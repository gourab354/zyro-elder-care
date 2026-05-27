import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body parser limit for base64 file uploads
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("Waring: GEMINI_API_KEY environment variable is missing.");
}

// API endpoint for Report Scanner
app.post("/api/scan-report", async (req, res) => {
  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: "Missing fileData (base64 string)" });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini AI is not initialized. Please verify your GEMINI_API_KEY is configured in the Secrets manager.",
      });
    }

    // Prepare multi-part content matching @google/genai SDK guidelines
    const filePart = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: fileData,
      },
    };

    const textPart = {
      text: `You are an expert senior geriatric healthcare consultant and medical analyst named AI_CARE. 
      Analyze this clinical report or medical document carefully. 
      Provide a highly empathetic, clear, patient-friendly summary for an elderly patient. 
      Format the output with rich Markdown structure, including:
      1. **Document Overview** (with file name: ${fileName || "unnamed document"})
      2. **Key Metrics & Readings** (highlighting any abnormal or concerning status)
      3. **Action Items & Lifestyle Recommendations** (written in highly encouraging and reassuring language)
      4. **Questions to Ask your Doctor** (so the patient is empowered for their next care visit)
      
      Keep medical jargon explained in plain, humble, reassuring terminology. 
      If there is nothing critical, emphasize that they are doing wonderfully. Always add a disclaimer at the bottom that this is an AI-assisted analysis and they should consult their personal physician.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [filePart, textPart] },
    });

    const summaryText = response.text || "No summary was generated. Support file format might have returned an empty content.";

    return res.json({ success: true, summary: summaryText });
  } catch (error: any) {
    console.error("Gemini Scan Error:", error);
    return res.status(500).json({
      error: error?.message || "Internal server error occurred while scanning with Gemini.",
    });
  }
});

// Configure Vite integration for Full-Stack Development
async function setupViteIntegration() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode with static directory serving...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI_CARE premium full-stack server listening on http://0.0.0.0:${PORT}`);
  });
}

setupViteIntegration().catch((e) => {
  console.error("Vite/Express initialization failed:", e);
  process.exit(1);
});
