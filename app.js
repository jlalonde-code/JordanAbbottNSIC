import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";

wss.on("connection", (ws) => {
  console.log("🟢 New WebSocket connection established");

  let callTranscript = [];

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      if (!data.audio) return;

      // Convert base64 audio to PCM stream using FFmpeg
      const ffmpeg = spawn(ffmpegPath, [
        "-f", "s16le",            // input format
        "-ar", "48000",           // input sample rate
        "-ac", "1",               // mono audio
        "-i", "pipe:0",           // read from stdin
        "-f", "wav",              // output format for Whisper
        "pipe:1"                  // output to stdout
      ]);

      // Feed the audio buffer into ffmpeg stdin
      ffmpeg.stdin.write(Buffer.from(data.audio, "base64"));
      ffmpeg.stdin.end();

      // Collect WAV output
      const chunks = [];
      ffmpeg.stdout.on("data", (chunk) => chunks.push(chunk));

      ffmpeg.on("close", async () => {
        const wavBuffer = Buffer.concat(chunks);

        // Transcribe with Whisper
        const transcription = await openai.audio.transcriptions.create({
          file: wavBuffer,
          model: "whisper-1",
        });

        const userText = transcription.text.trim();
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
      });

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
