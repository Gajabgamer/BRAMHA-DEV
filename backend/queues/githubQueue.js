const { createQueue } = require('./baseQueue');

const GITHUB_QUEUE_NAME = 'github';
const githubQueue = createQueue(GITHUB_QUEUE_NAME);

module.exports = {
  GITHUB_QUEUE_NAME,
  githubQueue,
};
