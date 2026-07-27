import { describe, expect, it } from 'vitest'
import curriculumData from './royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../types/curriculum'

describe('curriculum validation', () => {
    it('validates source json', () => {
        const result = curriculumSchema.safeParse(curriculumData)
        expect(result.success).toBe(true)
    })
})
