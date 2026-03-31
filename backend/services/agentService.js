const supabase = require('../lib/supabaseClient');
const { createCalendarEvent, findFreeSlot } = require('./calendarService');
const { isNoReplyAddress, sendReply } = require('./emailService');
const { createNotification } = require('./notificationService');
const { getDailyIssueStats } = require('../controllers/timelineController');
const { findGroup } = require('../lib/issueAggregator');
const { ensureUserRecords } = require('../lib/ensureUserRecords');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const AGENT_ID = 'product-pulse-agent-v1';
const AGENT_SENTINEL = '[Created by Agent]';
const DEFAULT_SETTINGS = {
  enabled: true,
  state: 'idle',
  lastRunAt: null,
  lastSummary: null,
};
const STOP_WORDS = new Set([
  'about',
  'after',
  'again',
  'been',
  'being',
  'between',
  'could',
  'does',
  'from',
  'have',
  'here',
  'into',
  'just',
  'like',
  'more',
  'most',
  'only',
  'over',
  'please',
  'really',
  'should',
  'than',
  'that',
  'their',
  'them',
  'there',
  'these',
  'they',
  'this',
  'through',
  'very',
  'were',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
  'your',
]);

function buildAcknowledgementMessage({ senderName, userEmail, sentiment }) {
  const name = String(senderName || '').trim() || 'there';
  const signature = userEmail ? `— ${userEmail}` : '— Product Pulse';
  const normalizedSentiment = String(sentiment || 'neutral').toLowerCase();

  if (normalizedSentiment === 'negative') {
    return [
      `Hi ${name},`,
      '',
      'We’re sorry you ran into this, and we really appreciate you taking the time to tell us about it.',
      '',
      'Our team has received your feedback and is reviewing the issue closely so we can work on a fix as soon as possible.',
      '',
      'If needed, we may follow up for a bit more context.',
      '',
      'Thanks again for helping us improve.',
      '',
      signature,
    ].join('\n');
  }

  if (normalizedSentiment === 'positive') {
    return [
      `Hi ${name},`,
      '',
      'Thank you for the kind feedback. We really appreciate you taking the time to share it with us.',
      '',
      'Our team has received your message, and it helps us understand what is working well for users.',
      '',
      'If there’s ever anything more you’d like to share, we’d love to hear it.',
      '',
      'Thanks again for supporting Product Pulse.',
      '',
      signature,
    ].join('\n');
  }

  return [
    `Hi ${name},`,
    '',
    'We’ve received your feedback and really appreciate you taking the time to share it.',
    '',
    'Our team is currently reviewing it, and we’ll work on resolving the issue as soon as possible.',
    '',
    'If needed, we may reach out for more details.',
    '',
    'Thanks again for helping us improve.',
    '',
    signature,
  ].join('\n');
}

function isMissingRelationError(error) {
  return (
    error?.code === '42P01' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('does not exist')
  );
}

function normalizeAgentAction(row) {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    actionType: row.action_type,
    reason: row.reason,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function parseAgentDescription(value) {
  const text = String(value || '');
  const createdByAgent = text.includes(AGENT_SENTINEL);
  return {
    createdByAgent,
    description: text.replace(`\n\n${AGENT_SENTINEL}`, '').trim(),
  };
}

async function getAgentSettings(userId) {
  const { data, error } = await supabase
    .from('agent_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }

  if (!data) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    enabled: data.autonomous_actions_enabled !== false,
    state: data.last_state || 'idle',
    lastRunAt: data.last_run_at || null,
    lastSummary: data.last_summary || null,
  };
}

async function updateAgentSettings(userId, patch) {
  const payload = {
    user_id: userId,
    autonomous_actions_enabled:
      patch.enabled === undefined ? true : Boolean(patch.enabled),
    last_state: patch.state || 'idle',
    last_run_at: patch.lastRunAt || null,
    last_summary: patch.lastSummary || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('agent_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        enabled: payload.autonomous_actions_enabled,
        state: payload.last_state,
        lastRunAt: payload.last_run_at,
        lastSummary: payload.last_summary,
      };
    }
    throw error;
  }

  return {
    enabled: data?.autonomous_actions_enabled !== false,
    state: data?.last_state || payload.last_state,
    lastRunAt: data?.last_run_at || payload.last_run_at,
    lastSummary: data?.last_summary || payload.last_summary,
  };
}

