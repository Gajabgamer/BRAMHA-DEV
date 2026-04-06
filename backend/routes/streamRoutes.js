const express = require("express");
const { streamMovie } = require("../controllers/streamController");
const { authenticateRequest } = require("../middleware/auth");

const router = express.Router();

router.get("/:filename", authenticateRequest, streamMovie);

module.exports = router;
