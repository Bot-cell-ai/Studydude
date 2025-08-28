import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// 👇 Add this
app.get("/", (req, res) => {
  res.send("✅ AI backend is running. Use POST / to talk to the AI.");
});

// AI endpoint
app.post("/", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "Error connecting to Gemini API" });
  }
});

app.listen(10000, () => console.log("✅ Server running on port 10000"));
