const { createQueue } = require('./baseQueue');

const GROQ_QUEUE_NAME = 'groq';
const groqQueue = createQueue(GROQ_QUEUE_NAME);

module.exports = {
  GROQ_QUEUE_NAME,
  groqQueue,
};
