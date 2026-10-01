export interface CadenceDescription {
    name: string
    /** The two closing chords, e.g. "V–I" */
    numerals: string
    description: string
}

type CadenceType = 'perfect' | 'plagal' | 'imperfect' | 'interrupted'

const CADENCES: Record<CadenceType, { name: string; description: string }> = {
    perfect: { name: 'Perfect cadence', description: 'The dominant resolves to the tonic: the strongest, most final-sounding close.' },
    plagal: { name: 'Plagal cadence', description: 'The subdominant moves to the tonic: a softer close, the "Amen" ending.' },
    imperfect: { name: 'Imperfect cadence', description: 'The phrase stops on the dominant, so it sounds unfinished.' },
    interrupted: { name: 'Interrupted cadence', description: 'The dominant moves to vi instead of the tonic, dodging the expected close.' },
}

const degreeOf = (numeral: string) => numeral.match(/^[iv]+/i)?.[0].toUpperCase() ?? ''
// 5/3 and 8 only mark voice motion over the same dominant, so they are left out of the name.
const plainNumeral = (numeral: string) => numeral.replace(/(5\/3|8)$/, '')

/** Names the cadence formed by the last two chords of a progression. */
export function describeCadence(romanNumerals: string[]): CadenceDescription | null {
    if (romanNumerals.length < 2) return null
    const penultimate = romanNumerals[romanNumerals.length - 2]
    const final = romanNumerals[romanNumerals.length - 1]
    const [from, to] = [degreeOf(penultimate), degreeOf(final)]

    const type: CadenceType | null =
        to === 'V' ? 'imperfect'
            : from === 'V' && to === 'I' ? 'perfect'
                : from === 'IV' && to === 'I' ? 'plagal'
                    : from === 'V' && to === 'VI' ? 'interrupted'
                        : null
    if (!type) return null

    const hasCadential64 = romanNumerals.includes('V6/4')
    return {
        name: CADENCES[type].name + (hasCadential64 ? ' with cadential 6/4' : ''),
        numerals: `${plainNumeral(penultimate)}–${plainNumeral(final)}`,
        description: CADENCES[type].description,
    }
}
