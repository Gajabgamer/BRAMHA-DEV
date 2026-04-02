const supabase = require('../lib/supabaseClient');

const OUTCOME_WINDOW_LIMIT = 30;

function isMissingRelationError(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

async function listOutcomeRows(userId, filters = {}) {
  let query = supabase
    .from('agent_outcomes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(filters.limit || OUTCOME_WINDOW_LIMIT);

  if (filters.issueType) {
    query = query.eq('issue_type', filters.issueType);
  }

  if (filters.actionType) {
    query = query.eq('action_type', filters.actionType);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return data || [];
}

function summarizeOutcomes(rows) {
  const summary = {
    total: rows.length,
    positiveCount: 0,
    negativeCount: 0,
    neutralCount: 0,
    acceptCount: 0,
    rejectCount: 0,
    editCount: 0,
    successCount: 0,
    failureCount: 0,
  };

  for (const row of rows) {
    const outcome = String(row?.outcome || '').trim().toLowerCase();
    if (['accept', 'success', 'resolved'].includes(outcome)) {
      summary.positiveCount += 1;
    } else if (outcome === 'edit') {
      summary.positiveCount += 0.5;
      summary.neutralCount += 0.5;
    } else if (['reject', 'failure', 'suppressed'].includes(outcome)) {
      summary.negativeCount += 1;
    } else {
      summary.neutralCount += 1;
    }

    if (outcome === 'accept') summary.acceptCount += 1;
    if (outcome === 'reject') summary.rejectCount += 1;
    if (outcome === 'edit') summary.editCount += 1;
    if (outcome === 'success') summary.successCount += 1;
    if (outcome === 'failure') summary.failureCount += 1;
  }

  return summary;
}

function buildGuidance(summary, confidence) {
  if (!summary.total) {
    return {
      confidenceAdjustment: 0,
      adjustedConfidence: confidence,
      shouldSuppress: false,
      summary: 'No past outcome history yet, so default thresholds remain in place.',
      stats: summary,
    };
  }

  const positiveRate = summary.positiveCount / summary.total;
  const negativeRate = summary.negativeCount / summary.total;
  const editRate = summary.editCount / summary.total;
  const confidenceAdjustment = clamp(
    (positiveRate - 0.5) * 0.18 + editRate * 0.04 - negativeRate * 0.18,
    -0.2,
    0.12
  );
  const adjustedConfidence = clamp(confidence + confidenceAdjustment, 0, 1);
  const shouldSuppress = summary.total >= 4 && negativeRate >= 0.65;

  const adjustmentPoints = Math.round(confidenceAdjustment * 100);
  const direction =
    adjustmentPoints > 0 ? `raised by ${adjustmentPoints}` : adjustmentPoints < 0 ? `lowered by ${Math.abs(adjustmentPoints)}` : 'unchanged';

  return {
    confidenceAdjustment,
    adjustedConfidence,
    shouldSuppress,
    summary: `Outcome tuning ${direction} points from ${summary.total} past cases, with ${Math.round(
      positiveRate * 100
    )}% positive outcomes and ${Math.round(negativeRate * 100)}% negative outcomes.`,
    stats: summary,
  };
}

async function getOutcomeGuidance(userId, options = {}) {
  const confidence = clamp(
    options.confidence == null ? 0.5 : options.confidence,
    0,
    1
  );
  const rows = await listOutcomeRows(userId, {
    issueType: options.issueType,
    actionType: options.actionType,
    limit: options.limit || OUTCOME_WINDOW_LIMIT,
  });

  return buildGuidance(summarizeOutcomes(rows), confidence);
}

async function recordAgentOutcome(userId, input) {
  const payload = {
    user_id: userId,
    issue_id: input.issueId || null,
    issue_type: String(input.issueType || '').trim(),
    action_type: String(input.actionType || 'agent_decision').trim(),
    confidence:
      input.confidence == null ? null : clamp(Number(input.confidence), 0, 1),
    outcome: String(input.outcome || '').trim().toLowerCase(),
    repo_owner: input.repoOwner || null,
    repo_name: input.repoName || null,
    metadata: input.metadata || {},
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('agent_outcomes')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return payload;
    }
    throw error;
  }

  return data || payload;
}

async function getPreferredRepositoryFromOutcomes(userId, issueType) {
  const rows = await listOutcomeRows(userId, {
    issueType,
    limit: 60,
  });

  const scored = new Map();

  for (const row of rows) {
    const owner = String(row.repo_owner || '').trim();
    const name = String(row.repo_name || '').trim();
    if (!owner || !name) {
      continue;
    }

    const key = `${owner}/${name}`;
    const current = scored.get(key) || {
      owner,
      name,
      score: 0,
      positive: 0,
      negative: 0,
      total: 0,
    };
    const outcome = String(row.outcome || '').trim().toLowerCase();

    if (['accept', 'success', 'resolved'].includes(outcome)) {
      current.score += 2;
      current.positive += 1;
    } else if (outcome === 'edit') {
      current.score += 1;
      current.positive += 1;
    } else if (['reject', 'failure', 'suppressed'].includes(outcome)) {
      current.score -= 2;
      current.negative += 1;
    }

    current.total += 1;
    scored.set(key, current);
  }

  const best = Array.from(scored.values()).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return right.positive - left.positive;
  })[0];

  if (!best || best.score <= 0 || best.positive === 0) {
    return null;
  }

  return best;
}

module.exports = {
  getOutcomeGuidance,
  getPreferredRepositoryFromOutcomes,
  recordAgentOutcome,
};
