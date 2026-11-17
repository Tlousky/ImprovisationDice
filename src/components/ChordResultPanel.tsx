import { Play, Sparkles } from 'lucide-react';
import type { ChordRollResult } from '../types/app';
import { PianoKeyboardMini } from './PianoKeyboardMini';

interface ChordResultPanelProps {
  result: ChordRollResult | null;
  isRolling: boolean;
  onPlayBlock: () => void;
  onPlayArpeggio: () => void;
  onKeyPress: (midi: number) => void;
}

export function ChordResultPanel({
  result,
  isRolling,
  onPlayBlock,
  onPlayArpeggio,
  onKeyPress,
}: ChordResultPanelProps) {
  return (
    <section className="result-panel chord-panel" aria-live="polite">
      {!result ? (
        <div className="result-empty">
          <p className="result-empty-title">Roll Both Dice for Harmony</p>
          <p className="result-empty-sub">
            Cast the D12 Root and weighted D20 Chord dice below to hear &amp;
            explore a new chord voicing.
          </p>
          <PianoKeyboardMini onKeyPress={onKeyPress} />
        </div>
      ) : (
        <>
          <div className="chord-main-row">
            <div className="chord-identity">
              <div className="dice-badges">
                <span className="die-pill die-pill--d12">
                  D12 · {result.root.label}
                </span>
                <span className="die-pill die-pill--d20">
                  D20 · {result.chord.faceLabel}
                </span>
              </div>

              <div className="chord-headline">
                <span className="chord-symbol">
                  {isRolling ? '…' : result.symbol}
                </span>
                <span className="chord-fullname">
                  {isRolling ? 'Rolling dice…' : result.fullTitle}
                </span>
              </div>
            </div>

            <div className="chord-playback-btns">
              <button
                type="button"
                className="action-chip"
                onClick={onPlayBlock}
                disabled={isRolling}
                aria-label="Play chord"
              >
                <Play size={13} />
                <span>Chord</span>
              </button>
              <button
                type="button"
                className="action-chip"
                onClick={onPlayArpeggio}
                disabled={isRolling}
                aria-label="Play arpeggio"
              >
                <Sparkles size={13} />
                <span>Arp</span>
              </button>
            </div>
          </div>

          <div className="chord-tones-row">
            {result.noteNames.map((note, idx) => (
              <span
                key={`${note}-${idx}`}
                className={`tone-pill ${idx === 0 ? 'is-root' : ''}`}
              >
                {note}
              </span>
            ))}
          </div>

          <PianoKeyboardMini
            highlightedMidis={isRolling ? [] : result.midiNotes}
            rootSemitone={isRolling ? null : result.root.semitone}
            onKeyPress={onKeyPress}
          />
        </>
      )}
    </section>
  );
}
