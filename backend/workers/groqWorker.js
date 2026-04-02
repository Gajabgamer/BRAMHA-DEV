const { Worker } = require('bullmq');
const aiController = require('../controllers/aiController');
const agentCodeController = require('../controllers/agentCodeController');
const { invokeController } = require('../services/internalControllerInvoker');
const { getRedisConnection } = require('../lib/redis');
const { GROQ_QUEUE_NAME } = require('../queues/groqQueue');
const { emitWorkerUpdate, getUserById } = require('./helpers');

function createGroqWorker() {
  return new Worker(
    GROQ_QUEUE_NAME,
    async (job) => {
      await emitWorkerUpdate(job, 'job_started', { stage: 'groq' }, 'high');
      const user = await getUserById(job.data.userId);

      if (job.name === 'chat') {
        const response = await invokeController(aiController.chatWithAssistant, {
          user,
          body: {
            message: job.data.message,
          },
        });
        return response.payload;
      }

      if (job.name === 'patch_generation') {
        const response = await invokeController(agentCodeController.analyzeIssueCode, {
          user,
          params: {
            issueId: String(job.data.issueId || ''),
          },
          body: {
            repoOwner: job.data.repoOwner,
            repoName: job.data.repoName,
          },
        });
        return response.payload;
      }

      throw new Error(`Unsupported groq job: ${job.name}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  );
}

module.exports = {
  createGroqWorker,
};
