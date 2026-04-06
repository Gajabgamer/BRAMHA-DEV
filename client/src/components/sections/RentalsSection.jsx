import { formatDateTime } from "../../lib/utils";
import EmptyState from "../ui/EmptyState";
import SectionHeader from "../ui/SectionHeader";

export default function RentalsSection({ user, rentals, summary, onWatch, onTrailer, onSignup, onBrowse }) {
  return (
    <section id="my-rentals" className="section-wrap bg-[radial-gradient(circle_at_top_right,rgba(245,197,24,0.06),transparent_30%),linear-gradient(180deg,#0d111a_0%,#101520_100%)]">
      <div className="section-container">
        <SectionHeader
          label="24 Hour Access"
          title="MY"
          accent="RENTALS"
          copy="Active rentals show time remaining, payment status, and quick watch actions. Expired rentals automatically drop out of the dashboard."
        />

        <div className="dashboard-grid mb-7">
          <article className="surface-card p-5">
            <div className="section-label">Active Rentals</div>
            <div className="mt-2 font-display text-5xl text-gold">{summary.count}</div>
            <div className="mt-1 text-sm text-muted">Pulled from GET /my-rentals</div>
          </article>
          <article className="surface-card p-5">
            <div className="section-label">Closest Expiry</div>
            <div className="mt-2 font-display text-5xl text-gold">{summary.closestExpiry}</div>
            <div className="mt-1 text-sm text-muted">Updated every second</div>
          </article>
          <article className="surface-card p-5">
            <div className="section-label">Wallet Saved</div>
            <div className="mt-2 font-display text-5xl text-gold">₹329</div>
            <div className="mt-1 text-sm text-muted">Versus a typical monthly subscription</div>
          </article>
        </div>

        {!user ? (
          <EmptyState
            title="Sign in to view your rentals"
            text="The rentals dashboard is connected to a mock GET /my-rentals flow and will show active access windows once you log in."
            actionLabel="Create Account"
            onAction={onSignup}
          />
        ) : rentals.length === 0 ? (
          <EmptyState
            title="No active rentals"
            text="Rent any title from the Browse section to see the 24-hour countdown, watch status, and payment metadata here."
            actionLabel="Browse Movies"
            onAction={onBrowse}
          />
        ) : (
          <div className="grid gap-4">
            {rentals.map((rental) => (
              <article key={rental.id} className="surface-card grid gap-5 p-4 lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center">
                <img
                  className="h-[168px] w-[120px] rounded-2xl object-cover"
                  src={rental.movie.poster}
                  alt={`${rental.movie.title} poster`}
                />

                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    {rental.movie.genreLabel} · {rental.movie.duration} · Paid ₹{rental.pricePaid}
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-white">{rental.movie.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-muted">{rental.movie.synopsis}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-gold">
                    Expires in {rental.remaining}
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    Payment: {rental.paymentMethod.toUpperCase()} · Activated {formatDateTime(rental.rentedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary btn-small" type="button" onClick={() => onWatch(rental.movie.id)}>
                    Watch Now
                  </button>
                  <button className="btn-secondary btn-small" type="button" onClick={() => onTrailer(rental.movie.id)}>
                    Trailer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
