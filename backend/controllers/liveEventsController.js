const {
  listRecentEvents,
  subscribeToUserEvents,
} = require('../services/liveEventsService');

function writeSseEvent(res, event) {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

async function streamEvents(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastSeenAt = new Date(Date.now() - 60 * 1000).toISOString();
  const seenIds = new Set();

  const sendRecentEvents = async () => {
    try {
      const events = await listRecentEvents(req.user.id, {
        since: lastSeenAt,
        limit: 50,
      });

      for (const event of events) {
        if (seenIds.has(event.id)) {
          continue;
        }
        seenIds.add(event.id);
        lastSeenAt = event.createdAt || lastSeenAt;
        writeSseEvent(res, event);
      }
    } catch {
      // Keep stream alive even if event refresh fails.
    }
  };

  await sendRecentEvents();

  const unsubscribe = subscribeToUserEvents(req.user.id, (event) => {
    if (seenIds.has(event.id)) {
      return;
    }
    seenIds.add(event.id);
    lastSeenAt = event.createdAt || lastSeenAt;
    writeSseEvent(res, event);
  });

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
  }, 20000);

  const backlogTimer = setInterval(() => {
    void sendRecentEvents();
  }, 2000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(backlogTimer);
    unsubscribe();
    res.end();
  });
}

module.exports = {
  streamEvents,
};
