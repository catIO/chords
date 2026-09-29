import { describe, expect, it } from 'vitest'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../../types/curriculum'
import { buildChordPool, buildVocabulary, pickChord } from './drill'
import { curriculumKeys, keyId, type KeyChoice } from './keys'

const curriculum = curriculumSchema.parse(curriculumData)

const key = (tonic: string, mode: 'major' | 'minor'): KeyChoice => ({ id: keyId(tonic, mode), tonic, mode })
const allChords = buildVocabulary(['triads', 'sevenths', 'chromatic'], [0, 1, 2, 3])

describe('keys', () => {
    it('lists every curriculum key once', () => {
        const ids = curriculumKeys(curriculum).map((k) => k.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids[0]).toBe('C-major')
    })
})

describe('chord pool', () => {
    it('only includes the chosen chord types and inversions', () => {
        const pool = buildChordPool({
            keys: [key('C', 'major')],
            minorForms: ['harmonic'],
            vocabulary: buildVocabulary(['sevenths'], [1]),
            weighting: 'common',
        })
        expect(pool.map((e) => e.chord.romanNumeral)).toEqual(['ii6/5', 'V6/5', 'viiø6/5'])
    })

    it('skips triads when only the third inversion is chosen', () => {
        const pool = buildChordPool({
            keys: [key('C', 'major')],
            minorForms: ['harmonic'],
            vocabulary: buildVocabulary(['triads'], [3]),
            weighting: 'common',
        })
        expect(pool).toEqual([])
    })

    it('merges chords shared by several minor forms', () => {
        const pool = buildChordPool({
            keys: [key('A', 'minor')],
            minorForms: ['natural', 'harmonic', 'melodic'],
            vocabulary: buildVocabulary(['triads'], [0]),
            weighting: 'common',
        })
        const dominant = pool.find((e) => e.chord.romanNumeral === 'V')
        expect(dominant?.forms).toEqual(['harmonic', 'melodic'])
        expect(pool.find((e) => e.chord.romanNumeral === 'v')?.forms).toEqual(['natural'])
        expect(pool.filter((e) => e.chord.romanNumeral === 'i')).toHaveLength(1)
    })

    it('gives every chord equal weight in uniform mode', () => {
        const pool = buildChordPool({
            keys: [key('E', 'minor')],
            minorForms: ['natural', 'harmonic'],
            vocabulary: allChords,
            weighting: 'uniform',
        })
        expect(new Set(pool.map((e) => e.weight))).toEqual(new Set([1]))
    })
})

describe('pickChord', () => {
    const pool = buildChordPool({
        keys: [key('G', 'major')],
        minorForms: ['harmonic'],
        vocabulary: buildVocabulary(['triads'], [0]),
        weighting: 'common',
    })

    it('never repeats the previous chord', () => {
        for (let i = 0; i < 20; i++) {
            const previous = pool[i % pool.length].id
            expect(pickChord(pool, previous, () => i / 20)?.id).not.toBe(previous)
        }
    })

    it('returns null for an empty pool', () => {
        expect(pickChord([], null)).toBeNull()
    })
})
