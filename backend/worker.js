require('dotenv').config();
const { startWorkers } = require('./workers');

startWorkers()
  .then(() => {
    console.log('[worker] BullMQ workers started');
  })
  .catch((error) => {
    console.error('[worker] fatal error', error);
    process.exit(1);
  });
