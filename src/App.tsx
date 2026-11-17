import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useAudioEngine } from './audio/useAudioEngine';
import { ChordResultPanel } from './components/ChordResultPanel';
import { HeaderBar } from './components/HeaderBar';
import { MelodyResultPanel } from './components/MelodyResultPanel';
import { RollButtonBar } from './components/RollButtonBar';
import {
  D12_PITCH_FACES,
  buildChordResult,
  buildMelodyStepMidi,
  midiToDisplayNote,
} from './music/theory';
import { DiceStage, type DiceStageHandle } from './three/DiceStage';
import type {
  AppMode,
  ChordRollResult,
  DiceSkin,
  HistoryEntry,
  MelodyNoteStep,
  TrayTheme,
} from './types/app';

function createPendingSteps(count: number): MelodyNoteStep[] {
  return Array.from({ length: count }, (_, idx) => ({
    stepIndex: idx,
    pitch: null,
    midiNote: null,
    noteLabel: null,
    status: 'pending',
  }));
}

export function App() {
  const [mode, setMode] = useState<AppMode>('chord');
  const [skin, setSkin] = useState<DiceSkin>('ivory');
  const [trayTheme, setTrayTheme] = useState<TrayTheme>('purple-velvet');
  const [isRolling, setIsRolling] = useState(false);

  const [chordResult, setChordResult] = useState<ChordRollResult | null>(null);

  const [noteCount, setNoteCount] = useState(5);
  const [melodySteps, setMelodySteps] = useState<MelodyNoteStep[]>(() =>
    createPendingSteps(5)
  );
  const [melodyProgressIndex, setMelodyProgressIndex] = useState(0);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [activePlaybackIndex, setActivePlaybackIndex] = useState<number | null>(
    null
  );
  const [isLooping, setIsLooping] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const stageRef = useRef<DiceStageHandle | null>(null);
  const melodyStepsRef = useRef<MelodyNoteStep[]>(melodySteps);
  const playbackRunRef = useRef(0);
  const isLoopingRef = useRef(isLooping);
  isLoopingRef.current = isLooping;

  const audio = useAudioEngine();

  const stopPlayback = useCallback(() => {
    playbackRunRef.current += 1;
    audio.stopMelodyPlayback();
    setIsPlayingBack(false);
    setActivePlaybackIndex(null);
  }, [audio]);

  const playMelodyPhrase = useCallback(
    async (midiNotes: number[]) => {
      if (midiNotes.length === 0) return;
      const runId = ++playbackRunRef.current;
      setIsPlayingBack(true);

      try {
        do {
          if (playbackRunRef.current !== runId) break;
          await audio.playMelodySequence(midiNotes, (stepIdx) => {
            if (playbackRunRef.current === runId) {
              setActivePlaybackIndex(stepIdx);
            }
          });
          if (playbackRunRef.current !== runId) break;
          if (isLoopingRef.current) {
            setActivePlaybackIndex(null);
            await new Promise((r) => window.setTimeout(r, 420));
          }
        } while (isLoopingRef.current && playbackRunRef.current === runId);
      } finally {
        if (playbackRunRef.current === runId) {
          setIsPlayingBack(false);
          setActivePlaybackIndex(null);
        }
      }
    },
    [audio]
  );

  const handleModeChange = useCallback(
    (nextMode: AppMode) => {
      if (isRolling || nextMode === mode) return;
      stopPlayback();
      setMode(nextMode);
    },
    [isRolling, mode, stopPlayback]
  );

  const handleChangeNoteCount = useCallback(
    (nextCount: number) => {
      if (isRolling) return;
      const clamped = Math.max(3, Math.min(9, Math.round(nextCount)));
      stopPlayback();
      setNoteCount(clamped);
      const fresh = createPendingSteps(clamped);
      melodyStepsRef.current = fresh;
      setMelodySteps(fresh);
      setMelodyProgressIndex(0);
    },
    [isRolling, stopPlayback]
  );

  const handleRoll = useCallback(async () => {
    if (isRolling) return;
    stopPlayback();
    setHistoryOpen(false);
    await audio.unlockAudio();

    if (mode === 'chord') {
      stageRef.current?.rollChord();
    } else {
      const fresh = createPendingSteps(noteCount);
      fresh[0].status = 'rolling';
      melodyStepsRef.current = fresh;
      setMelodySteps(fresh);
      setMelodyProgressIndex(0);
      stageRef.current?.rollMelody(noteCount);
    }
  }, [audio, isRolling, mode, noteCount, stopPlayback]);

  // Keyboard spacebar shortcut for quick rolling on desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
      e.preventDefault();
      handleRoll();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRoll]);

  const handleChordLanded = useCallback(
    (d12FaceIndex: number, d20FaceIndex: number) => {
      const result = buildChordResult(d12FaceIndex, d20FaceIndex);
      setChordResult(result);
      audio.playChord(result.midiNotes, 'block');
      setHistory((prev) =>
        [
          {
            kind: 'chord' as const,
            id: `chord-${result.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
            result,
          },
          ...prev,
        ].slice(0, 12)
      );
    },
    [audio]
  );

  const handleMelodyStepLanded = useCallback(
    (stepIndex: number, d12FaceIndex: number) => {
      const pitch = D12_PITCH_FACES[d12FaceIndex % D12_PITCH_FACES.length];
      const prevMidi =
        stepIndex > 0
          ? melodyStepsRef.current[stepIndex - 1]?.midiNote ?? null
          : null;
      const midiNote = buildMelodyStepMidi(pitch, prevMidi);
      const noteLabel = midiToDisplayNote(midiNote);

      audio.playNote(midiNote, '4n');

      const nextSteps = melodyStepsRef.current.map((step, idx) => {
        if (idx === stepIndex) {
          return {
            ...step,
            pitch,
            midiNote,
            noteLabel,
            status: 'landed' as const,
          };
        }
        if (idx === stepIndex + 1 && step.status === 'pending') {
          return {
            ...step,
            status: 'rolling' as const,
          };
        }
        return step;
      });

      melodyStepsRef.current = nextSteps;
      setMelodySteps(nextSteps);
      setMelodyProgressIndex(stepIndex + 1);
    },
    [audio]
  );

  const handleMelodySequenceComplete = useCallback(() => {
    const finalSteps = melodyStepsRef.current;
    const midiNotes = finalSteps
      .map((s) => s.midiNote)
      .filter((n): n is number => n !== null);

    if (midiNotes.length > 0) {
      const resultTimestamp = Date.now();
      setHistory((prev) =>
        [
          {
            kind: 'melody' as const,
            id: `melody-${resultTimestamp}-${Math.random().toString(36).slice(2, 6)}`,
            result: {
              steps: finalSteps,
              midiNotes,
              timestamp: resultTimestamp,
            },
          },
          ...prev,
        ].slice(0, 12)
      );

      window.setTimeout(() => {
        playMelodyPhrase(midiNotes);
      }, 360);
    }
  }, [playMelodyPhrase]);

  const handleDieTapped = useCallback(
    async (which: 'd12' | 'd20') => {
      if (isRolling) return;
      await audio.unlockAudio();

      if (mode === 'chord') {
        if (!chordResult) {
          handleRoll();
          return;
        }
        if (which === 'd12') {
          audio.playNote(chordResult.root.midiBase, '2n');
        } else {
          audio.playChord(chordResult.midiNotes, 'arpeggio');
        }
      } else {
        const landed = melodyStepsRef.current.filter(
          (s) => s.status === 'landed' && s.midiNote !== null
        );
        if (landed.length === 0) {
          handleRoll();
          return;
        }
        const midiNotes = landed.map((s) => s.midiNote!);
        playMelodyPhrase(midiNotes);
      }
    },
    [audio, chordResult, handleRoll, isRolling, mode, playMelodyPhrase]
  );

  const handleSelectHistory = useCallback(
    async (entry: HistoryEntry) => {
      if (isRolling) return;
      stopPlayback();
      await audio.unlockAudio();
      setHistoryOpen(false);

      if (entry.kind === 'chord') {
        setMode('chord');
        setChordResult(entry.result);
        audio.playChord(entry.result.midiNotes, 'block');
      } else {
        setMode('melody');
        setNoteCount(entry.result.steps.length);
        melodyStepsRef.current = entry.result.steps;
        setMelodySteps(entry.result.steps);
        playMelodyPhrase(entry.result.midiNotes);
      }
    },
    [audio, isRolling, playMelodyPhrase, stopPlayback]
  );

  return (
    <div className="app-backdrop">
      <main className="app-shell">
        <HeaderBar
          mode={mode}
          onModeChange={handleModeChange}
          isRolling={isRolling}
          sampleStatus={audio.sampleStatus}
          volume={audio.volume}
          onVolumeChange={audio.setVolume}
          reverbWet={audio.reverbWet}
          onReverbChange={audio.setReverbWet}
          melodyBpm={audio.melodyBpm}
          onMelodyBpmChange={audio.setMelodyBpm}
          diceSfxEnabled={audio.diceSfxEnabled}
          onDiceSfxChange={audio.setDiceSfxEnabled}
          skin={skin}
          onSkinChange={setSkin}
          trayTheme={trayTheme}
          onTrayThemeChange={setTrayTheme}
          midiSupported={audio.midiSupported}
          midiPorts={audio.midiPorts}
          selectedMidiPortId={audio.selectedMidiPortId}
          onSelectMidiPort={audio.setSelectedMidiPortId}
          onRefreshMidi={audio.refreshMidiPorts}
          historyCount={history.length}
          historyOpen={historyOpen}
          onToggleHistory={() => setHistoryOpen((prev) => !prev)}
        />

        {historyOpen && (
          <div className="history-drawer" role="dialog" aria-label="Roll History">
            <div className="settings-drawer-head">
              <span className="settings-title">Recent Rolls ({history.length})</span>
              <div className="history-head-actions">
                {history.length > 0 && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => setHistory([])}
                    aria-label="Clear history"
                    title="Clear history"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <p className="history-empty">
                No rolls yet. Cast the dice below to build your session history.
              </p>
            ) : (
              <ul className="history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="history-item-btn"
                      onClick={() => handleSelectHistory(item)}
                    >
                      {item.kind === 'chord' ? (
                        <>
                          <span className="history-badge">CHORD</span>
                          <span className="history-main">{item.result.symbol}</span>
                          <span className="history-sub">
                            {item.result.noteNames.join(' · ')}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="history-badge history-badge--melody">
                            {item.result.steps.length} NOTES
                          </span>
                          <span className="history-main">
                            {item.result.steps
                              .map((s) => s.pitch?.label ?? '—')
                              .join(' – ')}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'chord' ? (
          <ChordResultPanel
            result={chordResult}
            isRolling={isRolling}
            onPlayBlock={() => {
              if (chordResult) audio.playChord(chordResult.midiNotes, 'block');
            }}
            onPlayArpeggio={() => {
              if (chordResult) audio.playChord(chordResult.midiNotes, 'arpeggio');
            }}
            onKeyPress={(midi) => audio.playNote(midi, '4n')}
          />
        ) : (
          <MelodyResultPanel
            noteCount={noteCount}
            onChangeNoteCount={handleChangeNoteCount}
            steps={melodySteps}
            isRolling={isRolling}
            isPlayingBack={isPlayingBack}
            activePlaybackIndex={activePlaybackIndex}
            isLooping={isLooping}
            onToggleLoop={() => setIsLooping((prev) => !prev)}
            onPlayMelody={() => {
              const midis = melodySteps
                .map((s) => s.midiNote)
                .filter((n): n is number => n !== null);
              playMelodyPhrase(midis);
            }}
            onStopMelody={stopPlayback}
            onTapStep={(step) => {
              if (step.midiNote !== null) {
                audio.playNote(step.midiNote, '4n');
              }
            }}
            onKeyPress={(midi) => audio.playNote(midi, '4n')}
          />
        )}

        <div className="stage-wrapper">
          <DiceStage
            ref={stageRef}
            mode={mode}
            skin={skin}
            trayTheme={trayTheme}
            onChordLanded={handleChordLanded}
            onMelodyStepLanded={handleMelodyStepLanded}
            onMelodySequenceComplete={handleMelodySequenceComplete}
            onDiceImpact={audio.playDiceImpact}
            onDieTapped={handleDieTapped}
            onRollingChange={setIsRolling}
          />
          <span className="stage-hint">
            {isRolling
              ? 'Dice tumbling in tray…'
              : mode === 'chord'
                ? 'Tap a die to audition · Roll below'
                : 'Tap landed die to replay phrase'}
          </span>
        </div>

        <RollButtonBar
          mode={mode}
          noteCount={noteCount}
          isRolling={isRolling}
          melodyProgressIndex={melodyProgressIndex}
          onRoll={handleRoll}
          onFinishMelodyEarly={() => stageRef.current?.finishMelodyEarly()}
        />
      </main>
    </div>
  );
}

export default App;
