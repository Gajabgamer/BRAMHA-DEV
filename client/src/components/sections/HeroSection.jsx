export default function HeroSection({ nightOfferActive, heroCountdown, onOpenSignup }) {
  const pricePanels = [
    { label: "Budget Pick", amount: "₹30", note: "Classics and fan favorites" },
    { label: "Most Popular", amount: "₹49", note: "Fresh releases in HD", featured: true },
    {
      label: "Night Offer",
      amount: "₹20",
      note: nightOfferActive ? "Live now on selected titles until 5 AM" : "Selected titles between 12 AM and 5 AM"
    }
  ];

  return (
    <section id="home" className="relative min-h-screen overflow-hidden px-5 pb-20 pt-32 md:px-8">
      <div className="hero-ambient absolute inset-0" />
      <div className="noise-overlay absolute inset-0 opacity-[0.025]" />

      <div className="section-container relative grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,400px)]">
        <div className="animate-fade-up">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.16em] text-gold">
            <span className="inline-block h-2 w-2 rounded-full bg-gold animate-pulse-soft" />
            Pay Per Movie · No Subscription Needed
          </p>
          <h1 className="font-display text-[clamp(4rem,9vw,8rem)] leading-[0.92] tracking-[0.04em] text-white">
            WATCH
            <br />
            <em className="not-italic text-gold">ANY</em> FILM
            <br />
            FOR <span className="text-danger">24 HRS</span>
          </h1>
          <p className="mt-6 max-w-[640px] font-serif text-xl leading-8 text-muted">
            Skip expensive monthly plans. Rent the exact movie you want, <strong className="font-normal italic text-text">starting at just ₹30</strong>, valid for a full 24 hours with instant access.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a className="btn-primary" href="#movies">
              Browse Movies
            </a>
            <button className="btn-secondary" type="button" onClick={onOpenSignup}>
              Start Free Account
            </button>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["500+", "Movies Available"],
              ["₹30", "Starting Price"],
              ["24hr", "Rental Window"],
              ["0", "Subscriptions"]
            ].map(([value, label]) => (
              <div key={label} className="surface-card p-5">
                <div className="font-display text-4xl text-white">{value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="grid gap-4">
          {pricePanels.map((panel) => (
            <article
              key={panel.label}
              className={`surface-card overflow-hidden p-6 ${panel.featured ? "border-gold/25 bg-card-raised" : ""}`}
            >
              <div className="section-label">{panel.label}</div>
              <div className="mt-2 font-display text-6xl leading-none tracking-[0.04em] text-gold">{panel.amount}</div>
              <div className="mt-1 text-sm text-muted">{panel.note}</div>
            </article>
          ))}

          <article className="surface-card p-6">
            <div className="section-label">Live Rental Clock</div>
            <div className="mt-3 flex items-center gap-2 font-display text-5xl tracking-[0.04em] text-white">
              <span>{heroCountdown.hours}</span>
              <span className="text-gold">:</span>
              <span>{heroCountdown.minutes}</span>
              <span className="text-gold">:</span>
              <span>{heroCountdown.seconds}</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-muted">Your access starts when you press play, not when you pay.</p>
          </article>
        </aside>
      </div>
    </section>
  );
}
