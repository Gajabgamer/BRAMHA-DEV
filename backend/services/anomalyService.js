const { getIssueSignalSummary, loadIssueSignals } = require('./issueIntelligenceService');

function toSpikeLevel(ratio) {
  if (ratio >= 4) return 'high';
  if (ratio >= 3) return 'medium';
  return 'low';
}

function buildAnomalyFromSummary(summary) {
  const baselineHourly = summary.baselineHourlyRate;
  const currentHourly = summary.currentHourlyRate;
  const spikeRatio =
    baselineHourly > 0
      ? Number((currentHourly / baselineHourly).toFixed(2))
      : currentHourly >= 1
        ? 3
        : 0;

  const spikeDetected =
    currentHourly > 0 &&
    ((baselineHourly > 0 && currentHourly > baselineHourly * 2) ||
      (baselineHourly === 0 && summary.lastHourCount >= 2));

  return {
    issue_type: summary.issueType,
    issue_type_label: summary.issueTypeLabel,
    spike_detected: spikeDetected,
    spike_level: spikeDetected ? toSpikeLevel(spikeRatio) : 'none',
    baseline_hourly_rate: summary.baselineHourlyRate,
    current_hourly_rate: summary.currentHourlyRate,
    last_hour_count: summary.lastHourCount,
    last_six_hours_count: summary.lastSixHoursCount,
    spike_ratio: spikeRatio,
  };
}

async function getAnomalies(userId) {
  const summaries = await loadIssueSignals(userId);
  return summaries
    .map(buildAnomalyFromSummary)
    .filter((entry) => entry.spike_detected)
    .sort((a, b) => b.spike_ratio - a.spike_ratio);
}

async function getAnomalyForIssue(userId, issue) {
  return buildAnomalyFromSummary(await getIssueSignalSummary(userId, issue));
}

module.exports = {
  getAnomalies,
  getAnomalyForIssue,
};
