import { locateVoicing } from '../../music/guitarVoicings'
import type { ChordEvent, Curriculum } from '../../types/curriculum'
import type { CadenceProgression } from './drill'
import type { KeyChoice } from './keys'

const PROGRESSIONS: Record<string, CadenceProgression> = {
    'V-I': 'basic',
    'I-IV-V-I': 'subdominant',
    'I-IV-V6/4-V5/3-I': 'cadential64',
    'I-VI-IV-V6/4-V8-V7-I': 'extended',
}

/** Which progression a curated cadence is, from its Roman numerals; null for a lone tonic chord or an unknown pattern. */
export function progressionOf(numerals: string[]): CadenceProgression | null {
    return PROGRESSIONS[numerals.map((n) => n.toUpperCase()).join('-')] ?? null
}

/**
 * Every distinct curated voicing of `progression` in `key`, exactly as written (notes, fingerings, rhythm).
 * `'tonic'` returns the lone tonic chords. Identical harmonic/melodic minor versions appear once.
 */
export function curatedCadences(
    curriculum: Curriculum,
    key: KeyChoice,
    progression: CadenceProgression | 'tonic',
): ChordEvent[][] {
    const versions = new Map<string, ChordEvent[]>()
    for (const scales of Object.values(curriculum.grades)) {
        for (const scale of scales) {
            if (scale.tonic !== key.tonic || scale.mode !== key.mode) continue
            const numerals = scale.sequence.map((e) => e.romanNumeral)
            const matches = progression === 'tonic' ? numerals.length === 1 : progressionOf(numerals) === progression
            if (!matches) continue
            const id = JSON.stringify(scale.sequence.map((e) => [e.notes, e.fingerings, e.durationBeats, e.beatUnit]))
            if (!versions.has(id)) versions.set(id, scale.sequence)
        }
    }
    return [...versions.values()]
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']

/** Left-hand position of one chord: open chords count as position I, otherwise the index finger's fret. */
export function chordPosition(event: ChordEvent, previous?: number): number | null {
    const voicing = locateVoicing(event.notes, event.fingerings ?? [], previous)
    if (!voicing) return null
    const fretted = voicing.frets
        .map((fret, i) => ({ fret, finger: Number(voicing.fingerings[i]) }))
        .filter((p) => p.finger > 0)
    if (fretted.length === 0) return 1
    if (voicing.frets.includes(0) && Math.max(...fretted.map((p) => p.fret)) <= 4) return 1
    // Anchor on the lowest finger used: where it sits tells where the index finger is
    const anchor = fretted.reduce((a, b) => (b.finger < a.finger ? b : a))
    return Math.max(1, anchor.fret - anchor.finger + 1)
}

/** e.g. "Position II" or "Position II → V" when the hand shifts during the cadence. */
export function positionLabel(events: ChordEvent[]): string | null {
    const positions: (number | null)[] = []
    for (const event of events) positions.push(chordPosition(event, positions.at(-1) ?? undefined))
    if (positions.some((p) => p === null)) return null
    const shifts = positions.filter((p, i) => i === 0 || p !== positions[i - 1]) as number[]
    return `Position ${shifts.map((p) => ROMAN[p] ?? String(p)).join(' → ')}`
}
