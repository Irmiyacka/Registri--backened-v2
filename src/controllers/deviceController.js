const supabase = require("../config/supabase");

const REGISTRATION_FEE = 1000;

const mapDevice = (d) => ({
  id:                d.id,
  userId:            d.user_id,
  type:              d.type,
  brand:             d.brand,
  model:             d.model,
  imei:              d.imei,
  imei2:             d.imei2,
  serial:            d.serial,
  color:             d.color,
  storage:           d.storage,
  year:              d.year,
  purchaseDate:      d.purchase_date,
  receiptNo:         d.receipt_no,
  description:       d.description,
  status:            d.status,
  approvalStatus:    d.approval_status,
  incidentDate:      d.incident_date,
  incidentTime:      d.incident_time,
  incidentDesc:      d.incident_desc,
  damagedParts:      d.damaged_parts,
  salePrice:         d.sale_price,
  saleFaults:        d.sale_faults,
  contactMethods:    d.contact_methods || [],
  contactPhone:      d.contact_phone,
  contactWhatsapp:   d.contact_whatsapp,
  contactEmail:      d.contact_email,
  contactSms:        d.contact_sms,
  scheduledDeletion: d.scheduled_deletion,
  history:           d.history || [],
  createdAt:         d.created_at,
});

const registerDevice = async (req, res, next) => {
  try {
    const { type, brand, model, imei, imei2, serial, color, storage, year, purchaseDate, receiptNo, description } = req.body;
    if (!brand || !model) {
      return res.status(400).json({ success: false, message: "Brand and Model are required." });
    }
    const { data: user } = await supabase
      .from("users").select("wallet").eq("id", req.user.id).single();
    if ((user?.wallet || 0) < REGISTRATION_FEE) {
      return res.status(400).json({ success: false, message: `Insufficient balance. You need ₦${REGISTRATION_FEE.toLocaleString()}.` });
    }
    const newBalance = user.wallet - REGISTRATION_FEE;
    await supabase.from("users").update({ wallet: newBalance }).eq("id", req.user.id);
    await supabase.from("transactions").insert({
      user_id: req.user.id, type: "debit", amount: REGISTRATION_FEE,
      description: `Device registration fee — ${brand} ${model} (pending)`,
      balance: newBalance,
    });
    const { data: device, error } = await supabase.from("devices").insert({
      user_id: req.user.id, type: type || "Smartphone",
      brand, model, imei, imei2, serial, color, storage, year,
      purchase_date: purchaseDate, receipt_no: receiptNo, description,
      status: "active", approval_status: "pending",
      history: [{ event: "Device registered — awaiting admin approval", date: new Date().toISOString() }],
    }).select().single();
    if (error) return next(error);
    res.status(201).json({
      success: true,
      message: `Device registered. ₦${REGISTRATION_FEE.toLocaleString()} deducted. Awaiting admin approval.`,
      device: mapDevice(device),
    });
  } catch (err) {
    next(err);
  }
};

const getMyDevices = async (req, res, next) => {
  try {
    const { data: devices, error } = await supabase
      .from("devices").select("*").eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) return next(error);
    res.status(200).json({ success: true, count: devices.length, devices: devices.map(mapDevice) });
  } catch (err) {
    next(err);
  }
};

const searchDevices = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: "Search query must be at least 2 characters." });
    }
    const { data: devices, error } = await supabase
      .from("devices").select("*").eq("approval_status", "approved")
      .or(`imei.ilike.%${q}%,imei2.ilike.%${q}%,serial.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`);
    if (error) return next(error);
    res.status(200).json({ success: true, count: devices.length, devices: devices.map(mapDevice) });
  } catch (err) {
    next(err);
  }
};

