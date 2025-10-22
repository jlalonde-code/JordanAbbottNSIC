import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { OpenAI } from "openai";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/respond", async (req, res) => {
  try {
    const { text, round } = req.body;
    if (!text) return res.json({ reply: "I didn’t hear anything—could you repeat that?" });

    let systemPrompt = `
You are Jordan Abbott, Account Executive at SpotLogic, performing at the Northeast Intercollegiate Sales Competition.
Stay natural, concise, and conversational.
Always stay in character as Jordan Abbott.`;

    if (round === "enablement")
      systemPrompt += " Focus on enablement, onboarding, and speed-to-productivity.";
    else if (round === "frontline")
      systemPrompt += " Focus on frontline coaching and adoption.";
    else if (round === "cfo")
      systemPrompt += " Focus on ROI and budget efficiency.";
    else if (round === "svp")
      systemPrompt += " Focus on sales governance and strategy.";

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    });

    const reply = ai.choices[0].message.content.trim();
    console.log("🗣 Jordan:", reply);
    res.json({ reply });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ reply: "Sorry—Jordan’s having trouble responding right now." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend running on ${PORT}`));
