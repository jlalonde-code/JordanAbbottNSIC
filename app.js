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

  let callTranscript = []; // store all messages
  let audioChunkCount = 0; // counter for naming temp files

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      if (!data.audio) return;

      // Convert base64 audio to file
      const audioBuffer = Buffer.from(data.audio, "base64");
      const tempFileName = `temp-${audioChunkCount}.wav`;
      fs.writeFileSync(tempFileName, audioBuffer);
      audioChunkCount++;

      // Transcribe audio using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFileName),
        model: "whisper-1"
      });

      const userText = transcription.text.trim();
      if (!userText) return;

      console.log("User said:", userText);
      callTranscript.push({ speaker: "User", text: userText });

      // Prepare system prompt based on round
      let systemPrompt = `
You are Jordan Abbott, Account Executive at SpotLogic. Respond exactly as he would
during the Northeast Intercollegiate Sales Competition (NSIC). Always respond in character
based on the round and buyer persona context.`;

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

      const jordanText = aiResponse.choices[0].message.content.trim();
      console.log("Jordan responds:", jordanText);
      callTranscript.push({ speaker: "Jordan", text: jordanText });

      // Send AI response to client
      ws.send(JSON.stringify({ text: jordanText }));

      // Clean up temp file
      fs.unlinkSync(tempFileName);

    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  ws.on("close", () => {
    // Save full call transcript
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.writeFileSync(`transcript-${timestamp}.json`, JSON.stringify(callTranscript, null, 2));
    console.log("Transcript saved for reflection");
  });
});
