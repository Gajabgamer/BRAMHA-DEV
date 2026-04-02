const { Queue } = require('bullmq');
const { getRedisConnection } = require('../lib/redis');

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

function createQueue(name) {
  let instance = null;

  function ensureQueue() {
    if (!instance) {
      instance = new Queue(name, {
        connection: getRedisConnection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      });
    }
    return instance;
  }

  return {
    name,
    add(...args) {
      return ensureQueue().add(...args);
    },
    getJob(...args) {
      return ensureQueue().getJob(...args);
    },
    close(...args) {
      if (!instance) {
        return Promise.resolve();
      }
      return instance.close(...args);
    },
    get bull() {
      return ensureQueue();
    },
  };
}

module.exports = {
  DEFAULT_JOB_OPTIONS,
  createQueue,
};
