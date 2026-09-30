import { describe, expect, it } from 'vitest'
import curriculumData from '../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../types/curriculum'
import { parsePitchSpelling } from './noteUtils'
import { buildScale, chromaticChord, diatonicChord, diatonicCloseNotes, pitchClass, type Chord, type ScaleType } from './theory'

const curriculum = curriculumSchema.parse(curriculumData)

const RCM_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** 'V6/4' is the cadential 6/4 (tonic chord over the dominant bass); 'V5/3' and 'V8' are root-position V. */
function rcmChord(tonic: string, scaleType: ScaleType, roman: string): Chord {
    if (roman === 'V6/4') return diatonicChord(tonic, scaleType, 0, { inversion: 2 })
    const match = /^([ivIV]+)(.*)$/.exec(roman)
    if (!match) throw new Error(`Unrecognised numeral ${roman}`)
    return diatonicChord(tonic, scaleType, RCM_NUMERALS.indexOf(match[1].toUpperCase()), { seventh: match[2] === '7' })
}

const midi = (note: string) => {
    const parsed = parsePitchSpelling(note)
    return (parsed.specifiedOctave! + 1) * 12 + parsed.semitone
}

describe('scale spelling', () => {
    it('spells major scales with one letter per degree', () => {
        expect(buildScale('F', 'major')).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E'])
        expect(buildScale('F#', 'major')).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'])
    })

    it('spells the three minor forms', () => {
        expect(buildScale('A', 'natural')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
        expect(buildScale('G#', 'harmonic')).toEqual(['G#', 'A#', 'B', 'C#', 'D#', 'E', 'F##'])
        expect(buildScale('D', 'melodic')).toEqual(['D', 'E', 'F', 'G', 'A', 'B', 'C#'])
    })
})

describe('diatonic chords', () => {
    it('builds the triads of C major', () => {
        const chords = [0, 1, 2, 3, 4, 5, 6].map((d) => diatonicChord('C', 'major', d))
        expect(chords.map((c) => c.symbol)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'])
        expect(chords.map((c) => c.romanNumeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
    })

    it('reflects the minor form in chord quality', () => {
        const romans = (form: 'natural' | 'harmonic' | 'melodic') =>
            [0, 1, 2, 3, 4, 5, 6].map((d) => diatonicChord('A', form, d).romanNumeral)
        expect(romans('natural')).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
        expect(romans('harmonic')).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'])
        expect(romans('melodic')).toEqual(['i', 'ii', 'III+', 'IV', 'V', 'vi°', 'vii°'])
    })

    it('labels inversions with figured bass and slash symbols', () => {
        const i6 = diatonicChord('C', 'major', 0, { inversion: 1 })
        expect(i6.romanNumeral).toBe('I6')
        expect(i6.symbol).toBe('C/E')
        expect(i6.bass).toBe('E')

        const v42 = diatonicChord('C', 'major', 4, { seventh: true, inversion: 3 })
        expect(v42.romanNumeral).toBe('V4/2')
        expect(v42.symbol).toBe('G7/F')
    })

    it('builds seventh chord qualities', () => {
        expect(diatonicChord('A', 'harmonic', 6, { seventh: true }).romanNumeral).toBe('vii°7')
        expect(diatonicChord('C', 'major', 6, { seventh: true }).symbol).toBe('Bm7b5')
        expect(diatonicChord('C', 'major', 1, { seventh: true }).symbol).toBe('Dm7')
    })
})

describe('chromatic chords', () => {
    it('builds V7/V and the Neapolitan sixth', () => {
        expect(chromaticChord('C', 'V7/V').tones).toEqual(['D', 'F#', 'A', 'C'])
        expect(chromaticChord('C', 'N6').symbol).toBe('Db/F')
        expect(chromaticChord('E', 'N6').symbol).toBe('F/A')
    })
})

describe('agreement with the RCM curriculum', () => {
    const scales = Object.values(curriculum.grades).flat()

    it.each(scales.map((s) => [s.id, s] as const))('%s', (_, scale) => {
        // RCM uses harmonic-minor harmony (major V, minor iv) for both minor forms
        const scaleType = scale.mode === 'major' ? 'major' : 'harmonic'
        for (const event of scale.sequence) {
            const chord = rcmChord(scale.tonic, scaleType, event.romanNumeral)
            expect(event.symbol).toBe(chord.symbol)

            const tonePcs = chord.tones.map(pitchClass)
            const eventPcs = event.notes.map(pitchClass)
            eventPcs.forEach((pc) => expect(tonePcs).toContain(pc))
            // Book voicings may omit the fifth, but always sound the root and third
            expect(eventPcs).toContain(tonePcs[0])
            expect(eventPcs).toContain(tonePcs[1])
            expect(pitchClass(event.notes[0])).toBe(pitchClass(chord.bass))

            const midis = event.notes.map(midi)
            expect(midis).toEqual([...midis].sort((a, b) => a - b))
            expect(event.fingerings).toHaveLength(event.notes.length)
        }
    })
})

describe('diatonicCloseNotes', () => {
    it('builds exact textbook close-position triads for C major ascending on treble staff', () => {
        expect(diatonicCloseNotes('C', 'major', 0)).toEqual(['C4', 'E4', 'G4'])
        expect(diatonicCloseNotes('C', 'major', 1)).toEqual(['D4', 'F4', 'A4'])
        expect(diatonicCloseNotes('C', 'major', 2)).toEqual(['E4', 'G4', 'B4'])
        expect(diatonicCloseNotes('C', 'major', 3)).toEqual(['F4', 'A4', 'C5'])
        expect(diatonicCloseNotes('C', 'major', 4)).toEqual(['G4', 'B4', 'D5'])
        expect(diatonicCloseNotes('C', 'major', 5)).toEqual(['A4', 'C5', 'E5'])
        expect(diatonicCloseNotes('C', 'major', 6)).toEqual(['B4', 'D5', 'F5'])
    })

    it('builds inversions correctly in close position', () => {
        expect(diatonicCloseNotes('C', 'major', 0, { inversion: 1 })).toEqual(['E4', 'G4', 'C5'])
        expect(diatonicCloseNotes('C', 'major', 0, { inversion: 2 })).toEqual(['G4', 'C5', 'E5'])
    })
})

