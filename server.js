import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const GEMINI_KEY = process.env.GEMINI_KEY; // store key in Render dashboard

app.post("/proxy", async (req, res) => {
  try {
    const { message, topic, mode, mood, personas } = req.body;

    // Build prompt
    const prompt = `
Topic: ${topic}
Mode: ${mode}
Mood: ${mood}
Personas: ${personas.join(", ")}
Message: ${message}
    `;

    const body = {
      contents: [
        { role: "user", parts: [{ text: prompt }] }
      ],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 900
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

    res.json({ reply: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
