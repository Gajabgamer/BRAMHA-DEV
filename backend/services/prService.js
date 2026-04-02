const {
  githubRequest,
  getGitHubConnection,
  getRepository,
  getSelectedRepository,
} = require('./githubService');
const { fetchRepositoryFile } = require('./codeSearchService');

function toBase64(value) {
  return Buffer.from(String(value || ''), 'utf8').toString('base64');
}

function sanitizeBranchSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function buildBranchName(issue) {
  const label = sanitizeBranchSegment(issue.title || issue.id || 'issue-fix') || 'issue-fix';
  return `codex/${label}-${Date.now()}`;
}

function normalizeDiff(patch) {
  return String(patch || '').replace(/\r/g, '').trim();
}

function buildPullRequestBody(issue, description = {}) {
  const summary = String(description.summary || issue.summary || issue.description || issue.title).trim();
  const rootCause = String(description.rootCause || '').trim();
  const changes = Array.isArray(description.changes)
    ? description.changes.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const impact = String(description.impact || '').trim();
  const confidence = Number(description.confidence);

  const sections = [
    `This PR was generated from Product Pulse issue insight for **${issue.title}**.`,
    '',
    '## Summary',
    summary,
  ];

  if (rootCause) {
    sections.push('', '## Root Cause', rootCause);
  }

  if (changes.length > 0) {
    sections.push('', '## Changes', ...changes.map((item) => `- ${item}`));
  }

  if (impact) {
    sections.push('', '## Impact', impact);
  }

  if (Number.isFinite(confidence)) {
    sections.push('', '## Confidence', `${confidence.toFixed(1)}%`);
  }

  sections.push('', 'Generated via Product Pulse GitHub Code Insight + Patch Agent.');
  return sections.join('\n');
}

function parseMarkerPath(value) {
  const raw = String(value || '').trim();
  if (raw === '/dev/null') return null;
  return raw.replace(/^[ab]\//, '');
}

function parseUnifiedDiff(diffText) {
  const lines = normalizeDiff(diffText).split('\n');
  const files = [];
  let current = null;

  function pushCurrent() {
    if (current) {
      files.push(current);
      current = null;
    }
  }

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('diff --git ')) {
      pushCurrent();
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      current = {
        oldPath: match?.[1] || null,
        newPath: match?.[2] || null,
        hunks: [],
      };
      index += 1;
      continue;
    }

    if (line.startsWith('--- ')) {
      if (!current) {
        current = { oldPath: null, newPath: null, hunks: [] };
      }
      current.oldPath = parseMarkerPath(line.slice(4));
      index += 1;
      if (lines[index]?.startsWith('+++ ')) {
        current.newPath = parseMarkerPath(lines[index].slice(4));
        index += 1;
      }
      continue;
    }

    if (line.startsWith('@@')) {
      if (!current) {
        throw new Error('Patch hunk found before file header.');
      }

      const match = line.match(
        /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
      );
      if (!match) {
        throw new Error(`Invalid patch hunk header: ${line}`);
      }

      const hunk = {
        oldStart: Number(match[1]),
        oldCount: Number(match[2] || 1),
        newStart: Number(match[3]),
        newCount: Number(match[4] || 1),
        lines: [],
      };

      index += 1;
      while (index < lines.length) {
        const hunkLine = lines[index];
        if (
          hunkLine.startsWith('diff --git ') ||
          hunkLine.startsWith('--- ') ||
          hunkLine.startsWith('@@')
        ) {
          break;
        }

        if (hunkLine.startsWith('\\ No newline at end of file')) {
          index += 1;
          continue;
        }

        const type = hunkLine[0];
        if (![' ', '+', '-'].includes(type)) {
          throw new Error(`Unsupported patch line: ${hunkLine}`);
        }

        hunk.lines.push({
          type,
          content: hunkLine.slice(1),
        });
        index += 1;
      }

      current.hunks.push(hunk);
      continue;
    }

    index += 1;
  }

  pushCurrent();

  return files
    .map((file) => ({
      ...file,
      path: file.newPath || file.oldPath,
      isNewFile: !file.oldPath && Boolean(file.newPath),
      isDeletedFile: !file.newPath && Boolean(file.oldPath),
    }))
    .filter((file) => file.path && !file.isDeletedFile && file.hunks.length > 0);
}

