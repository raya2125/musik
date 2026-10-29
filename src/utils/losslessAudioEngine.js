// Clean Web Audio API Dual-Deck DSP Engine
// Supports two <audio> elements (Active Deck + Standby Preload Deck) routed into a shared
// 5-Band Parametric EQ with Automatic Anti-Clip Preamp Headroom, Peak Safety Limiter, and Spectrum Analyzer.

export class AudioProcessingEngine {
  constructor() {
    this.ctx = null;
    this.connectedDecks = new Map(); // HTMLAudioElement -> { source, gain }
    this.activeElement = null;
    this.analyser = null;
    this.bands = [];
    this.preamp = null;
    this.limiter = null;
    this.isInitialized = false;
    this.eqEnabled = true;
  }

  init(audioElement) {
    if (!audioElement) return;

    if (!this.isInitialized) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      // Use 'playback' buffer sizing for smooth, dropout-free music rendering
      this.ctx = new AudioContext({ latencyHint: 'playback' });

      this.preamp = this.ctx.createGain();
      this.limiter = this.ctx.createDynamicsCompressor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;

      // Transparent brickwall safety limiter to prevent 0 dBFS digital clipping under EQ boost
      this.limiter.threshold.value = -0.6;
      this.limiter.knee.value = 2.0;
      this.limiter.ratio.value = 18.0;
      this.limiter.attack.value = 0.002;
      this.limiter.release.value = 0.12;

      // Five-band musical parametric equalizer
      const freqs = [
        { freq: 60, type: 'lowshelf', gain: 2.5, q: 0.71, label: '60Hz Sub' },
        { freq: 230, type: 'peaking', gain: 1.2, q: 0.85, label: '230Hz Bass' },
        { freq: 910, type: 'peaking', gain: 0.0, q: 0.85, label: '910Hz Mid' },
        { freq: 3600, type: 'peaking', gain: 1.8, q: 0.85, label: '3.6kHz Clarity' },
        { freq: 14000, type: 'highshelf', gain: 3.2, q: 0.71, label: '14kHz Treble Air' },
      ];

      this.bands = freqs.map((f) => {
        const filter = this.ctx.createBiquadFilter();
        filter.type = f.type;
        filter.frequency.value = f.freq;
        filter.Q.value = f.q;
        filter.gain.value = f.gain;
        return { filter, ...f };
      });

      // Shared DSP Chain: Deck Gains -> Auto-Headroom Preamp -> EQ Bands -> Safety Limiter -> Analyser -> Destination
      let current = this.preamp;
      this.bands.forEach((b) => {
        current.connect(b.filter);
        current = b.filter;
      });

      current.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.isInitialized = true;
      this._syncPreampAndLimiter();
    }

    if (!this.connectedDecks.has(audioElement)) {
      const source = this.ctx.createMediaElementSource(audioElement);
      const deckGain = this.ctx.createGain();
      deckGain.gain.value = this.activeElement && this.activeElement !== audioElement ? 0.0 : 1.0;
      source.connect(deckGain);
      deckGain.connect(this.preamp);
      this.connectedDecks.set(audioElement, { source, gain: deckGain });
    }

    if (!this.activeElement) {
      this.setActiveElement(audioElement);
    }
  }

  setActiveElement(audioElement) {
    if (!audioElement) return;
    if (!this.isInitialized || !this.connectedDecks.has(audioElement)) {
      this.init(audioElement);
    }
    this.activeElement = audioElement;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const [el, deck] of this.connectedDecks.entries()) {
      const target = el === audioElement ? 1.0 : 0.0;
      deck.gain.gain.cancelScheduledValues(now);
      deck.gain.gain.setValueAtTime(target, now);
    }
  }

  _syncPreampAndLimiter() {
    if (!this.isInitialized || !this.ctx) return;
    if (!this.eqEnabled) {
      // Pure flat unity gain & limiter off for bit-clean bypass
      this.preamp.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
      this.limiter.threshold.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
      this.limiter.ratio.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
      return;
    }

    // Automatic preamp headroom compensation proportional to highest positive EQ boost
    const maxBoostDb = Math.max(0, ...this.bands.map((b) => b.gain || 0));
    const headroomDb = Math.min(6.0, maxBoostDb * 0.65);
    const linearGain = Math.pow(10, -headroomDb / 20);

    this.preamp.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.05);
    this.limiter.threshold.setTargetAtTime(-0.6, this.ctx.currentTime, 0.05);
    this.limiter.ratio.setTargetAtTime(18.0, this.ctx.currentTime, 0.05);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setEqEnabled(enabled) {
    this.eqEnabled = enabled;
    if (!this.isInitialized) return;
    this.bands.forEach((b) => {
      b.filter.gain.setTargetAtTime(enabled ? b.gain : 0, this.ctx.currentTime, 0.08);
    });
    this._syncPreampAndLimiter();
  }

  setBandGain(index, valueDb) {
    if (this.bands[index]) {
      this.bands[index].gain = valueDb;
      if (this.isInitialized) {
        this.bands[index].filter.gain.setTargetAtTime(
          this.eqEnabled ? valueDb : 0,
          this.ctx.currentTime,
          0.05
        );
        this._syncPreampAndLimiter();
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
