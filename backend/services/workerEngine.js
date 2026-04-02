const supabase = require('../lib/supabaseClient');
const aiController = require('../controllers/aiController');
const agentCodeController = require('../controllers/agentCodeController');
const connectionsController = require('../controllers/connectionsController');
const { getAnomalies } = require('./anomalyService');
const { generateExecutiveSummary } = require('./executiveSummaryService');
const { publishSystemEvent } = require('./liveEventsService');
const { createNotification } = require('./notificationService');
const { runAgent } = require('./agentService');
const { invokeController } = require('./internalControllerInvoker');
const {
  JOB_TYPES,
  QUEUE_NAMES,
  claimNextJob,
  completeJob,
  enqueueUniqueJob,
  ensureDefaultSchedules,
  failJob,
  getDueSchedules,
  listActiveUserIds,
  markScheduleRun,
} = require('./jobQueueService');

const WORKER_IDLE_MS = Number(process.env.WORKER_IDLE_MS || 3000);
const WORKER_POLL_MS = Number(process.env.WORKER_POLL_MS || 2000);
const QUEUE_LANES = [
  QUEUE_NAMES.REALTIME,
  QUEUE_NAMES.AGENT,
  QUEUE_NAMES.GITHUB,
  QUEUE_NAMES.SYNC,
  QUEUE_NAMES.MAINTENANCE,
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`User ${userId} not found for background job.`);
  }

  return data;
}

async function listSyncProviders(userId) {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('provider')
    .eq('user_id', userId)
    .eq('status', 'connected');

  if (error) {
    throw error;
  }

  return (data || [])
    .map((row) => row.provider)
    .filter((provider) => provider !== 'github' && provider !== 'google_calendar');
}

async function scheduleRecurringJobs() {
  await ensureDefaultSchedules();
  const dueSchedules = await getDueSchedules();

  for (const schedule of dueSchedules) {
    await enqueueUniqueJob({
      userId: schedule.user_id,
      jobType: schedule.job_type,
      queueName:
        schedule.job_type === JOB_TYPES.SYNC_SOURCES
          ? QUEUE_NAMES.SYNC
          : schedule.job_type === JOB_TYPES.AGENT_LOOP
            ? QUEUE_NAMES.AGENT
            : QUEUE_NAMES.MAINTENANCE,
      payload: schedule.payload || {},
      priority: schedule.job_type === JOB_TYPES.SYNC_SOURCES ? 80 : 120,
      dedupeKey: `${schedule.user_id}:${schedule.name}:${schedule.next_run_at}`,
    });
    await markScheduleRun(schedule.id, schedule.interval_minutes);
  }
}

async function handleGroqChatJob(job) {
  const user = await getUserById(job.user_id);
  const result = await invokeController(aiController.chatWithAssistant, {
    user,
    body: {
      message:
        job.payload?.message ||
        'Summarize the latest critical issue and recommended response.',
    },
  });

  return result.payload;
}

async function handlePatchGenerationJob(job) {
  const user = await getUserById(job.user_id);
  const result = await invokeController(agentCodeController.analyzeIssueCode, {
    user,
    params: {
      issueId: String(job.payload?.issueId || ''),
    },
    body: {
      repoOwner: job.payload?.repoOwner,
      repoName: job.payload?.repoName,
    },
  });

  return result.payload;
}

async function handleTestExecutionJob(job) {
  const user = await getUserById(job.user_id);
  const result = await invokeController(agentCodeController.validateIssuePatch, {
    user,
    params: {
      issueId: String(job.payload?.issueId || ''),
    },
    body: {
      patch: job.payload?.patch,
      repoOwner: job.payload?.repoOwner,
      repoName: job.payload?.repoName,
      generatedTest: job.payload?.generatedTest,
    },
  });

  return result.payload;
}

async function handleGitHubPrJob(job) {
  const user = await getUserById(job.user_id);
  const result = await invokeController(agentCodeController.createPatchPullRequest, {
    user,
    params: {
      issueId: String(job.payload?.issueId || ''),
    },
    body: {
      patch: job.payload?.patch,
      title: job.payload?.title,
      body: job.payload?.body,
      prDescription: job.payload?.prDescription,
      repoOwner: job.payload?.repoOwner,
      repoName: job.payload?.repoName,
      generatedTest: job.payload?.generatedTest,
    },
  });

  return result.payload;
}

