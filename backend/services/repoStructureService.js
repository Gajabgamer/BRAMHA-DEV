const supabase = require('../lib/supabaseClient');
const { getGitHubConnection, getRepositoryTree } = require('./githubService');

const STRUCTURE_CACHE_TTL_MS = 1000 * 60 * 15;
const structureCache = new Map();

const MODULE_KEYWORDS = [
  { key: 'AUTH', keywords: ['auth', 'login', 'signin', 'session', 'token', 'oauth'] },
  { key: 'PAYMENTS', keywords: ['payment', 'billing', 'invoice', 'checkout', 'subscription'] },
  { key: 'API', keywords: ['api', 'route', 'routes', 'controller', 'server', 'endpoint'] },
  { key: 'UI', keywords: ['component', 'components', 'ui', 'pages', 'views', 'screen'] },
  { key: 'DATA', keywords: ['db', 'database', 'schema', 'model', 'migration', 'supabase', 'prisma'] },
  { key: 'NOTIFICATIONS', keywords: ['notification', 'email', 'mail', 'alert', 'message'] },
  { key: 'ANALYTICS', keywords: ['analytics', 'tracking', 'metrics', 'events', 'telemetry'] },
  { key: 'TESTING', keywords: ['test', 'spec', '__tests__', 'cypress', 'playwright'] },
];

const TECH_FILE_MAP = [
  { label: 'Next.js', files: ['next.config.js', 'next.config.ts', 'app/', 'pages/'] },
  { label: 'React', files: ['package.json', '.tsx', '.jsx'] },
  { label: 'TypeScript', files: ['tsconfig.json', '.ts', '.tsx'] },
  { label: 'JavaScript', files: ['.js', '.jsx'] },
  { label: 'Tailwind CSS', files: ['tailwind.config.js', 'tailwind.config.ts', 'postcss.config.js', 'globals.css'] },
  { label: 'Supabase', files: ['supabase', 'supabase_schema.sql'] },
  { label: 'Node.js', files: ['package.json', 'server.js', 'app.js', 'express'] },
  { label: 'Express', files: ['express', 'app.js', 'server.js', 'routes/'] },
  { label: 'Vercel', files: ['vercel.json'] },
  { label: 'Docker', files: ['dockerfile', 'docker-compose'] },
];

