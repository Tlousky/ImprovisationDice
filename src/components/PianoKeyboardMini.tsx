import { midiToDisplayNote } from '../music/theory';

interface PianoKeyboardMiniProps {
  highlightedMidis?: number[];
  rootSemitone?: number | null;
  onKeyPress?: (midi: number) => void;
}

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

interface KeyDescriptor {
  midi: number;
  isBlack: boolean;
  semitone: number;
  whiteIndex: number;
}

const START_MIDI = 48; // C3
const END_MIDI = 76; // E5

const KEYS: KeyDescriptor[] = (() => {
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

const WHITE_KEYS = KEYS.filter((k) => !k.isBlack);
const BLACK_KEYS = KEYS.filter((k) => k.isBlack);
const TOTAL_WHITE = WHITE_KEYS.length; // 17 keys (C3..E5)

function normalizeIntoDisplayRange(midi: number): number {
  let m = midi;
  while (m < START_MIDI) m += 12;
  while (m > END_MIDI) m -= 12;
  return m;
}

export function PianoKeyboardMini({
  highlightedMidis = [],
  rootSemitone = null,
  onKeyPress,
}: PianoKeyboardMiniProps) {
  const normalizedActive = new Set(
    highlightedMidis.map(normalizeIntoDisplayRange)
  );

  return (
    <div className="piano-mini" role="group" aria-label="Piano keyboard visualizer">
      <div className="piano-white-row">
        {WHITE_KEYS.map((key) => {
          const isActive = normalizedActive.has(key.midi);
          const isRoot =
            isActive && rootSemitone !== null && key.semitone === rootSemitone;
          return (
            <button
              key={key.midi}
              type="button"
              className={`piano-key piano-key--white ${
                isActive ? 'is-active' : ''
              } ${isRoot ? 'is-root' : ''}`}
              onClick={() => onKeyPress?.(key.midi)}
              aria-label={`Play ${midiToDisplayNote(key.midi)}`}
            >
              {key.semitone === 0 && (
                <span className="piano-c-label">
                  C{Math.floor(key.midi / 12) - 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="piano-black-layer">
        {BLACK_KEYS.map((key) => {
          const isActive = normalizedActive.has(key.midi);
          const isRoot =
            isActive && rootSemitone !== null && key.semitone === rootSemitone;
          const leftPercent = ((key.whiteIndex + 0.68) / TOTAL_WHITE) * 100;
          const widthPercent = (0.62 / TOTAL_WHITE) * 100;

          return (
            <button
              key={key.midi}
              type="button"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
              className={`piano-key piano-key--black ${
                isActive ? 'is-active' : ''
              } ${isRoot ? 'is-root' : ''}`}
              onClick={() => onKeyPress?.(key.midi)}
              aria-label={`Play ${midiToDisplayNote(key.midi)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
