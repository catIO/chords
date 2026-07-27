import { describe, expect, it } from 'vitest'
import { allocateChordVoicing, parsePitchSpelling } from './noteUtils'

describe('note parsing and voicing', () => {
    it('parses accidentals', () => {
        const parsed = parsePitchSpelling('F#')
        expect(parsed.letter).toBe('F')
        expect(parsed.accidental).toBe('#')
    })

    it('doubles the root for triads to create a 4-note guitar voicing', () => {
        const voiced = allocateChordVoicing(['C', 'E', 'G'])
        expect(voiced).toHaveLength(4)
        // First and last note are both C
        expect(voiced[0].letter).toBe('C')
        expect(voiced[3].letter).toBe('C')
        // Root C is in octave 4 (semitone 0 < 7 → octave 4 rule)
        expect(voiced[0].octave).toBe(4)
        // Doubled root is one octave above the root
        expect(voiced[3].octave).toBe(5)
    })

    it('places G major root in octave 3 with close voicing', () => {
        const voiced = allocateChordVoicing(['G', 'B', 'D'])
        expect(voiced).toHaveLength(4)
        expect(voiced.map((n) => n.letter + n.octave)).toEqual(['G3', 'B3', 'D4', 'G4'])
    })

    it('places root A in octave 3 (2 ledger lines below treble staff)', () => {
        const voiced = allocateChordVoicing(['A', 'C', 'E'])
        expect(voiced[0].letter).toBe('A')
        expect(voiced[0].octave).toBe(3)
        // All notes strictly ascending
        const midis = voiced.map((n) => n.midi)
        expect(midis).toEqual([...midis].sort((a, b) => a - b))
    })

    it('allocates ascending octaves without collisions for 4-note input', () => {
        const voiced = allocateChordVoicing(['C', 'E', 'G', 'C'])
        const midiValues = voiced.map((note) => note.midi)
        const sorted = [...midiValues].sort((a, b) => a - b)
        expect(midiValues).toEqual(sorted)
        expect(new Set(midiValues).size).toBe(midiValues.length)
    })
})
