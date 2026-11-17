import { useMemo } from 'react';
import { midiToDisplayNote } from '../music/theory';

export interface PianoRolledStep {
  stepIndex: number; // 0-based
  midiNote: number | null;
  noteLabel?: string | null;
}

export interface PianoKeyboardMiniProps {
  highlightedMidis?: number[];
  rolledSteps?: PianoRolledStep[];
  activePlaybackIndex?: number | null;
  rootSemitone?: number | null;
  modeSemitones?: number[];
  scalePitches?: string[];
  onKeyPress?: (midi: number) => void;
}

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

export interface KeyDescriptor {
  midi: number;
  isBlack: boolean;
  semitone: number;
  whiteIndex: number;
}

export const START_MIDI = 48; // C3
export const END_MIDI = 76; // E5

export const KEYS: KeyDescriptor[] = (() => {
  const result: KeyDescriptor[] = [];
  let whiteCount = 0;
  for (let midi = START_MIDI; midi <= END_MIDI; midi++) {
    const semitone = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_SEMITONES.has(semitone);
    result.push({
      midi,
      isBlack,
      semitone,
      whiteIndex: isBlack ? whiteCount - 1 : whiteCount,
    });
    if (!isBlack) whiteCount += 1;
  }
  return result;
})();

export const WHITE_KEYS = KEYS.filter((k) => !k.isBlack);
export const BLACK_KEYS = KEYS.filter((k) => k.isBlack);
export const TOTAL_WHITE = WHITE_KEYS.length; // 17 keys (C3..E5)

export const DEFAULT_WHITE_LETTERS: Record<number, string> = {
  0: 'C',
  2: 'D',
  4: 'E',
  5: 'F',
  7: 'G',
  9: 'A',
  11: 'B',
};

export const DEFAULT_BLACK_NAMES: Record<number, string> = {
  1: 'C♯',
  3: 'E♭',
  6: 'F♯',
  8: 'A♭',
  10: 'B♭',
};

export function normalizeIntoDisplayRange(midi: number): number {
  let m = midi;
  while (m < START_MIDI) m += 12;
  while (m > END_MIDI) m -= 12;
  return m;
}

export function computeKeyLabel(
  key: KeyDescriptor,
  modeSemitones?: number[],
  scalePitches?: string[],
  isInMode = true,
  fallbackStepLabel?: string | null
): string {
  const octave = Math.floor(key.midi / 12) - 1;
  if (!key.isBlack) {
    if (key.semitone === 0) {
      return `C${octave}`;
    }
    if (modeSemitones && scalePitches && isInMode) {
      const idx = modeSemitones.indexOf(key.semitone);
      if (idx >= 0 && scalePitches[idx]) return scalePitches[idx];
    }
    return DEFAULT_WHITE_LETTERS[key.semitone] ?? '';
  }

  // Black key
  if (modeSemitones && scalePitches && isInMode) {
    const idx = modeSemitones.indexOf(key.semitone);
    if (idx >= 0 && scalePitches[idx]) return scalePitches[idx];
  }
  if (fallbackStepLabel) {
    return fallbackStepLabel;
  }
  return DEFAULT_BLACK_NAMES[key.semitone] ?? '';
}

export function PianoKeyboardMini({
  highlightedMidis = [],
  rolledSteps = [],
  activePlaybackIndex = null,
  rootSemitone = null,
  modeSemitones,
  scalePitches,
  onKeyPress,
}: PianoKeyboardMiniProps) {
  const normalizedActive = useMemo(
    () => new Set(highlightedMidis.map(normalizeIntoDisplayRange)),
    [highlightedMidis]
  );

  const modeSet = useMemo(
    () =>
      modeSemitones && modeSemitones.length < 12
        ? new Set(modeSemitones)
        : null,
    [modeSemitones]
  );

  // Group rolled steps by normalized MIDI key
  const stepsByMidi = useMemo(() => {
    const map = new Map<number, PianoRolledStep[]>();
    for (const step of rolledSteps) {
      if (step.midiNote !== null) {
        const norm = normalizeIntoDisplayRange(step.midiNote);
        const list = map.get(norm) ?? [];
        list.push(step);
        map.set(norm, list);
      }
    }
    return map;
  }, [rolledSteps]);

  const renderKey = (key: KeyDescriptor) => {
    const keySteps = stepsByMidi.get(key.midi) ?? [];
    const hasMelodySteps = keySteps.length > 0;
    const isChordActive = normalizedActive.has(key.midi);
    const isActive = isChordActive || hasMelodySteps;

    const isStepPlaying =
      activePlaybackIndex !== null &&
      keySteps.some((s) => s.stepIndex === activePlaybackIndex);

    const isInMode = modeSet !== null ? modeSet.has(key.semitone) : true;
    const isDimmed = modeSet !== null && !isInMode && !isActive;

    const isTonic = rootSemitone !== null && key.semitone === rootSemitone;
    const isRoot = isChordActive && isTonic;

    const label = computeKeyLabel(
      key,
      modeSemitones,
      scalePitches,
      isInMode,
      keySteps[0]?.noteLabel
    );

    const stepBadgeText = hasMelodySteps
      ? keySteps.map((s) => s.stepIndex + 1).join('·')
      : null;

    const classes = [
      'piano-key',
      key.isBlack ? 'piano-key--black' : 'piano-key--white',
      isActive ? 'is-active' : '',
      isRoot ? 'is-root' : '',
      isTonic ? 'is-tonic' : '',
      hasMelodySteps ? 'is-melody-step' : '',
      isStepPlaying ? 'is-playing' : '',
      modeSet !== null && isInMode ? 'in-mode' : '',
      isDimmed ? 'is-dimmed' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const style = key.isBlack
      ? {
          left: `${((key.whiteIndex + 0.68) / TOTAL_WHITE) * 100}%`,
          width: `${(0.62 / TOTAL_WHITE) * 100}%`,
        }
      : undefined;

    return (
      <button
        key={key.midi}
        type="button"
        style={style}
        className={classes}
        onClick={() => onKeyPress?.(key.midi)}
        aria-label={`Play ${midiToDisplayNote(key.midi)}`}
      >
        {modeSet !== null && isInMode && (
          <span className="piano-mode-dot" aria-hidden="true" />
        )}

        {stepBadgeText && (
          <span
            className={`piano-step-badge ${isStepPlaying ? 'is-playing' : ''}`}
            aria-hidden="true"
          >
            {stepBadgeText}
          </span>
        )}

        {label && (
          <span
            className={`piano-key-label ${
              key.semitone === 0 ? 'piano-c-label' : ''
            } ${isTonic ? 'is-tonic-label' : ''}`}
            aria-hidden="true"
          >
            {label}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="piano-mini"
      role="group"
      aria-label="Piano keyboard visualizer"
    >
      <div className="piano-white-row">
        {WHITE_KEYS.map((k) => renderKey(k))}
      </div>
      <div className="piano-black-layer">
        {BLACK_KEYS.map((k) => renderKey(k))}
      </div>
    </div>
  );
}
