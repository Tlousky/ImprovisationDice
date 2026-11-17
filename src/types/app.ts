export type AppMode = 'chord' | 'melody';

export type DiceSkin = 'ivory' | 'obsidian';

export type TrayTheme = 'purple-velvet' | 'studio-felt';

export interface PitchClass {
  id: string;
  label: string;
  enharmonic?: string;
  semitone: number;
  midiBase: number;
  needsUnderline?: boolean;
}

export type ChordQualityId =
  | 'M'
  | 'm'
  | 'M7'
  | 'm7'
  | '7'
  | 'halfDim7'
  | 'dim7'
  | 'mM7'
  | 'sus4'
  | 'sus2'
  | 'aug'
  | 'dim'
  | '6';

export interface ChordFace {
  faceIndex: number;
  id: ChordQualityId;
  faceLabel: string;
  displaySuffix: string;
  fullName: string;
  intervals: number[];
  needsUnderline?: boolean;
}

export interface ChordRollResult {
  root: PitchClass;
  chord: ChordFace;
  symbol: string;
  fullTitle: string;
  noteNames: string[];
  midiNotes: number[];
  chordNotes: number[];
  bassNotes: number[];
  timestamp: number;
}

export type DiatonicModeType =
  | 'Ionian'
  | 'Dorian'
  | 'Phrygian'
  | 'Lydian'
  | 'Mixolydian'
  | 'Aeolian'
  | 'Locrian'
  | 'Major Pentatonic'
  | 'Minor Pentatonic';

export interface DiatonicModeEntry {
  id: string; // e.g. "C-Dorian"
  keyName: string; // e.g. "Bb Major" (parent key from table)
  modeType: DiatonicModeType; // e.g. "Dorian"
  tonic: string; // e.g. "C"
  tonicSemitone: number;
  displayName: string; // e.g. "C Dorian (B♭ Major)"
  scalePitches: string[]; // e.g. ['C', 'D', 'E♭', 'F', 'G', 'A', 'B♭']
  semitones: number[]; // e.g. [0, 2, 3, 5, 7, 9, 10]
}

export type MelodyModeSelection =
  | {
      isChromatic: true;
      id: 'chromatic';
      name: 'Chromatic';
    }
  | ({
      isChromatic: false;
    } & DiatonicModeEntry);

export interface MelodyNoteStep {
  stepIndex: number;
  pitch: PitchClass | null;
  midiNote: number | null;
  noteLabel: string | null;
  status: 'pending' | 'rolling' | 'landed';
}

export interface MelodyRollResult {
  steps: MelodyNoteStep[];
  midiNotes: number[];
  timestamp: number;
}

export type HistoryEntry =
  | {
      kind: 'chord';
      id: string;
      result: ChordRollResult;
    }
  | {
      kind: 'melody';
      id: string;
      result: MelodyRollResult;
    };
