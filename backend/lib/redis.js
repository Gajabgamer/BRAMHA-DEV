const IORedis = require('ioredis');

let connection;

function getRedisConnection() {
  if (connection) {
    return connection;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Missing REDIS_URL in backend environment.');
  }

  connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });

  connection.on('error', (error) => {
    console.error('[redis] connection error', error.message);
  });

  return connection;
}

module.exports = {
  getRedisConnection,
};
