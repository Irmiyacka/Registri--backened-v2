const supabase = require("../config/supabase");

const mapUser = (u) => ({
  id:        u.id,
  fullname:  u.fullname,
  email:     u.email,
  phone:     u.phone,
  nin:       u.nin,
  docType:   u.doc_type,
  state:     u.state,
  lga:       u.lga,
  area:      u.area,
  address:   u.address,
  zipcode:   u.zipcode,
  role:      u.role,
  status:    u.status,
  wallet:    u.wallet,
  createdAt: u.created_at,
});

const listUsers = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    let query = supabase
      .from("users")
      .select("*")
      .neq("role", "admin")
      .order("created_at", { ascending: false });
    if (status && status !== "all") query = query.eq("status", status);
    const { data: users, error } = await query;
    if (error) return next(error);
    let filtered = users.map(mapUser);
    if (search && search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.fullname?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      );
    }
    res.status(200).json({ success: true, count: filtered.length, users: filtered });
  } catch (err) {
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users").select("*").eq("id", req.params.id).single();
    if (error || !user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    const { data: devices } = await supabase
      .from("devices").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: transactions } = await supabase
      .from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    res.status(200).json({
      success: true,
      user: mapUser(user),
      devices: devices || [],
      transactions: transactions || [],
    });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { status, role } = req.body;
    const allowed = {};
    if (status) {
      const validStatuses = ["active", "pending", "rejected", "blocked"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status.` });
      }
      allowed.status = status;
    }
    if (role) {
      const validRoles = ["user", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role." });
      }
      allowed.role = role;
    }
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }
    const { data: user, error } = await supabase
      .from("users").update(allowed).eq("id", req.params.id).select().single();
    if (error || !user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    res.status(200).json({ success: true, message: "User updated.", user: mapUser(user) });
  } catch (err) {
    next(err);
  }
};

const creditWallet = async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }
    const { data: user } = await supabase
      .from("users").select("wallet, fullname").eq("id", req.params.id).single();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const newBalance = (user.wallet || 0) + amt;
    await supabase.from("users").update({ wallet: newBalance }).eq("id", req.params.id);
    await supabase.from("transactions").insert({
      user_id:     req.params.id,
      type:        "credit",
      amount:      amt,
      description: description || "Manual credit by admin",
      balance:     newBalance,
    });
    res.status(200).json({
      success: true,
      message: `₦${amt.toLocaleString()} credited to ${user.fullname}.`,
      newBalance,
    });
  } catch (err) {
    next(err);
  }
};

const debitWallet = async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const amt = parseInt(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }
    const { data: user } = await supabase
      .from("users").select("wallet, fullname").eq("id", req.params.id).single();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (amt > (user.wallet || 0)) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
    }
    const newBalance = (user.wallet || 0) - amt;
    await supabase.from("users").update({ wallet: newBalance }).eq("id", req.params.id);
    await supabase.from("transactions").insert({
      user_id:     req.params.id,
      type:        "debit",
      amount:      amt,
      description: description || "Manual debit by admin",
      balance:     newBalance,
    });
    res.status(200).json({
      success: true,
      message: `₦${amt.toLocaleString()} debited from ${user.fullname}.`,
      newBalance,
    });
  } catch (err) {
    next(err);
  }
};

const getUserTransactions = async (req, res, next) => {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions").select("*").eq("user_id", req.params.id)
      .order("created_at", { ascending: false });
    if (error) return next(error);
    res.status(200).json({ success: true, count: transactions.length, transactions });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, getUser, updateUser, creditWallet, debitWallet, getUserTransactions };