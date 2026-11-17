import { useState } from 'react';
import {
  Dices,
  History,
  Music,
  Settings2,
  SlidersHorizontal,
  Volume2,
  X,
} from 'lucide-react';
import type { MidiPortInfo } from '../audio/midiOutput';
import type { SampleLoadStatus } from '../audio/pianoEngine';
import type { AppMode, DiceSkin, TrayTheme } from '../types/app';

interface HeaderBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isRolling: boolean;
  sampleStatus: SampleLoadStatus;
  volume: number;
  onVolumeChange: (val: number) => void;
  reverbWet: number;
  onReverbChange: (val: number) => void;
  melodyBpm: number;
  onMelodyBpmChange: (bpm: number) => void;
  diceSfxEnabled: boolean;
  onDiceSfxChange: (enabled: boolean) => void;
  skin: DiceSkin;
  onSkinChange: (skin: DiceSkin) => void;
  trayTheme: TrayTheme;
  onTrayThemeChange: (theme: TrayTheme) => void;
  midiSupported: boolean;
  midiPorts: MidiPortInfo[];
  selectedMidiPortId: string | null;
  onSelectMidiPort: (id: string | null) => void;
  onRefreshMidi: () => void;
  historyCount: number;
  historyOpen: boolean;
  onToggleHistory: () => void;
}

export function HeaderBar({
  mode,
  onModeChange,
  isRolling,
  sampleStatus,
  volume,
  onVolumeChange,
  reverbWet,
  onReverbChange,
  melodyBpm,
  onMelodyBpmChange,
  diceSfxEnabled,
  onDiceSfxChange,
  skin,
  onSkinChange,
  trayTheme,
  onTrayThemeChange,
  midiSupported,
  midiPorts,
  selectedMidiPortId,
  onSelectMidiPort,
  onRefreshMidi,
  historyCount,
  historyOpen,
  onToggleHistory,
}: HeaderBarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const statusLabel =
    sampleStatus === 'ready'
      ? 'Salamander Grand'
      : sampleStatus === 'loading'
        ? 'Loading Piano…'
        : 'Studio Synth';

  return (
    <header className="app-header">
      <div className="header-top-row">
        <div className="brand-block">
          <div className="brand-emblem" aria-hidden="true">
            <Dices size={18} />
          </div>
          <div>
            <h1 className="brand-title">Composer&apos;s Dice</h1>
            <div className="brand-sub">
              <span
                className={`status-dot status-dot--${sampleStatus}`}
                aria-hidden="true"
              />
              <span>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`icon-btn ${historyOpen ? 'is-active' : ''}`}
            onClick={onToggleHistory}
            aria-label="Toggle roll history"
            title="Recent Rolls"
          >
            <History size={17} />
            {historyCount > 0 && (
              <span className="icon-badge">{historyCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`icon-btn ${settingsOpen ? 'is-active' : ''}`}
            onClick={() => setSettingsOpen((prev) => !prev)}
            aria-label="Audio and visual settings"
            aria-expanded={settingsOpen}
            title="Studio Settings"
          >
            <Settings2 size={17} />
          </button>
        </div>
      </div>

      <nav className="mode-switcher" aria-label="Improvisation mode">
        <button
          type="button"
          className={`mode-tab ${mode === 'chord' ? 'is-active' : ''}`}
          disabled={isRolling}
          onClick={() => onModeChange('chord')}
        >
          <Dices size={15} />
          <span>Chord &amp; Root</span>
          <small>D12 + D20</small>
        </button>

        <button
          type="button"
          className={`mode-tab ${mode === 'melody' ? 'is-active' : ''}`}
          disabled={isRolling}
          onClick={() => onModeChange('melody')}
        >
          <Music size={15} />
          <span>Melody</span>
          <small>D6 / D8 / D12</small>
        </button>
      </nav>

      {settingsOpen && (
        <div className="settings-drawer" role="dialog" aria-label="Studio Settings">
          <div className="settings-drawer-head">
            <span className="settings-title">
              <SlidersHorizontal size={15} />
              Studio &amp; MIDI Settings
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
            >
              <X size={16} />
            </button>
          </div>

          <div className="settings-grid">
            <label className="setting-row">
              <span>
                <Volume2 size={14} /> Piano Volume ({Math.round(volume * 100)}%)
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
              />
            </label>

            <label className="setting-row">
              <span>Studio Reverb ({Math.round((reverbWet / 0.65) * 100)}%)</span>
              <input
                type="range"
                min={0}
                max={0.6}
                step={0.05}
                value={reverbWet}
                onChange={(e) => onReverbChange(Number(e.target.value))}
              />
            </label>

            <label className="setting-row">
              <span>Melody Tempo ({melodyBpm} BPM)</span>
              <input
                type="range"
                min={70}
                max={145}
                step={2}
                value={melodyBpm}
                onChange={(e) => onMelodyBpmChange(Number(e.target.value))}
              />
            </label>

            <div className="setting-toggle-row">
              <span>Dice Finish</span>
              <div className="pill-group">
                <button
                  type="button"
                  className={`mini-pill ${skin === 'ivory' ? 'is-active' : ''}`}
                  onClick={() => onSkinChange('ivory')}
                >
                  Pearl Ivory
                </button>
                <button
                  type="button"
                  className={`mini-pill ${skin === 'obsidian' ? 'is-active' : ''}`}
                  onClick={() => onSkinChange('obsidian')}
                >
                  Obsidian Gold
                </button>
              </div>
            </div>

            <div className="setting-toggle-row">
              <span>Tray Surface</span>
              <div className="pill-group">
                <button
                  type="button"
                  className={`mini-pill ${
                    trayTheme === 'purple-velvet' ? 'is-active' : ''
                  }`}
                  onClick={() => onTrayThemeChange('purple-velvet')}
                >
                  Purple Velvet
                </button>
                <button
                  type="button"
                  className={`mini-pill ${
                    trayTheme === 'studio-felt' ? 'is-active' : ''
                  }`}
                  onClick={() => onTrayThemeChange('studio-felt')}
                >
                  Studio Felt
                </button>
              </div>
            </div>

            <div className="setting-toggle-row">
              <span>Dice Physics Sound</span>
              <button
                type="button"
                className={`mini-pill ${diceSfxEnabled ? 'is-active' : ''}`}
                onClick={() => onDiceSfxChange(!diceSfxEnabled)}
              >
                {diceSfxEnabled ? 'On' : 'Muted'}
              </button>
            </div>

            <div className="setting-midi-row">
              <div className="setting-midi-label">
                <span>Web MIDI Output</span>
                {midiSupported && (
                  <button
                    type="button"
                    className="text-link-btn"
                    onClick={onRefreshMidi}
                  >
                    Refresh
                  </button>
                )}
              </div>
              {midiSupported ? (
                <select
                  className="midi-select"
                  value={selectedMidiPortId ?? ''}
                  onChange={(e) => onSelectMidiPort(e.target.value || null)}
                >
                  <option value="">Internal Piano Only</option>
                  {midiPorts.map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="midi-unsupported">
                  Web MIDI is unavailable in this browser; using Salamander Grand.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
