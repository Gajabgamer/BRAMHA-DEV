const { EventEmitter } = require('events');
const {
  QUEUE_PRIORITY,
  agentQueue,
  githubQueue,
  groqQueue,
  notificationQueue,
  syncQueue,
} = require('../queues');
const { publishSystemEvent } = require('../services/liveEventsService');

const eventBus = new EventEmitter();
eventBus.setMaxListeners(200);

let initialized = false;

function createJobOptions(input = {}) {
  const priorityKey = input.priority || 'medium';
  return {
    priority: QUEUE_PRIORITY[priorityKey] || QUEUE_PRIORITY.medium,
    jobId: input.jobId || undefined,
  };
}

function registerListener(eventName, handler) {
  eventBus.on(eventName, async (payload = {}) => {
    try {
      await handler(payload);
    } catch (error) {
      console.error(`[event-bus] ${eventName} listener failed`, error);
    }
  });
}

function initializeEventBus() {
  if (initialized) {
    return eventBus;
  }

  initialized = true;

  registerListener('new_feedback', async (payload) => {
    await agentQueue.add(
      'process_feedback',
      payload,
      createJobOptions({
        priority: 'critical',
        jobId: payload.jobId || `${payload.userId}:process_feedback:${payload.provider || 'all'}`,
      })
    );
  });

  registerListener('repo_connected', async (payload) => {
    const repoName = payload.repository?.name || payload.repoName;
    const repoOwner = payload.repository?.owner || payload.repoOwner;
    if (!repoName || !repoOwner) {
      return;
    }

    await githubQueue.add(
      'fetch_repo',
      payload,
      createJobOptions({
        priority: 'medium',
        jobId: payload.jobId || `${payload.userId}:fetch_repo:${payload.repository?.name || payload.provider || 'repo'}`,
      })
    );
  });

  registerListener('patch_accepted', async (payload) => {
    await githubQueue.add(
      'create_pr',
      payload,
      createJobOptions({
        priority: 'critical',
        jobId: payload.jobId || `${payload.userId}:create_pr:${payload.issueId || 'issue'}`,
      })
    );
  });

  registerListener('test_failed', async (payload) => {
    await agentQueue.add(
      'calculate_confidence',
      payload,
      createJobOptions({
        priority: 'critical',
        jobId: payload.jobId || `${payload.userId}:calculate_confidence:${payload.issueId || 'issue'}`,
      })
    );
  });

  registerListener('sync_requested', async (payload) => {
    await syncQueue.add(
      payload.jobName || 'sync_sources',
      payload,
      createJobOptions({
        priority: payload.priority || 'low',
        jobId: payload.jobId,
      })
    );
  });

  registerListener('groq_requested', async (payload) => {
    await groqQueue.add(
      payload.jobName || 'chat',
      payload,
      createJobOptions({
        priority: payload.priority || 'medium',
        jobId: payload.jobId,
      })
    );
  });

  registerListener('notify', async (payload) => {
    await notificationQueue.add(
      payload.jobName || 'push_notification',
      payload,
      createJobOptions({
        priority: payload.priority || 'medium',
        jobId: payload.jobId,
      })
    );
  });

  return eventBus;
}

async function emitDomainEvent(eventName, payload = {}, options = {}) {
  initializeEventBus();
  if (options.userId) {
    await publishSystemEvent({
      userId: options.userId,
      type: eventName,
      queueName: options.queueName || null,
      priority: options.priority || 'normal',
      payload,
    }).catch(() => null);
  }

  eventBus.emit(eventName, payload);
}

module.exports = {
  emitDomainEvent,
  eventBus,
  initializeEventBus,
};
