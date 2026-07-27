import { z } from 'zod'

export const NOTE_PATTERN = /^[A-G](?:#{1,2}|b{1,2})?$/

export const chordEventSchema = z.object({
    id: z.string().min(1),
    romanNumeral: z.string().min(1),
    symbol: z.string().min(1),
    notes: z.array(z.string().regex(NOTE_PATTERN)).min(1),
    durationBeats: z.number().positive(),
    beatUnit: z.number().positive(),
    fingerings: z.array(z.string()).optional(),
})

export const scaleExerciseSchema = z.object({
    id: z.string().min(1),
    grade: z.string().min(1),
    scaleName: z.string().min(1),
    tonic: z.string().regex(NOTE_PATTERN),
    mode: z.enum(['major', 'minor']),
    sequence: z.array(chordEventSchema).min(1),
    sourcePages: z.array(z.number().int().positive()).min(1),
    minorForm: z.enum(['harmonic', 'melodic']).optional(),
})

export const curriculumSchema = z.object({
    schemaVersion: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    renderingNotes: z.object({
        supported: z.string().min(1),
        notEncoded: z.string().min(1),
    }),
    grades: z.record(z.string(), z.array(scaleExerciseSchema)),
})

export type ChordEvent = z.infer<typeof chordEventSchema>
export type ScaleExercise = z.infer<typeof scaleExerciseSchema>
export type Curriculum = z.infer<typeof curriculumSchema>
