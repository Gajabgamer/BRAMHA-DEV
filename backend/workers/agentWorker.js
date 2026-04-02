const { Worker } = require('bullmq');
const { rebuildIssuesFromFeedback } = require('../lib/issueAggregator');
const { getConfidenceForIssue } = require('../services/learningService');
const { generateExecutiveSummary } = require('../services/executiveSummaryService');
const { runAgent } = require('../services/agentService');
const { getRedisConnection } = require('../lib/redis');
const { AGENT_QUEUE_NAME } = require('../queues/agentQueue');
const { emitWorkerUpdate, getUserById } = require('./helpers');

function createAgentWorker() {
  return new Worker(
    AGENT_QUEUE_NAME,
    async (job) => {
      await emitWorkerUpdate(job, 'job_started', { stage: 'agent' }, 'high');
      const user = await getUserById(job.data.userId);

      if (job.name === 'process_feedback') {
        await rebuildIssuesFromFeedback(job.data.userId);
        return runAgent(user, {
          background: true,
          mode: job.name,
        });
      }

      if (job.name === 'detect_issue' || job.name === 'agent_loop' || job.name === 'detect_anomalies') {
        return runAgent(user, {
          background: true,
          mode: job.name,
        });
      }

      if (job.name === 'calculate_confidence') {
        return getConfidenceForIssue(job.data.userId, String(job.data.issueId || ''));
      }

      if (job.name === 'update_insights') {
        return generateExecutiveSummary(user);
      }

      throw new Error(`Unsupported agent job: ${job.name}`);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}

module.exports = {
  createAgentWorker,
};
