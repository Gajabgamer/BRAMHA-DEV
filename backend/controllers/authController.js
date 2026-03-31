const supabase = require("../lib/supabaseClient");
const { ensureUserRecords } = require("../lib/ensureUserRecords");

async function register(req, res) {
  const { email, password, fullName } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName ?? "",
    },
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  await ensureUserRecords({
    id: data.user?.id ?? null,
    email: data.user?.email ?? email,
  });

  return res.status(201).json({
    user: {
      id: data.user?.id ?? null,
      email: data.user?.email ?? email,
    },
  });
}

module.exports = {
  register,
};
