const { groqQueue } = require('./groqQueue');
const { githubQueue } = require('./githubQueue');
const { agentQueue } = require('./agentQueue');
const { syncQueue } = require('./syncQueue');
const { notificationQueue } = require('./notificationQueue');

const QUEUE_PRIORITY = {
  critical: 1,
  medium: 2,
  low: 3,
};

function getQueueForJobType(jobType) {
  switch (jobType) {
    case 'groq_chat':
    case 'chat':
    case 'patch_generation':
      return groqQueue;
    case 'create_pr':
    case 'fetch_repo':
    case 'apply_patch':
    case 'test_execution':
    case 'github_pr':
      return githubQueue;
    case 'process_feedback':
    case 'detect_issue':
    case 'calculate_confidence':
    case 'agent_loop':
    case 'detect_anomalies':
    case 'update_insights':
      return agentQueue;
    case 'sync_gmail':
    case 'sync_reviews':
    case 'sync_sdk':
    case 'sync_sources':
    case 'sync_all':
    case 'cleanup':
      return syncQueue;
    case 'send_alert':
    case 'send_email':
    case 'push_notification':
      return notificationQueue;
    default:
      return agentQueue;
  }
}

module.exports = {
  QUEUE_PRIORITY,
  agentQueue,
  getQueueForJobType,
  githubQueue,
  groqQueue,
  notificationQueue,
  syncQueue,
};
