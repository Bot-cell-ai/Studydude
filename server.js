import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ AI backend is running. Use POST / to talk to the AI.");
});

app.post("/", async (req, res) => {
  try {
    const prompt = req.body.prompt;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    // ✅ Extract the text safely
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";

    res.json({ text: aiText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ text: "Error contacting AI" });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`✅ Server running on port ${port}`));
