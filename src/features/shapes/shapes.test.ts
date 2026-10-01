import { describe, expect, it } from 'vitest'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../../types/curriculum'
import { locateVoicing } from '../../music/guitarVoicings'
import {
    buildExercise,
    buildShapeExamples,
    classifyShape,
    groupBySignature,
    seededRandom,
    shapeSignature,
    type FrettedNote,
} from './shapes'

const curriculum = curriculumSchema.parse(curriculumData)

// [string (0 = low E), fret, finger]
const shape = (...notes: [number, number, number][]): FrettedNote[] =>
    notes.map(([string, fret, finger]) => ({ string, fret, finger }))

describe('classifyShape', () => {
    it('recognises the open-position shapes', () => {
        expect(classifyShape(shape([2, 2, 1], [3, 2, 2], [4, 2, 3]))).toBe('line') // A major
        expect(classifyShape(shape([3, 2, 1], [4, 3, 3], [5, 2, 2]))).toBe('triangle') // D major
        expect(classifyShape(shape([2, 3, 3], [3, 2, 2], [4, 1, 1]))).toBe('staircase') // F major, first position
        expect(classifyShape(shape([1, 3, 3], [2, 2, 2], [4, 1, 1]))).toBe('reverseDiagonal') // C major
        expect(classifyShape(shape([4, 1, 1], [5, 3, 3]))).toBe('diagonal')
    })

    it('separates full and partial barres', () => {
        expect(classifyShape(shape([0, 1, 1], [1, 3, 3], [2, 3, 4], [5, 1, 1]))).toBe('barre')
        expect(classifyShape(shape([3, 2, 1], [4, 2, 1], [5, 4, 3]))).toBe('partialBarre')
    })

    it('tells parallelograms, stretches, clusters and fans apart', () => {
        expect(classifyShape(shape([1, 3, 3], [2, 2, 1], [3, 3, 4], [4, 2, 2]))).toBe('parallelogram')
        expect(classifyShape(shape([1, 2, 1], [2, 4, 2]))).toBe('stretch')
        expect(classifyShape(shape([1, 2, 1], [2, 4, 3], [3, 3, 2]))).toBe('cluster')
        expect(classifyShape(shape([0, 2, 1], [2, 4, 3], [5, 3, 2]))).toBe('fan')
    })

    it('needs at least two fretted fingers', () => {
        expect(classifyShape(shape([1, 2, 2]))).toBeNull()
    })

    it('gives a moved shape the same signature', () => {
        expect(shapeSignature(shape([3, 2, 1], [4, 3, 3], [5, 2, 2]))).toBe(
            shapeSignature(shape([2, 7, 1], [3, 8, 3], [4, 7, 2])),
        )
    })
})

describe('locateVoicing', () => {
    it('finds the strings and frets of a printed chord', () => {
        // RCM Level 5 G major: barre on the 3rd fret
        expect(locateVoicing(['G3', 'B4', 'D5', 'G5'], ['1', '2', '1', '1'])).toMatchObject({
            strings: [0, 3, 4, 5],
            frets: [3, 4, 3, 3],
        })
    })

    it('places every RCM chord on the fretboard', () => {
        const missing = Object.values(curriculum.grades)
            .flat()
            .flatMap((s) => s.sequence)
            .filter((e) => !locateVoicing(e.notes, e.fingerings ?? []))
            .map((e) => e.id)
        expect(missing).toEqual([])
    })
})

describe('shape examples', () => {
    const examples = buildShapeExamples(curriculum)

    it('names each chord and keeps the voicing for notation', () => {
        const dMajor = examples.find((e) => e.source === 'Level 1' && e.name === 'D major' && e.family === 'triangle')
        expect(dMajor).toMatchObject({ description: 'Major triad', fingerPattern: '1–3–2' })
        expect(dMajor?.event.notes).toHaveLength(dMajor!.event.fingerings!.length)
        expect(new Set(examples.map((e) => e.id)).size).toBe(examples.length)
    })

    it('keeps to chords common in classical guitar repertoire', () => {
        const generated = examples.filter((e) => !e.source)
        expect(generated.some((e) => e.chord.quality === 'augmented')).toBe(false)
        expect(generated.some((e) => /^(A♭|D♭|G♭|C♭)/.test(e.name))).toBe(false)
        expect(examples.find((e) => e.name === 'D♯ diminished 7/F♯')).toMatchObject({
            family: 'partialBarre',
            fingerPattern: '2–1–3–1',
        })
        expect(examples.find((e) => e.name === 'D♯ diminished 7')).toMatchObject({
            family: 'parallelogram',
            fingerPattern: '2–3–1–4',
        })
    })

    it('groups harmonically different chords under one hand shape', () => {
        const groups = groupBySignature(examples)
        expect(groups.some((g) => new Set(g.examples.map((e) => e.chord.quality)).size > 1)).toBe(true)
        expect(groups.every((g) => g.examples.every((e) => e.signature === g.signature))).toBe(true)
    })

    it('builds an exercise from one family, led by a single hand shape', () => {
        const triangles = examples.filter((e) => e.family === 'triangle')
        const exercise = buildExercise(triangles, seededRandom(1))
        expect(exercise).toHaveLength(4)
        expect(new Set(exercise.map((e) => e.id)).size).toBe(4)
        expect(exercise.every((e) => e.family === 'triangle')).toBe(true)
        const groupSize = triangles.filter((e) => e.signature === exercise[0].signature).length
        expect(exercise.filter((e) => e.signature === exercise[0].signature)).toHaveLength(Math.min(groupSize, 4))
    })
})
