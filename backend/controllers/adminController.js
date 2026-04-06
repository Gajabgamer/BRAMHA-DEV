const fs = require("fs");
const path = require("path");
const Movie = require("../models/Movie");
const { buildMoviePayload } = require("../lib/moviePayload");

function slugify(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getUploadedFile(files, fieldName) {
  return files?.[fieldName]?.[0] || null;
}

function removeFileIfExists(directory, fileName) {
  if (!fileName) {
    return;
  }

  const filePath = path.join(directory, fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function cleanupUploadedFiles(files) {
  Object.values(files || {})
    .flat()
    .forEach((file) => {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
}

function getMovieRecord(movie) {
  const normalized = buildMoviePayload(movie);
  return {
    ...normalized,
    createdAt: movie.createdAt,
    updatedAt: movie.updatedAt
  };
}

async function uploadMovie(req, res) {
  res.set("Cache-Control", "no-store");
  const title = req.body.title?.trim();
  const description = req.body.description?.trim();
  const movieFile = getUploadedFile(req.files, "movie");
  const thumbnailFile = getUploadedFile(req.files, "thumbnail");

  if (!title || !description || !movieFile || !thumbnailFile) {
    cleanupUploadedFiles(req.files);
    return res.status(400).json({
      message: "Title, description, movie file, and thumbnail are required."
    });
  }

  const movieId = `${slugify(title) || "movie"}-${Date.now()}`;
  const payload = {
    movieId,
    title,
    description,
    synopsis: description,
    genre: "featured",
    genreLabel: "Featured",
    duration: "2h 00m",
    price: 49,
    nightPrice: 20,
    nightEligible: false,
    quality: "HD",
    badge: "New",
    file: movieFile.filename,
    fileName: movieFile.filename,
    thumbnail: thumbnailFile.filename
  };

  const movie = await Movie.create(payload);
  console.log("[admin/upload] created movie", { movieId, title, file: movieFile.filename });
  return res.status(201).json({
    message: "Movie uploaded successfully.",
    movie: getMovieRecord(movie.toObject())
  });
}

async function getAdminMovies(req, res) {
  res.set("Cache-Control", "no-store");
  const movies = await Movie.find().sort({ createdAt: -1 }).lean();
  console.log(`[admin/movies] returning ${movies.length} movies`);
  return res.json({ data: movies.map(getMovieRecord) });
}

async function deleteMovie(req, res) {
  res.set("Cache-Control", "no-store");
  const { id } = req.params;
  const movie = await Movie.findByIdAndDelete(id).lean();

  if (!movie) {
    return res.status(404).json({ message: "Movie not found." });
  }

  removeFileIfExists(path.join(__dirname, "..", "movies"), movie.fileName || movie.file);
  removeFileIfExists(path.join(__dirname, "..", "thumbnails"), movie.thumbnail);
  console.log("[admin/delete] removed movie", { id, title: movie.title });

  return res.json({ message: "Movie deleted successfully." });
}

async function updateMovie(req, res) {
  res.set("Cache-Control", "no-store");
  const { id } = req.params;
  const title = req.body.title?.trim();
  const description = req.body.description?.trim();
  const thumbnailFile = getUploadedFile(req.files, "thumbnail");

  if (!title || !description) {
    cleanupUploadedFiles(req.files);
    return res.status(400).json({ message: "Title and description are required." });
  }

  const existingMovie = await Movie.findById(id);
  if (!existingMovie) {
    cleanupUploadedFiles(req.files);
    return res.status(404).json({ message: "Movie not found." });
  }

  if (thumbnailFile && existingMovie.thumbnail) {
    removeFileIfExists(path.join(__dirname, "..", "thumbnails"), existingMovie.thumbnail);
    existingMovie.thumbnail = thumbnailFile.filename;
  }

  existingMovie.title = title;
  existingMovie.description = description;
  existingMovie.synopsis = description;
  await existingMovie.save();
  console.log("[admin/update] updated movie", { id, title });

  return res.json({
    message: "Movie updated successfully.",
    movie: getMovieRecord(existingMovie.toObject())
  });
}

module.exports = {
  uploadMovie,
  getAdminMovies,
  deleteMovie,
  updateMovie
};
