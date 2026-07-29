# Scale Chord Practice

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

## Features

- Grade Review mode: browse every scale's cadence chords by level
- Filter by major, harmonic minor, or melodic minor
- Treble-staff chord rendering via VexFlow (guitar 8vb clef, key signatures, fingerings)
- Keyboard navigation: Left/Right arrows to step through scales
- Light/dark/system themes with mobile-first Material UI layout
- Local persistence of selected grade and expanded scale

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
- [src/features/review](src/features/review) - GradeReviewPanel
- [src/music](src/music) - note parsing, voicing allocation, key signature utilities
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
