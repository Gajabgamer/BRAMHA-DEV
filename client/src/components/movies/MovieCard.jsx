export default function MovieCard({ movie, price, activeRental, nightOfferActive, onTrailer, onRent, onWatch }) {
  return (
    <article className="surface-card group overflow-hidden">
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          src={movie.poster}
          alt={`${movie.title} poster`}
        />

        {activeRental ? (
          <span className="absolute left-3 top-3 rounded-full border border-gold/30 bg-ink/90 px-3 py-1 text-[0.7rem] uppercase tracking-[0.14em] text-gold">
            ⏳ {activeRental}
          </span>
        ) : null}

        {movie.badge ? (
          <span className="absolute right-3 top-3 rounded-full border border-danger/30 bg-danger/20 px-3 py-1 text-[0.7rem] uppercase tracking-[0.14em] text-white">
            {movie.badge}
          </span>
        ) : null}

        {movie.nightEligible ? (
          <span className="absolute bottom-3 left-3 rounded-full border border-emerald-400/30 bg-emerald-400/15 px-3 py-1 text-[0.7rem] uppercase tracking-[0.14em] text-emerald-200">
            {nightOfferActive ? "Night Offer Live" : "Night Offer ₹20"}
          </span>
        ) : null}

        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink via-ink/20 to-transparent p-4 opacity-0 transition duration-300 group-hover:opacity-100">
          <button
            className="btn-primary btn-small"
            type="button"
            onClick={() => onTrailer(movie.id)}
            data-user-action="watch-trailer"
            data-movie-id={movie.id}
          >
            Quick Preview
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            {movie.genreLabel} · {movie.quality}
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">{movie.title}</h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted">{movie.duration}</span>
          <strong className="font-display text-3xl tracking-[0.04em] text-gold">₹{price}</strong>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="btn-secondary btn-small"
            type="button"
            onClick={() => onTrailer(movie.id)}
            data-user-action="watch-trailer"
            data-movie-id={movie.id}
          >
            Watch Trailer
          </button>
          <button
            className="btn-primary btn-small"
            type="button"
            onClick={() => (activeRental ? onWatch(movie.id) : onRent(movie.id))}
            data-user-action={activeRental ? "watch-now" : "rent"}
            data-movie-id={movie.id}
          >
            {activeRental ? "Watch Now" : "Rent Now"}
          </button>
        </div>
      </div>
    </article>
  );
}
