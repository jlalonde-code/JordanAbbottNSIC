// client.js
const socket = new WebSocket("wss://jordanabbottnsic.onrender.com"); // change if different

let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startCall");

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
  mediaRecorder.onstop = sendAudioToServer;

  mediaRecorder.start();
  console.log("Recording started. Speak now!");

  // Stop recording automatically every 5 seconds (optional for live streaming)
  setInterval(() => {
    if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
  }, 5000);
};

function sendAudioToServer() {
  const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
  const reader = new FileReader();

  reader.onloadend = () => {
    const base64Audio = reader.result.split(",")[1];
    socket.send(JSON.stringify({ audio: base64Audio }));
  };

  reader.readAsDataURL(audioBlob);
  audioChunks = [];
}

// Play AI response using browser speech synthesis
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const utterance = new SpeechSynthesisUtterance(data.text);
  speechSynthesis.speak(utterance);
};
