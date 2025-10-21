// ✅ CONNECT TO YOUR BACKEND
const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");

// ✅ UI ELEMENTS
const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, workletNode;
let fullTranscript = [];

// ✅ Append transcript to chat display
function appendTranscript(text) {
  const p = document.createElement("p");
  p.textContent = text;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

// ✅ Start call
startBtn.onclick = async () => {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Add the audio worklet
    await audioContext.audioWorklet.addModule("audio-processor.js");
    const source = audioContext.createMediaStreamSource(mediaStream);

    workletNode = new AudioWorkletNode(audioContext, "microphone-processor");
    workletNode.port.onmessage = (e) => {
      const float32Array = e.data;
      const buffer = new ArrayBuffer(float32Array.length * 2);
      const view = new DataView(buffer);

      for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }

      const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));

      // ✅ Only send if socket is open
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            audio: base64Chunk,
            round: roundSelect.value,
          })
        );
      }
    };

    source.connect(workletNode);
    workletNode.connect(audioContext.destination);

    appendTranscript(
      `System: Call started! Selling to ${roundSelect.selectedOptions[0].text}`
    );
    console.log("🎙️ Real-time streaming started.");
  } catch (err) {
    console.error("Error starting call:", err);
    appendTranscript("❌ Error: Microphone access or setup failed.");
  }
};

// ✅ Stop call
stopBtn.onclick = () => {
  try {
    if (workletNode) workletNode.disconnect();
    if (mediaStream) mediaStream.getTracks().forEach((track) => track.stop());
    if (audioContext) audioContext.close();

    audioContext = null;
    workletNode = null;
    mediaStream = null;

    appendTranscript("System: Call stopped.");

    // Download transcript
    const blob = new Blob([JSON.stringify(fullTranscript, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "call_transcript.json";
    a.click();
  } catch (err) {
    console.error("Error stopping call:", err);
  }
};

// ✅ Handle AI messages from server
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);

    if (data.text) {
      const utterance = new SpeechSynthesisUtterance(data.text);
      speechSynthesis.speak(utterance);

      appendTranscript("Jordan: " + data.text);
      fullTranscript.push({ speaker: "Jordan", text: data.text });
    }
  } catch (err) {
    console.error("Error handling AI message:", err);
  }
};

// ✅ Handle connection issues
socket.onopen = () => console.log("✅ WebSocket connected.");
socket.onclose = () => {
  console.warn("⚠️ WebSocket closed. Reconnecting...");
  appendTranscript("System: Connection lost. Reconnecting...");
  setTimeout(() => window.location.reload(), 2000);
};
socket.onerror = (err) => console.error("WebSocket error:", err);

