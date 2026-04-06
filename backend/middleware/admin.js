const ADMIN_EMAIL = "admin@gmail.com";

function requireAdmin(req, res, next) {
  const email = req.user?.email?.trim().toLowerCase();

  if (email !== ADMIN_EMAIL) {
    return res.status(403).json({ message: "Admin access required." });
  }

  return next();
}

module.exports = {
  ADMIN_EMAIL,
  requireAdmin
};
