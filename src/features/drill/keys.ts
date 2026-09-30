import type { Curriculum } from '../../types/curriculum'
import type { Mode } from '../../music/theory'

export interface KeyChoice {
    id: string
    tonic: string
    mode: Mode
}

const MAJOR_ORDER = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
const MINOR_ORDER = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'D', 'G', 'C', 'F', 'Bb', 'Eb', 'Ab']

export const keyId = (tonic: string, mode: Mode) => `${tonic}-${mode}`

/** Every key used in the Cadences data, ordered around the circle of fifths. */
export function curriculumKeys(curriculum: Curriculum): KeyChoice[] {
    const present = new Set(Object.values(curriculum.grades).flat().map((s) => keyId(s.tonic, s.mode)))
    const ordered = (mode: Mode, order: string[]) =>
        order.filter((tonic) => present.has(keyId(tonic, mode))).map((tonic) => ({ id: keyId(tonic, mode), tonic, mode }))
    return [...ordered('major', MAJOR_ORDER), ...ordered('minor', MINOR_ORDER)]
}

/** Keys used across the given RC curriculum grades, ordered around the circle of fifths. */
export function keysForGrades(curriculum: Curriculum, grades: string[]): KeyChoice[] {
    const gradeScales = grades.flatMap((g) => curriculum.grades[g] ?? [])
    const present = new Set(gradeScales.map((s) => keyId(s.tonic, s.mode)))
    const ordered = (mode: Mode, order: string[]) =>
        order.filter((tonic) => present.has(keyId(tonic, mode))).map((tonic) => ({ id: keyId(tonic, mode), tonic, mode }))
    return [...ordered('major', MAJOR_ORDER), ...ordered('minor', MINOR_ORDER)]
}

export type KeyTier = 'beginner' | 'intermediate' | 'advanced'

/** Cumulative key sets loosely following the RCM levels where each key is first introduced. */
export const KEY_TIERS: { value: KeyTier; label: string; grades: string[] | 'all' }[] = [
    { value: 'beginner', label: 'Beginner', grades: ['Preparatory', '1', '2'] },
    { value: 'intermediate', label: 'Intermediate', grades: ['Preparatory', '1', '2', '3', '4', '5'] },
    { value: 'advanced', label: 'Advanced', grades: 'all' },
]

export function keysForTier(curriculum: Curriculum, tier: KeyTier): KeyChoice[] {
    const grades = KEY_TIERS.find((t) => t.value === tier)?.grades ?? 'all'
    return grades === 'all' ? curriculumKeys(curriculum) : keysForGrades(curriculum, grades)
}
