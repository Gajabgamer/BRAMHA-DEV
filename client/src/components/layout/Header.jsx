import { Link } from "react-router-dom";

export default function Header({
  isScrolled,
  isAdminView,
  isAdmin,
  mobileOpen,
  onToggleMobile,
  user,
  onOpenLogin,
  onOpenSignup,
  onLogout
}) {
  const links = isAdminView
    ? [{ href: "/#movies", label: "Back to Site", isRoute: true }]
    : [
        { href: "#movies", label: "Browse" },
        { href: "#continue-watching", label: "Continue Watching" },
        { href: "#my-rentals", label: "My Rentals" },
        { href: "#how-it-works", label: "How It Works" },
        { href: "#pricing", label: "Pricing" }
      ];

  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 border-b transition duration-300 ${
        isScrolled ? "border-white/5 bg-ink/90 backdrop-blur-xl" : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex w-full max-w-[1240px] items-start justify-between gap-6 px-5 py-4 md:px-8">
        <Link className="brand-mark" to="/">
          MOVIE<span>24</span>
        </Link>

        <button
          className="inline-flex flex-col gap-1.5 pt-2 text-white md:hidden"
          type="button"
          onClick={onToggleMobile}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
        >
          <span className="h-0.5 w-7 bg-current" />
          <span className="h-0.5 w-7 bg-current" />
        </button>

        <div
          className={`absolute left-5 right-5 top-[calc(100%-0.25rem)] rounded-3xl border border-white/10 bg-ink/95 p-5 shadow-soft transition duration-200 md:static md:flex md:flex-1 md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0 md:shadow-none ${
            mobileOpen ? "pointer-events-auto translate-y-2 opacity-100" : "pointer-events-none -translate-y-2 opacity-0 md:pointer-events-auto md:translate-y-0 md:opacity-100"
          }`}
        >
          <ul className="mb-4 flex list-none flex-col gap-4 p-0 md:mb-0 md:flex-row md:items-center md:gap-7">
            {links.map((link) => (
              <li key={link.href}>
                {link.isRoute ? (
                  <Link className="text-sm uppercase tracking-[0.14em] text-muted transition hover:text-gold" to={link.href}>
                    {link.label}
                  </Link>
                ) : (
                  <a className="text-sm uppercase tracking-[0.14em] text-muted transition hover:text-gold" href={link.href}>
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {user ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {isAdmin ? (
                  <Link className="btn-primary btn-small text-center" to={isAdminView ? "/" : "/admin"}>
                    {isAdminView ? "Back to Home" : "Admin Panel"}
                  </Link>
                ) : null}
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold/20 to-danger/20 font-semibold text-white">
                    {user.initials}
                  </div>
                  <div>
                    <div className="text-[0.72rem] uppercase tracking-[0.14em] text-muted">Logged in as</div>
                    <div className="text-sm font-semibold text-white">{user.name}</div>
                  </div>
                </div>
                <button className="btn-secondary btn-small" type="button" onClick={onLogout}>
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button className="btn-secondary btn-small" type="button" onClick={onOpenLogin}>
                  Log In
                </button>
                <button className="btn-primary btn-small" type="button" onClick={onOpenSignup}>
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
