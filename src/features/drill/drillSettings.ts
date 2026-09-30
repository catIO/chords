import { z } from 'zod'

const STORAGE_KEY = 'scale-chord-practice/drill/v2'

const drillSettingsSchema = z.object({
    keyIds: z.array(z.string()),
    selectedGrades: z.array(z.string()).optional(),
    grade: z.string().optional(),
    chordFocus: z.enum(['cadence', 'tonic', 'all']).optional(),
    displayMode: z.enum(['sequence', 'flashcard']).optional(),
    triadVoicing: z.enum(['3-note', '4-note']).optional(),
    activeKeyId: z.string().optional(),
    minorForms: z.array(z.enum(['natural', 'harmonic', 'melodic'])).min(1),
    chordTypes: z.array(z.enum(['triads', 'sevenths', 'chromatic'])).min(1),
    inversions: z.array(z.number().int().min(0).max(3)).min(1),
    weighting: z.enum(['common', 'uniform']),
})

export type DrillSettings = z.infer<typeof drillSettingsSchema>

export function loadDrillSettings(validKeyIds: string[], defaultGrade = 'all'): DrillSettings {
    const defaultGrades = defaultGrade && defaultGrade !== 'all' ? [defaultGrade] : []
    const defaults: DrillSettings = {
        keyIds: validKeyIds,
        selectedGrades: defaultGrades,
        grade: defaultGrade,
        chordFocus: 'cadence',
        displayMode: 'sequence',
        triadVoicing: '3-note',
        activeKeyId: validKeyIds[0],
        minorForms: ['harmonic'],
        chordTypes: ['triads'],
        inversions: [0],
        weighting: 'common',
    }
    try {
        const parsed = drillSettingsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
        if (!parsed.success) return defaults
        const selectedGrades =
            parsed.data.selectedGrades ??
            (parsed.data.grade && parsed.data.grade !== 'all' ? [parsed.data.grade] : defaultGrades)
        return {
            ...parsed.data,
            selectedGrades,
            grade: parsed.data.grade ?? defaultGrade,
            chordFocus: parsed.data.chordFocus ?? 'cadence',
            displayMode: parsed.data.displayMode ?? 'sequence',
            triadVoicing: parsed.data.triadVoicing ?? '3-note',
            activeKeyId: parsed.data.activeKeyId && validKeyIds.includes(parsed.data.activeKeyId) ? parsed.data.activeKeyId : validKeyIds[0],
            keyIds: parsed.data.keyIds.filter((id) => validKeyIds.includes(id)),
        }
    } catch {
        return defaults
    }
}

export function saveDrillSettings(settings: DrillSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
