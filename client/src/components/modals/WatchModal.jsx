import ModalShell from "../ui/ModalShell";

export default function WatchModal({ isOpen, movie, streamUrl, onClose, onPlaybackStarted }) {
  if (!movie) {
    return null;
  }

  return (
    <ModalShell isOpen={isOpen} onClose={onClose}>
      <div className="mb-6">
        <span className="section-label">Protected Streaming</span>
        <h2 className="mt-2 font-display text-5xl leading-none tracking-[0.04em] text-white">WATCH NOW</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          Streaming is protected by rental validation. If the file is missing locally, this player will show a load error instead of exposing the movie.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <img className="aspect-[2/3] w-full rounded-3xl object-cover shadow-soft" src={movie.poster} alt={`${movie.title} poster`} />

        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-muted">
            {movie.genreLabel} · {movie.duration} · {movie.quality}
          </div>
          <h3 className="mt-3 text-3xl font-semibold text-white">{movie.title}</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{movie.synopsis}</p>

          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black">
            {movie.hasVideo ? (
              <video
                className="aspect-video w-full bg-black"
                controls
                preload="metadata"
                src={streamUrl}
                onPlay={onPlaybackStarted}
              />
            ) : (
              <div className="grid min-h-[280px] place-items-center p-6 text-center">
                  <div>
                    <div className="text-lg font-semibold text-white">Sample video file missing</div>
                    <p className="mt-3 max-w-md text-sm leading-7 text-muted">
                      Add <strong className="text-white">{movie.fileName || movie.file}</strong> to the backend <code>movies</code> folder to enable playback for this title.
                    </p>
                  </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
