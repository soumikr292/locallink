const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reactivateCategory
} = require("../services/adminCategoryService");


// Get categories
async function listCategories(req, res, next) {
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

    const allowedStatuses = [
      "",
      "active",
      "inactive"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive"
      });
    }

    const result = await getCategories({
      page,
      limit,
      search,
      status
    });

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Create category
async function addCategory(req, res, next) {
  try {
    const {
      name,
      slug,
      description,
      imageUrl,
      parentId,
      status = "active"
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    if (
      typeof slug !== "string" ||
      !slug.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category slug is required"
      });
    }

    const parsedParentId =
      parentId === undefined ||
      parentId === null ||
      parentId === ""
        ? null
        : Number(parentId);

    if (
      parsedParentId !== null &&
      (!Number.isInteger(parsedParentId) ||
        parsedParentId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid parentId"
      });
    }

    const allowedStatuses = [
      "active",
      "inactive"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive"
      });
    }

    const result = await createCategory({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description:
        typeof description === "string" &&
        description.trim()
          ? description.trim()
          : null,
      imageUrl:
        typeof imageUrl === "string" &&
        imageUrl.trim()
          ? imageUrl.trim()
          : null,
      parentId: parsedParentId,
      status
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Update category
async function editCategory(req, res, next) {
  try {
    const categoryId = Number(req.params.id);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required"
      });
    }

    const {
      name,
      slug,
      description,
      imageUrl,
      parentId,
      status
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    if (
      typeof slug !== "string" ||
      !slug.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category slug is required"
      });
    }

    const parsedParentId =
      parentId === undefined ||
      parentId === null ||
      parentId === ""
        ? null
        : Number(parentId);

    if (
      parsedParentId !== null &&
      (!Number.isInteger(parsedParentId) ||
        parsedParentId <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid parentId"
      });
    }

    const allowedStatuses = [
      "active",
      "inactive"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed: active, inactive"
      });
    }

    const result = await updateCategory({
      categoryId,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description:
        typeof description === "string" &&
        description.trim()
          ? description.trim()
          : null,
      imageUrl:
        typeof imageUrl === "string" &&
        imageUrl.trim()
          ? imageUrl.trim()
          : null,
      parentId: parsedParentId,
      status
    });

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


// Deactivate category
async function removeCategory(req, res, next) {
  try {
    const categoryId = Number(req.params.id);

    if (
      !Number.isInteger(categoryId) ||
      categoryId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required"
      });
    }

    const result = await deleteCategory(categoryId);

    return res.status(200).json({
      success: true,
      message: "Category deactivated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


async function reactivateCategoryController(req, res, next) {
  try {
    const categoryId = Number(req.params.id);

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid category ID is required"
      });
    }

    const result = await reactivateCategory(categoryId);

    return res.status(200).json({
      success: true,
      message: "Category reactivated successfully",
      data: result
    });
  } catch (error) {
    next(error);
  }
}


module.exports = {
  listCategories,
  addCategory,
  editCategory,
  removeCategory,
  reactivateCategoryController
};