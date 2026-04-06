const express = require("express");
const { rentMovie, getMyRentals } = require("../controllers/rentalController");
const { authenticateRequest } = require("../middleware/auth");

const router = express.Router();

router.get("/me/list", authenticateRequest, getMyRentals);
router.get("/my-rentals", authenticateRequest, getMyRentals);
router.post("/:movieId", authenticateRequest, rentMovie);

module.exports = router;
