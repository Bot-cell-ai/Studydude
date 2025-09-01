import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Keep node-fetch for now, but consider @google/generative-ai for better integration

dotenv.config();

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: '*', // Allow all origins for now - restrict this in production
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// --- Gemini API Configuration (using node-fetch directly as per your original setup) ---
// For more robust Gemini integration, consider using the official @google/generative-ai SDK.
// If you install it (npm install @google/generative-ai), you'd use:
// import { GoogleGenerativeAI } from '@google/generative-ai';
// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// And then use model.generateContent or model.startChat.

// Health check endpoint (already present and good)
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ AI Study Tool backend is running",
    message: "Use POST /api/chat to talk to the AI, or /api/generate-flashcards, /api/generate-quiz",
    timestamp: new Date().toISOString()
  });
});

// --- NEW/MODIFIED: AI Chat Endpoint ---
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Received /api/chat request body:", req.body);
    
    const { message, topic, history } = req.body; // Destructure message, topic, history
    
    if (!message) {
      return res.status(400).json({ 
        error: "Missing message in request body",
        text: "Please provide a message to generate AI response" 
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment variables");
      return res.status(500).json({ 
        error: "API key not configured",
        text: "Server configuration error. Please contact administrator." 
      });
    }

    console.log("Sending request to Gemini API for chat...");
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Construct conversation history for Gemini
    const contents = history.map(entry => ({
      role: entry.sender === 'user' ? 'user' : 'model',
      parts: [{ text: entry.content }]
    }));
    
    // Add current message with topic context and style instructions
    contents.push({
      role: "user",
      parts: [{
        text: `You are an AI tutor. 
Answer in a style similar to ChatGPT:
- Write clear, natural sentences.
- Use short paragraphs and bullet points where helpful.
- Highlight important terms in **bold**.
- Keep answers concise (max 6–8 sentences unless user asks for more).
- Tone: professional but friendly for students.

Topic: ${topic}
User Question: ${message}`
      }]
    });

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    console.log("Gemini API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return res.status(response.status).json({
        error: `Gemini API error: ${response.status}`,
        text: "Sorry, the AI service is temporarily unavailable. Please try again later."
      });
    }

    const data = await response.json();
    console.log("Gemini API response received");

    let aiText = "No response from AI";
    
    if (data && data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        aiText = candidate.content.parts[0].text || "Empty response from AI";
      } else if (candidate && candidate.finishReason) {
        aiText = `AI response blocked: ${candidate.finishReason}`;
      }
    }

    console.log("Sending response to client");
    res.json({ response: aiText }); // Changed 'text' to 'response' to match frontend

  } catch (err) {
    console.error("Server error in /api/chat:", err);
    res.status(500).json({ 
      error: "Internal server error",
      text: "An error occurred while processing your request. Please try again.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// --- NEW: Flashcard Generation Endpoint ---
app.post("/api/generate-flashcards", async (req, res) => {
  try {
    console.log("Received /api/generate-flashcards request body:", req.body);
    const { topic, conversationHistory } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required to generate flashcards." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment variables");
      return res.status(500).json({ error: "API key not configured." });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `Based on the topic "${topic}" and the following conversation history, generate 5-7 flashcards. Each flashcard should have a "question" and an "answer". Format the output as a JSON array of objects. Ensure the JSON is valid and directly parsable.

Conversation History:
${conversationHistory.map(msg => `${msg.sender}: ${msg.content}`).join('\n')}

Example JSON format:
[
    {"question": "What is X?", "answer": "Y is the definition."},
    {"question": "Key concept of Z?", "answer": "It involves A, B, and C."}
]
`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error for flashcards:", errorText);
      return res.status(response.status).json({ error: `Gemini API error: ${response.status}` });
    }

    const data = await response.json();
    let flashcards = [];
    if (data && data.candidates && data.candidates.length > 0) {
      const aiResponseText = data.candidates[0].content.parts[0].text;
      try {
        // Attempt to extract JSON from markdown block if present
        const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          flashcards = JSON.parse(jsonMatch[1]);
        } else {
          flashcards = JSON.parse(aiResponseText); // Try parsing directly
        }
      } catch (parseError) {
        console.error("Failed to parse flashcards JSON from AI response:", parseError, "Raw AI response:", aiResponseText);
        return res.status(500).json({ error: "AI generated malformed flashcards. Please try again." });
      }
    }

    res.json({ flashcards });

  } catch (err) {
    console.error("Server error in /api/generate-flashcards:", err);
    res.status(500).json({ error: "An error occurred while generating flashcards." });
  }
});

// --- NEW: Quiz Generation Endpoint ---
app.post("/api/generate-quiz", async (req, res) => {
  try {
    console.log("Received /api/generate-quiz request body:", req.body);
    const { topic, conversationHistory } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required to generate quiz questions." });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment variables");
      return res.status(500).json({ error: "API key not configured." });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `Based on the topic "${topic}" and the following conversation history, generate 3-5 multiple-choice quiz questions. Each question should have a "question", an array of "options", and the "correctAnswer" (the 0-based index of the correct option). Format the output as a JSON array of objects. Ensure the JSON is valid and directly parsable.

Conversation History:
${conversationHistory.map(msg => `${msg.sender}: ${msg.content}`).join('\n')}

Example JSON format:
[
    {
        "question": "What is the capital of France?",
        "options": ["Berlin", "Madrid", "Paris", "Rome"],
        "correctAnswer": 2
    },
    {
        "question": "Which planet is known as the Red Planet?",
        "options": ["Earth", "Mars", "Jupiter", "Venus"],
        "correctAnswer": 1
    }
]
`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error for quiz:", errorText);
      return res.status(response.status).json({ error: `Gemini API error: ${response.status}` });
    }

    const data = await response.json();
    let quizQuestions = [];
    if (data && data.candidates && data.candidates.length > 0) {
      const aiResponseText = data.candidates[0].content.parts[0].text;
      try {
        const jsonMatch = aiResponseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          quizQuestions = JSON.parse(jsonMatch[1]);
        } else {
          quizQuestions = JSON.parse(aiResponseText);
        }
      } catch (parseError) {
        console.error("Failed to parse quiz questions JSON from AI response:", parseError, "Raw AI response:", aiResponseText);
        return res.status(500).json({ error: "AI generated malformed quiz questions. Please try again." });
      }
    }

    res.json({ quizQuestions });

  } catch (err) {
    console.error("Server error in /api/generate-quiz:", err);
    res.status(500).json({ error: "An error occurred while generating quiz questions." });
  }
});


// Handle 404 (already present and good)
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: "Use GET / for status or POST /api/chat, /api/generate-flashcards, /api/generate-quiz"
  });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🔑 API Key configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
