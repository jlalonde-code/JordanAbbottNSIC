// app.js
import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static files from Public folder
app.use(express.static("Public"));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  let callTranscript = []; // Store all messages for this session

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      // Stop call action
      if (data.action === "stop") {
        ws.send(JSON.stringify({ text: "Call ended.", transcript: callTranscript }));
        return;
      }

      if (!data.audio) return;

      // Convert audio from base64 to file
      const audioBuffer = Buffer.from(data.audio, "base64");
      fs.writeFileSync("temp.wav", audioBuffer);

      // Transcribe audio using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("temp.wav"),
        model: "whisper-1"
      });

      const userText = transcription.text;
      callTranscript.push({ speaker: "User", text: userText });
      console.log("User said:", userText);

      // Build system prompt based on selected round
      let systemPrompt = `
You are Jordan Abbott, Account Executive at SpotLogic. Respond exactly as he would
during the Northeast Intercollegiate Sales Competition (NSIC). You know:
- SpotLogic product details, pilot pricing, and success metrics
- Tech.ai company situation and challenges
- Round-by-round roles: Jordan Abbott, Pat Regan, Alex Marcaida, Jaime Nelson
- How each round is judged (Approach, Discovery, Connection, Pushback, Close)
- Buyer personas and typical objections
- Quick prep guides, ROI math, and relevant talking points
Always respond using this context and in character as Jordan Abbott.`;

      if (data.round === "enablement") {
        systemPrompt += " Focus on Enablement Manager objectives, BAINTC questions, and speed-to-productivity.";
      } else if (data.round === "frontline") {
        systemPrompt += " Focus on Frontline Manager objectives and coaching cadence.";
      } else if (data.round === "cfo") {
        systemPrompt += " Focus on CFO objectives, budget, ROI, and risk.";
      } else if (data.round === "svp") {
        systemPrompt += " Focus on SVP Sales Ops objectives, governance, and process consistency.";
      }

      // Generate AI response
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ]
      });

      const jordanText = aiResponse.choices[0].message.content;
      callTranscript.push({ speaker: "Jordan", text: jordanText });
      console.log("Jordan responds:", jordanText);

      // Send response back to client
      ws.send(JSON.stringify({ text: jordanText }));

    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  // Save transcript when connection closes
  ws.on("close", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(`transcript-${timestamp}.json`, JSON.stringify(callTranscript, null, 2));
    console.log("Transcript saved for reflection:", `transcript-${timestamp}.json`);
  });
});
