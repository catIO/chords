import { z } from 'zod'

const STORAGE_KEY = 'scale-chord-practice/drill/v2'

const drillSettingsSchema = z.object({
    keyIds: z.array(z.string()),
    minorForms: z.array(z.enum(['natural', 'harmonic', 'melodic'])).min(1),
    chordTypes: z.array(z.enum(['triads', 'sevenths', 'chromatic'])).min(1),
    inversions: z.array(z.number().int().min(0).max(3)).min(1),
    weighting: z.enum(['common', 'uniform']),
})

export type DrillSettings = z.infer<typeof drillSettingsSchema>

export function loadDrillSettings(validKeyIds: string[]): DrillSettings {
    const defaults: DrillSettings = {
        keyIds: validKeyIds,
        minorForms: ['natural', 'harmonic'],
        chordTypes: ['triads', 'sevenths'],
        inversions: [0, 1],
        weighting: 'common',
    }
    try {
        const parsed = drillSettingsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
        if (!parsed.success) return defaults
        return { ...parsed.data, keyIds: parsed.data.keyIds.filter((id) => validKeyIds.includes(id)) }
    } catch {
        return defaults
    }
}

export function saveDrillSettings(settings: DrillSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
