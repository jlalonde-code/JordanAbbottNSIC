import express from "express";
import { WebSocketServer } from "ws";
import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 10000;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("."));

const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  ws.on("message", async message => {
    const userText = message.toString();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: userText }]
    });

    const responseText = completion.choices[0].message.content;
    ws.send(JSON.stringify({ text: responseText }));
  });
});
