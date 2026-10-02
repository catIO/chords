import { z } from 'zod'

const STORAGE_KEY = 'scale-chord-practice/drill/v2'

export const PRACTICES = ['cadences', 'scale', 'tonic', 'flashcards'] as const
export type Practice = (typeof PRACTICES)[number]

const drillSettingsSchema = z.object({
    keyIds: z.array(z.string()),
    practice: z.enum(PRACTICES),
    cadence: z.enum(['basic', 'subdominant', 'cadential64', 'extended']),
    activeKeyId: z.string().optional(),
    minorForms: z.array(z.enum(['natural', 'harmonic', 'melodic'])).min(1),
    chordTypes: z.array(z.enum(['triads', 'sevenths', 'chromatic'])).min(1),
    inversions: z.array(z.number().int().min(0).max(3)).min(1),
})

// Older saves chose a display format and a harmony focus instead of a practice
const savedSettingsSchema = drillSettingsSchema.partial({ practice: true, cadence: true }).extend({
    chordFocus: z.enum(['cadence', 'tonic', 'all']).optional(),
    displayMode: z.enum(['sequence', 'flashcard']).optional(),
})

export type DrillSettings = z.infer<typeof drillSettingsSchema>

function savedPractice(saved: z.infer<typeof savedSettingsSchema>): Practice {
    if (saved.practice) return saved.practice
    if (saved.displayMode === 'flashcard') return 'flashcards'
    if (saved.chordFocus === 'tonic') return 'tonic'
    if (saved.chordFocus === 'all') return 'scale'
    return 'cadences'
}

export function loadDrillSettings(validKeyIds: string[]): DrillSettings {
    const defaults: DrillSettings = {
        keyIds: validKeyIds,
        practice: 'cadences',
        cadence: 'basic',
        activeKeyId: validKeyIds[0],
        minorForms: ['harmonic'],
        chordTypes: ['triads'],
        inversions: [0],
    }
    try {
        const parsed = savedSettingsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
        if (!parsed.success) return defaults
        const saved = parsed.data
        return {
            keyIds: saved.keyIds.filter((id) => validKeyIds.includes(id)),
            practice: savedPractice(saved),
            cadence: saved.cadence ?? 'basic',
            activeKeyId: saved.activeKeyId && validKeyIds.includes(saved.activeKeyId) ? saved.activeKeyId : validKeyIds[0],
            minorForms: saved.minorForms,
            chordTypes: saved.chordTypes,
            inversions: saved.inversions,
        }
    } catch {
        return defaults
    }
}

export function saveDrillSettings(settings: DrillSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
