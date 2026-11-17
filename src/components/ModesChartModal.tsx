import { X } from 'lucide-react';
import {
  DIATONIC_MODE_NAMES,
  MUSIC_MODES_CHART_ROWS,
  buildDiatonicModeEntry,
  type ModeChartRow,
} from '../music/modes';
import type { DiatonicModeType, MelodyModeSelection } from '../types/app';

interface ModesChartModalProps {
  currentMode: MelodyModeSelection;
  onSelectMode: (mode: MelodyModeSelection) => void;
  onClose: () => void;
}

export function ModesChartModal({
  currentMode,
  onSelectMode,
  onClose,
}: ModesChartModalProps) {
  const isCellActive = (row: ModeChartRow, modeType: DiatonicModeType) => {
    if (currentMode.isChromatic) return false;
    return currentMode.keyName === row.keyName && currentMode.modeType === modeType;
  };

  const handleCellClick = (row: ModeChartRow, modeType: DiatonicModeType) => {
    const entry = buildDiatonicModeEntry(row.keyName, modeType);
    onSelectMode({
      isChromatic: false,
      ...entry,
    });
    onClose();
  };

  const handleResetChromatic = () => {
    onSelectMode({
      isChromatic: true,
      id: 'chromatic',
      name: 'Chromatic',
    });
    onClose();
  };

  return (
    <div
      className="modes-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Music Modes Chart"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modes-modal-sheet">
        <div className="modes-modal-header">
          <div>
            <h2 className="modes-modal-title">Music Modes Chart</h2>
            <p className="modes-modal-sub">
              Tap any cell to constrain melody rolls to that mode.
            </p>
          </div>
          <div className="modes-modal-actions">
            <button
              type="button"
              className={`modes-chromatic-btn ${
                currentMode.isChromatic ? 'is-active' : ''
              }`}
              onClick={handleResetChromatic}
            >
              Default (Chromatic)
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={onClose}
              aria-label="Close chart"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="modes-table-scroll">
          <table className="modes-table">
            <thead>
              <tr>
                <th className="th-key">Key</th>
                {DIATONIC_MODE_NAMES.map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MUSIC_MODES_CHART_ROWS.map((row) => (
                <tr key={row.keyName}>
                  <td className="td-key">{row.keyName}</td>
                  {DIATONIC_MODE_NAMES.map((modeType, colIdx) => {
                    const tonic = row.tonics[colIdx];
                    const active = isCellActive(row, modeType);
                    return (
                      <td key={modeType}>
                        <button
                          type="button"
                          className={`mode-cell-btn ${active ? 'is-active' : ''}`}
                          onClick={() => handleCellClick(row, modeType)}
                          title={`${tonic} ${modeType} (${row.keyName})`}
                        >
                          <span className="mode-cell-tonic">{tonic}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
