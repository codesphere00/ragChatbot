const express = require("express");
const router = express.Router();
const askQuestion = require("../controllers/askController");
const protect = require("../middleware/authMiddleware"); 

router.post("/", protect , askQuestion); 

module.exports = router;