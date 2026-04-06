const mongoose = require("mongoose");

const rentalSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    movieId: { type: String, required: true, index: true },
    paymentMethod: { type: String, required: true },
    pricePaid: { type: Number, required: true },
    rentedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rental", rentalSchema);
