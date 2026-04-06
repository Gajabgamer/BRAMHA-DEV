const cors = require("cors");
const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { connectDatabase } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const movieRoutes = require("./routes/movieRoutes");
const rentalRoutes = require("./routes/rentalRoutes");
const streamRoutes = require("./routes/streamRoutes");
const { getMyRentals } = require("./controllers/rentalController");
const { seedMoviesIfNeeded } = require("./controllers/movieController");
const { authenticateRequest } = require("./middleware/auth");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"],
    credentials: true
  })
);
app.use(express.json());
app.use("/thumbnails", express.static(path.join(__dirname, "thumbnails")));

app.get("/health", (req, res) => {
  res.json({ ok: true, mode: "mongo" });
});

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/movies", movieRoutes);
app.use("/rent", rentalRoutes);
app.get("/my-rentals", authenticateRequest, getMyRentals);
app.use("/stream", streamRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: error.message || "Internal server error." });
});

async function startServer() {
  const moviesDir = path.join(__dirname, "movies");
  const thumbnailsDir = path.join(__dirname, "thumbnails");
  if (!fs.existsSync(moviesDir)) fs.mkdirSync(moviesDir, { recursive: true });
  if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

  await connectDatabase(process.env.MONGO_URI);
  await seedMoviesIfNeeded();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port} (mongo mode)`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