async function listAgentActions(userId, limit = 25) {
  const { data, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(normalizeAgentAction);
}

async function logAgentAction(userId, actionType, reason, metadata = {}) {
  const { data, error } = await supabase
    .from('agent_actions')
    .insert({
      user_id: userId,
      agent_id: AGENT_ID,
      action_type: actionType,
      reason,
      metadata,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        id: `temp-${Date.now()}`,
        userId,
        agentId: AGENT_ID,
        actionType,
        reason,
        metadata,
        createdAt: new Date().toISOString(),
      };
    }
    throw error;
  }

  return normalizeAgentAction(data);
}

async function notifyAgentAction(userId, input) {
  try {
    await createNotification(userId, {
      title: input.title,
      message: input.message,
      type: input.type,
      metadata: input.metadata || {},
    });
  } catch {
    // Notifications should never block core agent actions.
  }
}

function toPriority(weight) {
  if (weight >= 8) return 'high';
  if (weight >= 5) return 'medium';
  return 'low';
}

function toSeverity(weight) {
  if (weight >= 9) return 'critical';
  if (weight >= 6) return 'high';
  if (weight >= 4) return 'medium';
  return 'low';
}

function calculateSpike(timeline) {
  if (timeline.length < 2) {
    return null;
  }

  const latest = timeline[timeline.length - 1];
  const previous = timeline.slice(0, -1);
  const avg = previous.reduce((sum, row) => sum + row.issue_count, 0) / previous.length;

  if (avg <= 0) {
    return latest.issue_count >= 3
      ? {
          date: latest.date,
          issueCount: latest.issue_count,
          previousAverage: 0,
          growthPercent: 100,
        }
      : null;
  }

  const growthPercent = Number((((latest.issue_count - avg) / avg) * 100).toFixed(1));
  if (growthPercent <= 30) {
    return null;
  }

  return {
    date: latest.date,
    issueCount: latest.issue_count,
    previousAverage: Number(avg.toFixed(1)),
    growthPercent,
  };
}

function extractRepeatedKeywords(feedbackEvents) {
  const counts = new Map();

  for (const event of feedbackEvents) {
    const text = `${event.title || ''} ${event.body || ''}`.toLowerCase();
    const tokens = text.match(/[a-z]{4,}/g) || [];

    for (const token of tokens) {
      if (STOP_WORDS.has(token)) {
        continue;
      }
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([keyword, count]) => ({ keyword, count }));
}

function buildIssueCandidate(issue, unresolvedTicketCount, repeatedKeywords, spike) {
  const group = findGroup(`${issue.title || ''} ${issue.summary || ''}`);
  const reportCount = Number(issue.report_count || 0);
  const trendPercent = Number(issue.trend_percent || 0);
  const priority = String(issue.priority || 'LOW').toUpperCase();
  const issueText = `${issue.title || ''} ${issue.summary || ''}`.toLowerCase();
  const matchingKeywords = repeatedKeywords.filter(({ keyword }) =>
    issueText.includes(keyword)
  );

  let weight = 0;
  if (priority === 'HIGH') weight += 4;
  if (priority === 'MEDIUM') weight += 2;
  if (reportCount >= 15) weight += 4;
  else if (reportCount >= 8) weight += 3;
  else if (reportCount >= 4) weight += 2;
  if (trendPercent >= 45) weight += 3;
  else if (trendPercent >= 30) weight += 2;
  else if (trendPercent >= 15) weight += 1;
  if (unresolvedTicketCount > 0) weight += 2;
  if (matchingKeywords.length > 0) weight += 1;
  if (spike && issueText.includes('login')) weight += 1;

  const severity = toSeverity(weight);
  const actionRequired =
    severity === 'critical' ||
    severity === 'high' ||
    unresolvedTicketCount > 0 ||
    reportCount >= 8 ||
    trendPercent >= 30;

  const impact = reportCount >= 15 ? 'broad' : reportCount >= 6 ? 'noticeable' : 'localized';
  const reason = [
    `${issue.title} has ${reportCount} reports`,
    trendPercent > 0 ? `and is trending ${trendPercent}%` : null,
    unresolvedTicketCount > 0
      ? `with ${unresolvedTicketCount} unresolved ticket${unresolvedTicketCount === 1 ? '' : 's'}`
      : null,
    matchingKeywords[0] ? `while "${matchingKeywords[0].keyword}" keeps repeating in feedback` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    issue,
    group,
    severity,
    actionRequired,
    impact,
    userCount: reportCount,
    weight,
    repeatedKeywords: matchingKeywords,
    unresolvedTicketCount,
    reason,
  };
}

function buildFallbackRecommendation(candidate) {
  if (candidate.severity === 'critical') {
    return 'Escalate immediately, open an investigation ticket, and set a follow-up reminder for the team.';
  }

  if (candidate.severity === 'high') {
    return 'Create a triage ticket now and review fresh evidence before the next release window.';
  }

  return 'Continue monitoring this issue and keep a reminder in place until the trend stabilizes.';
}

async function getGroqReasoning(candidate, context) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      summary: buildFallbackRecommendation(candidate),
      action: candidate.actionRequired ? 'create_ticket_and_reminder' : 'monitor',
    };
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Analyze this issue and suggest what action should be taken in a product system. Be concise and actionable. Return strict JSON with keys summary and action.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            issue: {
              id: candidate.issue.id,
              title: candidate.issue.title,
              summary: candidate.issue.summary,
              priority: candidate.issue.priority,
              reportCount: candidate.issue.report_count,
              trendPercent: candidate.issue.trend_percent,
            },
            trend: context.spike,
            impact: candidate.impact,
            user_count: candidate.userCount,
            repeated_keywords: candidate.repeatedKeywords,
            unresolved_ticket_count: candidate.unresolvedTicketCount,
          }),
        },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    return {
      summary: buildFallbackRecommendation(candidate),
      action: candidate.actionRequired ? 'create_ticket_and_reminder' : 'monitor',
    };
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return {
      summary: buildFallbackRecommendation(candidate),
      action: candidate.actionRequired ? 'create_ticket_and_reminder' : 'monitor',
    };
  }

  try {
    const parsed = JSON.parse(content);
    return {
      summary: parsed.summary || buildFallbackRecommendation(candidate),
      action: parsed.action || (candidate.actionRequired ? 'create_ticket_and_reminder' : 'monitor'),
    };
  } catch {
    return {
      summary: buildFallbackRecommendation(candidate),
      action: candidate.actionRequired ? 'create_ticket_and_reminder' : 'monitor',
    };
  }
}

