const supabase = require('./supabaseClient');

async function upsertBestEffort(table, payload, fallbacks = []) {
  const attempts = [payload, ...fallbacks];

  for (const attempt of attempts) {
    const { error } = await supabase
      .from(table)
      .upsert(attempt, { onConflict: 'id' });

    if (!error) {
      return;
    }

    if (
      error.code === '42P01' ||
      error.message?.toLowerCase().includes('relation') ||
      error.message?.toLowerCase().includes('does not exist')
    ) {
      return;
    }
  }
}

async function ensureUserRecords(user) {
  if (!user?.id) {
    return;
  }

  const email = user.email || null;

  await upsertBestEffort(
    'users',
    {
      id: user.id,
      email,
    },
    [{ id: user.id }]
  );

  await upsertBestEffort(
    'profiles',
    {
      id: user.id,
      email,
    },
    [
      {
        id: user.id,
        full_name: email ? String(email).split('@')[0] : null,
      },
      { id: user.id },
    ]
  );
}

module.exports = {
  ensureUserRecords,
};
