const { createQueue } = require('./baseQueue');

const NOTIFICATION_QUEUE_NAME = 'notification';
const notificationQueue = createQueue(NOTIFICATION_QUEUE_NAME);

module.exports = {
  NOTIFICATION_QUEUE_NAME,
  notificationQueue,
};