const updateDeviceStatus = async (req, res, next) => {
  try {
    const { status, incidentDate, incidentTime, incidentDesc, damagedParts,
      salePrice, saleFaults, contactMethods, contactPhone, contactWhatsapp, contactEmail, contactSms } = req.body;
    const { data: device } = await supabase
      .from("devices").select("*").eq("id", req.params.id).eq("user_id", req.user.id).single();
    if (!device) {
      return res.status(404).json({ success: false, message: "Device not found or you do not own it." });
    }
    if (device.approval_status !== "approved") {
      return res.status(400).json({ success: false, message: "Device must be approved before status can be changed." });
    }
    const validStatuses = ["active","stolen","lost","recovered","damaged","forsale","sold"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    const history = [...(device.history || [])];
    history.push({ event: `Marked as ${status} by owner`, date: new Date().toISOString() });
    const patch = {
      status, history,
      contact_methods:  contactMethods || [],
      contact_phone:    contactPhone,
      contact_whatsapp: contactWhatsapp,
      contact_email:    contactEmail,
      contact_sms:      contactSms,
    };
    if (["stolen","lost","recovered","damaged"].includes(status)) {
      patch.incident_date = incidentDate;
      patch.incident_time = incidentTime;
      patch.incident_desc = incidentDesc;
    }
    if (status === "damaged")  patch.damaged_parts = damagedParts;
    if (status === "forsale") { patch.sale_price = salePrice; patch.sale_faults = saleFaults; }
    if (status === "sold")     patch.scheduled_deletion = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: updated, error } = await supabase
      .from("devices").update(patch).eq("id", req.params.id).select().single();
    if (error) return next(error);
    res.status(200).json({
      success: true,
      message: status === "sold" ? "Device marked as sold. Removed in 24 hours." : `Status updated to ${status}.`,
      device: mapDevice(updated),
    });
  } catch (err) {
    next(err);
  }
};

const getAllDevices = async (req, res, next) => {
  try {
    const { status, type, approvalStatus } = req.query;
    let query = supabase.from("devices").select("*").order("created_at", { ascending: false });
    if (status && status !== "all")               query = query.eq("status", status);
    if (type && type !== "all")                   query = query.eq("type", type);
    if (approvalStatus && approvalStatus !== "all") query = query.eq("approval_status", approvalStatus);
    const { data: devices, error } = await query;
    if (error) return next(error);
    res.status(200).json({ success: true, count: devices.length, devices: devices.map(mapDevice) });
  } catch (err) {
    next(err);
  }
};

const approveDevice = async (req, res, next) => {
  try {
    const { data: device } = await supabase.from("devices").select("*").eq("id", req.params.id).single();
    if (!device) return res.status(404).json({ success: false, message: "Device not found." });
    const history = [...(device.history || [])];
    history.push({ event: "Approved by admin", date: new Date().toISOString() });
    const { data: updated, error } = await supabase
      .from("devices").update({ approval_status: "approved", history }).eq("id", req.params.id).select().single();
    if (error) return next(error);
    res.status(200).json({ success: true, message: "Device approved.", device: mapDevice(updated) });
  } catch (err) {
    next(err);
  }
};

const rejectDevice = async (req, res, next) => {
  try {
    const { data: device } = await supabase.from("devices").select("*").eq("id", req.params.id).single();
    if (!device) return res.status(404).json({ success: false, message: "Device not found." });
    const { data: owner } = await supabase.from("users").select("wallet").eq("id", device.user_id).single();
    const newBalance = (owner?.wallet || 0) + REGISTRATION_FEE;
    await supabase.from("users").update({ wallet: newBalance }).eq("id", device.user_id);
    await supabase.from("transactions").insert({
      user_id: device.user_id, type: "credit", amount: REGISTRATION_FEE,
      description: `Refund: ${device.brand} ${device.model} rejected by admin`,
      balance: newBalance,
    });
    const history = [...(device.history || [])];
    history.push({ event: `Rejected by admin — ₦${REGISTRATION_FEE.toLocaleString()} refunded`, date: new Date().toISOString() });
    const { data: updated, error } = await supabase
      .from("devices").update({ approval_status: "rejected", history }).eq("id", req.params.id).select().single();
    if (error) return next(error);
    res.status(200).json({ success: true, message: `Device rejected. ₦${REGISTRATION_FEE.toLocaleString()} refunded.`, device: mapDevice(updated) });
  } catch (err) {
    next(err);
  }
};

const adminUpdateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["active","stolen","lost","recovered","damaged","forsale","sold"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status." });
    }
    const { data: device } = await supabase.from("devices").select("history").eq("id", req.params.id).single();
    if (!device) return res.status(404).json({ success: false, message: "Device not found." });
    const history = [...(device.history || [])];
    history.push({ event: `Status set to ${status} by admin`, date: new Date().toISOString() });
    const { data: updated, error } = await supabase
      .from("devices").update({ status, history }).eq("id", req.params.id).select().single();
    if (error) return next(error);
    res.status(200).json({ success: true, message: `Device status updated to ${status}.`, device: mapDevice(updated) });
  } catch (err) {
    next(err);
  }
};

module.exports = { registerDevice, getMyDevices, searchDevices, updateDeviceStatus, getAllDevices, approveDevice, rejectDevice, adminUpdateStatus };