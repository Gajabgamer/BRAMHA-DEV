const express = require("express");
const {
  uploadMovie,
  getAdminMovies,
  deleteMovie,
  updateMovie
} = require("../controllers/adminController");
const { authenticateRequest } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { adminUploadFields, adminEditFields } = require("../middleware/upload");

const router = express.Router();

router.use(authenticateRequest, requireAdmin);

router.post("/upload", adminUploadFields, uploadMovie);
router.get("/movies", getAdminMovies);
router.delete("/movie/:id", deleteMovie);
router.put("/movie/:id", adminEditFields, updateMovie);

module.exports = router;
