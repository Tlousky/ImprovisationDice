import * as Tone from 'tone';
import { midiToToneNote } from '../music/theory';
import type { MidiOutputManager } from './midiOutput';

export type SampleLoadStatus = 'loading' | 'ready' | 'fallback';

const SALAMANDER_URLS: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
};

export class PianoEngine {
  private sampler: Tone.Sampler | null = null;
  private fallbackSynth: Tone.PolySynth | null = null;
  private reverb: Tone.Reverb | null = null;
  private compressor: Tone.Compressor | null = null;
  private masterGain: Tone.Gain | null = null;
  private status: SampleLoadStatus = 'loading';
  private onStatusChange?: (status: SampleLoadStatus) => void;
  private midiOutput?: MidiOutputManager;
  private initialized = false;
  private diceSfxEnabled = true;
  private lastImpactTime = 0;
  private melodyToken = 0;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(options?: {
    onStatusChange?: (status: SampleLoadStatus) => void;
    midiOutput?: MidiOutputManager;
  }) {
    this.onStatusChange = options?.onStatusChange;
    this.midiOutput = options?.midiOutput;
  }

  private ensureNodes(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.compressor = new Tone.Compressor({
      threshold: -18,
      ratio: 3,
      attack: 0.01,
      release: 0.25,
    }).toDestination();

    this.reverb = new Tone.Reverb({
      decay: 2.6,
      preDelay: 0.02,
      wet: 0.28,
    }).connect(this.compressor);

    this.masterGain = new Tone.Gain(0.85).connect(this.reverb);

    this.fallbackSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle8' },
      envelope: {
        attack: 0.008,
        decay: 0.55,
        sustain: 0.24,
        release: 1.4,
      },
      volume: -6,
    }).connect(this.masterGain);

    this.sampler = new Tone.Sampler({
      urls: SALAMANDER_URLS,
      release: 1.5,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      onload: () => {
        this.status = 'ready';
        this.onStatusChange?.('ready');
      },
      onerror: () => {
        this.status = 'fallback';
        this.onStatusChange?.('fallback');
      },
    }).connect(this.masterGain);
  }

  async unlock(): Promise<void> {
    this.ensureNodes();
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
  }

  setVolume(volume: number): void {
    this.ensureNodes();
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.rampTo(clamped, 0.05);
    }
  }

  setReverbWet(wet: number): void {
    this.ensureNodes();
    const clamped = Math.max(0, Math.min(0.65, wet));
    if (this.reverb) {
      this.reverb.wet.rampTo(clamped, 0.05);
    }
  }

  setDiceSfxEnabled(enabled: boolean): void {
    this.diceSfxEnabled = enabled;
  }

  getStatus(): SampleLoadStatus {
    return this.status;
  }

  private getActiveInstrument(): Tone.Sampler | Tone.PolySynth | null {
    this.ensureNodes();
    if (this.status === 'ready' && this.sampler) {
      return this.sampler;
    }
    return this.fallbackSynth;
  }

  async playNote(
    midiNote: number,
    duration = '2n',
    velocity = 0.84
  ): Promise<void> {
    await this.unlock();
    const instrument = this.getActiveInstrument();
    if (!instrument) return;

    const noteName = midiToToneNote(midiNote);
    const now = Tone.now() + 0.015;
    instrument.triggerAttackRelease(noteName, duration, now, velocity);
    this.midiOutput?.sendNote(
      midiNote,
      Math.round(velocity * 110),
      650,
      15
    );
  }

  async playChord(
    midiNotes: number[],
    mode: 'block' | 'arpeggio' = 'block'
  ): Promise<void> {
    if (midiNotes.length === 0) return;
    await this.unlock();
    const instrument = this.getActiveInstrument();
    if (!instrument) return;

    const stepSec = mode === 'arpeggio' ? 0.14 : 0.018;
    const duration = mode === 'arpeggio' ? '1n' : '1.5n';
    const baseTime = Tone.now() + 0.02;

    midiNotes.forEach((midi, idx) => {
      const noteName = midiToToneNote(midi);
      const velocity = idx < 2 ? 0.68 : 0.8 + Math.min(0.14, idx * 0.02);
      instrument.triggerAttackRelease(
        noteName,
        duration,
        baseTime + idx * stepSec,
        velocity
      );
    });

    this.midiOutput?.sendChord(midiNotes, mode, 1750);
  }

  async playChordAndRoot(
    chordNotes: number[],
    rootNotes: number[]
  ): Promise<void> {
    if (chordNotes.length === 0 && rootNotes.length === 0) return;
    await this.unlock();
    const instrument = this.getActiveInstrument();
    if (!instrument) return;

    const baseTime = Tone.now() + 0.02;

    // 1. Play the chord first
    chordNotes.forEach((midi, idx) => {
      const noteName = midiToToneNote(midi);
      instrument.triggerAttackRelease(
        noteName,
        '1.5n',
        baseTime + idx * 0.018,
        0.82 + Math.min(0.12, idx * 0.02)
      );
    });

    // 2. Play the root after 0.5s
    const rootTime = baseTime + 0.5;
    rootNotes.forEach((midi, idx) => {
      const noteName = midiToToneNote(midi);
      instrument.triggerAttackRelease(
        noteName,
        '1.5n',
        rootTime + idx * 0.015,
        0.86
      );
    });

    this.midiOutput?.sendChordAndRoot(chordNotes, rootNotes, 1750);
  }

  stopMelodySequence(): void {
    this.melodyToken += 1;
  }

  async playMelodySequence(
    midiNotes: number[],
    bpm: number,
    onStep?: (index: number) => void
  ): Promise<void> {
    if (midiNotes.length === 0) return;
    await this.unlock();
    const instrument = this.getActiveInstrument();
    if (!instrument) return;

    const token = ++this.melodyToken;
    const stepMs = Math.round((60 / Math.max(50, Math.min(180, bpm))) * 1000);
    const noteDurationSec = Math.max(0.28, (stepMs / 1000) * 0.92);

    for (let i = 0; i < midiNotes.length; i++) {
      if (token !== this.melodyToken) return;
      const midi = midiNotes[i];
      const noteName = midiToToneNote(midi);
      const now = Tone.now() + 0.01;
      const isLast = i === midiNotes.length - 1;
      instrument.triggerAttackRelease(
        noteName,
        isLast ? noteDurationSec * 1.65 : noteDurationSec,
        now,
        0.84
      );
      this.midiOutput?.sendNote(
        midi,
        92,
        Math.round((isLast ? noteDurationSec * 1.5 : noteDurationSec) * 1000),
        10
      );
      onStep?.(i);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, stepMs);
      });
    }
  }

  /**
   * Synthesizes a subtle resin-on-velvet/walnut dice collision click via Web Audio.
   */
  playDiceImpact(intensity = 0.5): void {
    if (!this.diceSfxEnabled) return;
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowPerf - this.lastImpactTime < 45) return;
    this.lastImpactTime = nowPerf;

    try {
      const ctx = Tone.getContext().rawContext as AudioContext | undefined;
      if (!ctx || ctx.state !== 'running') return;

      const gainScalar = Math.max(0.05, Math.min(0.45, intensity * 0.35));
      const t = ctx.currentTime;

      // Soft woody/velvet body resonance
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195 + Math.random() * 85, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.045);

      oscGain.gain.setValueAtTime(gainScalar * 0.55, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.055);

      // Subtle resin tap transient
      if (!this.noiseBuffer) {
        const len = Math.floor(ctx.sampleRate * 0.03);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
        }
        this.noiseBuffer = buf;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + Math.random() * 700, t);
      filter.Q.value = 2.4;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gainScalar * 0.35, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(t);
    } catch {
      // Ignore if audio context is not unlocked yet
    }
  }

  dispose(): void {
    this.stopMelodySequence();
    this.sampler?.dispose();
    this.fallbackSynth?.dispose();
    this.masterGain?.dispose();
    this.reverb?.dispose();
    this.compressor?.dispose();
    this.initialized = false;
  }
}
