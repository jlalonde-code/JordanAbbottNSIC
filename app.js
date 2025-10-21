// app.js
import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files (like client.js and index.html)
app.use(express.static("public"));

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket server for live calls
const wss = new WebSocketServer({ server });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      const audioBase64 = data.audio;

      // Convert audio to text using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: Buffer.from(audioBase64, "base64"),
        model: "whisper-1"
      });

      const userText = transcription.text;
      console.log("User said:", userText);

      // Generate AI response (Jordan Abbott style)
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Jordan Abbott. Respond like him using the info provided about NSIC and Jordan." },
          { role: "user", content: userText }
        ]
      });

      const jordanText = aiResponse.choices[0].message.content;

      // Send AI text back to client
      ws.send(JSON.stringify({ text: jordanText }));

    } catch (err) {
      console.error("Error handling message:", err);
    }
  });
});
