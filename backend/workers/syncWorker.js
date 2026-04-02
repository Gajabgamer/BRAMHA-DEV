const { Worker } = require('bullmq');
const connectionsController = require('../controllers/connectionsController');
const { invokeController } = require('../services/internalControllerInvoker');
const { getRedisConnection } = require('../lib/redis');
const { SYNC_QUEUE_NAME } = require('../queues/syncQueue');
const { emitDomainEvent } = require('../lib/eventBus');
const { emitWorkerUpdate, getUserById } = require('./helpers');

async function runSync(user, provider, syncPayload) {
  const response = await invokeController(connectionsController.syncConnection, {
    user,
    params: { provider },
    body: syncPayload || {},
  });

  return response.payload;
}

function createSyncWorker() {
  return new Worker(
    SYNC_QUEUE_NAME,
    async (job) => {
      await emitWorkerUpdate(job, 'job_started', { stage: 'sync' }, 'normal');
      const user = await getUserById(job.data.userId);

      if (job.name === 'sync_all') {
        const providers = Array.isArray(job.data.providers) && job.data.providers.length
          ? job.data.providers
          : ['gmail', 'app-reviews', 'google-play', 'imap'];
        const results = [];

        for (const provider of providers) {
          try {
            const result = await runSync(user, provider, job.data.syncPayload);
            results.push({ provider, success: true, result });
          } catch (error) {
            results.push({
              provider,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return { results };
      }

      if (job.name === 'sync_gmail' || job.name === 'sync_reviews' || job.name === 'sync_sdk' || job.name === 'sync_sources') {
        const provider =
          job.data.provider ||
          (job.name === 'sync_gmail'
            ? 'gmail'
            : job.name === 'sync_reviews'
              ? 'app-reviews'
              : 'imap');

        const result = await runSync(user, provider, job.data.syncPayload);
        if (Number(result?.imported || 0) > 0) {
          await emitDomainEvent(
            'new_feedback',
            {
              userId: job.data.userId,
              provider,
              imported: result.imported,
            },
            {
              userId: job.data.userId,
              queueName: SYNC_QUEUE_NAME,
              priority: 'high',
            }
          );
        }
        return result;
      }

      if (job.name === 'cleanup') {
        return {
          cleaned: true,
          message: 'BullMQ handles most cleanup through removeOnComplete/removeOnFail.',
        };
      }

      throw new Error(`Unsupported sync job: ${job.name}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}

module.exports = {
  createSyncWorker,
};
