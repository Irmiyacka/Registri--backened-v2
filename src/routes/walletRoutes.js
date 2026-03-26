const express = require("express");
const router  = express.Router();
const { getWallet, topUp } = require("../controllers/walletController");
const { protect, activeOnly } = require("../middleware/auth");

router.get("/",        protect, getWallet);
router.post("/topup",  protect, activeOnly, topUp);

module.exports = router;