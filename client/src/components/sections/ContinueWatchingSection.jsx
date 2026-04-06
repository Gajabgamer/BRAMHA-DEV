import EmptyState from "../ui/EmptyState";
import SectionHeader from "../ui/SectionHeader";

export default function ContinueWatchingSection({
  user,
  items,
  onResume,
  onTrailer,
  onLogin,
  onBrowse
}) {
  return (
    <section id="continue-watching" className="section-wrap bg-deep">
      <div className="section-container">
        <SectionHeader
          label="Your Queue"
          title="CONTINUE"
          accent="WATCHING"
          copy="Pick up right where you left off across your rented titles. Progress is stored in UI state today and can be swapped to backend playback endpoints later."
        />

        {!user ? (
          <EmptyState
            title="Log in to continue watching"
            text="Your progress list, playback position, and resume actions appear here after authentication."
            actionLabel="Log In"
            onAction={onLogin}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing in progress yet"
            text="Rent a movie and tap Start Watching to create a continue-watching state with progress bars and resume actions."
            actionLabel="Browse Movies"
            onAction={onBrowse}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.movie.id} className="surface-card overflow-hidden">
                <img className="aspect-video w-full object-cover" src={item.movie.poster} alt={`${item.movie.title} poster`} />
                <div className="space-y-4 p-5">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">
                    {item.movie.genreLabel} · {item.movie.duration}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{item.movie.title}</h3>
                  <p className="text-sm text-muted">
                    Progress: {item.progress}% · Last position {item.lastPosition}
                  </p>
                  <progress
                    className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-value]:bg-[linear-gradient(90deg,#f5c518,#e8a000)]"
                    max="100"
                    value={item.progress}
                  />
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary btn-small" type="button" onClick={() => onResume(item.movie.id)}>
                      Resume Watching
                    </button>
                    <button className="btn-secondary btn-small" type="button" onClick={() => onTrailer(item.movie.id)}>
                      Watch Trailer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
