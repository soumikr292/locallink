const {
  getSellerProducts,
  getSellerProductById,
  createSellerProduct,
  updateSellerProduct,
  deleteSellerProduct,
  bulkUpdateSellerProductStatus
} = require("../services/sellerProductService");

async function listProducts(req, res, next) {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "",
      categoryId = ""
    } = req.query;

    const result = await getSellerProducts({
      sellerId: req.user.userId,
      page: Number(page),
      limit: Number(limit),
      search: String(search).trim(),
      status: String(status).trim(),
      categoryId: categoryId ? Number(categoryId) : ""
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const result = await getSellerProductById(req.user.userId, id);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const result = await createSellerProduct(req.user.userId, req.body);
    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const result = await updateSellerProduct(req.user.userId, id, req.body);
    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const result = await deleteSellerProduct(req.user.userId, id);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
}

async function bulkUpdateStatus(req, res, next) {
  try {
    const { productIds, status } = req.body;
    const result = await bulkUpdateSellerProductStatus(
      req.user.userId,
      productIds,
      status
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
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateStatus
};
