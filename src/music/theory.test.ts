import { describe, expect, it } from 'vitest';
import {
  D12_PITCH_FACES,
  D20_CHORD_FACES,
  buildChordResult,
  buildMelodyStepMidi,
  midiToDisplayNote,
  midiToToneNote,
} from './theory';

describe('Composer Dice Music Theory', () => {
  it('defines 12 unique pitch classes covering semitones 0..11 on the D12', () => {
    expect(D12_PITCH_FACES).toHaveLength(12);
    const semitones = D12_PITCH_FACES.map((p) => p.semitone);
    expect(semitones).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('defines a weighted 20-face D20 matching the Harmony Lab distribution', () => {
    expect(D20_CHORD_FACES).toHaveLength(20);
    D20_CHORD_FACES.forEach((face, idx) => {
      expect(face.faceIndex).toBe(idx);
    });

    const countByQuality = D20_CHORD_FACES.reduce<Record<string, number>>(
      (acc, face) => {
        acc[face.id] = (acc[face.id] ?? 0) + 1;
        return acc;
      },
      {}
    );

    expect(countByQuality.M).toBe(3);
    expect(countByQuality.m).toBe(3);
    expect(countByQuality.M7).toBe(2);
    expect(countByQuality.m7).toBe(2);
    expect(countByQuality['7']).toBe(2);
    expect(countByQuality.halfDim7).toBe(1);
    expect(countByQuality.dim7).toBe(1);
    expect(countByQuality.mM7).toBe(1);
    expect(countByQuality.sus4).toBe(1);
    expect(countByQuality.sus2).toBe(1);
    expect(countByQuality.aug).toBe(1);
    expect(countByQuality.dim).toBe(1);
    expect(countByQuality['6']).toBe(1);
  });

  it('builds accurate chord symbols, note lists, and strictly ascending piano voicings', () => {
    // Eb (index 3) + half-diminished (index 12) -> Ebø
    const halfDim = buildChordResult(3, 12);
    expect(halfDim.symbol).toBe('E♭ø');
    expect(halfDim.noteNames).toEqual(['E♭', 'G♭', 'A', 'D♭']);
    expect(halfDim.midiNotes).toEqual([39, 51, 63, 66, 69, 73]);
    expect(halfDim.chordNotes).toEqual([63, 66, 69, 73]);
    expect(halfDim.bassNotes).toEqual([39, 51]);

    // D (index 2) + minor (index 3) -> Dm
    const dMinor = buildChordResult(2, 3);
    expect(dMinor.symbol).toBe('Dm');
    expect(dMinor.noteNames).toEqual(['D', 'F', 'A']);
    expect(dMinor.midiNotes).toEqual([38, 45, 62, 65, 69]);
    expect(dMinor.chordNotes).toEqual([62, 65, 69]);
    expect(dMinor.bassNotes).toEqual([38, 45]);

    // Every combination of D12 x D20 produces strictly ascending MIDI notes
    for (let r = 0; r < D12_PITCH_FACES.length; r++) {
      for (let c = 0; c < D20_CHORD_FACES.length; c++) {
        const res = buildChordResult(r, c);
        expect(res.midiNotes.length).toBeGreaterThanOrEqual(5);
        for (let i = 1; i < res.midiNotes.length; i++) {
          expect(res.midiNotes[i]).toBeGreaterThan(res.midiNotes[i - 1]);
        }
      }
    }
  });

  it('keeps melody step MIDI notes in singable range with smooth voice leading', () => {
    const first = buildMelodyStepMidi(D12_PITCH_FACES[0], null); // C4 = 60
    expect(first).toBe(60);

    // Next pitch B (semitone 11): B3 (59) is 1 semitone away from C4 (60), closer than B4 (71)
    const nextB = buildMelodyStepMidi(D12_PITCH_FACES[11], first);
    expect(nextB).toBe(59);

    expect(midiToDisplayNote(63)).toBe('E♭4');
    expect(midiToToneNote(63)).toBe('Eb4');
  });
});
