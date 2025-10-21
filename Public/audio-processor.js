// audio-processor.js
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      // Copy audio samples
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('microphone-processor', MicrophoneProcessor);
