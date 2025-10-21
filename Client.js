const startButton = document.getElementById("startCall");
const status = document.getElementById("status");

let ws;

startButton.onclick = async () => {
  status.innerText = "Connecting...";
  ws = new WebSocket("wss://YOUR_RENDER_URL"); // Replace with your WebSocket endpoint
  ws.onopen = () => status.innerText = "Connected! Speak now...";
  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    // data.audio contains Jordan's response (if using speech synthesis)
    console.log("Jordan says:", data.text);
    // optionally use Web Speech API to speak:
    const utter = new SpeechSynthesisUtterance(data.text);
    speechSynthesis.speak(utter);
  };
};
