import type {
  ChordFace,
  ChordQualityId,
  ChordRollResult,
  PitchClass,
} from '../types/app';

/**
 * Authentic 12 pitch classes printed on The Harmony Lab Composer's Dice D12.
 */
export const D12_PITCH_FACES: PitchClass[] = [
  { id: 'C', label: 'C', semitone: 0, midiBase: 60, needsUnderline: true },
  { id: 'Cs', label: 'C♯', enharmonic: 'D♭', semitone: 1, midiBase: 61 },
  { id: 'D', label: 'D', semitone: 2, midiBase: 62 },
  { id: 'Eb', label: 'E♭', enharmonic: 'D♯', semitone: 3, midiBase: 63 },
  { id: 'E', label: 'E', semitone: 4, midiBase: 64 },
  { id: 'F', label: 'F', semitone: 5, midiBase: 65 },
  { id: 'Fs', label: 'F♯', enharmonic: 'G♭', semitone: 6, midiBase: 66 },
  { id: 'G', label: 'G', semitone: 7, midiBase: 67 },
  { id: 'Ab', label: 'A♭', enharmonic: 'G♯', semitone: 8, midiBase: 68 },
  { id: 'A', label: 'A', semitone: 9, midiBase: 69 },
  { id: 'Bb', label: 'B♭', enharmonic: 'A♯', semitone: 10, midiBase: 70 },
  { id: 'B', label: 'B', semitone: 11, midiBase: 71 },
];

interface ChordDefinition {
  id: ChordQualityId;
  faceLabel: string;
  displaySuffix: string;
  fullName: string;
  intervals: number[];
  weight: number;
  needsUnderline?: boolean;
}

const CHORD_DEFINITIONS: ChordDefinition[] = [
  {
    id: 'M',
    faceLabel: 'M',
    displaySuffix: '',
    fullName: 'Major',
    intervals: [0, 4, 7],
    weight: 3,
    needsUnderline: true,
  },
  {
    id: 'm',
    faceLabel: 'm',
    displaySuffix: 'm',
    fullName: 'Minor',
    intervals: [0, 3, 7],
    weight: 3,
    needsUnderline: true,
  },
  {
    id: 'M7',
    faceLabel: 'M⁷',
    displaySuffix: 'M⁷',
    fullName: 'Major 7th',
    intervals: [0, 4, 7, 11],
    weight: 2,
  },
  {
    id: 'm7',
    faceLabel: 'm⁷',
    displaySuffix: 'm⁷',
    fullName: 'Minor 7th',
    intervals: [0, 3, 7, 10],
    weight: 2,
  },
  {
    id: '7',
    faceLabel: '7',
    displaySuffix: '7',
    fullName: 'Dominant 7th',
    intervals: [0, 4, 7, 10],
    weight: 2,
  },
  {
    id: 'halfDim7',
    faceLabel: 'ø',
    displaySuffix: 'ø',
    fullName: 'Half-Diminished 7th (m7♭5)',
    intervals: [0, 3, 6, 10],
    weight: 1,
  },
  {
    id: 'dim7',
    faceLabel: '°7',
    displaySuffix: '°7',
    fullName: 'Diminished 7th',
    intervals: [0, 3, 6, 9],
    weight: 1,
  },
  {
    id: 'mM7',
    faceLabel: 'mM⁷',
    displaySuffix: 'mM⁷',
    fullName: 'Minor-Major 7th',
    intervals: [0, 3, 7, 11],
    weight: 1,
  },
  {
    id: 'sus4',
    faceLabel: 'sus4',
    displaySuffix: 'sus4',
    fullName: 'Suspended 4th',
    intervals: [0, 5, 7],
    weight: 1,
  },
  {
    id: 'sus2',
    faceLabel: 'sus2',
    displaySuffix: 'sus2',
    fullName: 'Suspended 2nd',
    intervals: [0, 2, 7],
    weight: 1,
  },
  {
    id: 'aug',
    faceLabel: '+',
    displaySuffix: '+',
    fullName: 'Augmented',
    intervals: [0, 4, 8],
    weight: 1,
  },
  {
    id: 'dim',
    faceLabel: '°',
    displaySuffix: '°',
    fullName: 'Diminished',
    intervals: [0, 3, 6],
    weight: 1,
  },
  {
    id: '6',
    faceLabel: '6',
    displaySuffix: '6',
    fullName: 'Major 6th',
    intervals: [0, 4, 7, 9],
    weight: 1,
    needsUnderline: true,
  },
];

/**
 * Weighted 20-face D20 distribution matching the Composer's Chord Die.
 * Common triads and sevenths repeat so harmonic progressions feel musical.
 */
