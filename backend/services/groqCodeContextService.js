const MAX_CONTEXT_FILES = 5;
const MAX_CONTEXT_LINES = 500;

function normalizeFiles(files) {
  const sourceFiles = Array.isArray(files) ? files : [];
  const trimmed = [];
  let remainingLines = MAX_CONTEXT_LINES;

  for (const file of sourceFiles.slice(0, MAX_CONTEXT_FILES)) {
    const lineCount = Math.min(Number(file?.lineCount || 0), remainingLines);
    if (lineCount <= 0) {
      break;
    }

    trimmed.push({
      ...file,
      lineCount,
    });
    remainingLines -= lineCount;
  }

  return trimmed;
}

function buildRelevantCodeSummary(files) {
  return normalizeFiles(files)
    .map(
      (file) =>
        [
          `File: ${file.path}`,
          `Purpose: ${file.filePurpose || 'application logic'}`,
          `Lines: ${file.startLine}-${file.endLine}`,
          `Snippet:`,
          file.snippet,
        ].join('\n')
    )
    .join('\n\n');
}

function buildRepoSummary(repository, repoStructure) {
  const repoName = repository?.owner && repository?.name
    ? `${repository.owner}/${repository.name}`
    : 'unknown repository';
  const techStack = Array.isArray(repoStructure?.techStack)
    ? repoStructure.techStack.slice(0, 6).join(', ')
    : 'unknown';
  const modules = Array.isArray(repoStructure?.modules)
    ? repoStructure.modules
        .slice(0, 5)
        .map((module) => `${module.module} (${Math.round(Number(module.confidence || 0) * 100)}%)`)
        .join(', ')
    : 'unknown';
  const keyFiles = Array.isArray(repoStructure?.keyFiles)
    ? repoStructure.keyFiles.slice(0, 6).join(', ')
    : 'unknown';

  return {
    repoName,
    summary: [
      `Repository: ${repoName}`,
      `Tech stack: ${techStack || 'unknown'}`,
      `Modules: ${modules || 'unknown'}`,
      `Key files: ${keyFiles || 'unknown'}`,
    ].join('\n'),
  };
}

function buildGroqCodeContext({ issue, repository, repoStructure, files }) {
  const normalizedFiles = normalizeFiles(files);
  const repoSummary = buildRepoSummary(repository, repoStructure);

  return {
    repositoryName: repoSummary.repoName,
    relevantFiles: normalizedFiles,
    totalLines: normalizedFiles.reduce(
      (sum, file) => sum + Number(file.lineCount || 0),
      0
    ),
    repoSummary: repoSummary.summary,
    codeSummary: buildRelevantCodeSummary(normalizedFiles),
    issueTitle: issue?.title || '',
    issueDescription: issue?.description || issue?.summary || issue?.title || '',
  };
}

module.exports = {
  MAX_CONTEXT_FILES,
  MAX_CONTEXT_LINES,
  buildGroqCodeContext,
  buildRelevantCodeSummary,
  buildRepoSummary,
  normalizeFiles,
};
