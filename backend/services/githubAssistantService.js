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
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'GitHub assistant request failed.');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('GitHub assistant returned an empty response.');
  }

  return JSON.parse(content);
}

function buildFallbackResponse({ issue, action, selectedFilePath, repository }) {
  if (action === 'explain_patch') {
    return {
      answer: `This patch is trying to address ${issue.title} in ${repository.owner}/${repository.name} with a minimal code change focused on the most relevant file context.`,
      quickReplies: ['What should I verify?', 'Explain this file', 'Suggest a safer fix'],
    };
  }

  if (action === 'explain_file' && selectedFilePath) {
    return {
      answer: `${selectedFilePath} looks relevant to ${issue.title} because the matched snippet overlaps with the reported behavior and routing context.`,
      quickReplies: ['Explain this change', 'What should I test?', 'Suggest fix'],
    };
  }

  return {
    answer: `${issue.title} is being analyzed against ${repository.owner}/${repository.name} using the selected issue context, repository structure, and matched code snippets.`,
    quickReplies: ['Explain patch', 'Suggest fix', 'What should I do?'],
  };
}

async function chatWithGitHubContext({
  issue,
  analysis,
  message,
  action,
  selectedFilePath,
}) {
  const prompt = String(message || '').trim();
  const actionLabel = String(action || '').trim().toLowerCase() || 'ask';

  if (!prompt) {
    return buildFallbackResponse({
      issue,
      action: actionLabel,
      selectedFilePath,
      repository: analysis.repository,
    });
  }

  try {
    const context = buildGroqCodeContext({
      issue,
      repository: analysis.repository,
      repoStructure: analysis.repositoryStructure,
      files: selectedFilePath
        ? analysis.files.filter((file) => file.path === selectedFilePath)
        : analysis.files,
    });

    const parsed = await callGroq([
      {
        role: 'system',
        content: [
          'You are Product Pulse GitHub Debug Assistant.',
          'You are not a generic chatbot.',
          'You explain repository-specific debugging context using only the provided issue, repository, patch, and file evidence.',
          'Be technical, short, clear, and confident.',
          'Explain reasoning plainly and mention exact files when useful.',
          'Return strict JSON with keys answer and quickReplies.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          context.repoSummary,
          `Issue title: ${context.issueTitle}`,
          `Issue description: ${context.issueDescription}`,
          `Assistant action: ${actionLabel}`,
          `Possible causes:\n${(analysis.possibleCauses || []).map((cause, index) => `${index + 1}. ${cause}`).join('\n') || 'None provided.'}`,
          `Root cause:\n${analysis.rootCause}`,
          `Reasoning summary:\n${analysis.reasoningSummary || 'Not provided.'}`,
          `Alternative fixes:\n${
            (analysis.alternativeFixes || [])
              .map(
                (option) =>
                  `${option.rank}. ${option.title} (${option.recommended ? 'recommended' : 'alternative'}): ${option.summary}`
              )
              .join('\n') || 'None provided.'
          }`,
          analysis.prDescription
            ? `PR draft:\nTitle: ${analysis.prDescription.title}\nSummary: ${analysis.prDescription.summary}\nImpact: ${analysis.prDescription.impact}`
            : '',
          '',
          `Patch:\n${analysis.patch}`,
          '',
          `Relevant files:\n${context.codeSummary}`,
          '',
          `User request:\n${prompt}`,
        ].join('\n'),
      },
    ]);

    return {
      answer: String(parsed.answer || '').trim() || buildFallbackResponse({
        issue,
        action: actionLabel,
        selectedFilePath,
        repository: analysis.repository,
      }).answer,
      quickReplies: Array.isArray(parsed.quickReplies)
        ? parsed.quickReplies.slice(0, 4).map((value) => String(value))
        : buildFallbackResponse({
            issue,
            action: actionLabel,
            selectedFilePath,
            repository: analysis.repository,
          }).quickReplies,
    };
  } catch {
    return buildFallbackResponse({
      issue,
      action: actionLabel,
      selectedFilePath,
      repository: analysis.repository,
    });
  }
}

module.exports = {
  chatWithGitHubContext,
};
