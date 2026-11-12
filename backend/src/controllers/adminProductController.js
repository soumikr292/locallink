const { pool } = require("../config/database");
const {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
} = require("../services/adminProductService");

// Get all products
async function listProducts(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    const sellerId =
      typeof req.query.sellerId === "string"
        ? req.query.sellerId.trim()
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

    const result = await getProducts({
      page,
      limit,
      search,
      status,
      sellerId
    });

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Create product
async function addProduct(req, res, next) {
  try {
    const {
      sellerId,
      name,
      slug,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      brand,
      categoryId,
      imageUrl,
      status = "draft"
    } = req.body;

    let parsedSellerId = Number(sellerId);

    if (
      !Number.isInteger(parsedSellerId) ||
      parsedSellerId <= 0
    ) {
      // Auto-fallback: assign to first active seller in system
      const defaultSellers = await pool.query(
        "SELECT user_id FROM users WHERE role = 'seller' AND status = 'active' ORDER BY user_id ASC LIMIT 1"
      );
      if (defaultSellers.length > 0) {
        parsedSellerId = Number(defaultSellers[0].user_id);
      } else {
        return res.status(400).json({
          success: false,
          message: "Valid sellerId is required"
        });
      }
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (
      typeof slug !== "string" ||
      !slug.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product slug is required"
      });
    }

    if (
      typeof sku !== "string" ||
      !sku.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product SKU is required"
      });
    }

    const parsedPrice = Number(price);

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product price is required"
      });
    }

    let parsedDiscountPrice = null;

    if (
      discountPrice !== undefined &&
      discountPrice !== null &&
      discountPrice !== ""
    ) {
      parsedDiscountPrice = Number(discountPrice);

      if (
        !Number.isFinite(parsedDiscountPrice) ||
        parsedDiscountPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid discount price"
        });
      }

      if (parsedDiscountPrice > parsedPrice) {
        return res.status(400).json({
          success: false,
          message:
            "Discount price cannot be greater than product price"
        });
      }
    }

    const parsedStockQuantity =
      stockQuantity === undefined ||
      stockQuantity === null ||
      stockQuantity === ""
        ? 0
        : Number(stockQuantity);

    if (
      !Number.isInteger(parsedStockQuantity) ||
      parsedStockQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock quantity must be a non-negative integer"
      });
    }

    let parsedCategoryId = null;

    if (
      categoryId !== undefined &&
      categoryId !== null &&
      categoryId !== ""
    ) {
      parsedCategoryId = Number(categoryId);

      if (
        !Number.isInteger(parsedCategoryId) ||
        parsedCategoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId"
        });
      }
    }

    const allowedStatuses = [
      "active",
      "inactive",
      "out_of_stock",
      "draft"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive, out_of_stock, draft"
      });
    }

    const result = await createProduct({
      sellerId: parsedSellerId,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description:
        typeof description === "string" &&
        description.trim()
          ? description.trim()
          : null,
      sku: sku.trim(),
      price: parsedPrice,
      discountPrice: parsedDiscountPrice,
      stockQuantity: parsedStockQuantity,
      brand:
        typeof brand === "string" &&
        brand.trim()
          ? brand.trim()
          : null,
      categoryId: parsedCategoryId,
      imageUrl:
        typeof imageUrl === "string" &&
        imageUrl.trim()
          ? imageUrl.trim()
          : null,
      status
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Update product
async function editProduct(req, res, next) {
  try {
    const productId = Number(req.params.id);

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
      name,
      slug,
      description,
      sku,
      price,
      discountPrice,
      stockQuantity,
      brand,
      categoryId,
      imageUrl,
      status
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (
      typeof slug !== "string" ||
      !slug.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product slug is required"
      });
    }

    if (
      typeof sku !== "string" ||
      !sku.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Product SKU is required"
      });
    }

    const parsedPrice = Number(price);

    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product price is required"
      });
    }

    let parsedDiscountPrice = null;

    if (
      discountPrice !== undefined &&
      discountPrice !== null &&
      discountPrice !== ""
    ) {
      parsedDiscountPrice = Number(discountPrice);

      if (
        !Number.isFinite(parsedDiscountPrice) ||
        parsedDiscountPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid discount price"
        });
      }

      if (parsedDiscountPrice > parsedPrice) {
        return res.status(400).json({
          success: false,
          message:
            "Discount price cannot be greater than product price"
        });
      }
    }

    const parsedStockQuantity = Number(stockQuantity);

    if (
      !Number.isInteger(parsedStockQuantity) ||
      parsedStockQuantity < 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Stock quantity must be a non-negative integer"
      });
    }

    let parsedCategoryId = null;

    if (
      categoryId !== undefined &&
      categoryId !== null &&
      categoryId !== ""
    ) {
      parsedCategoryId = Number(categoryId);

      if (
        !Number.isInteger(parsedCategoryId) ||
        parsedCategoryId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid categoryId"
        });
      }
    }

    const allowedStatuses = [
      "active",
      "inactive",
      "out_of_stock",
      "draft"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive, out_of_stock, draft"
      });
    }

    const result = await updateProduct({
      productId,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description:
        typeof description === "string" &&
        description.trim()
          ? description.trim()
          : null,
      sku: sku.trim(),
      price: parsedPrice,
      discountPrice: parsedDiscountPrice,
      stockQuantity: parsedStockQuantity,
      brand:
        typeof brand === "string" &&
        brand.trim()
          ? brand.trim()
          : null,
      categoryId: parsedCategoryId,
      imageUrl:
        typeof imageUrl === "string" &&
        imageUrl.trim()
          ? imageUrl.trim()
          : null,
      status
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Deactivate product
async function removeProduct(req, res, next) {
  try {
    const productId = Number(req.params.id);

    if (
      !Number.isInteger(productId) ||
      productId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
      });
    }

    const result = await deleteProduct(productId);

    return res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listProducts,
  addProduct,
  editProduct,
  removeProduct
};