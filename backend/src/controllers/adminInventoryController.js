const {
  getInventory,
  getInventoryByProductId,
  adjustStock,
  getAdjustmentHistory
} = require("../services/adminInventoryService");


// Get inventory list
async function listInventory(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const lowStockOnly =
      req.query.lowStockOnly === "true";

    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0"
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }

    const result = await getInventory({
      page,
      limit,
      search,
      lowStockOnly
    });

    return res.status(200).json({
      success: true,
      message: "Inventory fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Get inventory for one product
async function getProductInventory(req, res, next) {
  try {
    const productId = Number(req.params.productId);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const result =
      await getInventoryByProductId(productId);

    return res.status(200).json({
      success: true,
      message:
        "Product inventory fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Adjust stock
async function changeStock(req, res, next) {
  try {
    const productId = Number(req.params.productId);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const {
      quantityChange,
      reason,
      note
    } = req.body;

    const parsedQuantityChange =
      Number(quantityChange);

    if (
      !Number.isInteger(parsedQuantityChange) ||
      parsedQuantityChange === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "quantityChange must be a non-zero integer"
      });
    }

    const allowedReasons = [
      "restock",
      "sale",
      "return",
      "damage",
      "loss",
      "manual",
      "correction"
    ];

    if (!allowedReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid reason. Allowed: restock, sale, return, damage, loss, manual, correction"
      });
    }

    if (
      note !== undefined &&
      note !== null &&
      typeof note !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Note must be a string"
      });
    }

    const adjustedBy = Number(req.user.userId);

    const result = await adjustStock({
      productId,
      quantityChange:
        parsedQuantityChange,
      reason,
      note:
        typeof note === "string"
          ? note.trim()
          : null,
      adjustedBy
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


// Get adjustment history
async function listAdjustmentHistory(
  req,
  res,
  next
) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const productId =
      req.query.productId !== undefined
        ? Number(req.query.productId)
        : "";

    if (page < 1) {
      return res.status(400).json({
        success: false,
        message: "Page must be greater than 0"
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }

    if (
      productId !== "" &&
      (!Number.isInteger(productId) ||
        productId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid productId"
      });
    }

    const result =
      await getAdjustmentHistory({
        productId,
        page,
        limit
      });

    return res.status(200).json({
      success: true,
      message:
        "Inventory adjustment history fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listInventory,
  getProductInventory,
  changeStock,
  listAdjustmentHistory
};