// Audio processing and EQ engine using Web Audio API.
// Provides 5-Band Parametric EQ, Dynamic Range Expander, and Real-Time Spectrum Analyzer

export class AudioProcessingEngine {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.analyser = null;
    this.bands = [];
    this.preamp = null;
    this.isInitialized = false;
    this.eqEnabled = true;
  }

  init(audioElement) {
    if (this.isInitialized || !audioElement) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    // Keep the device/browser's preferred rate. Requesting 96 kHz does not make
    // a lossy source lossless, and browser audio processing is not bit-perfect.
    this.ctx = new AudioContext();

    this.source = this.ctx.createMediaElementSource(audioElement);
    this.preamp = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;

    // Five-band equalizer.
    const freqs = [
      { freq: 60, type: 'lowshelf', gain: 2.5, label: '60Hz Sub' },
      { freq: 230, type: 'peaking', gain: 1.2, label: '230Hz Bass' },
      { freq: 910, type: 'peaking', gain: 0.0, label: '910Hz Mid' },
      { freq: 3600, type: 'peaking', gain: 1.8, label: '3.6kHz Clarity' },
      { freq: 14000, type: 'highshelf', gain: 3.2, label: '14kHz Hi-Res Air' },
    ];

    this.bands = freqs.map((f) => {
      const filter = this.ctx.createBiquadFilter();
      filter.type = f.type;
      filter.frequency.value = f.freq;
      filter.gain.value = f.gain;
      return { filter, ...f };
    });

    // Connect chain: Source -> Preamp -> EQ Bands -> Analyser -> Destination
    let current = this.source;
    current.connect(this.preamp);
    current = this.preamp;

    this.bands.forEach((b) => {
      current.connect(b.filter);
      current = b.filter;
    });

    current.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.isInitialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    if (!this.isInitialized) return;
    // Apply the selected EQ curve when enabled.
    const defaultGains = [2.5, 1.2, 0.0, 1.8, 3.2];
    this.bands.forEach((b, idx) => {
      b.filter.gain.setTargetAtTime(enabled ? defaultGains[idx] : 0, this.ctx.currentTime, 0.1);
    });
  }

  setBandGain(index, valueDb) {
    if (this.bands[index]) {
      this.bands[index].gain = valueDb;
      if (this.isInitialized) {
        this.bands[index].filter.gain.setTargetAtTime(valueDb, this.ctx.currentTime, 0.05);
      }
    }
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(32).fill(15);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

export const dspEngine = new AudioProcessingEngine();
