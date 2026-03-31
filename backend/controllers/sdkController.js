const supabase = require('../lib/supabaseClient');
const { insertFeedbackEventsDeduped } = require('../lib/feedbackDedup');
const { rebuildIssuesFromFeedback } = require('../lib/issueAggregator');
const { extractLocation } = require('../services/locationService');
const { resolveUserIdFromSdkApiKey } = require('../lib/sdkAuth');
const { normalizeEmail, sendReply } = require('../services/emailService');
const { runAgent } = require('../services/agentService');

async function resolveSdkUser(req) {
  const apiKey = String(req.headers['x-product-pulse-key'] || req.body?.apiKey || '').trim();
  const userId = resolveUserIdFromSdkApiKey(apiKey);

  if (!userId) {
    return { error: 'Invalid SDK API key.', user: null };
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user) {
    return { error: 'SDK account not found.', user: null };
  }

  return { error: null, user };
}

async function insertFeedbackEvent(row) {
  return insertFeedbackEventsDeduped(row.user_id, [row], {
    logLabel: row.source,
  });
}

function normalizeUrl(value) {
  const url = String(value || '').trim();
  return url || null;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function normalizeTimestamp(value) {
  const parsed = value ? new Date(value) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function buildSdkAcknowledgementMessage({ name, userEmail, sentiment }) {
  const greetingName = name || 'there';
  const signature = `— ${userEmail || 'Product Pulse'}`;
  const normalizedSentiment = String(sentiment || 'neutral').toLowerCase();

  if (normalizedSentiment === 'negative') {
    return [
      `Hi ${greetingName},`,
      '',
      'We’re sorry you ran into this, and we really appreciate you taking the time to share it with us.',
      '',
      'Our team has received your feedback and is reviewing the issue carefully so we can work on it as soon as possible.',
      '',
      'If needed, we may reach out for a little more detail.',
      '',
      'Thanks again for helping us improve.',
      '',
      signature,
    ].join('\n');
  }

  if (normalizedSentiment === 'positive') {
    return [
      `Hi ${greetingName},`,
      '',
      'Thank you for the kind feedback. We really appreciate you taking the time to share it with us.',
      '',
      'Our team has received your message, and it helps us understand what users are loving.',
      '',
      'If you ever have more to share, we’d love to hear from you.',
      '',
      'Thanks again for your support.',
      '',
      signature,
    ].join('\n');
  }

  return [
    `Hi ${greetingName},`,
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

async function postSdkEvent(req, res) {
  try {
    const { user, error: userError } = await resolveSdkUser(req);
    if (userError) {
      return res.status(401).json({ error: userError });
    }

    const event = normalizeText(req.body?.event);
    if (!event) {
      return res.status(400).json({ error: 'Event name is required.' });
    }

    const url = normalizeUrl(req.body?.url);
    const timestamp = normalizeTimestamp(req.body?.timestamp);
    const data = req.body?.data && typeof req.body.data === 'object' ? req.body.data : {};
    const serialized = JSON.stringify(data);

    const insertResult = await insertFeedbackEvent({
      user_id: user.id,
      source: 'sdk_event',
      external_id: req.body?.event_id ? String(req.body.event_id).trim() : null,
      title: `Event: ${event}`,
      body: serialized.length > 4000 ? serialized.slice(0, 4000) : serialized || event,
      author: 'website_visitor',
      url,
      occurred_at: timestamp,
      sentiment: 'neutral',
      location: extractLocation({
        source: 'sdk_event',
        title: event,
        body: serialized,
        author: 'website_visitor',
        metadata: { url },
      }),
      metadata: {
        isProductFeedback: false,
        event,
        data,
        url,
        userAgent: normalizeText(req.body?.userAgent),
      },
    });

    return res.status(202).json({
      success: true,
      fetched: 1,
      inserted: insertResult.inserted,
      duplicatesSkipped: insertResult.duplicatesSkipped,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to track event.',
    });
  }
}

async function postSdkFeedback(req, res) {
  try {
    const { user, error: userError } = await resolveSdkUser(req);
    if (userError) {
      return res.status(401).json({ error: userError });
    }

    const message = normalizeText(req.body?.message);
    if (!message) {
      return res.status(400).json({ error: 'Feedback message is required.' });
    }

    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const url = normalizeUrl(req.body?.url);
    const timestamp = normalizeTimestamp(req.body?.timestamp);
    const author = name || email || 'website_visitor';

    const insertResult = await insertFeedbackEvent({
      user_id: user.id,
      source: 'sdk_feedback',
      external_id: req.body?.feedback_id ? String(req.body.feedback_id).trim() : null,
      title: 'Website feedback',
      body: message,
      author,
      author_email: email,
      url,
      occurred_at: timestamp,
      sentiment: 'neutral',
      location: extractLocation({
        source: 'sdk_feedback',
        title: 'Website feedback',
        body: message,
        author,
        metadata: { url, authorEmail: email },
      }),
      replied: false,
      metadata: {
        isProductFeedback: true,
        url,
        senderName: name || null,
        senderEmail: email,
        originalSubject: 'Website feedback',
        userAgent: normalizeText(req.body?.userAgent),
      },
    });

    if (insertResult.inserted > 0) {
      await rebuildIssuesFromFeedback(user.id);
      if (email) {
        try {
          const replyResult = await sendReply({
            userId: user.id,
            to: email,
            subject: 'Re: Website feedback',
            message: buildSdkAcknowledgementMessage({
              name,
              userEmail: user.email || null,
              sentiment: insertResult.rows[0]?.sentiment || 'neutral',
            }),
          });

          if (!replyResult.skipped && insertResult.rows[0]?.unique_key) {
            await supabase
              .from('feedback_events')
              .update({
                replied: true,
                metadata: {
                  ...(insertResult.rows[0].metadata || {}),
                  senderName: name || null,
                  senderEmail: email,
                  repliedAt: new Date().toISOString(),
                  replyMessageId: replyResult.id || null,
                },
              })
              .eq('unique_key', insertResult.rows[0].unique_key)
              .eq('user_id', user.id);
          }
        } catch {
          // Best effort for hackathon-friendly SDK replies.
        }
      }

      await runAgent(user, {
        newFeedbackRows: insertResult.rows,
      });
    }

    return res.status(201).json({
      success: true,
      fetched: 1,
      inserted: insertResult.inserted,
      duplicatesSkipped: insertResult.duplicatesSkipped,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to submit feedback.',
    });
  }
}

async function postSdkError(req, res) {
  try {
    const { user, error: userError } = await resolveSdkUser(req);
    if (userError) {
      return res.status(401).json({ error: userError });
    }

    const errorMessage = normalizeText(req.body?.error_message);
    if (!errorMessage) {
      return res.status(400).json({ error: 'Error message is required.' });
    }

    const url = normalizeUrl(req.body?.url);
    const stack = normalizeText(req.body?.stack);
    const timestamp = normalizeTimestamp(req.body?.timestamp);

    const insertResult = await insertFeedbackEvent({
      user_id: user.id,
      source: 'sdk_error',
      external_id: req.body?.error_id ? String(req.body.error_id).trim() : null,
      title: 'Website error',
      body: stack ? `${errorMessage}\n\n${stack}` : errorMessage,
      author: 'website_runtime',
      url,
      occurred_at: timestamp,
      sentiment: 'negative',
      location: extractLocation({
        source: 'sdk_error',
        title: 'Website error',
        body: errorMessage,
        author: 'website_runtime',
        metadata: { url },
      }),
      metadata: {
        isProductFeedback: true,
        stack,
        url,
        userAgent: normalizeText(req.body?.userAgent),
      },
    });

    if (insertResult.inserted > 0) {
      await rebuildIssuesFromFeedback(user.id);
      await runAgent(user);
    }

    return res.status(201).json({
      success: true,
      fetched: 1,
      inserted: insertResult.inserted,
      duplicatesSkipped: insertResult.duplicatesSkipped,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to capture error.',
    });
  }
}

module.exports = {
  postSdkEvent,
  postSdkFeedback,
  postSdkError,
};
