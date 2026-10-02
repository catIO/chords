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

    it('stacks every triad as three notes in close position, the chosen inversion in the bass', () => {
        const failures: string[] = []
        for (const key of curriculumKeys(curriculum)) {
            const scaleType = key.mode === 'major' ? 'major' : 'harmonic'
            for (let degree = 0; degree < 7; degree++) {
                for (const inversion of [0, 1, 2]) {
                    const chord = diatonicChord(key.tonic, scaleType, degree, { inversion })
                    const voicing = voiceChord(chord, { threeNoteTriads: true })
                    const tones = voicing?.notes.map((n) => n.replace(/\d/, ''))
                    const stacked = [0, 1, 2].map((i) => chord.tones[(inversion + i) % 3])
                    const midis = voicing?.notes.map(midi) ?? []
                    if (!voicing || tones!.join() !== stacked.join() || midis[2] - midis[0] >= 12) {
                        failures.push(`${key.id} ${chord.romanNumeral} ${voicing?.notes.join(' ') ?? 'none'}`)
                    }
                }
            }
        }
        expect(failures).toEqual([])
    })

    it('climbs a scale of three-note triads by step, at most one chord moved an octave', () => {
        const failures: string[] = []
        for (const key of curriculumKeys(curriculum)) {
            for (const inversion of [0, 1, 2]) {
                const chords = buildScaleSequence(key, 'all', ['natural'], [inversion], ['triads']).map((i) => i.chord)
                const basses = voiceWithRisingBass(chords, { threeNoteTriads: true }).map((v) => (v ? midi(v.notes[0]) : NaN))
                const leaps = basses.slice(1).filter((b, i) => !(b - basses[i] >= 1 && b - basses[i] <= 2))
                if (basses.some(Number.isNaN) || leaps.length > 2) failures.push(`${key.id} inv${inversion}: ${basses.join(',')}`)
            }
        }
        expect(failures).toEqual([])
        const aMinor = voiceWithRisingBass(
            buildScaleSequence({ id: 'A-minor', tonic: 'A', mode: 'minor' }, 'all', ['natural'], [0], ['triads']).map((i) => i.chord),
            { threeNoteTriads: true },
        )
        expect(aMinor.map((v) => v?.notes[0])).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'])
    })

    it('doubles the 3rd of a diminished triad, not its leading-tone root', () => {
        const notes = generateVoicing(diatonicChord('C', 'major', 6))!.notes.map((n) => n.replace(/\d/, ''))
        expect(notes.filter((n) => n === 'B')).toHaveLength(1)
        expect(notes.filter((n) => n === 'D')).toHaveLength(2)
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
