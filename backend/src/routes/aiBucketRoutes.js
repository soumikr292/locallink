/**
 * LocalLink AI Bucket API Routes
 * Multi-Platform Price Intelligence across:
 * Zepto, Blinkit, JioMart, Flipkart Minutes, Swiggy Instamart, Amazon, Amazon Grocery, MemoCash & LocalLink
 */
const express = require("express");
const aiBucketService = require("../services/aiBucketService");

const router = express.Router();

// GET /api/ai-bucket/platforms - List all supported platforms with fees and tags
router.get("/platforms", (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      platforms: aiBucketService.getPlatforms()
    }
  });
});

// GET /api/ai-bucket/benchmarks - Pre-calculated smart benchmark baskets
router.get("/benchmarks", async (req, res, next) => {
  try {
    const benchmarks = await aiBucketService.getBenchmarks();
    return res.status(200).json({
      success: true,
      data: {
        benchmarks
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-bucket/calculate - Calculate customized bucket pricing
router.post("/calculate", async (req, res, next) => {
  try {
    const { items, options } = req.body;
    const result = await aiBucketService.calculateBucket(items || [], options || {});
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ai-bucket/quick-parse - Parse natural language list/voice input into an AI bucket
router.post("/quick-parse", async (req, res, next) => {
  try {
    const { text, options } = req.body;
    const items = [];
    if (text && typeof text === "string") {
      // Split by commas, newlines, or conjunctions
      const lines = text.split(/[\n,;]+| এবং | ও | aur | and /i);
      for (const line of lines) {
        const clean = line.trim();
        if (!clean) continue;
        
        // Extract quantity if present (e.g. "2 kg potato", "500g paneer", "1 packet salt")
        const qtyMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(kg|kilo|gm|g|gram|liter|litre|l|ml|packet|pkt|tin|box|pcs|pc|টা|কেজি|গ্রাম|লিটার)?\s*(.*)$/i);
        if (qtyMatch) {
          let qty = Number(qtyMatch[1]) || 1;
          let unit = (qtyMatch[2] || "unit").toLowerCase();
          const name = (qtyMatch[3] || clean).trim();

          // Grams and ml normalization
          if (["g", "gm", "gram", "গ্রাম"].includes(unit)) {
            if (qty >= 50) {
              qty = Number((qty / 1000).toFixed(2));
              unit = "kg";
            }
          } else if (["ml"].includes(unit)) {
            if (qty >= 50) {
              qty = Number((qty / 1000).toFixed(2));
              unit = "L";
            }
          }

          items.push({ name: name || clean, qty, unit });
        } else {
          items.push({ name: clean, qty: 1, unit: "unit" });
        }
      }
    }

    const result = await aiBucketService.calculateBucket(items, options || {});
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
