import type { ScaleExercise } from '../../types/curriculum'

type MinorForm = NonNullable<ScaleExercise['minorForm']>

export type CadenceScale = ScaleExercise & { minorForms: MinorForm[] }

const cadenceKey = (scale: ScaleExercise) =>
    JSON.stringify(scale.sequence.map((e) => [e.romanNumeral, e.notes, e.fingerings, e.durationBeats, e.beatUnit]))

/** Lists a minor key once when its harmonic and melodic cadences are identical. */
export function mergeMinorForms(scales: ScaleExercise[]): CadenceScale[] {
    const result: CadenceScale[] = []
    for (const scale of scales) {
        const twin = scale.minorForm
            ? result.find((s) => s.mode === 'minor' && s.tonic === scale.tonic && cadenceKey(s) === cadenceKey(scale))
            : undefined
        if (twin && scale.minorForm) {
            twin.minorForms.push(scale.minorForm)
        } else {
            result.push({ ...scale, minorForms: scale.minorForm ? [scale.minorForm] : [] })
        }
    }
    return result
}
