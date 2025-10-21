const socket = new WebSocket("wss://jordanabbottnsic.onrender.com");
const startBtn = document.getElementById("startCall");
const stopBtn = document.getElementById("stopCall");
const transcriptDiv = document.getElementById("transcript");

let audioContext, mediaStream, processor, input;

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
    socket.send(JSON.stringify({ audio: base64Chunk }));
  };

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
  console.log("Call stopped.");
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // Speak AI response
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);

  // Append to transcript
  const p = document.createElement("p");
  p.textContent = "Jordan: " + data.text;
  transcriptDiv.appendChild(p);
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
};
