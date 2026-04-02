const supabase = require('../lib/supabaseClient');
const { publishSystemEvent } = require('./liveEventsService');

function normalizeNotification(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    read: row.read,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function isMissingRelationError(error) {
  return (
    error?.code === '42P01' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('does not exist')
  );
}

async function createNotification(userId, input) {
  const payload = {
    user_id: userId,
    title: String(input.title || 'Agent update'),
    message: String(input.message || ''),
    type: String(input.type || 'info'),
    read: false,
    metadata: input.metadata || {},
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) {
      return {
        id: `temp-${Date.now()}`,
        userId,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        read: false,
        metadata: payload.metadata,
        createdAt: new Date().toISOString(),
      };
    }
    throw error;
  }

  const notification = normalizeNotification(data);
  await publishSystemEvent({
    userId,
    type: 'notification_created',
    queueName: 'realtime',
    priority: 'normal',
    payload: {
      notification,
    },
  }).catch(() => null);

  return notification;
}

async function listNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  const notifications = (data || []).map(normalizeNotification);
  for (const notification of notifications) {
    await publishSystemEvent({
      userId,
      type: 'notification_read',
      queueName: 'realtime',
      priority: 'low',
      payload: {
        notificationId: notification.id,
      },
    }).catch(() => null);
  }

  return notifications;
}

async function markNotificationsRead(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .in('id', ids)
    .select('*');

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map(normalizeNotification);
}

module.exports = {
  createNotification,
  listNotifications,
  markNotificationsRead,
};
