const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");
const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, processor, input;
let fullTranscript = []; // store full conversation

startBtn.onclick = async () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  input.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    if (!mediaStream) return; // stop if call ended

    const float32Array = e.inputBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);

    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    // Send audio + selected round
    socket.send(JSON.stringify({ 
      audio: base64Chunk,
      round: roundSelect.value 
    }));

    // Append user speaking to transcript (optional placeholder)
    appendTranscript(`You (speaking…): `);
  };

  appendTranscript(`System: Call started! Selling to ${roundSelect.options[roundSelect.selectedIndex].text}`);
  console.log("Continuous recording started. Speak now!");
};

stopBtn.onclick = () => {
  if (processor) processor.disconnect();
  if (input) input.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  audioContext = null;
  processor = null;
  input = null;
  mediaStream = null;

  appendTranscript("System: Call stopped.");

  // Download transcript as JSON for reflection
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

  // Append to transcript
  appendTranscript("Jordan: " + data.text);

  // Add to full transcript
  fullTranscript.push({ speaker: "Jordan", text: data.text });
};

function appendTranscript(text) {
  const p = document.createElement("p");
  p.textContent = text;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}
