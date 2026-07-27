import rawCurriculum from './royal_conservatory_pwa_chords.json'
import { curriculumSchema, type Curriculum } from '../types/curriculum'

const parseResult = curriculumSchema.safeParse(rawCurriculum)

export const curriculumError = parseResult.success
    ? null
    : parseResult.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('\n')

export const curriculum: Curriculum | null = parseResult.success
    ? parseResult.data
    : null

// Ensure Preparatory comes first, then numeric order, then 10/ARCT last
const GRADE_ORDER = ['Preparatory', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10/ARCT']

export const gradeOptions = curriculum
    ? GRADE_ORDER.filter((g) => g in curriculum.grades)
    : []

/** Display label for each grade key (matches PDF "Level" terminology) */
export function gradeDisplayName(key: string): string {
    if (key === 'Preparatory') return 'Preparatory'
    if (key === '10/ARCT') return 'Level 10 / ARCT'
    return `Level ${key}`
}
