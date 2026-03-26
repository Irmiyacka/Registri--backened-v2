const express = require("express");
const router  = express.Router();
const { listUsers, getUser, updateUser, creditWallet, debitWallet, getUserTransactions } = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/auth");

router.use(protect, adminOnly);

router.get("/",                    listUsers);
router.get("/:id",                 getUser);
router.patch("/:id",               updateUser);
router.post("/:id/credit",         creditWallet);
router.post("/:id/debit",          debitWallet);
router.get("/:id/transactions",    getUserTransactions);

module.exports = router;