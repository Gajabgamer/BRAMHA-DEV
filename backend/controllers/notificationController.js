const {
  listNotifications,
  markNotificationsRead,
} = require('../services/notificationService');

async function getNotifications(req, res) {
  try {
    const notifications = await listNotifications(req.user.id, 25);
    const unreadCount = notifications.filter((entry) => !entry.read).length;
    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to load notifications.',
    });
  }
}

async function markRead(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const notifications = await markNotificationsRead(req.user.id, ids);
    res.json({
      success: true,
      notifications,
    });
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Failed to update notifications.',
    });
  }
}

module.exports = {
  getNotifications,
  markRead,
};
