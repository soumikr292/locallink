const adminTaxService = require("../services/adminTaxService");

async function listTaxRates(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim() : "";

    const result = await adminTaxService.getTaxRates({ page, limit, search, status });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function addTaxRate(req, res, next) {
  try {
    const { name, rate } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Tax name is required." });
    }
    if (rate === undefined || isNaN(Number(rate))) {
      return res.status(400).json({ success: false, message: "Valid tax rate percentage is required." });
    }

    const result = await adminTaxService.createTaxRate(req.body);
    return res.status(201).json({ success: true, message: result.message, data: { id: result.id } });
  } catch (error) {
    next(error);
  }
}

async function editTaxRate(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid tax rate ID" });

    const result = await adminTaxService.updateTaxRate(id, req.body);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function toggleTaxStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid tax rate ID" });

    const result = await adminTaxService.toggleTaxRateStatus(id);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function removeTaxRate(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid tax rate ID" });

    const result = await adminTaxService.deleteTaxRate(id);
    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

async function getTaxAnalytics(req, res, next) {
  try {
    const summary = await adminTaxService.getTaxSummary();
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTaxRates,
  addTaxRate,
  editTaxRate,
  toggleTaxStatus,
  removeTaxRate,
  getTaxAnalytics
};
