import { describe, expect, it } from 'vitest'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../../types/curriculum'
import { buildChordPool, buildScaleSequence, buildVocabulary, pickChord, resolveChordOptions } from './drill'
import { curriculumKeys, keyId, keysForTier, type KeyChoice } from './keys'

const curriculum = curriculumSchema.parse(curriculumData)

const key = (tonic: string, mode: 'major' | 'minor'): KeyChoice => ({ id: keyId(tonic, mode), tonic, mode })
const allChords = buildVocabulary(['triads', 'sevenths', 'chromatic'], [0, 1, 2, 3])

describe('keys', () => {
    it('lists every curriculum key once', () => {
        const ids = curriculumKeys(curriculum).map((k) => k.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids[0]).toBe('C-major')
    })

    it('builds cumulative key tiers of 10, 20 and all 24 keys', () => {
        const ids = (tier: 'beginner' | 'intermediate' | 'advanced') => keysForTier(curriculum, tier).map((k) => k.id)
        const beginner = ids('beginner')
        const intermediate = ids('intermediate')

        expect(beginner).toHaveLength(10)
        expect(beginner).toContain('F#-minor')
        expect(beginner).not.toContain('Bb-major')
        expect(intermediate).toHaveLength(20)
        expect(intermediate).toEqual(expect.arrayContaining(beginner))
        expect(intermediate).not.toContain('B-major')
        expect(ids('advanced')).toEqual(curriculumKeys(curriculum).map((k) => k.id))
    })
})

