export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-deep px-5 py-14 md:px-8">
      <div className="section-container">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <a className="brand-mark mb-4 inline-block" href="#home">
              MOVIE<span>24</span>
            </a>
            <p className="max-w-sm text-sm leading-7 text-muted">
              India&apos;s pay-per-movie OTT rental platform for people who want the movie night, not the monthly bill.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-xs uppercase tracking-[0.2em] text-white">Platform</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#movies">Browse</a></li>
              <li><a href="#continue-watching">Continue Watching</a></li>
              <li><a href="#my-rentals">My Rentals</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-xs uppercase tracking-[0.2em] text-white">Company</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#how-it-works">How It Works</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#why-movie24">Why Movie24</a></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-xs uppercase tracking-[0.2em] text-white">Support</h3>
            <ul className="space-y-2 text-sm text-muted">
              <li><a href="#home">FAQs</a></li>
              <li><a href="#home">Contact</a></li>
              <li><a href="#home">Refund Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-sm text-muted md:flex-row md:justify-between">
          <span>© 2026 Movie24 · Pay Per Movie · 24 Hour OTT Rental Platform</span>
          <span>No subscription. No auto-renewal. Just great cinema on demand.</span>
        </div>
      </div>
    </footer>
  );
}
