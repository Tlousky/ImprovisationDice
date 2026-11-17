import { Minus, Play, Plus, Repeat, Square } from 'lucide-react';
import type { MelodyNoteStep } from '../types/app';
import { PianoKeyboardMini } from './PianoKeyboardMini';

interface MelodyResultPanelProps {
  noteCount: number;
  onChangeNoteCount: (next: number) => void;
  steps: MelodyNoteStep[];
  isRolling: boolean;
  isPlayingBack: boolean;
  activePlaybackIndex: number | null;
  isLooping: boolean;
  onToggleLoop: () => void;
  onPlayMelody: () => void;
  onStopMelody: () => void;
  onTapStep: (step: MelodyNoteStep) => void;
  onKeyPress: (midi: number) => void;
}

export function MelodyResultPanel({
  noteCount,
  onChangeNoteCount,
  steps,
  isRolling,
  isPlayingBack,
  activePlaybackIndex,
  isLooping,
  onToggleLoop,
  onPlayMelody,
  onStopMelody,
  onTapStep,
  onKeyPress,
}: MelodyResultPanelProps) {
  const landedSteps = steps.filter(
    (s) => s.status === 'landed' && s.midiNote !== null
  );
  const canPlay = landedSteps.length > 0 && !isRolling;

  let activeKeyboardMidis: number[] = [];
  let activeRootSemitone: number | null = null;

  if (
    activePlaybackIndex !== null &&
    steps[activePlaybackIndex]?.midiNote !== null &&
    steps[activePlaybackIndex]?.pitch
  ) {
    activeKeyboardMidis = [steps[activePlaybackIndex].midiNote!];
    activeRootSemitone = steps[activePlaybackIndex].pitch!.semitone;
  } else if (landedSteps.length > 0) {
    const latest = landedSteps[landedSteps.length - 1];
    if (latest.midiNote !== null && latest.pitch) {
      activeKeyboardMidis = [latest.midiNote];
      activeRootSemitone = latest.pitch.semitone;
    }
  }

  return (
    <section className="result-panel melody-panel" aria-live="polite">
      <div className="melody-controls-row">
        <div className="stepper-group" aria-label="Melody roll count">
          <span className="stepper-label">Rolls</span>
          <div className="stepper-control">
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onChangeNoteCount(Math.max(3, noteCount - 1))}
              disabled={isRolling || noteCount <= 3}
              aria-label="Decrease note count"
            >
              <Minus size={14} />
            </button>
            <span className="stepper-value" data-testid="melody-count-value">
              {noteCount}
            </span>
            <button
              type="button"
              className="stepper-btn"
              onClick={() => onChangeNoteCount(Math.min(9, noteCount + 1))}
              disabled={isRolling || noteCount >= 9}
              aria-label="Increase note count"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="melody-playback-btns">
          {isPlayingBack ? (
            <button
              type="button"
              className="action-chip is-playing"
              onClick={onStopMelody}
            >
              <Square size={12} />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              className="action-chip"
              onClick={onPlayMelody}
              disabled={!canPlay}
            >
              <Play size={13} />
              <span>Play Phrase</span>
            </button>
          )}

          <button
            type="button"
            className={`action-chip action-chip--icon ${
              isLooping ? 'is-active' : ''
            }`}
            onClick={onToggleLoop}
            aria-label="Loop melody playback"
            aria-pressed={isLooping}
            title="Loop melody"
          >
            <Repeat size={13} />
          </button>
        </div>
      </div>

      <div className="melody-slots-row" role="list" aria-label="Rolled melody notes">
        {steps.map((step) => {
          const isCurrentPlay = activePlaybackIndex === step.stepIndex;
          return (
            <button
              key={step.stepIndex}
              type="button"
              role="listitem"
              disabled={step.status !== 'landed'}
              onClick={() => onTapStep(step)}
              className={`melody-slot melody-slot--${step.status} ${
                isCurrentPlay ? 'is-playing-step' : ''
              }`}
            >
              <span className="slot-idx">{step.stepIndex + 1}</span>
              <span className="slot-note">
                {step.status === 'rolling'
                  ? '•••'
                  : step.noteLabel ?? '—'}
              </span>
            </button>
          );
        })}
      </div>

      <PianoKeyboardMini
        highlightedMidis={activeKeyboardMidis}
        rootSemitone={activeRootSemitone}
        onKeyPress={onKeyPress}
      />
    </section>
  );
}
