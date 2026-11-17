import { useState } from 'react';
import { Minus, Play, Plus, Repeat, Square, Table2 } from 'lucide-react';
import {
  CHROMATIC_MODE_SELECTION,
  DIATONIC_MODE_NAMES,
  MUSIC_MODES_CHART_ROWS,
  buildDiatonicModeEntry,
} from '../music/modes';
import type {
  DiatonicModeType,
  MelodyModeSelection,
  MelodyNoteStep,
} from '../types/app';
import { ModesChartModal } from './ModesChartModal';
import { PianoKeyboardMini } from './PianoKeyboardMini';

interface MelodyResultPanelProps {
  noteCount: number;
  onChangeNoteCount: (next: number) => void;
  melodyMode: MelodyModeSelection;
  onChangeMelodyMode: (mode: MelodyModeSelection) => void;
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
  melodyMode,
  onChangeMelodyMode,
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
  const [isChartOpen, setIsChartOpen] = useState(false);

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

  const handleModeTypeSelect = (selected: string) => {
    if (selected === 'chromatic') {
      onChangeMelodyMode(CHROMATIC_MODE_SELECTION);
      return;
    }
    const modeType = selected as DiatonicModeType;
    const currentKey = melodyMode.isChromatic ? 'C Major' : melodyMode.keyName;
    const entry = buildDiatonicModeEntry(currentKey, modeType);
    onChangeMelodyMode({
      isChromatic: false,
      ...entry,
    });
  };

  const handleKeySelect = (keyName: string) => {
    const currentType: DiatonicModeType = melodyMode.isChromatic
      ? 'Ionian'
      : melodyMode.modeType;
    const entry = buildDiatonicModeEntry(keyName, currentType);
    onChangeMelodyMode({
      isChromatic: false,
      ...entry,
    });
  };

  return (
    <section className="result-panel melody-panel" aria-live="polite">
      {/* Top Controls: Rolls stepper & Playback buttons */}
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

      {/* Mode Selection Row */}
      <div className="melody-mode-row">
        <div className="mode-select-group">
          <span className="mode-label">Mode</span>
          <select
            className="mode-select"
            value={melodyMode.isChromatic ? 'chromatic' : melodyMode.modeType}
            onChange={(e) => handleModeTypeSelect(e.target.value)}
            disabled={isRolling}
            aria-label="Select musical mode"
          >
            <option value="chromatic">Chromatic (All 12 notes)</option>
            {DIATONIC_MODE_NAMES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {!melodyMode.isChromatic && (
            <select
              className="mode-select mode-select--key"
              value={melodyMode.keyName}
              onChange={(e) => handleKeySelect(e.target.value)}
              disabled={isRolling}
              aria-label="Select parent key"
            >
              {MUSIC_MODES_CHART_ROWS.map((row) => (
                <option key={row.keyName} value={row.keyName}>
                  {row.keyName}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          className={`chart-toggle-btn ${!melodyMode.isChromatic ? 'is-custom-mode' : ''}`}
          onClick={() => setIsChartOpen(true)}
          disabled={isRolling}
          title="Open Music Modes Chart"
        >
          <Table2 size={13} />
          <span>Chart</span>
        </button>
      </div>

      {/* Active Mode Scale Notes Strip */}
      {!melodyMode.isChromatic && (
        <div className="mode-notes-strip" aria-label="Mode scale notes">
          <span className="mode-notes-badge">
            D7 · {melodyMode.tonic} {melodyMode.modeType}:
          </span>
          <span className="mode-notes-list">
            {melodyMode.scalePitches.join(' · ')}
          </span>
        </div>
      )}

      {/* Rolled Notes Slots */}
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

      {/* Mini Piano with Mode Key Dots */}
      <PianoKeyboardMini
        highlightedMidis={activeKeyboardMidis}
        rootSemitone={activeRootSemitone}
        modeSemitones={melodyMode.isChromatic ? undefined : melodyMode.semitones}
        onKeyPress={onKeyPress}
      />

      {/* Music Modes Chart Modal */}
      {isChartOpen && (
        <ModesChartModal
          currentMode={melodyMode}
          onSelectMode={onChangeMelodyMode}
          onClose={() => setIsChartOpen(false)}
        />
      )}
    </section>
  );
}
