import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

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

app.get("/", (req, res) => {
  res.json({ 
    status: "✅ AI Study Tool backend is running",
    message: "Use POST / to talk to the AI",
    timestamp: new Date().toISOString()
  });
});

app.post("/", async (req, res) => {
  try {
    console.log("Received request body:", req.body);
    
    const prompt = req.body.prompt;
    
    if (!prompt) {
      return res.status(400).json({ 
        error: "Missing prompt in request body",
        text: "Please provide a prompt to generate AI response" 
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not found in environment variables");
      return res.status(500).json({ 
        error: "API key not configured",
        text: "Server configuration error. Please contact administrator." 
      });
    }

    console.log("Sending request to Gemini API...");
    
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ 
          role: "user", 
          parts: [{ text: prompt }] 
        }],
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

    // Enhanced response extraction with better error handling
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
    res.json({ text: aiText });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      text: "An error occurred while processing your request. Please try again.",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: {
      node_version: process.version,
      api_key_configured: !!process.env.GEMINI_API_KEY
    }
  });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    message: "Use GET / for status or POST / for AI chat"
  });
});

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
  console.log(`🔑 API Key configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
