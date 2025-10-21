const socket = new WebSocket("wss://jordanabbottnsic.onrender.com"); // replace if needed
const startBtn = document.getElementById("startCall");

let audioContext, mediaStream, processor, input;

startBtn.onclick = async () => {
  // Initialize audio
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);

  // ScriptProcessor for continuous audio chunks
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  input.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    const float32Array = e.inputBuffer.getChannelData(0);
    // Convert Float32Array to 16-bit PCM
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

// Play AI responses
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);
};
