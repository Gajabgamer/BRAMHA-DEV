const { createQueue } = require('./baseQueue');

const AGENT_QUEUE_NAME = 'agent';
const agentQueue = createQueue(AGENT_QUEUE_NAME);

module.exports = {
  AGENT_QUEUE_NAME,
  agentQueue,
};
