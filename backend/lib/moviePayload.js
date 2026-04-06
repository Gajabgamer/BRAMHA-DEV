function titleCase(value = "") {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMoviePayload(movie) {
  const fileName = movie.fileName || movie.file || "";
  const genre = movie.genre || "featured";

  return {
    ...movie,
    id: movie.movieId,
    movieId: movie.movieId,
    adminId: movie._id?.toString?.() || movie.id || movie.movieId,
    description: movie.description || movie.synopsis || "",
    synopsis: movie.synopsis || movie.description || "New release added to Movie24.",
    genre,
    genreLabel: movie.genreLabel || titleCase(genre),
    duration: movie.duration || "2h 00m",
    price: Number(movie.price ?? 49),
    nightPrice: Number(movie.nightPrice ?? 20),
    nightEligible: Boolean(movie.nightEligible ?? false),
    quality: movie.quality || "HD",
    badge: movie.badge || "",
    palette: Array.isArray(movie.palette) ? movie.palette : [],
    file: fileName,
    fileName,
    thumbnail: movie.thumbnail || ""
  };
}

module.exports = {
  buildMoviePayload
};
