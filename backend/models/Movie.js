const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema(
  {
    movieId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    genre: { type: String, default: "featured" },
    genreLabel: { type: String, default: "Featured" },
    duration: { type: String, default: "2h 00m" },
    price: { type: Number, default: 49 },
    nightPrice: { type: Number, default: 20 },
    nightEligible: { type: Boolean, default: false },
    quality: { type: String, default: "HD" },
    badge: { type: String, default: "" },
    synopsis: { type: String, default: "" },
    palette: { type: [String], default: [] },
    file: { type: String, default: "" },
    fileName: { type: String, default: "" },
    thumbnail: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Movie", movieSchema);
