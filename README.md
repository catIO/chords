#  Chord Practice

Offline-first progressive web app for classical guitar chord work

## Stack

- React 19 + TypeScript + Vite
- Material UI (Material Design 3 surface system)
- VexFlow (notation rendering)
- Zod (runtime schema validation)
- Vitest + React Testing Library
- vite-plugin-pwa (installable offline PWA)

## Curriculum Source

The app uses exactly one curriculum source:

- [src/data/royal_conservatory_pwa_chords.json](src/data/royal_conservatory_pwa_chords.json)

No grade, scale, chord, or progression data is hard-coded in UI components.
The Random chords mode generates chords from music theory in the keys that appear in the cadences; it does not follow levels.

## Features

- Cadences mode: the RCM cadence for every key in the selected level
- Filter by major or minor; minor keys whose harmonic and melodic cadences are identical are listed once
- Random chords mode: weighted random chords in chosen keys and minor forms (natural, harmonic, melodic)
  - Choose chords (triads; ii7, V7, vii7; V7/V and the Neapolitan sixth) and inversions (root, 1st, 2nd, 3rd)
  - Each chord shows its name, Roman numeral and notation with fingerings
  - "Common in repertoire" weighting favours I, V, V7, IV; "Equal" weights every chord the same
  - Guitar voicings: the easiest 4-note shape (thumb bass + three adjacent treble strings) in standard tuning
  - Keyboard: Space, Enter or Right arrow for the next chord
- Treble-staff chord rendering via VexFlow (guitar 8vb clef, key signatures, fingerings)
- Keyboard navigation: Left/Right arrows to step through scales
- Light/dark/system themes with mobile-first Material UI layout
- Local persistence of selected grade, tab, expanded scale and practice settings

## Voicing Audit

Cadence voicings and left-hand fingerings are transcribed from the RCM Technique book
([reference/royal-conservatory-technique.pdf](reference/royal-conservatory-technique.pdf)), including its 2- and 3-note chords,
the cadential 6/4 (tonic over dominant bass) and the Level 10 V8–7 motion (two eighth-note chords).
Barre/position markings are not encoded.

To compare the book with the app side by side:

1. `python3 scripts/render_rcm_audit.py` (requires PyMuPDF) renders the book pages to `reference/audit/`
2. `npm run dev` and open `/audit.html` (dev only; not part of the production build)

## PWA Behavior

- Installable app manifest
- Service worker with app-shell precache
- Offline support for bundled curriculum and assets
- In-app update notification when a new version is available

## Scripts

- `npm run dev` - start local dev server
- `npm run test` - run Vitest once
- `npm run lint` - run ESLint
- `npm run build` - type-check and production build
- `npm run preview` - preview production build locally

## Project Structure

- [src/components](src/components) - ChordStaff, UpdateBanner, ValidationErrorScreen
- [src/features/cadences](src/features/cadences) - CadencePanel, minor-form merging
- [src/features/drill](src/features/drill) - Random chords panel, key list, chord pool and weighting
- [src/music](src/music) - note parsing, voicing allocation, key signatures, chord engine (theory.ts), guitar voicings
- [src/data](src/data) - curriculum JSON + validation
- [src/types](src/types) - Zod schemas and TypeScript types
- [src/theme](src/theme) - Material UI theme builder

## Validation and Error Handling

At startup, curriculum JSON is validated using Zod schemas in [src/types/curriculum.ts](src/types/curriculum.ts).
If validation fails, the app shows a dedicated error screen with issue details.

## Test Coverage

Current tests cover:

- JSON schema validation
- Note parsing and octave allocation
- Curriculum data integrity
- Sequence ordering
- Note parsing
- Octave allocation
- localStorage persistence
- Chord engine spelling, qualities, inversions and chromatic chords
- Chord engine agreement with every curriculum chord
- A playable voicing for every chord the Random chords mode can produce
- Chord pool merging, weighting and no-repeat picking
- Random chords next-chord flow
