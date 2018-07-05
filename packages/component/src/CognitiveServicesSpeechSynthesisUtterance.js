import fetchSpeechData from './synthesis/fetchSpeechData';
import playArrayBuffer from './synthesis/playArrayBuffer';

function asyncDecodeAudioData(audioContext, arrayBuffer) {
  return new Promise((resolve, reject) => {
    const promise = audioContext.decodeAudioData(arrayBuffer, resolve, reject);

    // Newer implementation of "decodeAudioData" will return a Promise
    if (typeof promise.then === 'function') {
      resolve(promise);
    }
  });
}

function playDecoded(audioContext, audioBuffer) {
  return new Promise((resolve, reject) => {
    try {
      const source = audioContext.createBufferSource();

      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);

      // "ended" may not fire if the underlying AudioContext is closed prematurely
      source.onended = resolve;
    } catch (err) {
      reject(err);
    }
  });
}

export default class CognitiveServicesSpeechSynthesisUtterance {
  constructor(text) {
    this.lang = null;
    this.pitch = 1;
    this.rate = 1;
    this.text = text;
    this.voice = null;
    this.volume = 1;

    this.onboundary = null;
    this.onend = null;
    this.onerror = null;
    this.onmark = null;
    this.onpause = null;
    this.onresume = null;
    this.onstart = null;
  }

  async preload() {
    this.arrayBufferPromise = fetchSpeechData({
      lang: window.navigator.language,
      speechToken: this.speechToken,
      text: this.text,
      voice: this.voice && this.voice.voiceURI
    });

    await this.arrayBufferPromise;
  }

  async play(audioContext) {
    try {
      const audioBuffer = await asyncDecodeAudioData(audioContext, await this.arrayBufferPromise);

      this.onstart && this.onstart({ type: 'start' });
      await playDecoded(audioContext, audioBuffer);
      this.onend && this.onend({ type: 'end' });
    } catch (error) {
      this.onerror && this.onerror({ error, type: 'error' });
      throw error;
    }
  }
}
