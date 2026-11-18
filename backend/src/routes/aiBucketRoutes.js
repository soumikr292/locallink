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

function normalizeNumerals(str) {
  const bnDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  const hiDigits = ["०","१","२","३","४","५","६","७","८","९"];
  let res = String(str || "");
  for (let i = 0; i <= 9; i++) {
    res = res.replaceAll(bnDigits[i], String(i)).replaceAll(hiDigits[i], String(i));
  }
  return res;
}

// POST /api/ai-bucket/quick-parse - Parse natural language list/voice input into an AI bucket
router.post("/quick-parse", async (req, res, next) => {
  try {
    const { text, options } = req.body;
    const items = [];
    if (text && typeof text === "string") {
      const normalized = normalizeNumerals(text);
      // Split by commas, newlines, semicolons, or conjunctions in en/bn/hi
      const lines = normalized.split(/[\n,;]+|\s+(?:এবং|ও|আর|aur|and|तथा)\s+/i);
      for (const line of lines) {
        const clean = line.trim();
        if (!clean) continue;
        
        // Pattern 1: Qty + Unit + Name (e.g. "2 kg potato", "১ কেজি আলু", "500g paneer")
        let qtyMatch = clean.match(/^(\d+(?:\.\d+)?)\s*(kg|kilo|gm|g|gram|liter|litre|l|ml|packet|pkt|tin|box|pcs|pc|টা|কেজি|গ্রাম|লিটার|लीटर|किलो|ग्राम)?\s*(.*)$/i);
        if (qtyMatch && qtyMatch[3] && qtyMatch[3].trim()) {
          let qty = Number(qtyMatch[1]) || 1;
          let unit = (qtyMatch[2] || "unit").toLowerCase();
          const name = qtyMatch[3].trim();

          // Grams and ml normalization
          if (["g", "gm", "gram", "গ্রাম", "ग्राम"].includes(unit)) {
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

          items.push({ name, qty, unit });
          continue;
        }

        // Pattern 2: Name + Qty + Unit (e.g. "potato 2kg", "আলু ১ কেজি", "oil 1L")
        qtyMatch = clean.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(kg|kilo|gm|g|gram|liter|litre|l|ml|packet|pkt|tin|box|pcs|pc|টা|কেজি|গ্রাম|লিটার|लीटर|किलो|ग्राम)?$/i);
        if (qtyMatch && qtyMatch[1] && qtyMatch[1].trim() && Number(qtyMatch[2])) {
          let name = qtyMatch[1].trim();
          let qty = Number(qtyMatch[2]) || 1;
          let unit = (qtyMatch[3] || "unit").toLowerCase();

          if (["g", "gm", "gram", "গ্রাম", "ग्राम"].includes(unit)) {
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

          items.push({ name, qty, unit });
          continue;
        }

        // Pattern 3: Bare Name (e.g. "mustard oil", "আটা", "paneer")
        items.push({ name: clean, qty: 1, unit: "unit" });
      }
    }

    const result = await aiBucketService.calculateBucket(items, options || {});
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
