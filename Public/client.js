const socket = new WebSocket("wss://your-domain-or-localhost:10000");

const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, processor, input;
let fullTranscript = [];
let recording = false;

startBtn.onclick = async () => {
  if (recording) return; // prevent multiple clicks
  recording = true;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);

  // ScriptProcessorNode is deprecated, but works for now
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  input.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!mediaStream) return;

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
};

stopBtn.onclick = () => {
  if (!recording) return;
  recording = false;

  if (processor) processor.disconnect();
  if (input) input.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());

  appendTranscript("System: Call stopped.");

  // Save transcript locally
  const blob = new Blob([JSON.stringify(fullTranscript, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "call_transcript.json";
  a.click();
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Speak AI response
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);

  // Add to transcript div
  appendTranscript("Jordan: " + data.text);

  // Store full transcript
  fullTranscript.push({ speaker: "Jordan", text: data.text });
};

function appendTranscript(text) {
  const p = document.createElement("p");
  p.textContent = text;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;

  // Add user placeholder for speaking
  if (text.includes("System: Call started")) {
    fullTranscript.push({ speaker: "System", text });
  }
}
