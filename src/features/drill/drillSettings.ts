import { z } from 'zod'

const STORAGE_KEY = 'scale-chord-practice/drill/v2'

const drillSettingsSchema = z.object({
    keyIds: z.array(z.string()),
    chordFocus: z.enum(['cadence', 'tonic', 'all']).optional(),
    displayMode: z.enum(['sequence', 'flashcard']).optional(),
    voicing: z.enum(['close', 'guitar']).optional(),
    // Legacy: 4-note meant guitar voicings
    triadVoicing: z.enum(['3-note', '4-note']).optional(),
    activeKeyId: z.string().optional(),
    minorForms: z.array(z.enum(['natural', 'harmonic', 'melodic'])).min(1),
    chordTypes: z.array(z.enum(['triads', 'sevenths', 'chromatic'])).min(1),
    inversions: z.array(z.number().int().min(0).max(3)).min(1),
})

export type DrillSettings = z.infer<typeof drillSettingsSchema>

export function loadDrillSettings(validKeyIds: string[]): DrillSettings {
    const defaults: DrillSettings = {
        keyIds: validKeyIds,
        chordFocus: 'cadence',
        displayMode: 'sequence',
        voicing: 'close',
        activeKeyId: validKeyIds[0],
        minorForms: ['harmonic'],
        chordTypes: ['triads'],
        inversions: [0],
    }
    try {
        const parsed = drillSettingsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
        if (!parsed.success) return defaults
        const { triadVoicing, ...saved } = parsed.data
        return {
            ...saved,
            chordFocus: saved.chordFocus ?? 'cadence',
            displayMode: saved.displayMode ?? 'sequence',
            voicing: saved.voicing ?? (triadVoicing === '4-note' ? 'guitar' : 'close'),
            activeKeyId: saved.activeKeyId && validKeyIds.includes(saved.activeKeyId) ? saved.activeKeyId : validKeyIds[0],
            keyIds: saved.keyIds.filter((id) => validKeyIds.includes(id)),
        }
    } catch {
        return defaults
    }
}

export function saveDrillSettings(settings: DrillSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
