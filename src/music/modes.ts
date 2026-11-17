import type {
  DiatonicModeEntry,
  DiatonicModeType,
  MelodyModeSelection,
} from '../types/app';
import { D12_PITCH_FACES } from './theory';

export const DIATONIC_MODE_NAMES: DiatonicModeType[] = [
  'Ionian',
  'Dorian',
  'Phrygian',
  'Lydian',
  'Mixolydian',
  'Aeolian',
  'Locrian',
];

export const PENTATONIC_MODE_NAMES: DiatonicModeType[] = [
  'Major Pentatonic',
  'Minor Pentatonic',
];

export interface ModeChartRow {
  keyName: string;
  tonics: string[]; // 7 notes matching columns: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian
  semitones: number[]; // 7 root semitones for the 7 modes
  scaleNotes: string[]; // The 7 notes of this parent key
}

/**
 * Exact Music Modes Chart matching the reference chart:
 * 12 Major Keys (rows) x 7 Modes (columns)
 */
export const MUSIC_MODES_CHART_ROWS: ModeChartRow[] = [
  {
    keyName: 'C Major',
    tonics: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    semitones: [0, 2, 4, 5, 7, 9, 11],
    scaleNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  },
  {
    keyName: 'G Major',
    tonics: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'],
    semitones: [7, 9, 11, 0, 2, 4, 6],
    scaleNotes: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'],
  },
  {
    keyName: 'D Major',
    tonics: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'],
    semitones: [2, 4, 6, 7, 9, 11, 1],
    scaleNotes: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'],
  },
  {
    keyName: 'A Major',
    tonics: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'],
    semitones: [9, 11, 1, 2, 4, 6, 8],
    scaleNotes: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'],
  },
  {
    keyName: 'E Major',
    tonics: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'],
    semitones: [4, 6, 8, 9, 11, 1, 3],
    scaleNotes: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'],
  },
  {
    keyName: 'B Major',
    tonics: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'],
    semitones: [11, 1, 3, 4, 6, 8, 10],
    scaleNotes: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'],
  },
  {
    keyName: 'F Major',
    tonics: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
    semitones: [5, 7, 9, 10, 0, 2, 4],
    scaleNotes: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
  },
  {
    keyName: 'B♭ Major',
    tonics: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
    semitones: [10, 0, 2, 3, 5, 7, 9],
    scaleNotes: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
  },
  {
    keyName: 'E♭ Major',
    tonics: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
    semitones: [3, 5, 7, 8, 10, 0, 2],
    scaleNotes: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
  },
  {
    keyName: 'A♭ Major',
    tonics: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
    semitones: [8, 10, 0, 1, 3, 5, 7],
    scaleNotes: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
  },
  {
    keyName: 'D♭ Major',
    tonics: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
    semitones: [1, 3, 5, 6, 8, 10, 0],
    scaleNotes: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
  },
  {
    keyName: 'G♭ Major',
    tonics: ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F'],
    semitones: [6, 8, 10, 11, 1, 3, 5],
    scaleNotes: ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F'],
  },
];

export const CHROMATIC_MODE_SELECTION: MelodyModeSelection = {
  isChromatic: true,
  id: 'chromatic',
  name: 'Chromatic',
};

/**
 * Builds a DiatonicModeEntry from a given keyName and modeType.
 */
export function buildDiatonicModeEntry(
  keyName: string,
  modeType: DiatonicModeType
): DiatonicModeEntry {
  const row =
    MUSIC_MODES_CHART_ROWS.find((r) => r.keyName === keyName) ??
    MUSIC_MODES_CHART_ROWS[0];

  if (modeType === 'Major Pentatonic') {
    const tonic = row.tonics[0];
    const tonicSemitone = row.semitones[0];
    // Degrees 1, 2, 3, 5, 6 of the Major scale (5 notes)
    const scalePitches = [
      row.scaleNotes[0],
      row.scaleNotes[1],
      row.scaleNotes[2],
      row.scaleNotes[4],
      row.scaleNotes[5],
    ];
    const semitones = [
      row.semitones[0],
      row.semitones[1],
      row.semitones[2],
      row.semitones[4],
      row.semitones[5],
    ];
    return {
      id: `${row.keyName}-MajorPentatonic`,
      keyName: row.keyName,
      modeType,
      tonic,
      tonicSemitone,
      displayName: `${tonic} Major Pentatonic (${row.keyName})`,
      scalePitches,
      semitones,
    };
  }

  if (modeType === 'Minor Pentatonic') {
    // Relative minor (Aeolian) tonic & degrees 1, 3, 4, 5, 7 of Aeolian (5 notes)
    const tonic = row.tonics[5];
    const tonicSemitone = row.semitones[5];
    const aeolianNotes = [
      ...row.scaleNotes.slice(5),
      ...row.scaleNotes.slice(0, 5),
    ];
    const aeolianSemis = [
      ...row.semitones.slice(5),
      ...row.semitones.slice(0, 5),
    ];
    const scalePitches = [
      aeolianNotes[0],
      aeolianNotes[2],
      aeolianNotes[3],
      aeolianNotes[4],
      aeolianNotes[6],
    ];
    const semitones = [
      aeolianSemis[0],
      aeolianSemis[2],
      aeolianSemis[3],
      aeolianSemis[4],
      aeolianSemis[6],
    ];
    return {
      id: `${row.keyName}-MinorPentatonic`,
      keyName: row.keyName,
      modeType,
      tonic,
      tonicSemitone,
      displayName: `${tonic} Minor Pentatonic (${row.keyName})`,
      scalePitches,
      semitones,
    };
  }

  const colIdx = DIATONIC_MODE_NAMES.indexOf(modeType);
  const safeCol = colIdx >= 0 ? colIdx : 0;

  const tonic = row.tonics[safeCol];
  const tonicSemitone = row.semitones[safeCol];

  // Rotate scale notes to start on the mode's tonic (7 notes)
  const rotatedNotes = [
    ...row.scaleNotes.slice(safeCol),
    ...row.scaleNotes.slice(0, safeCol),
  ];
  const rotatedSemitones = [
    ...row.semitones.slice(safeCol),
    ...row.semitones.slice(0, safeCol),
  ];

  const displayName = `${tonic} ${modeType} (${row.keyName})`;
  const id = `${row.keyName}-${modeType}`;

  return {
    id,
    keyName: row.keyName,
    modeType,
    tonic,
    tonicSemitone,
    displayName,
    scalePitches: rotatedNotes,
    semitones: rotatedSemitones,
  };
}

/**
 * Returns all 84 mode entries (12 keys x 7 modes) from the chart.
 */
export function getAllModeEntries(): DiatonicModeEntry[] {
  const entries: DiatonicModeEntry[] = [];
  MUSIC_MODES_CHART_ROWS.forEach((row) => {
    DIATONIC_MODE_NAMES.forEach((modeType) => {
      entries.push(buildDiatonicModeEntry(row.keyName, modeType));
    });
  });
  return entries;
}

/**
 * Returns the D12 face indices (0..11) that match the allowed pitches of the selected mode.
 * For Chromatic mode, returns all 12 indices [0, 1, 2, ..., 11].
 */
export function getAllowedD12FaceIndices(mode: MelodyModeSelection): number[] {
  if (mode.isChromatic) {
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  }

  const allowedSemitoneSet = new Set(mode.semitones);
  const indices: number[] = [];

  D12_PITCH_FACES.forEach((face, idx) => {
    if (allowedSemitoneSet.has(face.semitone)) {
      indices.push(idx);
    }
  });

  return indices;
}
