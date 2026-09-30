import { describe, expect, it } from 'vitest'
import curriculumData from '../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../types/curriculum'
import { buildChordPool, buildScaleSequence, buildVocabulary } from '../features/drill/drill'
import { curriculumKeys } from '../features/drill/keys'
import { generateVoicing, voiceChord, voiceWithRisingBass } from './guitarVoicings'
import { parsePitchSpelling } from './noteUtils'
import { diatonicChord, pitchClass } from './theory'

const curriculum = curriculumSchema.parse(curriculumData)

const midi = (note: string) => {
    const parsed = parsePitchSpelling(note)
    return (parsed.specifiedOctave! + 1) * 12 + parsed.semitone
}

describe('generated voicings', () => {
    it('finds the standard open shapes', () => {
        expect(generateVoicing(diatonicChord('C', 'major', 0))).toMatchObject({
            notes: ['C4', 'G4', 'C5', 'E5'],
            fingerings: ['3', '0', '1', '0'],
        })
        expect(generateVoicing(diatonicChord('D', 'major', 0))).toMatchObject({
            notes: ['D4', 'A4', 'D5', 'F#5'],
            fingerings: ['0', '1', '3', '2'],
        })
        expect(generateVoicing(diatonicChord('G', 'major', 0))?.notes).toEqual(['G3', 'D4', 'G4', 'B4'])
    })

    it('puts the inversion note in the bass', () => {
        const voicing = generateVoicing(diatonicChord('C', 'major', 0, { inversion: 1 }))
        expect(voicing?.notes[0].replace(/\d/, '')).toBe('E')
    })

    it('gives the chords of a scale a bass that rises by step', () => {
        const steps = (chords: ReturnType<typeof diatonicChord>[]) => {
            const basses = voiceWithRisingBass(chords).map((v) => (v ? midi(v.notes[0]) : NaN))
            return basses.slice(1).map((b, i) => b - basses[i])
        }
        const isStep = (s: number) => s >= 1 && s <= 3
        const strict: string[] = []
        const loose: string[] = []
        for (const key of curriculumKeys(curriculum)) {
            for (const chordTypes of [['triads'], ['sevenths']] as const) {
                for (const inversion of [0, 1, 2]) {
                    const chords = buildScaleSequence(key, 'all', ['harmonic'], [inversion], [...chordTypes]).map((i) => i.chord)
                    const s = steps(chords)
                    const label = `${key.id} ${chordTypes[0]} inv${inversion}: ${s.join(',')}`
                    if (chordTypes[0] === 'triads' && inversion === 0 && !s.every(isStep)) strict.push(label)
                    // Past the guitar's bass range the line may drop an octave once
                    if (s.filter((x) => !Number.isNaN(x) && !isStep(x)).length > 1) loose.push(label)
                }
            }
        }
        expect(strict).toEqual([])
        expect(loose).toEqual([])
    })

    it('voices every chord the drill can produce', () => {
        const pool = buildChordPool({
            keys: curriculumKeys(curriculum),
            minorForms: ['natural', 'harmonic', 'melodic'],
            vocabulary: buildVocabulary(['triads', 'sevenths', 'chromatic'], [0, 1, 2, 3]),
            weighting: 'uniform',
        })
        const failures: string[] = []

        for (const { chord, key } of pool) {
            const voicing = voiceChord(chord)
            if (!voicing) {
                failures.push(`${key.id} ${chord.romanNumeral} ${chord.symbol}`)
                continue
            }
            const midis = voicing.notes.map(midi)
            expect(midis).toEqual([...midis].sort((a, b) => a - b))
            expect(pitchClass(voicing.notes[0])).toBe(pitchClass(chord.bass))
            expect(voicing.fingerings).toHaveLength(voicing.notes.length)
            voicing.fingerings.forEach((f) => expect(['0', '1', '2', '3', '4']).toContain(f))
            voicing.notes.forEach((n) => expect(chord.tones).toContain(n.replace(/\d/, '')))
        }

        expect(failures).toEqual([])
    })
})
