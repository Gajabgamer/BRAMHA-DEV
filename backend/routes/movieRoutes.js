const express = require("express");
const { getMovies } = require("../controllers/movieController");

const router = express.Router();

router.get("/", getMovies);

module.exports = router;
