const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const { buildGroqCodeContext } = require('./groqCodeContextService');

async function callGroq(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY on the backend.');
  }

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to generate regression test.');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Regression test generation returned an empty response.');
  }

  return JSON.parse(content);
}

function inferTestPath(files) {
  const primary = files[0]?.path || 'src/app.js';
  const normalized = String(primary).replace(/\\/g, '/');
  const extensionMatch = normalized.match(/(\.[a-z0-9]+)$/i);
  const extension = extensionMatch?.[1] || '.js';

  if (normalized.includes('/src/')) {
    return normalized.replace(/(\.[a-z0-9]+)$/i, `.agent.test${extension === '.tsx' ? '.tsx' : extension === '.ts' ? '.ts' : '.js'}`);
  }

  return `tests/${normalized
    .split('/')
    .pop()
    ?.replace(/(\.[a-z0-9]+)$/i, `.agent.test${extension === '.tsx' ? '.tsx' : extension === '.ts' ? '.ts' : '.js'}`) || 'generated.agent.test.js'}`;
}

async function generateRegressionTest({
  issue,
  files,
  analysis,
  repository,
  repoStructure,
}) {
  if (!Array.isArray(files) || files.length === 0) {
    return null;
  }

  const context = buildGroqCodeContext({
    issue,
    repository,
    repoStructure,
    files: files.slice(0, 3),
  });

  const fallbackPath = inferTestPath(files);
  const parsed = await callGroq([
    {
      role: 'system',
      content: [
        'You are a senior software engineer generating one minimal regression test.',
        'Return strict JSON with keys testPath, testContent, rationale, validationFocus, frameworkHint.',
        'The test must reproduce the reported bug and validate the suggested fix.',
        'Keep it small, safe, and focused.',
        'Do not return prose outside JSON.',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        context.repoSummary,
        '',
        `Issue title:\n${context.issueTitle}`,
        '',
        `Issue description:\n${context.issueDescription}`,
        '',
        `Selected root cause:\n${analysis.selectedRootCause || analysis.rootCause}`,
        '',
        `Reasoning summary:\n${analysis.reasoningSummary || ''}`,
        '',
        `Relevant code:\n${context.codeSummary}`,
        '',
        'Requirements:',
        `- Prefer a test path near the affected code. Fallback path: ${fallbackPath}`,
        '- Use the repo testing style if obvious from file names or snippets',
        '- Keep total test file under 160 lines',
        '- Test should fail before fix and pass after fix',
      ].join('\n'),
    },
  ]);

  const testPath = String(parsed.testPath || fallbackPath).trim() || fallbackPath;
  const testContent = String(parsed.testContent || '').trim();
  if (!testContent) {
    throw new Error('Regression test generation did not return test content.');
  }

  return {
    path: testPath.replace(/^\/+/, ''),
    content: testContent,
    rationale:
      String(parsed.rationale || '').trim() ||
      'Generated regression test to reproduce the reported issue and validate the fix.',
    validationFocus:
      String(parsed.validationFocus || '').trim() ||
      'Verify the failing path is covered by the new test.',
    frameworkHint: String(parsed.frameworkHint || '').trim() || null,
    model: DEFAULT_MODEL,
  };
}

module.exports = {
  generateRegressionTest,
};
