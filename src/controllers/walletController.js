const supabase = require("../config/supabase");

const getWallet = async (req, res, next) => {
  try {
    const { data: user } = await supabase
      .from("users").select("wallet").eq("id", req.user.id).single();
    const { data: transactions } = await supabase
      .from("transactions").select("*").eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    res.status(200).json({
      success: true,
      balance: user?.wallet || 0,
      transactions: transactions || [],
    });
  } catch (err) {
    next(err);
  }
};

const topUp = async (req, res, next) => {
  try {
    const { reference, amount } = req.body;
    if (!reference || !amount) {
      return res.status(400).json({ success: false, message: "Payment reference and amount are required." });
    }
    const amt = parseInt(amount);
    if (amt <= 0) return res.status(400).json({ success: false, message: "Invalid amount." });
    const { data: user } = await supabase
      .from("users").select("wallet").eq("id", req.user.id).single();
    const newBalance = (user?.wallet || 0) + amt;
    await supabase.from("users").update({ wallet: newBalance }).eq("id", req.user.id);
    await supabase.from("transactions").insert({
      user_id:     req.user.id,
      type:        "credit",
      amount:      amt,
      description: `Wallet top-up via Paystack (ref: ${reference})`,
      balance:     newBalance,
    });
    res.status(200).json({
      success: true,
      message: `₦${amt.toLocaleString()} added to your wallet.`,
      newBalance,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWallet, topUp };