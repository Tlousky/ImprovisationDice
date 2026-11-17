import { Dices, FastForward } from 'lucide-react';
import type { AppMode } from '../types/app';

interface RollButtonBarProps {
  mode: AppMode;
  noteCount: number;
  isRolling: boolean;
  melodyProgressIndex: number;
  melodyDieSides?: 6 | 8 | 12;
  onRoll: () => void;
  onFinishMelodyEarly: () => void;
}

export function RollButtonBar({
  mode,
  noteCount,
  isRolling,
  melodyProgressIndex,
  melodyDieSides = 12,
  onRoll,
  onFinishMelodyEarly,
}: RollButtonBarProps) {
  const handlePress = () => {
    if (isRolling) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(22);
      } catch {
        // Ignore on unsupported browsers
      }
    }
    onRoll();
  };

  const dieBadge =
    melodyDieSides === 6 ? 'D6' : melodyDieSides === 8 ? 'D8' : 'D12';
  const buttonLabel =
    mode === 'chord'
      ? isRolling
        ? 'ROLLING…'
        : 'ROLL DICE'
      : isRolling
        ? `ROLLING ${Math.min(noteCount, melodyProgressIndex + 1)} / ${noteCount}`
        : `ROLL ${noteCount} NOTES (${dieBadge})`;

  return (
    <div className="roll-bar">
      {mode === 'melody' && isRolling && (
        <button
          type="button"
          className="finish-early-pill"
          onClick={onFinishMelodyEarly}
        >
          <FastForward size={13} />
          <span>Finish Now</span>
        </button>
      )}

      <button
        type="button"
        className={`roll-cta-btn ${isRolling ? 'is-rolling' : ''}`}
        onClick={handlePress}
        disabled={isRolling}
        aria-label={buttonLabel}
      >
        <span className="roll-cta-ring" aria-hidden="true" />
        <Dices size={22} className="roll-cta-icon" />
        <span className="roll-cta-label">{buttonLabel}</span>
      </button>
    </div>
  );
}