describe('resolveChordOptions', () => {
    it('keeps multi-selections for flashcards', () => {
        const o = resolveChordOptions('flashcard', 'all', ['triads', 'sevenths', 'chromatic'], [2, 0, 3])
        expect(o.chordTypes).toEqual(['triads', 'sevenths', 'chromatic'])
        expect(o.inversions).toEqual([0, 2, 3])
        expect(o.singleChoice).toBe(false)
    })

    it('uses one chord type and the lowest inversion in a scale sequence', () => {
        const o = resolveChordOptions('sequence', 'all', ['sevenths', 'triads', 'chromatic'], [2, 1])
        expect(o.chordTypes).toEqual(['triads'])
        expect(o.inversions).toEqual([1])
        expect(o.allowedTypes).not.toContain('chromatic')
    })

    it('never gives triads a 3rd inversion', () => {
        expect(resolveChordOptions('sequence', 'all', ['triads'], [3]).inversions).toEqual([0])
        expect(resolveChordOptions('sequence', 'cadence', ['sevenths'], [3]).inversions).toEqual([0])
        expect(resolveChordOptions('sequence', 'all', ['sevenths'], [3]).inversions).toEqual([3])
    })

    it('uses triads only for Tonic only', () => {
        const o = resolveChordOptions('flashcard', 'tonic', ['sevenths'], [0, 1])
        expect(o.chordTypes).toEqual(['triads'])
        expect(o.inversions).toEqual([0, 1])
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

    it('focuses strictly on tonic (I / i) when focus is tonic', () => {
        const pool = buildChordPool({
            keys: [key('D', 'major')],
            minorForms: ['natural'],
            vocabulary: buildVocabulary(['triads', 'sevenths'], [0, 1, 2], 'tonic'),
            weighting: 'common',
        })
        expect(pool.map((e) => e.chord.romanNumeral)).toEqual(['I', 'I6', 'I6/4'])
        expect(pool.every((e) => e.chord.symbol.startsWith('D'))).toBe(true)
    })

    it('focuses on cadence degrees (I, V, V7) when focus is cadence', () => {
        const pool = buildChordPool({
            keys: [key('A', 'major')],
            minorForms: ['natural'],
            vocabulary: buildVocabulary(['triads', 'sevenths'], [0], 'cadence'),
            weighting: 'common',
        })
        const numerals = pool.map((e) => e.chord.romanNumeral)
        expect(numerals).toContain('I')
        expect(numerals).toContain('V')
        expect(numerals).toContain('V7')
        expect(numerals).not.toContain('IV')
        expect(numerals).not.toContain('ii')
        expect(numerals).not.toContain('vi')
    })

    it('adds IV to the cadence vocabulary for longer progressions', () => {
        expect(buildVocabulary(['triads'], [0], 'cadence', 'subdominant').triadDegrees).toEqual([0, 3, 4])
    })

    it('keeps the tonic in a cadence when only 7th chords are chosen', () => {
        const pool = buildChordPool({
            keys: [key('C', 'major')],
            minorForms: ['harmonic'],
            vocabulary: buildVocabulary(['sevenths'], [3], 'cadence'),
            weighting: 'common',
        })
        expect(pool.map((e) => e.chord.romanNumeral).sort()).toEqual(['I', 'V4/2'])
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

describe('buildScaleSequence', () => {
    it('generates all 7 diatonic scale degrees for focus all', () => {
        const seq = buildScaleSequence(key('D', 'major'), 'all', ['natural'], [0], ['triads'])
        expect(seq).toHaveLength(7)
        expect(seq.map((s) => s.romanNumeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
        expect(seq[0].symbol).toBe('D')
        expect(seq[3].symbol).toBe('G')
        expect(seq[4].symbol).toBe('A')
    })

    it('generates tonic inversions for focus tonic', () => {
        const seq = buildScaleSequence(key('D', 'major'), 'tonic', ['natural'], [0, 1, 2], ['triads'])
        expect(seq).toHaveLength(3)
        expect(seq.map((s) => s.romanNumeral)).toEqual(['I', 'I6', 'I6/4'])
        expect(seq.every((s) => s.symbol.startsWith('D'))).toBe(true)
    })

    it('generates C major V–I cadence', () => {
        const seq = buildScaleSequence(key('C', 'major'), 'cadence', ['harmonic'], [0], ['triads'])
        expect(seq.map((s) => s.romanNumeral)).toEqual(['V', 'I'])
        expect(seq.map((s) => s.symbol)).toEqual(['G', 'C'])
    })

    it('generates A minor natural-minor degree generation', () => {
        const seq = buildScaleSequence(key('A', 'minor'), 'all', ['natural'], [0], ['triads'])
        expect(seq).toHaveLength(7)
        expect(seq.map((s) => s.romanNumeral)).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
        expect(seq.map((s) => s.symbol)).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'])
    })

    it('generates A minor harmonic-minor degree generation', () => {
        const seq = buildScaleSequence(key('A', 'minor'), 'all', ['harmonic'], [0], ['triads'])
        expect(seq).toHaveLength(7)
        expect(seq.map((s) => s.romanNumeral)).toEqual(['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'])
        expect(seq.map((s) => s.symbol)).toEqual(['Am', 'B°', 'C+', 'Dm', 'E', 'F', 'G#°'])
    })

    it('generates A minor cadence producing E–Am even if natural minor was selected', () => {
        const seq = buildScaleSequence(key('A', 'minor'), 'cadence', ['natural'], [0], ['triads'])
        expect(seq.map((s) => s.romanNumeral)).toEqual(['V', 'i'])
        expect(seq.map((s) => s.symbol)).toEqual(['E', 'Am'])
    })

    it('generates the extended cadence with vi, the cadential 6/4 and V–V7', () => {
        const major = buildScaleSequence(key('G', 'major'), 'cadence', ['harmonic'], [0], ['triads'], 'extended')
        expect(major.map((s) => s.romanNumeral)).toEqual(['I', 'vi', 'IV', 'V6/4', 'V', 'V7', 'I'])
        expect(major.map((s) => s.symbol)).toEqual(['G', 'Em', 'C', 'G/D', 'D', 'D7', 'G'])
        const minor = buildScaleSequence(key('E', 'minor'), 'cadence', ['harmonic'], [0], ['triads'], 'extended')
        expect(minor.map((s) => s.romanNumeral)).toEqual(['i', 'VI', 'iv', 'V6/4', 'V', 'V7', 'i'])
    })

    it('generates I–IV–V–I and the cadential 6/4 progression', () => {
        const subdominant = buildScaleSequence(key('A', 'minor'), 'cadence', ['harmonic'], [0], ['triads'], 'subdominant')
        expect(subdominant.map((s) => s.romanNumeral)).toEqual(['i', 'iv', 'V', 'i'])
        expect(subdominant.map((s) => s.symbol)).toEqual(['Am', 'Dm', 'E', 'Am'])

        const cadential = buildScaleSequence(key('C', 'major'), 'cadence', ['harmonic'], [0], ['triads'], 'cadential64')
        expect(cadential.map((s) => s.romanNumeral)).toEqual(['I', 'IV', 'V6/4', 'V5/3', 'I'])
        expect(cadential.map((s) => s.symbol)).toEqual(['C', 'F', 'C/G', 'G', 'C'])
        expect(cadential[2].notes).toEqual(['G4', 'C5', 'E5'])
    })

    it('keeps the cadential 6/4 over a root-position V7 when only 7ths are chosen', () => {
        const seq = buildScaleSequence(key('C', 'major'), 'cadence', ['harmonic'], [1], ['sevenths'], 'cadential64')
        expect(seq.map((s) => s.romanNumeral)).toEqual(['I6', 'IV6', 'V6/4', 'V7', 'I6'])
    })

    it('handles mixed major/minor key selections properly in chord pool', () => {
        const pool = buildChordPool({
            keys: [key('C', 'major'), key('A', 'minor')],
            minorForms: ['natural'],
            vocabulary: buildVocabulary(['triads'], [0], 'all'),
            weighting: 'common',
        })
        const cChords = pool.filter((e) => e.key.id === 'C-major').map((e) => e.chord.romanNumeral)
        const aChords = pool.filter((e) => e.key.id === 'A-minor').map((e) => e.chord.romanNumeral)

        expect(cChords).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
        expect(aChords).toEqual(['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'])
    })
})
