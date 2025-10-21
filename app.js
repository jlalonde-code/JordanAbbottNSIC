import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static("public"));

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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

      // Save audio temporarily
      const audioBuffer = Buffer.from(audioBase64, "base64");
      fs.writeFileSync("temp.wav", audioBuffer);

      // Transcribe audio with Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("temp.wav"),
        model: "whisper-1"
      });

      const userText = transcription.text;
      console.log("User said:", userText);

      // Generate AI response as Jordan Abbott
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
      ws.send(JSON.stringify({ text: "Sorry, something went wrong." }));
    }
  });
});

