import { describe, expect, it } from 'vitest';
import {
  BLACK_KEYS,
  KEYS,
  TOTAL_WHITE,
  WHITE_KEYS,
  computeKeyLabel,
  normalizeIntoDisplayRange,
} from './PianoKeyboardMini';
import { buildDiatonicModeEntry } from '../music/modes';

describe('PianoKeyboardMini', () => {
  it('generates the exact 29 keys (17 white, 12 black) from C3 (48) to E5 (76)', () => {
    expect(KEYS.length).toBe(29);
    expect(WHITE_KEYS.length).toBe(17);
    expect(BLACK_KEYS.length).toBe(12);
    expect(TOTAL_WHITE).toBe(17);
    expect(KEYS[0].midi).toBe(48); // C3
    expect(KEYS[KEYS.length - 1].midi).toBe(76); // E5
  });

  it('normalizes octaves into the display range (48..76)', () => {
    expect(normalizeIntoDisplayRange(36)).toBe(48); // C2 -> C3
    expect(normalizeIntoDisplayRange(60)).toBe(60); // C4 -> C4
    expect(normalizeIntoDisplayRange(84)).toBe(72); // C6 -> C5
  });

  it('computes correct octave labels for C keys and note letters for other white keys', () => {
    const c3 = KEYS.find((k) => k.midi === 48)!;
    const d3 = KEYS.find((k) => k.midi === 50)!;
    const c4 = KEYS.find((k) => k.midi === 60)!;
    const c5 = KEYS.find((k) => k.midi === 72)!;

    expect(computeKeyLabel(c3)).toBe('C3');
    expect(computeKeyLabel(d3)).toBe('D');
    expect(computeKeyLabel(c4)).toBe('C4');
    expect(computeKeyLabel(c5)).toBe('C5');
  });

  it('displays accurate modal accidental spellings for black keys in diatonic modes', () => {
    // F Major has B♭ (semitone 10)
    const fMajor = buildDiatonicModeEntry('F Major', 'Ionian');
    const bbKey = BLACK_KEYS.find((k) => k.semitone === 10)!;
    const labelBb = computeKeyLabel(
      bbKey,
      fMajor.semitones,
      fMajor.scalePitches,
      true
    );
    expect(labelBb).toBe('B♭');

    // G Major has F♯ (semitone 6)
    const gMajor = buildDiatonicModeEntry('G Major', 'Ionian');
    const fsKey = BLACK_KEYS.find((k) => k.semitone === 6)!;
    const labelFs = computeKeyLabel(
      fsKey,
      gMajor.semitones,
      gMajor.scalePitches,
      true
    );
    expect(labelFs).toBe('F♯');
  });

  it('matches selected mode tonic correctly rather than arbitrary roll notes', () => {
    // D Dorian has tonic D (semitone 2)
    const dDorian = buildDiatonicModeEntry('C Major', 'Dorian');
    expect(dDorian.tonic).toBe('D');
    expect(dDorian.tonicSemitone).toBe(2);

    // E Phrygian has tonic E (semitone 4)
    const ePhrygian = buildDiatonicModeEntry('C Major', 'Phrygian');
    expect(ePhrygian.tonic).toBe('E');
    expect(ePhrygian.tonicSemitone).toBe(4);
  });
});
