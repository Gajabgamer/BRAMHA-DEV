const supabase = require('../lib/supabaseClient');
const { publishSystemEvent } = require('../services/liveEventsService');

async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(`User ${userId} not found.`);
  }

  return data;
}

async function listActiveUserIds() {
  const { data, error } = await supabase.from('users').select('id');
  if (error) {
    throw error;
  }

  return (data || []).map((row) => row.id).filter(Boolean);
}

async function emitWorkerUpdate(job, type, payload = {}, priority = 'normal') {
  if (!job?.data?.userId) {
    return;
  }

  await publishSystemEvent({
    userId: job.data.userId,
    type,
    queueName: job.queueName,
    priority,
    payload: {
      jobId: job.id,
      jobName: job.name,
      ...payload,
    },
  }).catch(() => null);
}

module.exports = {
  emitWorkerUpdate,
  getUserById,
  listActiveUserIds,
};
