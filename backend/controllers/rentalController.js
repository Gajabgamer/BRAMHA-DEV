const Movie = require("../models/Movie");
const Rental = require("../models/Rental");

function getActiveRental(rentals, userId, movieId) {
  return rentals.find(
    (rental) =>
      rental.userId === userId &&
      rental.movieId === movieId &&
      new Date(rental.expiresAt).getTime() > Date.now()
  );
}

async function rentMovie(req, res) {
  const { movieId } = req.params;
  const { paymentMethod = "upi" } = req.body;
  const userId = req.user.id;

  const movie = await Movie.findOne({ movieId }).lean();
  if (!movie) {
    return res.status(404).json({ message: "Movie not found." });
  }

  const rentals = await Rental.find({ userId, movieId }).lean();
  const activeRental = getActiveRental(rentals, userId, movieId);
  if (activeRental) {
    return res.status(409).json({ message: "Movie is already rented.", rental: activeRental });
  }

  const pricePaid =
    movie.nightEligible && isNightOfferActive() ? movie.nightPrice : movie.price;

  const rental = await Rental.create({
    userId,
    movieId,
    paymentMethod,
    pricePaid,
    rentedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  return res.status(201).json({
    rental: {
      id: rental._id.toString(),
      movieId,
      pricePaid,
      paymentMethod: rental.paymentMethod,
      rentedAt: rental.rentedAt,
      expiresAt: rental.expiresAt
    }
  });
}

async function getMyRentals(req, res) {
  const userId = req.user.id;

  const movies = await Movie.find().lean();
  const rentals = await Rental.find({
    userId,
    expiresAt: { $gt: new Date() }
  })
    .sort({ expiresAt: 1 })
    .lean();

  const data = rentals
    .map((rental) => ({
      ...rental,
      id: rental._id.toString(),
      movie: movies.find((movie) => movie.movieId === rental.movieId)
    }))
    .filter((rental) => rental.movie);

  return res.json({ data });
}

function isNightOfferActive() {
  const hour = new Date().getHours();
  return hour >= 0 && hour < 5;
}

module.exports = {
  rentMovie,
  getMyRentals
};
