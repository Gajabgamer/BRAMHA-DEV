const { Worker } = require('bullmq');
const { createNotification } = require('../services/notificationService');
const { sendReply } = require('../services/emailService');
const { getRedisConnection } = require('../lib/redis');
const { NOTIFICATION_QUEUE_NAME } = require('../queues/notificationQueue');
const { emitWorkerUpdate } = require('./helpers');

function createNotificationWorker() {
  return new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      await emitWorkerUpdate(job, 'job_started', { stage: 'notification' }, 'normal');

      if (job.name === 'send_alert' || job.name === 'push_notification') {
        return createNotification(job.data.userId, {
          title: job.data.title,
          message: job.data.message,
          type: job.data.type || 'info',
          metadata: job.data.metadata || {},
        });
      }

      if (job.name === 'send_email') {
        return sendReply({
          userId: job.data.userId,
          to: job.data.to,
          subject: job.data.subject,
          message: job.data.message,
          threadId: job.data.threadId || null,
          references: job.data.references || null,
        });
      }

      throw new Error(`Unsupported notification job: ${job.name}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  );
}

module.exports = {
  createNotificationWorker,
};
