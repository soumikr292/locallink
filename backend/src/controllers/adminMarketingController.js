
const {
  getCoupons,
  createCoupon,
  getBanners,
  createBanner,
  getFlashSales,
  createFlashSale,
  getAbandonedCarts
} = require("../services/adminMarketingService");


async function listCoupons(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim()
        : "";

    if (
      status &&
      !["active", "inactive", "expired"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon status"
      });
    }

    const data = await getCoupons({
      page,
      limit,
      search,
      status
    });

    return res.status(200).json({
      success: true,
      message: "Coupons fetched successfully",
      data
    });
  } catch (error) {
    next(error);
  }
}


async function addCoupon(req, res, next) {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      minimum_order_amount = 0,
      maximum_discount = null,
      usage_limit = null,
      starts_at = null,
      expires_at = null
    } = req.body;

    if (
      typeof code !== "string" ||
      !/^[A-Z0-9_-]{3,50}$/.test(code.trim().toUpperCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon code must be 3-50 characters (letters, numbers, _ or -)"
      });
    }

    if (!["percentage", "fixed"].includes(discount_type)) {
      return res.status(400).json({
        success: false,
        message: "Discount type must be percentage or fixed"
      });
    }

    const value = Number(discount_value);
    const minimum = Number(minimum_order_amount);
    const maximum = maximum_discount == null ? null : Number(maximum_discount);
    const usage = usage_limit == null ? null : Number(usage_limit);

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      (discount_type === "percentage" && value > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discount value"
      });
    }

    if (!Number.isFinite(minimum) || minimum < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum order amount cannot be negative"
      });
    }

    if (
      (maximum !== null && (!Number.isFinite(maximum) || maximum <= 0)) ||
      (usage !== null && (!Number.isInteger(usage) || usage <= 0))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid maximum discount or usage limit"
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const coupon = await createCoupon({
      code: normalizedCode,
      description:
        typeof description === "string" ? description.trim() || null : null,
      discount_type,
      discount_value: value,
      minimum_order_amount: minimum,
      maximum_discount: maximum,
      usage_limit: usage,
      starts_at,
      expires_at
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Coupon code already exists"
      });
    }

    next(error);
  }
}


async function listBanners(req, res, next) {
  try {
    const banners = await getBanners();

    return res.json({
      success: true,
      message: "Banners fetched successfully",
      data: banners
    });
  } catch (error) {
    next(error);
  }
}

async function addBanner(req, res, next) {
  try {
    const {
      title,
      subtitle,
      image_url,
      target_url,
      position,
      starts_at,
      expires_at
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner title is required"
      });
    }

    if (
      starts_at &&
      expires_at &&
      new Date(expires_at) <= new Date(starts_at)
    ) {
      return res.status(400).json({
        success: false,
        message: "Expiry must be later than the start date"
      });
    }

    const banner = await createBanner({
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      image_url: image_url?.trim() || null,
      target_url: target_url?.trim() || null,
      position: position?.trim() || "homepage",
      starts_at: starts_at || null,
      expires_at: expires_at || null
    });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner
    });
  } catch (error) {
    next(error);
  }
}

async function listFlashSales(req, res, next) {
  try {
    const sales = await getFlashSales();

    return res.json({
      success: true,
      message: "Flash sales fetched successfully",
      data: sales
    });
  } catch (error) {
    next(error);
  }
}

async function addFlashSale(req, res, next) {
  try {
    const { title, description, starts_at, expires_at } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Flash sale title is required"
      });
    }

    if (!starts_at || !expires_at) {
      return res.status(400).json({
        success: false,
        message: "Start date and expiry date are required"
      });
    }

    if (new Date(expires_at) <= new Date(starts_at)) {
      return res.status(400).json({
        success: false,
        message: "Expiry must be later than the start date"
      });
    }

    const sale = await createFlashSale({
      title: title.trim(),
      description: description?.trim() || null,
      starts_at: starts_at.replace("T", " "),
      expires_at: expires_at.replace("T", " ")
    });

    return res.status(201).json({
      success: true,
      message: "Flash sale created successfully",
      data: sale
    });
  } catch (error) {
    next(error);
  }
}



async function listAbandonedCarts(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const data = await getAbandonedCarts({ page, limit, search });

    // Convert BigInt values to JSON-safe strings.
    const safeData = JSON.parse(
      JSON.stringify(data, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return res.status(200).json({
      success: true,
      message: "Abandoned carts fetched successfully",
      data: safeData
    });
  } catch (error) {
    next(error);
  }
}



module.exports = {
  listCoupons,
  addCoupon,
  listBanners,
  addBanner,
  listFlashSales,
  addFlashSale,
  listAbandonedCarts
};