function matchesHunkAt(lines, startIndex, hunk) {
  let cursor = startIndex;
  for (const entry of hunk.lines) {
    if (entry.type === '+') continue;
    if (lines[cursor] !== entry.content) {
      return false;
    }
    cursor += 1;
  }
  return true;
}

function findHunkPosition(lines, hunk, offset) {
  const expected = Math.max(0, hunk.oldStart - 1 + offset);
  const candidates = [];

  for (let delta = -5; delta <= 5; delta += 1) {
    const candidate = expected + delta;
    if (candidate >= 0 && candidate <= lines.length) {
      candidates.push(candidate);
    }
  }

  for (let index = 0; index <= lines.length; index += 1) {
    if (!candidates.includes(index)) {
      candidates.push(index);
    }
  }

  return candidates.find((candidate) => matchesHunkAt(lines, candidate, hunk));
}

function applyPatchToContent(originalContent, filePatch) {
  const lines =
    originalContent === ''
      ? []
      : String(originalContent).replace(/\r/g, '').split('\n');
  let offset = 0;

  for (const hunk of filePatch.hunks) {
    const position = findHunkPosition(lines, hunk, offset);
    if (position === undefined) {
      throw new Error(`Could not apply patch for ${filePatch.path}.`);
    }

    const replacement = [];
    let consumed = 0;
    let cursor = position;

    for (const entry of hunk.lines) {
      if (entry.type === ' ') {
        replacement.push(lines[cursor]);
        cursor += 1;
        consumed += 1;
      } else if (entry.type === '-') {
        cursor += 1;
        consumed += 1;
      } else if (entry.type === '+') {
        replacement.push(entry.content);
      }
    }

    lines.splice(position, consumed, ...replacement);
    offset += replacement.length - consumed;
  }

  return lines.join('\n');
}

async function getReferenceSha(accessToken, owner, repo, branch) {
  const ref = await githubRequest(
    accessToken,
    `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
  );
  return ref.object?.sha;
}

async function createBranch(accessToken, owner, repo, branchName, baseBranch) {
  const baseSha = await getReferenceSha(accessToken, owner, repo, baseBranch);
  if (!baseSha) {
    throw new Error(`Could not resolve base branch ${baseBranch}.`);
  }

  await githubRequest(accessToken, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });
}

async function updateRepositoryFile(
  accessToken,
  owner,
  repo,
  path,
  branch,
  content,
  sha,
  message
) {
  return githubRequest(
    accessToken,
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        content: toBase64(content),
        sha: sha || undefined,
        branch,
      }),
    }
  );
}

async function createPullRequest(accessToken, owner, repo, title, body, head, base) {
  return githubRequest(accessToken, `/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      head,
      base,
    }),
  });
}

async function getPullRequestCiStatus(accessToken, owner, repo, headSha) {
  if (!headSha) {
    return {
      status: 'pending',
      summary: 'CI status is pending until the PR head commit is indexed.',
      checks: [],
    };
  }

  try {
    const result = await githubRequest(
      accessToken,
      `/repos/${owner}/${repo}/commits/${headSha}/check-runs`
    );
    const checks = Array.isArray(result?.check_runs)
      ? result.check_runs.map((check) => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          url: check.html_url,
        }))
      : [];

    const hasFailure = checks.some(
      (check) =>
        check.conclusion &&
        !['success', 'neutral', 'skipped'].includes(String(check.conclusion))
    );
    const allCompleted = checks.length > 0 && checks.every((check) => check.status === 'completed');
    const allPassed =
      checks.length > 0 &&
      checks.every((check) =>
        ['success', 'neutral', 'skipped'].includes(String(check.conclusion))
      );

    return {
      status: hasFailure ? 'failed' : allCompleted && allPassed ? 'passed' : 'pending',
      summary:
        checks.length === 0
          ? 'CI has not reported any checks yet.'
          : hasFailure
            ? 'One or more CI checks failed.'
            : allCompleted && allPassed
              ? 'All CI checks passed.'
              : 'CI checks are still running.',
      checks,
    };
  } catch {
    return {
      status: 'pending',
      summary: 'CI status is not available yet.',
      checks: [],
    };
  }
}

