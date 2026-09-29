import { describe, expect, it } from 'vitest'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema, type ScaleExercise } from '../../types/curriculum'
import { mergeMinorForms } from './mergeMinorForms'

const curriculum = curriculumSchema.parse(curriculumData)

describe('mergeMinorForms', () => {
    it('lists each Level 1 minor key once with both forms', () => {
        const merged = mergeMinorForms(curriculum.grades['1'])
        const minors = merged.filter((s) => s.mode === 'minor')
        expect(minors.map((s) => s.tonic)).toEqual(['E', 'B', 'D'])
        minors.forEach((s) => expect(s.minorForms).toEqual(['harmonic', 'melodic']))
        expect(merged.filter((s) => s.mode === 'major').every((s) => s.minorForms.length === 0)).toBe(true)
    })

    it('keeps minor forms apart when their cadences differ', () => {
        const [harmonic] = curriculum.grades['1'].filter((s) => s.minorForm === 'harmonic')
        const melodic: ScaleExercise = {
            ...harmonic,
            id: 'melodic-variant',
            minorForm: 'melodic',
            sequence: harmonic.sequence.map((e, i) => (i === 0 ? { ...e, fingerings: ['0', '0', '0'] } : e)),
        }
        expect(mergeMinorForms([harmonic, melodic])).toHaveLength(2)
    })
})
