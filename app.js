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

      const audioBuffer = Buffer.from(audioBase64, "base64");
      fs.writeFileSync("temp.wav", audioBuffer);

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream("temp.wav"),
        model: "whisper-1"
      });

      const userText = transcription.text;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are Jordan Abbott. Respond like him using the info provided about NSIC and Jordan." },
          { role: "user", content: userText }
        ]
      });

      ws.send(JSON.stringify({ text: aiResponse.choices[0].message.content }));
    } catch (err) {
      console.error("Error:", err);
    }
  });
});

