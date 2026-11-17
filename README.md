# Composer's Chord Dice

A mobile-first 3D musical improvisation and songwriting Progressive Web App (PWA) inspired by The Harmony Lab's **Composer's Dice**.

## Features

- **Chord & Root Mode (D12 + D20)**: Roll the 12-sided Root/Pitch die and weighted 20-sided Chord die simultaneously on a royal-purple velvet tray. Inspect the resulting chord symbol, intervals, constituent notes, and highlighted mini piano keyboard, with instant block-chord or arpeggio playback.
- **Melody Mode (Sequential D12 × 3–9)**: Choose a sequence length from **3 to 9** notes with `-` / `+` stepper controls, then roll a single large D12 sequentially to compose an original melody phrase step-by-step and hear the finished phrase played back on piano.
- **3D Polyhedral Physics (`Three.js` + `cannon-es`)**: Real-time rigid-body rolling with beveled engraved serif dice faces (`M`, `m`, `M⁷`, `m⁷`, `7`, `ø`, `°7`, `mM⁷`, `sus4`, `sus2`, `+`, `°`, `6` and 12 chromatic pitches) and clean camera-facing settle alignment.
- **Salamander Grand Piano & Web MIDI (`Tone.js`)**: Sampled acoustic grand piano routed through studio reverb and dynamics, with an instant synthesized piano fallback and optional Web MIDI API output to external hardware/DAWs.
- **Installable Vertical Mobile PWA**: Portrait-locked `100dvh` layout with a prominent bottom-center Roll button and offline sample caching via Service Worker.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```
