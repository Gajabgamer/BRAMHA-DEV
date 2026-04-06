import ModalShell from "../ui/ModalShell";

export default function TrailerModal({ isOpen, movie, price, onClose, onRent }) {
  if (!movie) {
    return null;
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="mb-6">
        <span className="section-label">Trailer Preview</span>
        <h2 className="mt-2 font-display text-5xl leading-none tracking-[0.04em] text-white">WATCH TRAILER</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <img className="aspect-[2/3] w-full rounded-3xl object-cover shadow-soft" src={movie.poster} alt={`${movie.title} poster`} />

        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            {movie.genreLabel} · {movie.duration} · ₹{price}
          </div>
          <h3 className="mt-3 text-3xl font-semibold text-white">{movie.title}</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{movie.synopsis}</p>

          <div className="mt-5 grid min-h-[190px] place-items-center gap-3 rounded-3xl border border-dashed border-gold/20 bg-white/5 p-6 text-center">
            <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-gold/15 text-2xl text-gold">▶</div>
            <p className="max-w-md text-sm leading-7 text-muted">
              This is a UI-ready trailer state. Replace this panel with a real player or OTT preview endpoint later.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="btn-primary btn-small"
              type="button"
              onClick={() => onRent(movie.id)}
              data-user-action="rent"
              data-movie-id={movie.id}
            >
              Rent Now
            </button>
            <button className="btn-secondary btn-small" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
