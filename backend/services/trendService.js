const { getIssueSignalSummary, loadIssueSignals } = require('./issueIntelligenceService');

function getTrendDirection(growthPercent) {
  if (growthPercent >= 12) return 'up';
  if (growthPercent <= -12) return 'down';
  return 'stable';
}

function buildTrendFromSummary(summary) {
  const trendDirection = getTrendDirection(summary.weeklyGrowthPercent);
  const directionLabel =
    trendDirection === 'up' ? 'increased' : trendDirection === 'down' ? 'decreased' : 'remained stable';

  return {
    issue_type: summary.issueType,
    issue_type_label: summary.issueTypeLabel,
    frequency_count: summary.frequencyCount,
    resolution_time_hours: summary.avgResolutionTimeHours,
    trend_direction: trendDirection,
    trend_growth_percent: summary.weeklyGrowthPercent,
    summary: `${summary.issueTypeLabel} ${directionLabel} by ${Math.abs(
      Math.round(summary.weeklyGrowthPercent)
    )}% this week`,
  };
}

async function getTrends(userId) {
  const summaries = await loadIssueSignals(userId);
  return summaries
    .map(buildTrendFromSummary)
    .sort((a, b) => Math.abs(b.trend_growth_percent) - Math.abs(a.trend_growth_percent));
}

async function getTrendForIssue(userId, issue) {
  return buildTrendFromSummary(await getIssueSignalSummary(userId, issue));
}

module.exports = {
  getTrendForIssue,
  getTrends,
};
