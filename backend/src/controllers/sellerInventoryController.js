const {
  getSellerInventory,
  adjustSellerStock,
  getSellerStockHistory,
  updateSellerStockThreshold
} = require("../services/sellerInventoryService");

async function listInventory(req, res, next) {
  try {
    const { page = 1, limit = 20, search = "", lowStockOnly = "false" } = req.query;
    const result = await getSellerInventory({
      sellerId: req.user.userId,
      page: Number(page),
      limit: Number(limit),
      search: String(search).trim(),
      lowStockOnly: lowStockOnly === "true" || lowStockOnly === true
    });
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const { productId, quantityChange, reason = "restock", note = "" } = req.body;
    if (!productId || quantityChange === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product ID and quantityChange are required"
      });
    }

    const result = await adjustSellerStock({
      sellerId: req.user.userId,
      productId: Number(productId),
      quantityChange: Number(quantityChange),
      reason,
      note
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getStockHistory(req, res, next) {
  try {
    const { productId } = req.query;
    const history = await getSellerStockHistory(req.user.userId, productId ? Number(productId) : null);
    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
}

async function updateThreshold(req, res, next) {
  try {
    const { productId, threshold } = req.body;
    if (!productId || threshold === undefined) {
      return res.status(400).json({
        success: false,
        message: "Product ID and threshold are required"
      });
    }

    const result = await updateSellerStockThreshold(
      req.user.userId,
      Number(productId),
      Number(threshold)
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listInventory,
  adjustStock,
  getStockHistory,
  updateThreshold
};
