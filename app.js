import express from "express";
import { WebSocketServer } from "ws";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Start HTTP server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", async (message) => {
    console.log("Received:", message.toString());

    // Generate AI response
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: message.toString() }]
    });

    ws.send(response.choices[0].message.content);
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});
