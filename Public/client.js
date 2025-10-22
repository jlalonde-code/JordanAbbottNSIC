const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");

const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, workletNode;
let chunkBuffer = [];
let lastSent = 0;
let fullTranscript = [];

// Display transcript messages
function appendTranscript(text, role = "system") {
  const p = document.createElement("p");
  p.textContent = text;
  p.className = role;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

// Convert Float32Array to base64
function float32ToBase64(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 4);
  const view = new DataView(buffer);
  float32Array.forEach((sample, i) => view.setFloat32(i * 4, sample, true));
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Start the conversation
startBtn.onclick = async () => {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    await audioContext.audioWorklet.addModule("audio-processor.js");
    const source = audioContext.createMediaStreamSource(mediaStream);

    workletNode = new AudioWorkletNode(audioContext, "microphone-processor");
    workletNode.port.onmessage = (e) => {
      chunkBuffer.push(...e.data);

      if (Date.now() - lastSent > 2000 && socket.readyState === WebSocket.OPEN) {
        const base64Chunk = float32ToBase64(new Float32Array(chunkBuffer));
        socket.send(JSON.stringify({ audio: base64Chunk, round: roundSelect.value }));
        chunkBuffer = [];
        lastSent = Date.now();
      }
    };

    source.connect(workletNode);
    workletNode.connect(audioContext.destination);

    appendTranscript(
      `System: Call started. You are selling to ${roundSelect.selectedOptions[0].text}.`,
      "system"
    );
  } catch (err) {
    console.error("Error starting call:", err);
    appendTranscript("❌ Microphone access failed.", "system");
  }
};

// Stop the conversation
stopBtn.onclick = () => {
  if (workletNode) workletNode.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  if (audioContext) audioContext.close();

  appendTranscript("System: Call stopped.", "system");

  const blob = new Blob([JSON.stringify(fullTranscript, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "call_transcript.json";
  a.click();
};

// Receive AI responses
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.text) {
    const utterance = new SpeechSynthesisUtterance(data.text);
    speechSynthesis.speak(utterance);
    appendTranscript("Jordan: " + data.text, "jordan");
    fullTranscript.push({ speaker: "Jordan", text: data.text });
  }
};

socket.onopen = () => console.log("✅ WebSocket connected");
socket.onclose = () => appendTranscript("⚠️ Disconnected. Refresh to reconnect.", "system");
socket.onerror = (err) => console.error("WebSocket error:", err);
