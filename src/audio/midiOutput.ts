export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export class MidiOutputManager {
  private midiAccess: MIDIAccess | null = null;
  private selectedPortId: string | null = null;
  private onPortsChange?: (ports: MidiPortInfo[]) => void;

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  async init(onPortsChange?: (ports: MidiPortInfo[]) => void): Promise<MidiPortInfo[]> {
    this.onPortsChange = onPortsChange;
    if (!MidiOutputManager.isSupported()) {
      return [];
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = () => {
        const ports = this.getPorts();
        if (
          this.selectedPortId &&
          !ports.some((port) => port.id === this.selectedPortId)
        ) {
          this.selectedPortId = null;
        }
        this.onPortsChange?.(ports);
      };
      return this.getPorts();
    } catch {
      return [];
    }
  }

  getPorts(): MidiPortInfo[] {
    if (!this.midiAccess) return [];
    const ports: MidiPortInfo[] = [];
    this.midiAccess.outputs.forEach((output) => {
      ports.push({
        id: output.id,
        name: output.name || `MIDI Out (${output.id})`,
        manufacturer: output.manufacturer || 'External Device',
      });
    });
    return ports;
  }

  setSelectedPort(portId: string | null): void {
    this.selectedPortId = portId;
  }

  getSelectedPortId(): string | null {
    return this.selectedPortId;
  }

  private getActiveOutput(): MIDIOutput | null {
    if (!this.midiAccess || !this.selectedPortId) return null;
    return this.midiAccess.outputs.get(this.selectedPortId) ?? null;
  }

  sendNote(
    midiNote: number,
    velocity = 92,
    durationMs = 800,
    delayMs = 0
  ): void {
    const output = this.getActiveOutput();
    if (!output) return;

    const clampedNote = Math.max(0, Math.min(127, Math.round(midiNote)));
    const clampedVel = Math.max(1, Math.min(127, Math.round(velocity)));
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = now + Math.max(0, delayMs);

    try {
      output.send([0x90, clampedNote, clampedVel], startTime);
      output.send([0x80, clampedNote, 0], startTime + Math.max(60, durationMs));
    } catch {
      // Ignore disconnected port errors gracefully
    }
  }

  sendChord(
    midiNotes: number[],
    mode: 'block' | 'arpeggio' = 'block',
    durationMs = 1700
  ): void {
    const stepMs = mode === 'arpeggio' ? 140 : 18;
    midiNotes.forEach((note, idx) => {
      const velocity = idx < 2 ? 84 : 96;
      this.sendNote(note, velocity, durationMs, idx * stepMs);
    });
  }

  sendChordAndRoot(
    chordNotes: number[],
    rootNotes: number[],
    durationMs = 1700
  ): void {
    chordNotes.forEach((note, idx) => {
      this.sendNote(note, 94, durationMs, idx * 18);
    });
    rootNotes.forEach((note, idx) => {
      this.sendNote(note, 88, durationMs, 500 + idx * 15);
    });
  }

  dispose(): void {
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
      this.midiAccess = null;
    }
  }
}
