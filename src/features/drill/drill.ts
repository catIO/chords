import {
    chromaticChord,
    diatonicChord,
    type Chord,
    type ChordQuality,
    type ChromaticChord,
    type MinorForm,
    type ScaleType,
} from '../../music/theory'
import type { KeyChoice } from './keys'

export type Weighting = 'common' | 'uniform'
export type ChordType = 'triads' | 'sevenths' | 'chromatic'

export interface Vocabulary {
    /** Scale degrees (0 = tonic) practised as triads */
    triadDegrees: number[]
    triadInversions: number[]
    seventhDegrees: number[]
    seventhInversions: number[]
    chromatic: ChromaticChord[]
}

/** Seventh chords are ii7, V7 and vii7: the ones that recur in classical guitar repertoire. */
export function buildVocabulary(chordTypes: ChordType[], inversions: number[]): Vocabulary {
    return {
        triadDegrees: chordTypes.includes('triads') ? [0, 1, 2, 3, 4, 5, 6] : [],
        triadInversions: inversions.filter((i) => i <= 2),
        seventhDegrees: chordTypes.includes('sevenths') ? [1, 4, 6] : [],
        seventhInversions: inversions,
        chromatic: chordTypes.includes('chromatic') ? ['V7/V', 'N6'] : [],
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
        const scaleTypes: ScaleType[] = key.mode === 'major' ? ['major'] : minorForms
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
