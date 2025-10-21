const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");
const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");
const roundSelect = document.getElementById("roundSelect");

let audioContext, mediaStream, processor, input;
let fullTranscript = []; // store full conversation
let audioBufferArray = []; // store audio chunks
let sendAudioInterval; // interval ID for sending audio

startBtn.onclick = async () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  input.connect(processor);
  processor.connect(audioContext.destination);

  audioBufferArray = [];
  processor.onaudioprocess = (e) => {
    if (!mediaStream) return;
    const float32Array = e.inputBuffer.getChannelData(0);
    audioBufferArray.push(new Float32Array(float32Array));
  };

  // Send buffered audio every 1.5 seconds
  sendAudioInterval = setInterval(() => {
    if (!audioBufferArray.length) return;

    const totalLength = audioBufferArray.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of audioBufferArray) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to 16-bit PCM
    const buffer = new ArrayBuffer(merged.length * 2);
    const view = new DataView(buffer);
    let pos = 0;
    for (let i = 0; i < merged.length; i++, pos += 2) {
      let s = Math.max(-1, Math.min(1, merged[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    const base64Chunk = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    socket.send(JSON.stringify({ audio: base64Chunk, round: roundSelect.value }));

    // Show "User speaking…" in transcript
    appendTranscript("You (speaking…)");
    fullTranscript.push({ speaker: "User", text: "(speaking…)" });

    audioBufferArray = []; // clear buffer
  }, 1500);

  appendTranscript(`System: Call started! Selling to ${roundSelect.options[roundSelect.selectedIndex].text}`);
  console.log("Continuous recording started. Speak now!");
};

stopBtn.onclick = () => {
  if (processor) processor.disconnect();
  if (input) input.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
  if (sendAudioInterval) clearInterval(sendAudioInterval);

  audioContext = null;
  processor = null;
  input = null;
  mediaStream = null;

  appendTranscript("System: Call stopped.");

  // Optionally, download transcript as JSON for reflection
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
