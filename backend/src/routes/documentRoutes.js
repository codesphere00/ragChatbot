const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  uploadDocument,
} = require("../controllers/documentController");

router.post(
  "/upload",
  protect,
  upload.array("files", 10),
  uploadDocument
);

module.exports = router;