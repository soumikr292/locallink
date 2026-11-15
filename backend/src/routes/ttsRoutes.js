const express = require("express");
const https = require("https");

const router = express.Router();

// Simple in-memory cache for audio buffers (max 200 items)
const audioCache = new Map();
const MAX_CACHE_SIZE = 200;

function cleanTextForTTS(text) {
  if (!text) return "";
  return String(text)
    // Remove markdown, URLs, symbols and emojis
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_~`><\\|\/\[\]\{\}\(\)]/g, " ")
    .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoChunks(text, maxLength = 140) {
  if (text.length <= maxLength) return [text];
  // Split on Bengali danda (।), period, exclamation, question mark, or comma
  const rawParts = text.match(/([^।\.\!\?\,]+[।\.\!\?\,]*)/g) || [text];
  const chunks = [];
  let current = "";

  for (const part of rawParts) {
    if ((current + part).length <= maxLength) {
      current += part;
    } else {
      if (current.trim()) chunks.push(current.trim());
      if (part.length > maxLength) {
        const words = part.split(/\s+/);
        let sub = "";
        for (const w of words) {
          if ((sub + " " + w).length <= maxLength) {
            sub = sub ? sub + " " + w : w;
          } else {
            if (sub.trim()) chunks.push(sub.trim());
            sub = w;
          }
        }
        current = sub;
      } else {
        current = part;
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLength)];
}

function fetchTTSChunk(chunk, lang) {
  return new Promise((resolve, reject) => {
    // Map lang to Google TTS language code
    let targetLang = "bn";
    if (lang === "hi") targetLang = "hi";
    else if (lang === "en") targetLang = "en";

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 8000
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Google TTS responded with status ${res.statusCode}`));
        }
        const data = [];
        res.on("data", (d) => data.push(d));
        res.on("end", () => resolve(Buffer.concat(data)));
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Google TTS request timed out"));
    });
  });
}

async function handleTTS(req, res) {
  try {
    const rawText = req.query.text || req.body?.text || "";
    const lang = (req.query.lang || req.body?.lang || "bn").toLowerCase();

    if (!rawText.trim()) {
      return res.status(400).json({ success: false, message: "Text parameter is required" });
    }

    const cleanedText = cleanTextForTTS(rawText);
    if (!cleanedText) {
      return res.status(400).json({ success: false, message: "Cleaned text is empty" });
    }

    const cacheKey = `${lang}:${cleanedText}`;
    if (audioCache.has(cacheKey)) {
      const cachedBuf = audioCache.get(cacheKey);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", cachedBuf.length);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-TTS-Source", "cache");
      return res.end(cachedBuf);
    }

    const chunks = splitIntoChunks(cleanedText, 140);
    const audioBuffers = await Promise.all(chunks.map((c) => fetchTTSChunk(c, lang)));
    const fullAudioBuffer = Buffer.concat(audioBuffers);

    // Cache the response
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, fullAudioBuffer);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", fullAudioBuffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("X-TTS-Source", "upstream");
    return res.end(fullAudioBuffer);
  } catch (error) {
    console.error("TTS generation error:", error.message);
    return res.status(502).json({
      success: false,
      message: "Failed to generate speech audio: " + error.message
    });
  }
}

router.get("/", handleTTS);
router.post("/", handleTTS);

module.exports = router;
