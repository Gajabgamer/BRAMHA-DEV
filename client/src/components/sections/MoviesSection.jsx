import MovieCard from "../movies/MovieCard";
import EmptyState from "../ui/EmptyState";
import SectionHeader from "../ui/SectionHeader";

export default function MoviesSection({
  genreOptions,
  filters,
  onSearchChange,
  onGenreChange,
  visibleMovies,
  activeRentalMap,
  nightOfferActive,
  isLoading,
  onTrailer,
  onRent,
  onWatch,
  onReset
}) {
  return (
    <section id="movies" className="section-wrap bg-deep/95">
      <div className="section-container">
        <SectionHeader
          label="Now Available"
          title="BROWSE"
          accent="FILMS"
          copy="Search, filter, preview, and rent without leaving the page. Every primary action is already wired with backend-friendly hooks and service placeholders."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_260px_300px] lg:items-end">
          <label>
            <span className="field-label">Search</span>
            <input
              className="field-input"
              type="search"
              value={filters.search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by movie name"
            />
          </label>

          <label>
            <span className="field-label">Filter by Genre</span>
            <select
              className="field-input appearance-none"
              value={filters.genre}
              onChange={(event) => onGenreChange(event.target.value)}
            >
              {genreOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="surface-card p-5">
            <div className="section-label">Innovation Feature</div>
            <div className="mt-2 text-lg font-semibold text-white">{nightOfferActive ? "Night Offer Live" : "Night Offer ₹20"}</div>
            <div className="mt-1 text-sm leading-7 text-muted">
              {nightOfferActive ? "Selected titles are unlocked at ₹20 right now." : "Returns daily between 12 AM and 5 AM on selected titles."}
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          {genreOptions.map((option) => (
            <button
              key={option.value}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                filters.genre === option.value
                  ? "border-gold bg-gold text-ink"
                  : "border-white/10 text-muted hover:border-white/20 hover:text-white"
              }`}
              type="button"
              onClick={() => onGenreChange(option.value)}
            >
              {option.label === "All genres" ? "All" : option.label}
            </button>
          ))}
        </div>

        <div className="mb-5 mt-5 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
          <p className="text-white">
            {isLoading ? "Refreshing titles..." : `${visibleMovies.length} title${visibleMovies.length === 1 ? "" : "s"} available`}
          </p>
          <p className="text-muted">Search updates instantly and is already ready to map to server-side filtering later.</p>
        </div>

        {isLoading ? (
          <div className="movie-grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="surface-card overflow-hidden">
                <div className="aspect-[2/3] animate-pulse bg-white/5" />
                <div className="space-y-3 p-4">
                  <div className="h-3 rounded-full bg-white/5" />
                  <div className="h-3 w-2/3 rounded-full bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleMovies.length === 0 ? (
          <EmptyState
            title="No movies match this search"
            text="Try another title or reset the genre filter to discover more films."
            actionLabel="Reset Filters"
            onAction={onReset}
          />
        ) : (
          <div className="movie-grid">
            {visibleMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                price={movie.displayPrice}
                activeRental={activeRentalMap[movie.id]}
                nightOfferActive={nightOfferActive}
                onTrailer={onTrailer}
                onRent={onRent}
                onWatch={onWatch}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
