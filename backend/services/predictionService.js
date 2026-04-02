const { getIssueSignalSummary, loadIssueSignals } = require('./issueIntelligenceService');

function buildPredictionFromSummary(summary) {
  const growingFast =
    summary.lastThreeHoursCount >= 3 &&
    summary.lastThreeHoursCount > summary.previousThreeHoursCount &&
    summary.weeklyGrowthPercent > 10;
  const repeatingQuickly = summary.lastSixHoursCount >= 4;
  const escalating = growingFast && repeatingQuickly;

  const trendDelta = summary.lastThreeHoursCount - summary.previousThreeHoursCount;
  const message = escalating
    ? `${summary.issueTypeLabel} is increasing rapidly in the last 3 hours and is likely to become critical.`
    : `${summary.issueTypeLabel} is not showing a strong escalation pattern right now.`;

  return {
    issue_type: summary.issueType,
    issue_type_label: summary.issueTypeLabel,
    escalating,
    current_window_count: summary.lastThreeHoursCount,
    previous_window_count: summary.previousThreeHoursCount,
    trend_delta: trendDelta,
    repeated_within_short_interval: repeatingQuickly,
    prediction: message,
  };
}

async function getPredictions(userId) {
  const summaries = await loadIssueSignals(userId);
  return summaries
    .map(buildPredictionFromSummary)
    .filter((entry) => entry.escalating)
    .sort((a, b) => b.trend_delta - a.trend_delta);
}

async function getPredictionForIssue(userId, issue) {
  return buildPredictionFromSummary(await getIssueSignalSummary(userId, issue));
}

module.exports = {
  getPredictionForIssue,
  getPredictions,
};
