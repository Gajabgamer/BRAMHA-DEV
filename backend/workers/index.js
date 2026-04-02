require('dotenv').config();
const { initializeEventBus } = require('../lib/eventBus');
const { emitDomainEvent } = require('../lib/eventBus');
const { agentQueue, syncQueue } = require('../queues');
const { listActiveUserIds } = require('./helpers');
const { createGroqWorker } = require('./groqWorker');
const { createGitHubWorker } = require('./githubWorker');
const { createAgentWorker } = require('./agentWorker');
const { createSyncWorker } = require('./syncWorker');
const { createNotificationWorker } = require('./notificationWorker');

let bootstrapped = false;

async function registerRepeatableJobs() {
  const userIds = await listActiveUserIds();

  for (const userId of userIds) {
    await syncQueue.add(
      'sync_all',
      { userId },
      {
        jobId: `repeat:sync_all:${userId}`,
        priority: 3,
        repeat: { every: 5 * 60 * 1000 },
      }
    );

    await agentQueue.add(
      'detect_anomalies',
      { userId },
      {
        jobId: `repeat:detect_anomalies:${userId}`,
        priority: 1,
        repeat: { every: 10 * 60 * 1000 },
      }
    );

    await agentQueue.add(
      'update_insights',
      { userId },
      {
        jobId: `repeat:update_insights:${userId}`,
        priority: 2,
        repeat: { every: 30 * 60 * 1000 },
      }
    );

    await syncQueue.add(
      'cleanup',
      { userId },
      {
        jobId: `repeat:cleanup:${userId}`,
        priority: 3,
        repeat: { every: 24 * 60 * 60 * 1000 },
      }
    );
  }
}

async function startWorkers() {
  if (bootstrapped) {
    return [];
  }

  bootstrapped = true;
  initializeEventBus();
  await registerRepeatableJobs();

  const workers = [
    createGroqWorker(),
    createGitHubWorker(),
    createAgentWorker(),
    createSyncWorker(),
    createNotificationWorker(),
  ];

  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[worker:${job.queueName}] completed ${job.name} (${job.id})`);
    });
    worker.on('failed', (job, error) => {
      if (job?.name === 'test_execution' || job?.name === 'calculate_confidence') {
        void emitDomainEvent(
          'test_failed',
          {
            userId: job.data?.userId,
            issueId: job.data?.issueId || null,
            error: error.message,
          },
          {
            userId: job.data?.userId,
            queueName: job.queueName,
            priority: 'high',
          }
        );
      }
      console.error(
        `[worker:${job?.queueName}] failed ${job?.name} (${job?.id}): ${error.message}`
      );
    });
  }

  return workers;
}

module.exports = {
  registerRepeatableJobs,
  startWorkers,
};