async function createAgentTicket(userId, candidate, reasoning) {
  const description = `${reasoning.summary}\n\n${AGENT_SENTINEL}`;
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      user_id: userId,
      title: `Investigate ${candidate.issue.title}`,
      description,
      status: 'open',
      priority: toPriority(candidate.weight),
      linked_issue_id: candidate.issue.id,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createAgentReminder(userId, candidate, ticketId, reasoning) {
  const hoursFromNow = candidate.severity === 'critical' ? 6 : candidate.severity === 'high' ? 12 : 24;
  const remindAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
  const description = `${reasoning.summary}\n\n${AGENT_SENTINEL}`;

  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: userId,
      title: `Follow up on ${candidate.issue.title}`,
      description,
      remind_at: remindAt,
      status: 'pending',
      linked_issue_id: candidate.issue.id,
      linked_ticket_id: ticketId || null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createAgentCalendarEvent(userId, candidate, ticketId, reasoning) {
  try {
    const preferredStart = new Date(
      Date.now() +
        (candidate.severity === 'critical' ? 2 : 6) * 60 * 60 * 1000
    );
    const slot = await findFreeSlot(userId, {
      earliestStart: preferredStart.toISOString(),
      durationMinutes: 30,
    });

    if (slot.skipped || !slot.startTime || !slot.endTime) {
      return {
        skipped: true,
        reason: slot.reason || 'No suitable calendar slot was available.',
        event: null,
      };
    }

    return createCalendarEvent(userId, {
      title: `Follow up: ${candidate.issue.title}`,
      description: [
        reasoning.summary,
        ticketId ? `Linked ticket: ${ticketId}` : null,
        `Issue reports: ${candidate.userCount}`,
        `Severity: ${candidate.severity}`,
      ]
        .filter(Boolean)
        .join('\n'),
      startTime: slot.startTime,
      endTime: slot.endTime,
    });
  } catch (error) {
    return {
      skipped: true,
      reason:
        error instanceof Error
          ? error.message
          : 'Calendar scheduling failed for this account.',
      event: null,
    };
  }
}

async function sendAgentReplies(userId, feedbackRows, existingActions) {
  if (!Array.isArray(feedbackRows) || feedbackRows.length === 0) {
    return [];
  }

  const replyCandidates = feedbackRows.filter((row) => {
    const metadata = row.metadata || {};
    const senderEmail = String(metadata.senderEmail || '').trim();

    return (
      row.source === 'gmail' &&
      row.replied !== true &&
      senderEmail &&
      !isNoReplyAddress(senderEmail)
    );
  });

  if (replyCandidates.length === 0) {
    return [];
  }

  const { data: userRecord, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  const actions = [];

  for (const feedback of replyCandidates) {
    if (hasRecentAction(existingActions, 'email_reply_sent', feedback.id)) {
      continue;
    }

    const metadata = feedback.metadata || {};
    let replyResult;

    try {
      replyResult = await sendReply({
        userId,
        to: metadata.senderEmail,
        subject: `Re: ${metadata.originalSubject || feedback.title || 'Your feedback'}`,
        message: buildAcknowledgementMessage({
          senderName: metadata.senderName,
          userEmail: userRecord?.email || null,
          sentiment: feedback.sentiment,
        }),
        threadId: metadata.threadId || null,
        inReplyTo: metadata.messageIdHeader || null,
        references: metadata.messageIdHeader || null,
      });
    } catch (error) {
      actions.push(
        await logAgentAction(
          userId,
          'email_reply_skipped',
          `Could not send a reply to ${metadata.senderEmail || 'unknown sender'}.`,
          {
            issueId: feedback.id,
            feedbackEventId: feedback.id,
            senderEmail: metadata.senderEmail || null,
            reason:
              error instanceof Error ? error.message : 'Reply sending failed.',
          }
        )
      );
      continue;
    }

    if (replyResult.skipped) {
      actions.push(
        await logAgentAction(
          userId,
          'email_reply_skipped',
          `Skipped reply for ${metadata.senderEmail || 'unknown sender'}.`,
          {
            issueId: feedback.id,
            feedbackEventId: feedback.id,
            senderEmail: metadata.senderEmail || null,
            reason: replyResult.reason,
          }
        )
      );
      continue;
    }

    const { error: updateError } = await supabase
      .from('feedback_events')
      .update({
        replied: true,
        metadata: {
          ...metadata,
          repliedAt: new Date().toISOString(),
          replyMessageId: replyResult.id || null,
        },
      })
      .eq('id', feedback.id)
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    const action = await logAgentAction(
      userId,
      'email_reply_sent',
      `Sent an acknowledgment reply to ${metadata.senderEmail}.`,
      {
        issueId: feedback.id,
        feedbackEventId: feedback.id,
        senderEmail: metadata.senderEmail || null,
        threadId: replyResult.threadId || metadata.threadId || null,
        replyMessageId: replyResult.id || null,
      }
    );
    actions.push(action);

    await notifyAgentAction(userId, {
      title: 'Reply sent by agent',
      message: `The agent acknowledged feedback from ${metadata.senderEmail}.`,
      type: 'email',
      metadata: action.metadata,
    });
  }

  return actions;
}

function hasRecentAction(actions, actionType, issueId) {
  return actions.some(
    (action) =>
      action.actionType === actionType &&
      action.metadata?.issueId === issueId &&
      Date.now() - new Date(action.createdAt).getTime() < 1000 * 60 * 60 * 18
  );
}

async function getAgentStatus(userId) {
  const [settings, actions] = await Promise.all([
    getAgentSettings(userId),
    listAgentActions(userId, 8),
  ]);

  const latestAction = actions[0] || null;
  const state = settings.enabled
    ? settings.state === 'processing'
      ? 'processing'
      : actions.length > 0
        ? 'active'
        : 'idle'
    : 'idle';

  return {
    enabled: settings.enabled,
    state,
    lastRunAt: settings.lastRunAt,
    latestBanner: settings.lastSummary,
    latestAction,
    actions,
    listening: settings.enabled,
  };
}

async function updateAgentEnabled(userId, enabled) {
  return updateAgentSettings(userId, {
    enabled,
    state: enabled ? 'active' : 'idle',
    lastRunAt: new Date().toISOString(),
    lastSummary: enabled ? 'Agent is active and listening to product signals.' : 'Agent is idle.',
  });
}

async function runAgent(user, options = {}) {
  const userId = typeof user === 'string' ? user : user?.id;
  if (!userId) {
    return { enabled: false, state: 'idle', actions: [] };
  }

  if (typeof user === 'object') {
    await ensureUserRecords(user);
  }

  const currentSettings = await getAgentSettings(userId);
  if (!currentSettings.enabled) {
    return {
      enabled: false,
      state: 'idle',
      actions: [],
      banner: 'Autonomous actions are disabled.',
    };
  }

  await updateAgentSettings(userId, {
    enabled: true,
    state: 'processing',
    lastRunAt: new Date().toISOString(),
    lastSummary: 'Agent is reviewing fresh feedback...',
  });

  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    const [
      { data: feedbackEvents, error: feedbackError },
      { data: issues, error: issuesError },
      { data: unresolvedTickets, error: ticketsError },
      { data: pendingReminders, error: remindersError },
      timeline,
      existingActions,
    ] = await Promise.all([
      supabase
        .from('feedback_events')
        .select('id, title, body, source, occurred_at, sentiment, metadata, replied')
        .eq('user_id', userId)
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(200),
      supabase
        .from('issues')
        .select('*')
        .eq('user_id', userId)
        .order('report_count', { ascending: false }),
      supabase
        .from('tickets')
        .select('id, title, description, status, priority, linked_issue_id, created_at, updated_at')
        .eq('user_id', userId)
        .neq('status', 'resolved'),
      supabase
        .from('reminders')
        .select('id, title, description, status, linked_issue_id, linked_ticket_id, remind_at')
        .eq('user_id', userId)
        .eq('status', 'pending'),
      getDailyIssueStats(userId),
      listAgentActions(userId, 50),
    ]);

    if (feedbackError && !isMissingRelationError(feedbackError)) throw feedbackError;
    if (issuesError && !isMissingRelationError(issuesError)) throw issuesError;
    if (ticketsError && !isMissingRelationError(ticketsError)) throw ticketsError;
    if (remindersError && !isMissingRelationError(remindersError)) throw remindersError;

    const feedback = feedbackEvents || [];
    const issueRows = issues || [];
    const openTickets = unresolvedTickets || [];
    const reminders = pendingReminders || [];
    const repeatedKeywords = extractRepeatedKeywords(feedback);
    const spike = calculateSpike(timeline || []);
    const candidates = issueRows
      .map((issue) => {
        const unresolvedTicketCount = openTickets.filter(
          (ticket) => ticket.linked_issue_id === issue.id
        ).length;
        return buildIssueCandidate(issue, unresolvedTicketCount, repeatedKeywords, spike);
      })
      .filter((candidate) => candidate.actionRequired)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2);

    const newActions = await sendAgentReplies(
      userId,
      Array.isArray(options.newFeedbackRows) ? options.newFeedbackRows : [],
      existingActions
    );

    if (spike && !hasRecentAction(existingActions, 'spike_detected', 'timeline-spike')) {
      const action = await logAgentAction(
        userId,
        'spike_detected',
        `Issue volume increased by ${spike.growthPercent}% on ${spike.date}.`,
        {
          issueId: 'timeline-spike',
          date: spike.date,
          issueCount: spike.issueCount,
          previousAverage: spike.previousAverage,
          growthPercent: spike.growthPercent,
        }
      );
      newActions.push(action);
      await notifyAgentAction(userId, {
        title: '🚨 Issue spike detected',
        message: `Issue volume increased by ${spike.growthPercent}% on ${spike.date}. The agent is monitoring for follow-up action.`,
        type: 'spike',
        metadata: action.metadata,
      });
    }

    for (const candidate of candidates) {
      const reasoning = await getGroqReasoning(candidate, { spike });
      const openTicketForIssue = openTickets.find(
        (ticket) => ticket.linked_issue_id === candidate.issue.id
      );
      const hasOpenTicket = Boolean(openTicketForIssue);
      const hasPendingReminder = reminders.some(
        (reminder) => reminder.linked_issue_id === candidate.issue.id
      );

      if (!hasRecentAction(existingActions, 'issue_detected', candidate.issue.id)) {
        newActions.push(
          await logAgentAction(userId, 'issue_detected', candidate.reason, {
            issueId: candidate.issue.id,
            title: candidate.issue.title,
            severity: candidate.severity,
            userCount: candidate.userCount,
            trendPercent: candidate.issue.trend_percent || 0,
            why: candidate.reason,
            reasoning: reasoning.summary,
          })
        );
      }

      let createdTicket = null;
      if (!hasOpenTicket && !hasRecentAction(existingActions, 'ticket_created', candidate.issue.id)) {
        createdTicket = await createAgentTicket(userId, candidate, reasoning);
        const action = await logAgentAction(
          userId,
          'ticket_created',
          `Created a ticket for ${candidate.issue.title}.`,
          {
            issueId: candidate.issue.id,
            ticketId: createdTicket.id,
            severity: candidate.severity,
            why: candidate.reason,
            reasoning: reasoning.summary,
          }
        );
        newActions.push(action);
        await notifyAgentAction(userId, {
          title: `🎟 Ticket created for ${candidate.issue.title}`,
          message: `${candidate.userCount} reports are linked to this issue. A ticket has been created automatically.`,
          type: 'ticket',
          metadata: action.metadata,
        });
      }

      if (
        !hasPendingReminder &&
        !hasRecentAction(existingActions, 'reminder_created', candidate.issue.id)
      ) {
        const reminder = await createAgentReminder(
          userId,
          candidate,
          createdTicket?.id || openTicketForIssue?.id || null,
          reasoning
        );
        const action = await logAgentAction(
          userId,
          'reminder_created',
          `Scheduled a follow-up reminder for ${candidate.issue.title}.`,
          {
            issueId: candidate.issue.id,
            ticketId: createdTicket?.id || openTicketForIssue?.id || null,
            reminderId: reminder.id,
            severity: candidate.severity,
            why: candidate.reason,
            reasoning: reasoning.summary,
          }
        );
        newActions.push(action);
        await notifyAgentAction(userId, {
          title: `⏰ Reminder scheduled for ${candidate.issue.title}`,
          message: `A follow-up reminder has been scheduled automatically so this issue is not missed.`,
          type: 'reminder',
          metadata: action.metadata,
        });
      }

      if (
        (candidate.severity === 'high' || candidate.severity === 'critical') &&
        !hasRecentAction(existingActions, 'calendar_event_created', candidate.issue.id) &&
        !hasRecentAction(existingActions, 'calendar_event_skipped', candidate.issue.id)
      ) {
        const calendarResult = await createAgentCalendarEvent(
          userId,
          candidate,
          createdTicket?.id || openTicketForIssue?.id || null,
          reasoning
        );

        if (calendarResult.skipped) {
          newActions.push(
            await logAgentAction(
              userId,
              'calendar_event_skipped',
              `Skipped calendar event for ${candidate.issue.title}.`,
              {
                issueId: candidate.issue.id,
                ticketId: createdTicket?.id || openTicketForIssue?.id || null,
                severity: candidate.severity,
                why: candidate.reason,
                reason: calendarResult.reason,
              }
            )
          );
        } else {
          newActions.push(
            await logAgentAction(
              userId,
              'calendar_event_created',
              `Scheduled a calendar follow-up for ${candidate.issue.title}.`,
              {
                issueId: candidate.issue.id,
                ticketId: createdTicket?.id || openTicketForIssue?.id || null,
                severity: candidate.severity,
                why: candidate.reason,
                eventId: calendarResult.event?.id || null,
                eventLink: calendarResult.event?.htmlLink || null,
              }
            )
          );
        }
      }
    }

    const highlightAction =
      newActions.find((action) => action.actionType === 'ticket_created') ||
      newActions.find((action) => action.actionType === 'reminder_created') ||
      newActions[0];

    const latestSummary =
      highlightAction?.reason ||
      (candidates[0]
        ? `Agent is monitoring ${candidates[0].issue.title} after a fresh signal change.`
        : 'Agent is active and listening to feedback.');

    await updateAgentSettings(userId, {
      enabled: true,
      state: 'active',
      lastRunAt: new Date().toISOString(),
      lastSummary: latestSummary,
    });

    return {
      enabled: true,
      state: 'active',
      actions: newActions,
      banner: latestSummary,
    };
  } catch (error) {
    await updateAgentSettings(userId, {
      enabled: currentSettings.enabled,
      state: 'idle',
      lastRunAt: new Date().toISOString(),
      lastSummary: 'Agent is idle after a processing error.',
    });
    throw error;
  }
}

module.exports = {
  AGENT_ID,
  AGENT_SENTINEL,
  getAgentSettings,
  getAgentStatus,
  listAgentActions,
  parseAgentDescription,
  runAgent,
  updateAgentEnabled,
};