async function handleSyncSourcesJob(job) {
  const user = await getUserById(job.user_id);
  const explicitProvider = String(job.payload?.provider || '').trim();
  const providers = explicitProvider ? [explicitProvider] : await listSyncProviders(job.user_id);

  const results = [];
  for (const provider of providers) {
    try {
      const response = await invokeController(connectionsController.syncConnection, {
        user,
        params: { provider },
        body: job.payload?.syncPayload || {},
      });
      if (Number(response.payload?.imported || 0) > 0) {
        await publishSystemEvent({
          userId: job.user_id,
          type: 'new_feedback',
          queueName: QUEUE_NAMES.AGENT,
          priority: 'high',
          payload: {
            provider,
            imported: response.payload.imported,
            skipped: response.payload.skipped || 0,
          },
        });
      }
      results.push({
        provider,
        success: true,
        result: response.payload,
      });
    } catch (error) {
      results.push({
        provider,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    providers: results,
  };
}

async function handleAgentLoopJob(job) {
  const user = await getUserById(job.user_id);
  const result = await runAgent(user, {
    background: true,
    mode: job.payload?.mode || 'scheduled',
  });

  if (job.payload?.mode === 'anomaly_detection') {
    const anomalies = await getAnomalies(job.user_id);
    const strongest = anomalies.find((entry) => entry.spike_detected);
    if (strongest) {
      await createNotification(job.user_id, {
        title: `${strongest.issue_type_label} anomaly detected`,
        message: `${strongest.issue_type_label} is showing a ${strongest.spike_level} spike versus its recent baseline.`,
        type: 'anomaly',
        metadata: strongest,
      });
    }
  }

  return result;
}

async function handleInsightsUpdateJob(job) {
  const user = await getUserById(job.user_id);
  const summary = await generateExecutiveSummary(user);
  await createNotification(job.user_id, {
    title: 'Executive summary refreshed',
    message: summary.summary,
    type: 'summary',
    metadata: {
      generatedAt: summary.generatedAt,
      topIssueIds: (summary.topIssues || []).map((issue) => issue.id),
    },
  });

  return summary;
}

async function processJob(job) {
  await publishSystemEvent({
    userId: job.user_id,
    type: 'job_started',
    queueName: job.queue_name,
    priority: job.priority <= 60 ? 'high' : job.priority <= 120 ? 'normal' : 'low',
    payload: {
      jobId: job.id,
      jobType: job.job_type,
      queueName: job.queue_name,
    },
  }).catch(() => null);

  switch (job.job_type) {
    case JOB_TYPES.GROQ_CHAT:
      return handleGroqChatJob(job);
    case JOB_TYPES.PATCH_GENERATION:
      return handlePatchGenerationJob(job);
    case JOB_TYPES.TEST_EXECUTION:
      return handleTestExecutionJob(job);
    case JOB_TYPES.GITHUB_PR:
      return handleGitHubPrJob(job);
    case JOB_TYPES.SYNC_SOURCES:
      return handleSyncSourcesJob(job);
    case JOB_TYPES.AGENT_LOOP:
      return handleAgentLoopJob(job);
    case JOB_TYPES.INSIGHTS_UPDATE:
      return handleInsightsUpdateJob(job);
    default:
      throw new Error(`Unsupported job type: ${job.job_type}`);
  }
}

async function seedInitialJobs() {
  const userIds = await listActiveUserIds();
  for (const userId of userIds) {
    await enqueueUniqueJob({
      userId,
      jobType: JOB_TYPES.AGENT_LOOP,
      queueName: QUEUE_NAMES.AGENT,
      payload: { mode: 'startup' },
      dedupeKey: `${userId}:agent_loop:startup`,
      priority: 90,
    });
  }
}

async function runQueueLane(queueName, baseWorkerName, shouldContinue) {
  const workerName = `${baseWorkerName}:${queueName}`;

  while (shouldContinue()) {
    try {
      const job = await claimNextJob(workerName, queueName);

      if (!job) {
        await sleep(WORKER_IDLE_MS);
        continue;
      }

      try {
        const result = await processJob(job);
        await completeJob(job.id, result || {});
        await publishSystemEvent({
          userId: job.user_id,
          type: 'job_completed',
          queueName: queueName,
          priority: 'normal',
          payload: {
            jobId: job.id,
            jobType: job.job_type,
            queueName,
            result,
          },
        }).catch(() => null);
      } catch (error) {
        const failed = await failJob(job, error);
        if (job.job_type === JOB_TYPES.TEST_EXECUTION && job.user_id) {
          await createNotification(job.user_id, {
            title: 'Validation test failed',
            message:
              error instanceof Error
                ? error.message
                : 'A generated regression test failed during sandbox validation.',
            type: 'test_failure',
            metadata: {
              jobId: job.id,
              queueName,
              issueId: job.payload?.issueId || null,
            },
          }).catch(() => null);
        }
        await publishSystemEvent({
          userId: job.user_id,
          type: job.job_type === JOB_TYPES.TEST_EXECUTION ? 'test_failed' : 'job_failed',
          queueName: queueName,
          priority: 'high',
          payload: {
            jobId: job.id,
            jobType: job.job_type,
            queueName,
            error: error instanceof Error ? error.message : String(error || 'Job failed.'),
            status: failed?.status || 'failed',
          },
        }).catch(() => null);
      }
    } catch (error) {
      console.error(`[worker-engine:${queueName}] lane error`, error);
      await sleep(WORKER_POLL_MS);
    }
  }
}

async function runWorkerLoop(options = {}) {
  const baseWorkerName =
    options.workerName || `worker-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let keepRunning = true;

  const stop = () => {
    keepRunning = false;
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await ensureDefaultSchedules();
  await seedInitialJobs();

  const schedulerLoop = (async () => {
    while (keepRunning) {
      try {
        await scheduleRecurringJobs();
      } catch (error) {
        console.error('[worker-engine] scheduler error', error);
      }
      await sleep(WORKER_POLL_MS);
    }
  })();

  const laneLoops = QUEUE_LANES.map((queueName) =>
    runQueueLane(queueName, baseWorkerName, () => keepRunning)
  );

  await Promise.all([schedulerLoop, ...laneLoops]);
}

module.exports = {
  processJob,
  runWorkerLoop,
  scheduleRecurringJobs,
};
