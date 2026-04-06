const fs = require("fs");
const path = require("path");
const Movie = require("../models/Movie");
const { seedMovies } = require("../data/seedMovies");
const { buildMoviePayload } = require("../lib/moviePayload");

async function seedMoviesIfNeeded() {
  const count = await Movie.countDocuments();
  if (count === 0) {
    await Movie.insertMany(seedMovies);
  }
}

async function getMovies(req, res) {
  res.set("Cache-Control", "no-store");
  await seedMoviesIfNeeded();
  const movies = await Movie.find().sort({ createdAt: -1 }).lean();

  const response = movies.map((movie) => ({
    ...buildMoviePayload(movie),
    hasVideo: fs.existsSync(path.join(__dirname, "..", "movies", movie.fileName || movie.file)),
    hasThumbnail: Boolean(movie.thumbnail)
  }));

  console.log(`[movies] returning ${response.length} movies`);

  return res.json({ data: response });
}

module.exports = {
  getMovies,
  seedMoviesIfNeeded
};
