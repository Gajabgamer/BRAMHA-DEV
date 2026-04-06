export default function CTASection({ onOpenSignup }) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_70%_75%_at_50%_50%,rgba(245,197,24,0.06)_0%,transparent_70%),linear-gradient(180deg,#0d111a_0%,#0a0d13_100%)] px-5 py-24 md:px-8">
      <div className="section-container grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <span className="section-label">Tonight&apos;s Watchlist</span>
          <h2 className="section-title">
            READY TO <em className="not-italic text-gold">WATCH</em> TONIGHT?
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted md:text-base">
            Sign up, rent one title, and start streaming in minutes without committing to another monthly bill.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <a className="btn-primary" href="#movies">
            Browse Movies
          </a>
          <button className="btn-secondary" type="button" onClick={onOpenSignup}>
            Create Account
          </button>
        </div>
      </div>
    </section>
  );
}
