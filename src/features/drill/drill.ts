import {
    chromaticChord,
    diatonicChord,
    diatonicCloseNotes,
    type Chord,
    type ChordQuality,
    type ChromaticChord,
    type MinorForm,
    type ScaleType,
} from '../../music/theory'
import type { KeyChoice } from './keys'

export type Weighting = 'common' | 'uniform'
export type ChordType = 'triads' | 'sevenths' | 'chromatic'
export type ChordFocus = 'cadence' | 'tonic' | 'all'
export type DisplayMode = 'sequence' | 'flashcard'

export interface ChordOptions {
    /** Chord types the current display format and focus can use */
    allowedTypes: ChordType[]
    chordTypes: ChordType[]
    inversions: number[]
    maxInversion: number
    singleChoice: boolean
}

/** Chord types and inversions the display format and focus can use; stored selections are kept for other modes. */
export function resolveChordOptions(
    displayMode: DisplayMode,
    focus: ChordFocus,
    chordTypes: ChordType[],
    inversions: number[],
): ChordOptions {
    const isSequence = displayMode === 'sequence'
    const allowedTypes: ChordType[] =
        focus === 'tonic'
            ? ['triads']
            : focus === 'all' && !isSequence
                ? ['triads', 'sevenths', 'chromatic']
                : ['triads', 'sevenths']
    const singleChoice = isSequence && focus !== 'tonic'

    let types = chordTypes.filter((t) => allowedTypes.includes(t))
    if (types.length === 0) types = ['triads']
    if (singleChoice) types = [types.includes('triads') ? 'triads' : 'sevenths']

    // A cadence sequence keeps its tonic chords as triads, which have no 3rd inversion.
    const hasSeventhInversion = types.includes('sevenths') && !(isSequence && focus === 'cadence')
    const maxInversion = hasSeventhInversion ? 3 : 2
    let invs = [...new Set(inversions)].filter((i) => i <= maxInversion).sort((a, b) => a - b)
    if (invs.length === 0) invs = [0]
    if (singleChoice) invs = [invs[0]]

    return { allowedTypes, chordTypes: types, inversions: invs, maxInversion, singleChoice }
}

export interface Vocabulary {
    focus?: ChordFocus
    /** Scale degrees (0 = tonic) practised as triads */
    triadDegrees: number[]
    triadInversions: number[]
    seventhDegrees: number[]
    seventhInversions: number[]
    chromatic: ChromaticChord[]
}

/** Builds vocabulary tailored to scale practice: cadence chords (I, V), tonic only (I), or all degrees */
export function buildVocabulary(
    chordTypes: ChordType[],
    inversions: number[],
    focus: ChordFocus = 'all',
): Vocabulary {
    let triadDegrees: number[] = []
    let seventhDegrees: number[] = []

    if (chordTypes.includes('triads')) {
        if (focus === 'tonic') {
            triadDegrees = [0] // I / i
        } else if (focus === 'cadence') {
            triadDegrees = [0, 4] // I, V / i, V
        } else {
            triadDegrees = [0, 1, 2, 3, 4, 5, 6]
        }
    }

    let triadInversions = inversions.filter((i) => i <= 2)
    // A cadence needs its tonic even when only 7th chords are chosen (I–V7–I)
    if (focus === 'cadence' && !chordTypes.includes('triads') && chordTypes.includes('sevenths')) {
        triadDegrees = [0]
        if (triadInversions.length === 0) triadInversions = [0]
    }

    if (chordTypes.includes('sevenths')) {
        if (focus === 'tonic') {
            seventhDegrees = []
        } else if (focus === 'cadence') {
            seventhDegrees = [4] // V7
        } else {
            seventhDegrees = [1, 4, 6] // ii7, V7, vii7
        }
    }

    return {
        focus,
        triadDegrees,
        triadInversions,
        seventhDegrees,
        seventhInversions: inversions,
        chromatic: chordTypes.includes('chromatic') && focus === 'all' ? ['V7/V', 'N6'] : [],
    }
}

export interface DrillEntry {
    id: string
    key: KeyChoice
    /** Minor forms that contain this chord; empty for major keys and chromatic chords */
    forms: MinorForm[]
    chord: Chord
    weight: number
}

// Relative frequency in classical guitar repertoire: I ii iii IV V vi vii
const TRIAD_WEIGHT = [6, 3, 1, 4, 6, 3, 1]
const TRIAD_INVERSION_WEIGHT = [1, 0.5, 0.25]
const SEVENTH_WEIGHT: Record<number, number> = { 1: 2, 4: 5, 6: 1.5 }
const SEVENTH_INVERSION_WEIGHT = [1, 0.4, 0.3, 0.4]
const CHROMATIC_WEIGHT = 1.5

function triadWeight(degree: number, inversion: number, quality: ChordQuality): number {
    if (degree === 0 && inversion === 2) return 3 // cadential 6/4
    let weight = TRIAD_WEIGHT[degree]
    if (quality === 'major' && (degree === 2 || degree === 6)) weight = 3 // natural-minor III and VII
    if (quality === 'minor' && degree === 4) weight = 2 // natural-minor v
    if (quality === 'augmented') weight *= 0.2
    return weight * TRIAD_INVERSION_WEIGHT[inversion]
}

interface PoolOptions {
    keys: KeyChoice[]
    minorForms: MinorForm[]
    vocabulary: Vocabulary
    weighting: Weighting
}

