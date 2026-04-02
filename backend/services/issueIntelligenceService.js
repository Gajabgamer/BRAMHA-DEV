const supabase = require('../lib/supabaseClient');
const { findGroup } = require('../lib/issueAggregator');

const CACHE_TTL_MS = 1000 * 60 * 2;
const signalCache = new Map();

function isMissingRelationError(error) {
  return (
    error?.code === '42P01' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('does not exist')
  );
}

function toHourKey(value) {
  const date = new Date(value);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

function toDayKey(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function getPastDayKeys(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (index + 1));
    return date.toISOString().slice(0, 10);
  }).reverse();
}

function getTypeForText(title, body) {
  const group = findGroup(`${title || ''} ${body || ''}`);
  return {
    slug: group.slug,
    title: group.title,
    category: group.category,
  };
}

function emptySignalRow(type) {
  return {
    issueType: type.slug,
    issueTypeLabel: type.title,
    category: type.category,
    events: [],
    issues: [],
    sources: new Set(),
    hourlyCounts: new Map(),
    dailyCounts: new Map(),
    resolutionTimes: [],
  };
}

function ensureSignalRow(map, type) {
  if (!map.has(type.slug)) {
    map.set(type.slug, emptySignalRow(type));
  }

  return map.get(type.slug);
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentageChange(current, previous) {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildSignalSummary(row) {
  const now = Date.now();
  const oneHourAgo = now - 1000 * 60 * 60;
  const threeHoursAgo = now - 1000 * 60 * 60 * 3;
  const sixHoursAgo = now - 1000 * 60 * 60 * 6;
  const sevenDaysAgo = now - 1000 * 60 * 60 * 24 * 7;
  const previousSevenDaysAgo = now - 1000 * 60 * 60 * 24 * 14;

  let lastHourCount = 0;
  let lastThreeHoursCount = 0;
  let previousThreeHoursCount = 0;
  let lastSixHoursCount = 0;
  let lastSevenDaysCount = 0;
  let previousSevenDaysCount = 0;

  for (const event of row.events) {
    const eventTime = new Date(event.occurred_at).getTime();

    if (eventTime >= oneHourAgo) lastHourCount += 1;
    if (eventTime >= threeHoursAgo) lastThreeHoursCount += 1;
    if (eventTime >= sixHoursAgo) lastSixHoursCount += 1;
    if (eventTime >= sevenDaysAgo) lastSevenDaysCount += 1;
    if (eventTime < threeHoursAgo && eventTime >= sixHoursAgo) previousThreeHoursCount += 1;
    if (eventTime < sevenDaysAgo && eventTime >= previousSevenDaysAgo) {
      previousSevenDaysCount += 1;
    }
  }

  const baselineDays = getPastDayKeys(7);
  const baselineDailyCounts = baselineDays.map((key) => row.dailyCounts.get(key) || 0);
  const baselineDailyAverage = average(baselineDailyCounts);
  const baselineHourlyRate = baselineDailyAverage / 24;
  const currentHourlyRate = Math.max(lastHourCount, lastSixHoursCount / 6);
  const weeklyGrowthPercent = percentageChange(lastSevenDaysCount, previousSevenDaysCount);
  const latestIssue = [...row.issues].sort((a, b) => {
    const reportDelta = Number(b.report_count || 0) - Number(a.report_count || 0);
    if (reportDelta !== 0) {
      return reportDelta;
    }

    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  })[0] || null;

  return {
    issueType: row.issueType,
    issueTypeLabel: row.issueTypeLabel,
    category: row.category,
    latestIssue,
    sourceCount: row.sources.size,
    frequencyCount: latestIssue
      ? Number(latestIssue.report_count || 0)
      : Math.max(lastSevenDaysCount, row.events.length),
    lastHourCount,
    lastThreeHoursCount,
    previousThreeHoursCount,
    lastSixHoursCount,
    lastSevenDaysCount,
    previousSevenDaysCount,
    baselineDailyAverage: Number(baselineDailyAverage.toFixed(2)),
    baselineHourlyRate: Number(baselineHourlyRate.toFixed(3)),
    currentHourlyRate: Number(currentHourlyRate.toFixed(3)),
    weeklyGrowthPercent,
    avgResolutionTimeHours: Number(average(row.resolutionTimes).toFixed(1)),
    events: row.events,
  };
}

async function loadIssueSignals(userId) {
  const cached = signalCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const feedbackSince = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
  const [
    { data: feedbackEvents, error: feedbackError },
    { data: issues, error: issuesError },
    { data: tickets, error: ticketsError },
  ] = await Promise.all([
    supabase
      .from('feedback_events')
      .select('id, title, body, source, occurred_at')
      .eq('user_id', userId)
      .gte('occurred_at', feedbackSince)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('issues')
      .select('id, title, summary, report_count, sources, source_breakdown, trend_percent, created_at')
      .eq('user_id', userId),
    supabase
      .from('tickets')
      .select('id, linked_issue_id, created_at, updated_at, status')
      .eq('user_id', userId)
      .eq('status', 'resolved'),
  ]);

  if (feedbackError && !isMissingRelationError(feedbackError)) throw feedbackError;
  if (issuesError && !isMissingRelationError(issuesError)) throw issuesError;
  if (ticketsError && !isMissingRelationError(ticketsError)) throw ticketsError;

  const signalsByType = new Map();
  const issuesById = new Map();

  for (const issue of issues || []) {
    issuesById.set(issue.id, issue);
    const type = getTypeForText(issue.title, issue.summary);
    const row = ensureSignalRow(signalsByType, type);
    row.issues.push(issue);

    const issueSources = Array.isArray(issue.sources)
      ? issue.sources
      : Object.keys(issue.source_breakdown || {});
    for (const source of issueSources) {
      row.sources.add(source);
    }
  }

  for (const event of feedbackEvents || []) {
    const type = getTypeForText(event.title, event.body);
    const row = ensureSignalRow(signalsByType, type);
    row.events.push(event);
    row.sources.add(event.source);
    row.hourlyCounts.set(
      toHourKey(event.occurred_at),
      (row.hourlyCounts.get(toHourKey(event.occurred_at)) || 0) + 1
    );
    row.dailyCounts.set(
      toDayKey(event.occurred_at),
      (row.dailyCounts.get(toDayKey(event.occurred_at)) || 0) + 1
    );
  }

  for (const ticket of tickets || []) {
    const linkedIssue = issuesById.get(ticket.linked_issue_id);
    if (!linkedIssue) {
      continue;
    }

    const type = getTypeForText(linkedIssue.title, linkedIssue.summary);
    const row = ensureSignalRow(signalsByType, type);
    const durationHours =
      (new Date(ticket.updated_at).getTime() - new Date(ticket.created_at).getTime()) /
      (1000 * 60 * 60);
    if (!Number.isNaN(durationHours) && durationHours >= 0) {
      row.resolutionTimes.push(durationHours);
    }
  }

  const summaries = Array.from(signalsByType.values())
    .map(buildSignalSummary)
    .sort((a, b) => b.frequencyCount - a.frequencyCount);

  signalCache.set(userId, {
    value: summaries,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return summaries;
}

async function getIssueSignalSummary(userId, issue) {
  const issueType = getTypeForText(issue?.title, issue?.summary);
  const signals = await loadIssueSignals(userId);
  const match = signals.find((entry) => entry.issueType === issueType.slug);

  return (
    match || {
      issueType: issueType.slug,
      issueTypeLabel: issueType.title,
      category: issueType.category,
      latestIssue: issue || null,
      sourceCount: Array.isArray(issue?.sources)
        ? issue.sources.length
        : Object.keys(issue?.source_breakdown || {}).length,
      frequencyCount: Number(issue?.report_count || 0),
      lastHourCount: 0,
      lastThreeHoursCount: 0,
      previousThreeHoursCount: 0,
      lastSixHoursCount: 0,
      lastSevenDaysCount: Number(issue?.report_count || 0),
      previousSevenDaysCount: 0,
      baselineDailyAverage: 0,
      baselineHourlyRate: 0,
      currentHourlyRate: 0,
      weeklyGrowthPercent: Number(issue?.trend_percent || 0),
      avgResolutionTimeHours: 0,
      events: [],
    }
  );
}

function clearSignalCache(userId) {
  if (!userId) {
    signalCache.clear();
    return;
  }

  signalCache.delete(userId);
}

module.exports = {
  clearSignalCache,
  getIssueSignalSummary,
  loadIssueSignals,
};
