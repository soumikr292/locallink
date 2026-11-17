const express = require("express");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const router = express.Router();
const transcribeScript = path.join(__dirname, "../../scripts/transcribe.py");

router.post("/", async (req, res) => {
  try {
    const { audioBase64, lang } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, message: "Missing audioBase64 data" });
    }

    const cleanBase64 = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
    const audioBuffer = Buffer.from(cleanBase64, "base64");

    const tempWavPath = `/tmp/locallink_stt_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`;
    fs.writeFileSync(tempWavPath, audioBuffer);

    const targetLang = lang || "bn-IN";

    execFile("python3", [transcribeScript, tempWavPath, targetLang], { timeout: 15000 }, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
      } catch (_) {}

      if (error) {
        console.warn("STT execution error:", error.message, stderr);
        return res.status(500).json({ success: false, error: "stt-failed", message: error.message });
      }

      try {
        const result = JSON.parse(stdout.trim());
        return res.json(result);
      } catch (parseErr) {
        return res.status(500).json({ success: false, error: "parse-failed", raw: stdout });
      }
    });
  } catch (err) {
    console.error("STT route error:", err);
    return res.status(500).json({ success: false, error: "server-error", message: err.message });
  }
});

module.exports = router;
