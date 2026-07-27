# Scale Chord Practice

Offline-first progressive web app for classical guitar chord work, driven entirely by Royal Conservatory scale-chord curriculum data.

## Stack

- React 19 + TypeScript + Vite
- Material UI (Material Design system)
- VexFlow (notation)
- Tone.js (audio playback)
- Zod (runtime schema validation)
- Vitest + React Testing Library
- vite-plugin-pwa (installable offline PWA)

## Curriculum Source

The app uses exactly one curriculum source:

- [src/data/royal_conservatory_pwa_chords.json](src/data/royal_conservatory_pwa_chords.json)

No grade, scale, chord, or progression data is hard-coded in UI components.

## Features

- Random Chord mode
- Random Sequence mode with tempo and metronome
- Grade Review mode with major/harmonic/melodic filtering
- Treble-staff chord rendering via VexFlow
- Chord and sequence playback using shared voicing logic
- Shuffle-bag prompt selection with immediate-repeat prevention
- Weighted recall using Again/Hard/Good ratings
- Local persistence of grade, mode, theme, tempo, and history
- Light/dark/system themes with mobile-first Material UI layout
- Keyboard shortcuts:
  - Space: reveal/play
  - Left/Right: previous/next
  - 1: Again
  - 2: Hard
  - 3: Good

## PWA Behavior

- Installable app manifest
- Service worker with app-shell precache
- Offline support for bundled curriculum and assets
- In-app update notification when a new version is available

## Scripts

- `npm run dev` - start local dev server
- `npm run test` - run Vitest once
- `npm run test:watch` - run Vitest in watch mode
- `npm run lint` - run ESLint
- `npm run build` - type-check and production build
- `npm run preview` - preview production build locally

## Project Structure

- [src/components](src/components)
- [src/features/practice](src/features/practice)
- [src/features/review](src/features/review)
- [src/music](src/music)
- [src/data](src/data)
- [src/types](src/types)
- [src/storage](src/storage)
- [src/hooks](src/hooks)

## Validation and Error Handling

At startup, curriculum JSON is validated using Zod schemas in [src/types/curriculum.ts](src/types/curriculum.ts).
If validation fails, the app shows a dedicated error screen with issue details.

## Test Coverage

Current tests cover:

- JSON validation
- Grade filtering
- Shuffle-bag behavior
- Immediate-repeat prevention
- Sequence ordering
- Note parsing
- Octave allocation
- localStorage persistence
