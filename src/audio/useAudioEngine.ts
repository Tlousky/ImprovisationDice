import { useCallback, useEffect, useRef, useState } from 'react';
import { MidiOutputManager, type MidiPortInfo } from './midiOutput';
import { PianoEngine, type SampleLoadStatus } from './pianoEngine';

export function useAudioEngine() {
  const [sampleStatus, setSampleStatus] = useState<SampleLoadStatus>('loading');
  const [volume, setVolumeState] = useState(0.85);
  const [reverbWet, setReverbWetState] = useState(0.28);
  const [melodyBpm, setMelodyBpm] = useState(104);
  const [diceSfxEnabled, setDiceSfxEnabledState] = useState(true);
  const [midiSupported] = useState(() => MidiOutputManager.isSupported());
  const [midiPorts, setMidiPorts] = useState<MidiPortInfo[]>([]);
  const [selectedMidiPortId, setSelectedMidiPortIdState] = useState<string | null>(
    null
  );

  const midiManagerRef = useRef<MidiOutputManager | null>(null);
  const engineRef = useRef<PianoEngine | null>(null);

  if (!midiManagerRef.current) {
    midiManagerRef.current = new MidiOutputManager();
  }
  if (!engineRef.current) {
    engineRef.current = new PianoEngine({
      onStatusChange: (status) => setSampleStatus(status),
      midiOutput: midiManagerRef.current,
    });
  }

  useEffect(() => {
    const midiManager = midiManagerRef.current!;
    const engine = engineRef.current!;

    midiManager.init((ports) => {
      setMidiPorts(ports);
      setSelectedMidiPortIdState(midiManager.getSelectedPortId());
    }).then((ports) => {
      setMidiPorts(ports);
    });

    return () => {
      engine.dispose();
      midiManager.dispose();
    };
  }, []);

  const unlockAudio = useCallback(async () => {
    await engineRef.current?.unlock();
  }, []);

  const setVolume = useCallback((val: number) => {
    setVolumeState(val);
    engineRef.current?.setVolume(val);
  }, []);

  const setReverbWet = useCallback((val: number) => {
    setReverbWetState(val);
    engineRef.current?.setReverbWet(val);
  }, []);

  const setDiceSfxEnabled = useCallback((enabled: boolean) => {
    setDiceSfxEnabledState(enabled);
    engineRef.current?.setDiceSfxEnabled(enabled);
  }, []);

  const setSelectedMidiPortId = useCallback((portId: string | null) => {
    setSelectedMidiPortIdState(portId);
    midiManagerRef.current?.setSelectedPort(portId);
  }, []);

  const refreshMidiPorts = useCallback(async () => {
    if (!midiManagerRef.current) return;
    const ports = await midiManagerRef.current.init((updated) => {
      setMidiPorts(updated);
    });
    setMidiPorts(ports);
  }, []);

  const playNote = useCallback(
    async (midiNote: number, duration = '2n') => {
      await engineRef.current?.playNote(midiNote, duration);
    },
    []
  );

  const playChord = useCallback(
    async (midiNotes: number[], mode: 'block' | 'arpeggio' = 'block') => {
      await engineRef.current?.playChord(midiNotes, mode);
    },
    []
  );

  const playMelodySequence = useCallback(
    async (midiNotes: number[], onStep?: (index: number) => void) => {
      await engineRef.current?.playMelodySequence(midiNotes, melodyBpm, onStep);
    },
    [melodyBpm]
  );

  const stopMelodyPlayback = useCallback(() => {
    engineRef.current?.stopMelodySequence();
  }, []);

  const playDiceImpact = useCallback((intensity = 0.5) => {
    engineRef.current?.playDiceImpact(intensity);
  }, []);

  return {
    sampleStatus,
    volume,
    setVolume,
    reverbWet,
    setReverbWet,
    melodyBpm,
    setMelodyBpm,
    diceSfxEnabled,
    setDiceSfxEnabled,
    midiSupported,
    midiPorts,
    selectedMidiPortId,
    setSelectedMidiPortId,
    refreshMidiPorts,
    unlockAudio,
    playNote,
    playChord,
    playMelodySequence,
    stopMelodyPlayback,
    playDiceImpact,
  };
}
