const { Worker } = require('bullmq');
const agentCodeController = require('../controllers/agentCodeController');
const { analyzeRepositoryStructure } = require('../services/repoStructureService');
const { invokeController } = require('../services/internalControllerInvoker');
const { getRedisConnection } = require('../lib/redis');
const { GITHUB_QUEUE_NAME } = require('../queues/githubQueue');
const { emitDomainEvent } = require('../lib/eventBus');
const { emitWorkerUpdate, getUserById } = require('./helpers');

function createGitHubWorker() {
  return new Worker(
    GITHUB_QUEUE_NAME,
    async (job) => {
      await emitWorkerUpdate(job, 'job_started', { stage: 'github' }, 'high');
      const user = await getUserById(job.data.userId);

      if (job.name === 'fetch_repo') {
        const structure = await analyzeRepositoryStructure(job.data.userId, {
          repoOwner: job.data.repository?.owner || job.data.repoOwner,
          repoName: job.data.repository?.name || job.data.repoName,
          forceRefresh: true,
        });
        return { structure };
      }

      if (job.name === 'apply_patch' || job.name === 'create_pr') {
        const response = await invokeController(agentCodeController.createPatchPullRequest, {
          user,
          params: {
            issueId: String(job.data.issueId || ''),
          },
          body: {
            patch: job.data.patch,
            title: job.data.title,
            body: job.data.body,
            prDescription: job.data.prDescription,
            repoOwner: job.data.repoOwner,
            repoName: job.data.repoName,
            generatedTest: job.data.generatedTest,
          },
        });

        await emitDomainEvent(
          'update',
          {
            type: 'github_pr_created',
            issueId: job.data.issueId,
            pullRequest: response.payload.pullRequest || null,
          },
          {
            userId: job.data.userId,
            queueName: GITHUB_QUEUE_NAME,
            priority: 'high',
          }
        );

        return response.payload;
      }

      if (job.name === 'test_execution') {
        const response = await invokeController(agentCodeController.validateIssuePatch, {
          user,
          params: {
            issueId: String(job.data.issueId || ''),
          },
          body: {
            patch: job.data.patch,
            repoOwner: job.data.repoOwner,
            repoName: job.data.repoName,
            generatedTest: job.data.generatedTest,
          },
        });

        return response.payload;
      }

      throw new Error(`Unsupported github job: ${job.name}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}

module.exports = {
  createGitHubWorker,
};
