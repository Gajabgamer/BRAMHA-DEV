const supabase = require('../lib/supabaseClient');
const {
  getGitHubConnection,
  getRepository,
  listRepositoriesForUser,
} = require('./githubService');
const { getRepoStructure } = require('./repoStructureService');
const { normalizeIssueType } = require('./learningService');
const { getPreferredRepositoryFromOutcomes } = require('./selfHealingService');
const { extractKeywords } = require('./codeSearchService');

function isMissingRelationError(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

async function getGitHubSettings(userId) {
  const { data, error } = await supabase
    .from('github_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        user_id: userId,
        code_insights_enabled: true,
      };
    }
    throw error;
  }

  return (
    data || {
      user_id: userId,
      code_insights_enabled: true,
    }
  );
}

async function updateGitHubSettings(userId, updates) {
  const payload = {
    user_id: userId,
    code_insights_enabled:
      typeof updates.codeInsightsEnabled === 'boolean'
        ? updates.codeInsightsEnabled
        : true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('github_settings')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function listRepoMappings(userId) {
  const { data, error } = await supabase
    .from('repo_mappings')
    .select('*')
    .eq('user_id', userId)
    .order('issue_type', { ascending: true });

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return data || [];
}

async function getRepoStats(userId) {
  const { data, error } = await supabase
    .from('repo_stats')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return data || [];
}

async function recordRepoStat(userId, input) {
  const existingStats = await getRepoStats(userId);
  const existing = existingStats.find(
    (entry) =>
      entry.issue_type === input.issueType &&
      entry.repo_owner === input.repoOwner &&
      entry.repo_name === input.repoName
  );

  const payload = {
    user_id: userId,
    issue_type: input.issueType,
    repo_owner: input.repoOwner,
    repo_name: input.repoName,
    success_count:
      Number(existing?.success_count || 0) + (input.outcome === 'success' ? 1 : 0),
    failure_count:
      Number(existing?.failure_count || 0) + (input.outcome === 'failure' ? 1 : 0),
    last_used_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('repo_stats')
    .upsert(payload, { onConflict: 'user_id,issue_type,repo_owner,repo_name' })
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

function computePastSuccessScore(stat) {
  if (!stat) return 0;
  const successes = Number(stat.success_count || 0);
  const failures = Number(stat.failure_count || 0);
  const total = successes + failures;
  if (!total) return 0;
  return Number(((successes / total) * 10).toFixed(2));
}

function computeRuleScore(issue, repository, issueType, repoStructure = null) {
  const keywords = extractKeywords(issue.title, issue.description || issue.summary || '');
  const haystack = `${repository.owner}/${repository.name}`.toLowerCase();
  const issueText = `${issue.title || ''} ${issue.summary || ''}`.toLowerCase();
  const keywordMatch = keywords.filter((keyword) => haystack.includes(keyword)).length * 4;
  const structureScore = Array.isArray(repoStructure?.modules)
    ? repoStructure.modules.reduce((sum, module) => {
        const matches = (module.matchedKeywords || []).filter(
          (keyword) =>
            issueText.includes(keyword) || keywords.includes(keyword)
        ).length;
        return sum + matches * Math.max(1, Math.round(Number(module.confidence || 0) * 4));
      }, 0)
    : 0;
  const keyFileScore = Array.isArray(repoStructure?.keyFiles)
    ? repoStructure.keyFiles.reduce((sum, path) => {
        const normalizedPath = String(path || '').toLowerCase();
        const matches = keywords.filter((keyword) => normalizedPath.includes(keyword)).length;
        return sum + matches * 2;
      }, 0)
    : 0;
  const fileMatch =
    (haystack.includes(issueType) ? 5 : 0) +
    (issueText.includes('auth') && haystack.includes('auth') ? 4 : 0) +
    (issueText.includes('login') && haystack.includes('login') ? 4 : 0) +
    (issueText.includes('payment') && haystack.includes('billing') ? 4 : 0);

  return {
    keywordMatch,
    fileMatch: fileMatch + structureScore + keyFileScore,
    total: keywordMatch + fileMatch + structureScore + keyFileScore,
  };
}

async function upsertRepoMapping(userId, issueType, repoOwner, repoName) {
  const normalizedIssueType = normalizeIssueType({
    title: issueType,
    summary: issueType,
  });

  const connection = await getGitHubConnection(userId);
  if (!connection) {
    throw new Error('Connect GitHub before saving repository mappings.');
  }

  const repository = await getRepository(connection.accessToken, repoOwner, repoName);

  const { data, error } = await supabase
    .from('repo_mappings')
    .upsert(
      {
        user_id: userId,
        issue_type: normalizedIssueType.slug,
        repo_owner: repository.owner?.login || repoOwner,
        repo_name: repository.name || repoName,
        repo_default_branch: repository.default_branch || 'main',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,issue_type' }
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function deleteRepoMapping(userId, issueType) {
  const normalizedIssueType = normalizeIssueType({
    title: issueType,
    summary: issueType,
  });

  const { error } = await supabase
    .from('repo_mappings')
    .delete()
    .eq('user_id', userId)
    .eq('issue_type', normalizedIssueType.slug);

  if (error && !isMissingRelationError(error)) {
    throw error;
  }

  return { success: true };
}

async function resolveRepositoryForIssue(userId, issue, options = {}) {
  const connection = await getGitHubConnection(userId);
  if (!connection) {
    throw new Error('Connect GitHub before using code insights.');
  }

  if (options.repoOwner && options.repoName) {
    const repository = await getRepository(
      connection.accessToken,
      options.repoOwner,
      options.repoName
    );

    return {
      source: 'override',
      owner: repository.owner?.login || options.repoOwner,
      name: repository.name || options.repoName,
      defaultBranch: repository.default_branch || 'main',
      connection,
      issueType: normalizeIssueType(issue).slug,
    };
  }

  const issueType = normalizeIssueType(issue).slug;
  const mappings = await listRepoMappings(userId);
  const mapping = mappings.find((entry) => entry.issue_type === issueType);

  if (mapping?.repo_owner && mapping?.repo_name) {
    return {
      source: 'mapping',
      owner: mapping.repo_owner,
      name: mapping.repo_name,
      defaultBranch: mapping.repo_default_branch || 'main',
      connection,
      issueType,
    };
  }

  if (!connection.repoOwner || !connection.repoName) {
    throw new Error('Select a primary GitHub repository before using code insights.');
  }

  const [repoStats, learnedRepository, repositories] = await Promise.all([
    getRepoStats(userId),
    getPreferredRepositoryFromOutcomes(userId, issueType),
    listRepositoriesForUser(userId).catch(() => []),
  ]);

  const candidateMap = new Map();
  const addCandidate = (candidate, source) => {
    if (!candidate?.owner || !candidate?.name) return;
    const key = `${candidate.owner}/${candidate.name}`;
    if (!candidateMap.has(key)) {
      candidateMap.set(key, {
        owner: candidate.owner,
        name: candidate.name,
        defaultBranch: candidate.defaultBranch || candidate.default_branch || 'main',
        source,
      });
    }
  };

  addCandidate(
    {
      owner: connection.repoOwner,
      name: connection.repoName,
      defaultBranch: connection.defaultBranch || 'main',
    },
    'primary'
  );

  for (const entry of mappings) {
    addCandidate(
      {
        owner: entry.repo_owner,
        name: entry.repo_name,
        defaultBranch: entry.repo_default_branch || 'main',
      },
      'mapping_related'
    );
  }

  addCandidate(
    learnedRepository
      ? {
          owner: learnedRepository.owner,
          name: learnedRepository.name,
          defaultBranch: learnedRepository.defaultBranch || 'main',
        }
      : null,
    'learned'
  );

  for (const repository of repositories.slice(0, 25)) {
    addCandidate(repository, 'candidate');
  }

  const structures = await Promise.all(
    Array.from(candidateMap.values()).map((candidate) =>
      getRepoStructure(userId, {
        repoOwner: candidate.owner,
        repoName: candidate.name,
        defaultBranch: candidate.defaultBranch,
      }).catch(() => null)
    )
  );

  const candidates = Array.from(candidateMap.values()).map((candidate, index) => {
    const stat = repoStats.find(
      (entry) =>
        entry.issue_type === issueType &&
        entry.repo_owner === candidate.owner &&
        entry.repo_name === candidate.name
    );
    const ruleScore = computeRuleScore(issue, candidate, issueType, structures[index]);
    const pastSuccess = computePastSuccessScore(stat);
    return {
      ...candidate,
      structure: structures[index],
      score: ruleScore.keywordMatch + ruleScore.fileMatch + pastSuccess,
      scoreBreakdown: {
        keywordMatch: ruleScore.keywordMatch,
        fileMatch: ruleScore.fileMatch,
        pastSuccess,
      },
    };
  });

  const best = candidates.sort((left, right) => right.score - left.score)[0];

  return {
    source: best?.source || 'primary',
    owner: best?.owner || connection.repoOwner,
    name: best?.name || connection.repoName,
    defaultBranch: best?.defaultBranch || connection.defaultBranch || 'main',
    connection,
    issueType,
    routingScore: best?.score || 0,
    repoStructure: best?.structure || null,
    routingBreakdown: best?.scoreBreakdown || {
      keywordMatch: 0,
      fileMatch: 0,
      pastSuccess: 0,
    },
  };
}

module.exports = {
  deleteRepoMapping,
  getGitHubSettings,
  getRepoStats,
  listRepoMappings,
  recordRepoStat,
  resolveRepositoryForIssue,
  updateGitHubSettings,
  upsertRepoMapping,
};