export const D20_CHORD_FACES: ChordFace[] = CHORD_DEFINITIONS.flatMap((def) =>
  Array.from({ length: def.weight }, () => ({
    faceIndex: 0,
    id: def.id,
    faceLabel: def.faceLabel,
    displaySuffix: def.displaySuffix,
    fullName: def.fullName,
    intervals: def.intervals,
    needsUnderline: def.needsUnderline,
  }))
).map((face, index) => ({
  ...face,
  faceIndex: index,
}));

const SHARP_SPELLING = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_SPELLING = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

const FLAT_ROOTS = new Set(['F', 'B♭', 'E♭', 'A♭']);
const MINOR_OR_DIM_QUALITIES = new Set<ChordQualityId>([
  'm',
  'm7',
  'halfDim7',
  'dim7',
  'mM7',
  'dim',
]);

function chooseSpellingTable(root: PitchClass, chordId: ChordQualityId): string[] {
  if (FLAT_ROOTS.has(root.label)) return FLAT_SPELLING;
  if (root.label === 'C' || root.label === 'G' || root.label === 'D') {
    if (MINOR_OR_DIM_QUALITIES.has(chordId) && root.label === 'C') {
      return FLAT_SPELLING;
    }
  }
  if (root.label.includes('♯')) return SHARP_SPELLING;
  if (MINOR_OR_DIM_QUALITIES.has(chordId)) return FLAT_SPELLING;
  return SHARP_SPELLING;
}

/**
 * Returns readable pitch spellings for each tone in the chord.
 */
export function getChordNoteNames(root: PitchClass, chord: ChordFace): string[] {
  const table = chooseSpellingTable(root, chord.id);
  return chord.intervals.map((interval, idx) => {
    if (idx === 0) return root.label;
    const semitone = (root.semitone + interval) % 12;
    return table[semitone];
  });
}

/**
 * Generates a warm two-handed grand piano MIDI voicing for a root + chord quality.
 * Left hand anchors the bass register (C2-B2 + 5th/octave), while the right hand
 * plays the chord tones cleanly around middle C (C4-G5).
 */
export function buildChordResult(
  rootFaceIndex: number,
  chordFaceIndex: number
): ChordRollResult {
  const safeRootIdx =
    ((rootFaceIndex % D12_PITCH_FACES.length) + D12_PITCH_FACES.length) %
    D12_PITCH_FACES.length;
  const safeChordIdx =
    ((chordFaceIndex % D20_CHORD_FACES.length) + D20_CHORD_FACES.length) %
    D20_CHORD_FACES.length;

  const root = D12_PITCH_FACES[safeRootIdx];
  const chord = D20_CHORD_FACES[safeChordIdx];

  const bassRoot = 36 + root.semitone;
  const hasPerfectFifth = chord.intervals.includes(7);
  const bassCompanion = hasPerfectFifth ? bassRoot + 7 : bassRoot + 12;

  const rightHandNotes = chord.intervals.map(
    (interval) => 60 + root.semitone + interval
  );

  const midiNotes = [bassRoot, bassCompanion, ...rightHandNotes];
  const noteNames = getChordNoteNames(root, chord);
  const symbol = `${root.label}${chord.displaySuffix}`;
  const fullTitle = `${root.label} ${chord.fullName}`;

  return {
    root,
    chord,
    symbol,
    fullTitle,
    noteNames,
    midiNotes,
    timestamp: Date.now(),
  };
}

/**
 * Chooses a natural singing-register MIDI note (A3–E5) for a rolled D12 pitch,
 * keeping voice-leading leaps smooth relative to the previous melody note.
 */
export function buildMelodyStepMidi(
  pitch: PitchClass,
  prevMidi?: number | null
): number {
  const centerMidi = 60 + pitch.semitone;
  if (prevMidi == null) {
    return centerMidi;
  }

  const candidates = [centerMidi - 12, centerMidi, centerMidi + 12].filter(
    (midi) => midi >= 57 && midi <= 76
  );

  if (candidates.length === 0) return centerMidi;

  let best = centerMidi;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - prevMidi);
    if (
      distance < bestDistance ||
      (distance === bestDistance && candidate === centerMidi)
    ) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

const MIDI_NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
];

const TONE_NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * Formats a MIDI note number into musical display notation (e.g. 63 -> "E♭4").
 */
export function midiToDisplayNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pitch = MIDI_NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${pitch}${octave}`;
}

/**
 * Formats a MIDI note number into Tone.js pitch notation (e.g. 63 -> "Eb4").
 */
export function midiToToneNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pitch = TONE_NOTE_NAMES[((midi % 12) + 12) % 12];
  return `${pitch}${octave}`;
}
