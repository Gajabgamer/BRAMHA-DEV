const { createQueue } = require('./baseQueue');

const SYNC_QUEUE_NAME = 'sync';
const syncQueue = createQueue(SYNC_QUEUE_NAME);

module.exports = {
  SYNC_QUEUE_NAME,
  syncQueue,
};
