import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import fs from "fs";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

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
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Handle WebSocket connections
wss.on("connection", (ws) => {
  console.log("🟢 New WebSocket connection established");

  let callTranscript = [];
  let audioChunkCount = 0;

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      if (!data.audio) return;

      // Convert browser float32 audio to WAV using ffmpeg
      const rawAudio = Buffer.from(data.audio, "base64");
      const tempRaw = `temp-${Date.now()}-${audioChunkCount}.raw`;
      const tempWav = `temp-${Date.now()}-${audioChunkCount}.wav`;
      fs.writeFileSync(tempRaw, rawAudio);

      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
          "-f", "f32le",        // input format
          "-ar", "48000",       // input sample rate
          "-ac", "1",           // mono
          "-i", tempRaw,        // input file
          "-ar", "16000",       // Whisper sample rate
          "-ac", "1",
          tempWav
        ]);

        ffmpeg.on("close", (code) => {
          fs.unlinkSync(tempRaw);
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg failed with code ${code}`));
        });
      });

      audioChunkCount++;
      console.log(`🎧 Received audio chunk #${audioChunkCount}`);

      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempWav),
        model: "whisper-1",
      });

      fs.unlinkSync(tempWav);

      const userText = transcription.text.trim();
      if (!userText) return;

      console.log("👤 User said:", userText);
      callTranscript.push({ speaker: "User", text: userText });

      // Build system prompt
      let systemPrompt = `
You are Jordan Abbott, Account Executive at SpotLogic. 
You are performing in the Northeast Intercollegiate Sales Competition (NISC).
Respond naturally and conversationally, always staying in character as Jordan Abbott.
Tailor responses to the buyer persona for the selected round.
Keep answers short and realistic.`;

      if (data.round === "enablement") systemPrompt += " Focus on Enablement Manager objectives.";
      else if (data.round === "frontline") systemPrompt += " Focus on Frontline Manager objectives.";
      else if (data.round === "cfo") systemPrompt += " Focus on ROI and budget.";
      else if (data.round === "svp") systemPrompt += " Focus on sales governance and strategy.";

      // Ask AI to respond
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
    fs.writeFileSync(`transcript-${timestamp}.json`, JSON.stringify(callTranscript, null, 2));
    console.log("📄 Transcript saved successfully");
  });
});
