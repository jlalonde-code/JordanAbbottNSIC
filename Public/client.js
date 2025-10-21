const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");
const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, processor, input;
let fullTranscript = []; // store full conversation

// Start the call
startBtn.onclick = async () => {
  if (audioContext) return; // already running

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);

  // ScriptProcessorNode is deprecated, but still works for now
  processor = audioContext.createScriptProcessor(4096, 1, 1);
  input.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!mediaStream) return; // stop if call ended

    const float32Array = e.inputBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    socket.send(JSON.stringify({ 
      audio: base64Chunk,
      round: roundSelect.value
    }));
  };

  appendTranscript(`System: Call started! Selling to ${roundSelect.options[roundSelect.selectedIndex].text}`);
  console.log("Continuous recording started. Speak now!");
};

// Stop the call
stopBtn.onclick = () => {
  if (processor) processor.disconnect();
  if (input) input.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());

  audioContext = null;
  processor = null;
  input = null;
  mediaStream = null;

  appendTranscript("System: Call stopped.");

  // Download full transcript as JSON
  const blob = new Blob([JSON.stringify(fullTranscript, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "call_transcript.json";
  a.click();
};

// Receive messages from AI
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (!data.text) return;

  // Speak AI response
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);

  // Append AI response to transcript
  appendTranscript("Jordan: " + data.text);
  fullTranscript.push({ speaker: "Jordan", text: data.text });
};

// Helper to append transcript
function appendTranscript(text) {
  const p = document.createElement("p");
  p.textContent = text;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

  // Add to full transcript only if system message
  if (text.startsWith("System:")) fullTranscript.push({ speaker: "System", text });
}
