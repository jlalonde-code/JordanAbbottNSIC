const socket = new WebSocket("wss://jordanabbottnsic.onrender.com"); // make sure this matches your Render URL
const startBtn = document.getElementById("startCall");

let audioContext, mediaStream, processor, input;

startBtn.onclick = async () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  input = audioContext.createMediaStreamSource(mediaStream);

  processor = audioContext.createScriptProcessor(4096, 1, 1);
  input.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
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

  console.log("Recording started. Speak now!");
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);
};