export function buildChordPool({ keys, minorForms, vocabulary, weighting }: PoolOptions): DrillEntry[] {
    const entries = new Map<string, DrillEntry>()

    const add = (key: KeyChoice, chord: Chord, form: MinorForm | null, commonWeight: number) => {
        const weight = weighting === 'uniform' ? 1 : commonWeight
        const id = `${key.id}:${chord.romanNumeral}:${chord.symbol}`
        const existing = entries.get(id)
        if (existing) {
            if (form && !existing.forms.includes(form)) existing.forms.push(form)
            existing.weight = Math.max(existing.weight, weight)
            return
        }
        entries.set(id, { id, key, forms: form ? [form] : [], chord, weight })
    }

    for (const key of keys) {
        const scaleTypes: ScaleType[] =
            key.mode === 'major'
                ? ['major']
                : vocabulary.focus === 'cadence'
                    ? ['harmonic']
                    : minorForms
        for (const scaleType of scaleTypes) {
            const form = scaleType === 'major' ? null : scaleType
            for (const degree of vocabulary.triadDegrees) {
                for (const inversion of vocabulary.triadInversions) {
                    const chord = diatonicChord(key.tonic, scaleType, degree, { inversion })
                    add(key, chord, form, triadWeight(degree, inversion, chord.quality))
                }
            }
            for (const degree of vocabulary.seventhDegrees) {
                for (const inversion of vocabulary.seventhInversions) {
                    const chord = diatonicChord(key.tonic, scaleType, degree, { seventh: true, inversion })
                    add(key, chord, form, SEVENTH_WEIGHT[degree] * SEVENTH_INVERSION_WEIGHT[inversion])
                }
            }
        }
        for (const kind of vocabulary.chromatic) {
            add(key, chromaticChord(key.tonic, kind), null, CHROMATIC_WEIGHT)
        }
    }

    return [...entries.values()]
}

/** Weighted random pick that never repeats `previousId` when there is an alternative. */
export function pickChord(pool: DrillEntry[], previousId: string | null, random: () => number = Math.random): DrillEntry | null {
    const candidates = pool.length > 1 ? pool.filter((e) => e.id !== previousId) : pool
    if (candidates.length === 0) return null

    const total = candidates.reduce((sum, e) => sum + e.weight, 0)
    let remaining = random() * total
    for (const entry of candidates) {
        remaining -= entry.weight
        if (remaining < 0) return entry
    }
    return candidates[candidates.length - 1]
}

export interface ScaleChordItem {
    id: string
    romanNumeral: string
    symbol: string
    chord: Chord
    label: string
    notes: string[]
}

/** Builds an ordered sequence of chords for the given scale (cadence, tonic inversions, or all degrees). */
export function buildScaleSequence(
    key: KeyChoice,
    focus: ChordFocus,
    minorForms: MinorForm[],
    inversions: number[],
    chordTypes: ChordType[],
): ScaleChordItem[] {
    const isCadence = focus === 'cadence'
    const minorForm: MinorForm = isCadence ? 'harmonic' : (minorForms[0] ?? 'harmonic')
    const scaleType: ScaleType = key.mode === 'major' ? 'major' : minorForm
    const primaryInversion = inversions[0] ?? 0

    if (focus === 'tonic') {
        const triadInvs = inversions.filter((i) => i <= 2)
        const invsToUse = triadInvs.length > 0 ? triadInvs : [0]
        return invsToUse.map((inv) => {
            const chord = diatonicChord(key.tonic, scaleType, 0, { inversion: inv })
            const invLabel = inv === 0 ? 'Root' : inv === 1 ? '1st inv.' : '2nd inv.'
            const notes = diatonicCloseNotes(key.tonic, scaleType, 0, { inversion: inv })
            return {
                id: `${key.id}:tonic:${inv}`,
                romanNumeral: chord.romanNumeral,
                symbol: chord.symbol,
                chord,
                label: `${chord.romanNumeral} (${invLabel})`,
                notes,
            }
        })
    }

    if (focus === 'cadence') {
        const useSeventhDominant = chordTypes.includes('sevenths') && !chordTypes.includes('triads')
        const cadenceSteps: { degree: number; seventh?: boolean }[] = [
            { degree: 0 },
            { degree: 4, seventh: useSeventhDominant },
            { degree: 0 },
        ]

        return cadenceSteps.map((step, idx) => {
            const chord = diatonicChord(key.tonic, scaleType, step.degree, {
                seventh: step.seventh,
                inversion: primaryInversion,
            })
            const notes = diatonicCloseNotes(key.tonic, scaleType, step.degree, {
                seventh: step.seventh,
                inversion: primaryInversion,
            })
            return {
                id: `${key.id}:cadence:${idx}:${step.degree}`,
                romanNumeral: chord.romanNumeral,
                symbol: chord.symbol,
                chord,
                label: chord.romanNumeral,
                notes,
            }
        })
    }

    // focus === 'all': all 7 scale degrees I through vii°
    const useSevenths = chordTypes.includes('sevenths') && !chordTypes.includes('triads')
    return [0, 1, 2, 3, 4, 5, 6].map((degree) => {
        const chord = diatonicChord(key.tonic, scaleType, degree, {
            seventh: useSevenths,
            inversion: primaryInversion,
        })
        const notes = diatonicCloseNotes(key.tonic, scaleType, degree, {
            seventh: useSevenths,
            inversion: primaryInversion,
        })
        return {
            id: `${key.id}:degree:${degree}`,
            romanNumeral: chord.romanNumeral,
            symbol: chord.symbol,
            chord,
            label: `${chord.romanNumeral} · ${chord.symbol}`,
            notes,
        }
    })
}