async function createPullRequestFromPatch(userId, issue, patch, options = {}) {
  let repository;

  if (options.repoOwner && options.repoName) {
    const connection = await getGitHubConnection(userId);
    if (!connection) {
      throw new Error('Connect GitHub before creating a pull request.');
    }

    const repo = await getRepository(
      connection.accessToken,
      options.repoOwner,
      options.repoName
    );

    repository = {
      connection,
      owner: repo.owner?.login || options.repoOwner,
      name: repo.name || options.repoName,
      defaultBranch: repo.default_branch || 'main',
    };
  } else {
    repository = await getSelectedRepository(userId);
  }

  const accessToken = repository.connection.accessToken;
  const owner = repository.owner;
  const repo = repository.name;
  const baseBranch = options.baseBranch || repository.defaultBranch || 'main';
  const branchName = buildBranchName(issue);
  const filePatches = parseUnifiedDiff(patch);

  if (filePatches.length === 0) {
    throw new Error('No file changes were found in the proposed patch.');
  }

  await createBranch(accessToken, owner, repo, branchName, baseBranch);

  const changedFiles = [];
  for (const filePatch of filePatches) {
    const existing = filePatch.isNewFile
      ? { content: '', sha: null }
      : await fetchRepositoryFile(accessToken, owner, repo, filePatch.path, baseBranch);

    const nextContent = applyPatchToContent(existing.content || '', filePatch);

    const update = await updateRepositoryFile(
      accessToken,
      owner,
      repo,
      filePatch.path,
      branchName,
      nextContent,
      existing.sha,
      `fix: address ${issue.title}`
    );

    changedFiles.push({
      path: filePatch.path,
      sha: update?.content?.sha || null,
    });
  }

  for (const extraFile of Array.isArray(options.extraFiles) ? options.extraFiles : []) {
    if (!extraFile?.path || typeof extraFile.content !== 'string') {
      continue;
    }

    let existing = { content: '', sha: null };
    try {
      existing = await fetchRepositoryFile(accessToken, owner, repo, extraFile.path, baseBranch);
    } catch {
      // Allow creating a brand new file.
    }

    const update = await updateRepositoryFile(
      accessToken,
      owner,
      repo,
      extraFile.path,
      branchName,
      extraFile.content,
      existing.sha,
      extraFile.commitMessage || `test: add regression coverage for ${issue.title}`
    );

    changedFiles.push({
      path: extraFile.path,
      sha: update?.content?.sha || null,
    });
  }

  const validationSection = options.validationSummary
    ? [
        '',
        '## Validation Proof',
        `- Status: ${options.validationSummary.status}`,
        `- Summary: ${options.validationSummary.summary}`,
        options.validationSummary.command
          ? `- Command: \`${options.validationSummary.command}\``
          : null,
        options.validationSummary.generatedTestPath
          ? `- Generated test: \`${options.validationSummary.generatedTestPath}\``
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const pullRequest = await createPullRequest(
    accessToken,
    owner,
    repo,
    options.prTitle || options.prDescription?.title || `Fix: ${issue.title}`,
    (options.prBody || buildPullRequestBody(issue, options.prDescription)) + validationSection,
    branchName,
    baseBranch
  );

  const ciStatus = await getPullRequestCiStatus(
    accessToken,
    owner,
    repo,
    pullRequest.head?.sha || null
  );

  return {
    repository: {
      owner,
      name: repo,
      defaultBranch: baseBranch,
    },
    branchName,
    baseBranch,
    changedFiles,
    pullRequest: {
      id: pullRequest.id,
      number: pullRequest.number,
      url: pullRequest.html_url,
      title: pullRequest.title,
    },
    prNumber: pullRequest.number,
    prUrl: pullRequest.html_url,
    prTitle: pullRequest.title,
    prDescription: {
      title: options.prTitle || options.prDescription?.title || pullRequest.title,
      body:
        (options.prBody || buildPullRequestBody(issue, options.prDescription)) +
        validationSection,
    },
    validationSummary: options.validationSummary || null,
    ciStatus,
  };
}

module.exports = {
  applyPatchToContent,
  buildPullRequestBody,
  createPullRequestFromPatch,
  getPullRequestCiStatus,
  parseUnifiedDiff,
};
