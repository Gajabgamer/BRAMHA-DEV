const fs = require("fs");
const path = require("path");
const Movie = require("../models/Movie");
const Rental = require("../models/Rental");

async function streamMovie(req, res) {
  const { filename } = req.params;
  const userId = req.user.id;

  const movie = await findMovie(filename);
  if (!movie) {
    return res.status(404).json({ message: "Movie not found." });
  }

  const hasRental = await hasActiveRental(userId, movie.movieId);
  if (!hasRental) {
    return res.status(403).json({ message: "This rental is missing or has expired." });
  }

  const filePath = path.join(__dirname, "..", "movies", movie.fileName || movie.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: `Video file not found. Add ${movie.fileName || movie.file} to backend/movies to enable streaming for this title.`
    });
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;

  if (range) {
    const [startValue, endValue] = range.replace(/bytes=/, "").split("-");
    const start = Number(startValue);
    const end = endValue ? Number(endValue) : Math.min(start + 10 ** 6, stat.size - 1);
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": "video/mp4"
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    "Content-Length": stat.size,
    "Content-Type": "video/mp4"
  });
  fs.createReadStream(filePath).pipe(res);
}

async function findMovie(filename) {
  return Movie.findOne({ $or: [{ fileName: filename }, { file: filename }] }).lean();
}

async function hasActiveRental(userId, movieId) {
  const rental = await Rental.findOne({
    userId,
    movieId,
    expiresAt: { $gt: new Date() }
  }).lean();
  return Boolean(rental);
}

module.exports = {
  streamMovie
};
