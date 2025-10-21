// app.js
import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from /Public
app.use(express.static("Public"));

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("🟢 New WebSocket connection established");

  let callTranscript = [];
  let audioChunkCount = 0;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (!data.audio) return;

      // Write temporary audio chunk
      const audioBuffer = Buffer.from(data.audio, "base64");
      const tempFileName = `temp-${Date.now()}-${audioChunkCount}.wav`;
      fs.writeFileSync(tempFileName, audioBuffer);
      audioChunkCount++;

      console.log(`🎧 Received audio chunk #${audioChunkCount}`);

      // Transcribe with Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFileName),
        model: "whisper-1",
      });

      const userText = transcription.text.trim();
      fs.unlinkSync(tempFileName); // Always clean up temp files
      if (!userText) return;

      console.log("👤 User said:", userText);
      callTranscript.push({ speaker: "User", text: userText });

      // Build system prompt
      let systemPrompt = `
You are Jordan Abbott, Account Executive at SpotLogic. 
You are performing in the Northeast Intercollegiate Sales Competition (NISC).
You must respond naturally, conversationally, and always stay in character as Jordan Abbott.
Tailor your tone and content based on the buyer persona for the selected round.
Keep responses short and realistic — like a human conversation.`;

      if (data.round === "enablement") {
        systemPrompt += " Focus on Enablement Manager objectives, speed-to-productivity, and enablement alignment.";
      } else if (data.round === "frontline") {
        systemPrompt += " Focus on Frontline Manager objectives, team coaching, and sales rep adoption.";
      } else if (data.round === "cfo") {
        systemPrompt += " Focus on ROI, budget efficiency, and financial justification.";
      } else if (data.round === "svp") {
        systemPrompt += " Focus on sales governance, global alignment, and strategy.";
      }

      // Ask Jordan to respond
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
      });

      const jordanText = aiResponse.choices[0].message.content.trim();
      console.log("🗣️ Jordan responds:", jordanText);

      callTranscript.push({ speaker: "Jordan", text: jordanText });

      ws.send(JSON.stringify({ text: jordanText }));

    } catch (err) {
      console.error("❌ Error handling message:", err);
    }
  });

  ws.on("close", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(
      `transcript-${timestamp}.json`,
      JSON.stringify(callTranscript, null, 2)
    );
    console.log("📄 Transcript saved successfully");
  });
});
