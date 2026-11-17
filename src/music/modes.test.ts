import { describe, expect, it } from 'vitest';
import {
  CHROMATIC_MODE_SELECTION,
  DIATONIC_MODE_NAMES,
  MUSIC_MODES_CHART_ROWS,
  buildDiatonicModeEntry,
  getAllModeEntries,
  getAllowedD12FaceIndices,
} from './modes';

describe('Music Modes Chart & Theory', () => {
  it('has 12 major keys and 7 modes matching the reference chart', () => {
    expect(MUSIC_MODES_CHART_ROWS).toHaveLength(12);
    expect(DIATONIC_MODE_NAMES).toHaveLength(7);

    // C Major row: C, D, E, F, G, A, B
    const cMajor = MUSIC_MODES_CHART_ROWS[0];
    expect(cMajor.keyName).toBe('C Major');
    expect(cMajor.tonics).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

    // G Major row: G, A, B, C, D, E, F#
    const gMajor = MUSIC_MODES_CHART_ROWS[1];
    expect(gMajor.keyName).toBe('G Major');
    expect(gMajor.tonics).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F♯']);

    // D Major row: D, E, F#, G, A, B, C#
    const dMajor = MUSIC_MODES_CHART_ROWS[2];
    expect(dMajor.tonics).toEqual(['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯']);

    // Bb Major row: Bb, C, D, Eb, F, G, A
    const bbMajor = MUSIC_MODES_CHART_ROWS.find((r) => r.keyName === 'B♭ Major')!;
    expect(bbMajor.tonics).toEqual(['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A']);

    // Gb Major row: Gb, Ab, Bb, Cb, Db, Eb, F
    const gbMajor = MUSIC_MODES_CHART_ROWS.find((r) => r.keyName === 'G♭ Major')!;
    expect(gbMajor.tonics).toEqual(['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']);
  });

  it('builds diatonic mode entry with accurate tonic, rotation and parent key', () => {
    // D Dorian from C Major
    const dDorian = buildDiatonicModeEntry('C Major', 'Dorian');
    expect(dDorian.tonic).toBe('D');
    expect(dDorian.modeType).toBe('Dorian');
    expect(dDorian.keyName).toBe('C Major');
    expect(dDorian.displayName).toBe('D Dorian (C Major)');
    expect(dDorian.scalePitches).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C']);
    expect(dDorian.semitones).toEqual([2, 4, 5, 7, 9, 11, 0]);

    // A Aeolian (Natural Minor) from C Major
    const aAeolian = buildDiatonicModeEntry('C Major', 'Aeolian');
    expect(aAeolian.tonic).toBe('A');
    expect(aAeolian.scalePitches).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(aAeolian.semitones).toEqual([9, 11, 0, 2, 4, 5, 7]);
  });

  it('returns all 84 mode entries across the 12 keys and 7 modes', () => {
    const all = getAllModeEntries();
    expect(all).toHaveLength(84);
  });

  it('maps allowed D12 face indices accurately for chromatic and diatonic modes', () => {
    const chromaticIndices = getAllowedD12FaceIndices(CHROMATIC_MODE_SELECTION);
    expect(chromaticIndices).toHaveLength(12);
    expect(chromaticIndices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const dDorian = buildDiatonicModeEntry('C Major', 'Dorian');
    const dDorianIndices = getAllowedD12FaceIndices({
      isChromatic: false,
      ...dDorian,
    });
    // Notes: C(0), D(2), E(4), F(5), G(7), A(9), B(11) -> 7 faces
    expect(dDorianIndices).toHaveLength(7);
    expect(dDorianIndices).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });
});