function isMissingRelationError(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

function normalizePath(path) {
  return String(path || '').trim().toLowerCase();
}

function getCacheKey(userId, owner, repo, branch) {
  return `${userId}:${owner}/${repo}:${branch || 'main'}`;
}

function getCacheValue(key) {
  const entry = structureCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    structureCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCacheValue(key, value) {
  structureCache.set(key, {
    value,
    expiresAt: Date.now() + STRUCTURE_CACHE_TTL_MS,
  });
}

function scoreModule(paths, keywords) {
  let score = 0;

  for (const rawPath of paths) {
    const path = normalizePath(rawPath);
    for (const keyword of keywords) {
      if (path.includes(`/${keyword}/`) || path.includes(`${keyword}/`) || path.includes(`/${keyword}.`)) {
        score += 3;
      } else if (path.includes(keyword)) {
        score += 1;
      }
    }
  }

  return score;
}

function detectModules(paths) {
  const modules = MODULE_KEYWORDS.map((entry) => {
    const score = scoreModule(paths, entry.keywords);
    const confidence = Math.max(0, Math.min(1, score / 12));
    return {
      module: entry.key,
      confidence: Number(confidence.toFixed(2)),
      matchedKeywords: entry.keywords.filter((keyword) =>
        paths.some((path) => normalizePath(path).includes(keyword))
      ),
    };
  }).filter((entry) => entry.confidence > 0);

  return modules.sort((left, right) => right.confidence - left.confidence).slice(0, 8);
}

function detectTechStack(paths) {
  const normalizedPaths = paths.map(normalizePath);
  const extensions = new Set(
    normalizedPaths
      .map((path) => {
        const match = path.match(/(\.[a-z0-9]+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
  );

  const detected = TECH_FILE_MAP.filter((tech) =>
    tech.files.some((token) => {
      const normalizedToken = token.toLowerCase();
      if (normalizedToken.startsWith('.')) {
        return extensions.has(normalizedToken);
      }
      return normalizedPaths.some((path) => path.includes(normalizedToken));
    })
  ).map((tech) => tech.label);

  return detected;
}

function scoreKeyFile(path, modules) {
  const normalized = normalizePath(path);
  let score = 0;

  if (
    normalized.endsWith('package.json') ||
    normalized.endsWith('tsconfig.json') ||
    normalized.endsWith('next.config.js') ||
    normalized.endsWith('next.config.ts') ||
    normalized.endsWith('vercel.json') ||
    normalized.endsWith('server.js') ||
    normalized.endsWith('app.js')
  ) {
    score += 6;
  }

  if (normalized.includes('/src/') || normalized.startsWith('src/')) score += 2;
  if (normalized.includes('/app/') || normalized.includes('/pages/')) score += 2;
  if (normalized.includes('/api/') || normalized.includes('/routes/')) score += 2;
  if (normalized.includes('/components/')) score += 1;

  for (const module of modules) {
    if (module.matchedKeywords.some((keyword) => normalized.includes(keyword))) {
      score += Math.max(1, Math.round(module.confidence * 3));
    }
  }

  return score;
}

function selectKeyFiles(paths, modules) {
  return [...paths]
    .map((path) => ({
      path,
      score: scoreKeyFile(path, modules),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((entry) => entry.path);
}

async function getStoredRepoStructure(userId, repoOwner, repoName) {
  const { data, error } = await supabase
    .from('repo_structure')
    .select('*')
    .eq('user_id', userId)
    .eq('repo_owner', repoOwner)
    .eq('repo_name', repoName)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return null;
    }
    throw error;
  }

  return data || null;
}

async function storeRepoStructure(userId, structure) {
  const payload = {
    user_id: userId,
    repo_owner: structure.repoOwner,
    repo_name: structure.repoName,
    default_branch: structure.defaultBranch || 'main',
    modules: structure.modules,
    tech_stack: structure.techStack,
    key_files: structure.keyFiles,
    file_count: structure.fileCount,
    analyzed_at: structure.analyzedAt,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('repo_structure')
    .upsert(payload, { onConflict: 'user_id,repo_owner,repo_name' })
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

function formatStructureRecord(record) {
  if (!record) return null;
  return {
    repoOwner: record.repo_owner,
    repoName: record.repo_name,
    defaultBranch: record.default_branch || 'main',
    modules: Array.isArray(record.modules) ? record.modules : [],
    techStack: Array.isArray(record.tech_stack) ? record.tech_stack : [],
    keyFiles: Array.isArray(record.key_files) ? record.key_files : [],
    fileCount: Number(record.file_count || 0),
    analyzedAt: record.analyzed_at || record.updated_at || null,
  };
}

async function analyzeRepositoryStructure(userId, input = {}) {
  const connection = await getGitHubConnection(userId);
  if (!connection) {
    throw new Error('Connect GitHub before analyzing repository structure.');
  }

  const repoOwner = input.repoOwner || connection.repoOwner;
  const repoName = input.repoName || connection.repoName;
  const defaultBranch = input.defaultBranch || connection.defaultBranch || 'main';

  if (!repoOwner || !repoName) {
    throw new Error('Select a primary GitHub repository before analyzing structure.');
  }

  const cacheKey = getCacheKey(userId, repoOwner, repoName, defaultBranch);
  const cached = getCacheValue(cacheKey);
  if (cached && !input.forceRefresh) {
    return cached;
  }

  if (!input.forceRefresh) {
    const stored = formatStructureRecord(
      await getStoredRepoStructure(userId, repoOwner, repoName)
    );
    if (stored) {
      setCacheValue(cacheKey, stored);
      return stored;
    }
  }

  const tree = await getRepositoryTree(
    connection.accessToken,
    repoOwner,
    repoName,
    defaultBranch
  );
  const paths = tree.map((entry) => entry.path).filter(Boolean);
  const modules = detectModules(paths);
  const techStack = detectTechStack(paths);
  const keyFiles = selectKeyFiles(paths, modules);

  const structure = {
    repoOwner,
    repoName,
    defaultBranch,
    modules,
    techStack,
    keyFiles,
    fileCount: paths.length,
    analyzedAt: new Date().toISOString(),
  };

  const stored = formatStructureRecord(await storeRepoStructure(userId, structure));
  setCacheValue(cacheKey, stored);
  return stored;
}

async function getRepoStructure(userId, input = {}) {
  const repoOwner = input.repoOwner;
  const repoName = input.repoName;

  if (repoOwner && repoName) {
    const cached = getCacheValue(getCacheKey(userId, repoOwner, repoName, input.defaultBranch));
    if (cached) return cached;
  }

  return analyzeRepositoryStructure(userId, input);
}

module.exports = {
  analyzeRepositoryStructure,
  getRepoStructure,
};
