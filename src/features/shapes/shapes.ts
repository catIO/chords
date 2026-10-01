import { gradeDisplayName } from '../../data/curriculum'
import { locateVoicing, voiceChord, type GuitarVoicing } from '../../music/guitarVoicings'
import { chordDescription, chordName, identifyChord, type Chord } from '../../music/theory'
import type { ChordEvent, Curriculum } from '../../types/curriculum'
import { buildChordPool, buildVocabulary, pickChord } from '../drill/drill'
import { curriculumKeys, keyId } from '../drill/keys'

export type ShapeFamily =
    | 'line'
    | 'diagonal'
    | 'reverseDiagonal'
    | 'triangle'
    | 'parallelogram'
    | 'box'
    | 'staircase'
    | 'cluster'
    | 'fan'
    | 'stretch'
    | 'barre'
    | 'partialBarre'

export type ShapeChordType = 'triads' | 'sevenths'

export const SHAPE_FAMILIES: { value: ShapeFamily; label: string; description: string }[] = [
    { value: 'line', label: 'Line', description: 'Two or more fingers side by side on the same fret.' },
    { value: 'diagonal', label: 'Diagonal', description: 'The fingers move up the neck as they cross toward the treble strings.' },
    { value: 'reverseDiagonal', label: 'Reverse diagonal', description: 'The fingers move down the neck as they cross toward the treble strings.' },
    { value: 'triangle', label: 'Triangle', description: 'Three fingers on two neighbouring frets: a pair on one fret, a single finger on the other.' },
    { value: 'parallelogram', label: 'Parallelogram', description: 'Four fingers on two neighbouring frets, alternating fret from string to string so the hand slants.' },
    { value: 'box', label: 'Box', description: 'Four fingers on two neighbouring frets, grouped in pairs rather than alternating: a compact block.' },
    { value: 'staircase', label: 'Staircase', description: 'Three or more fingers on neighbouring strings, each one fret further along.' },
    { value: 'cluster', label: 'Cluster', description: 'Fingers packed onto neighbouring strings in a compact, irregular group.' },
    { value: 'fan', label: 'Fan', description: 'Fingers spread across the neck with strings skipped between them.' },
    { value: 'stretch', label: 'Stretch', description: 'Two fingers are further apart than one finger per fret, so the hand opens up.' },
    { value: 'barre', label: 'Barre', description: 'One finger lies flat across four or more strings.' },
    { value: 'partialBarre', label: 'Partial barre', description: 'One finger lies flat across two or three strings.' },
]

export interface FrettedNote {
    /** 0 = 6th (low E) string */
    string: number
    fret: number
    finger: number
}

/** Fretted (non-open) notes of a voicing, low string first. */
export function frettedNotes(voicing: GuitarVoicing): FrettedNote[] {
    return voicing.fingerings
        .map((finger, i) => ({ string: voicing.strings[i], fret: voicing.frets[i], finger: Number(finger) }))
        .filter((note) => note.finger > 0)
        .sort((a, b) => a.string - b.string)
}

const span = (values: number[]) => Math.max(...values) - Math.min(...values)

/** Groups a left-hand shape by its finger geometry alone; open strings and pitches play no part. */
export function classifyShape(notes: FrettedNote[]): ShapeFamily | null {
    if (notes.length < 2) return null

    const barre = notes.filter((n) => notes.some((m) => m !== n && m.finger === n.finger))
    if (barre.length > 0) return span(barre.map((n) => n.string)) >= 3 ? 'barre' : 'partialBarre'

    for (const a of notes) {
        for (const b of notes) {
            if (a.finger < b.finger && b.fret - a.fret > b.finger - a.finger) return 'stretch'
        }
    }

    const rows = new Map<number, number[]>()
    for (const n of notes) rows.set(n.fret, [...(rows.get(n.fret) ?? []), n.string])
    if (rows.size === 1) return 'line'

    const fretSteps = notes.slice(1).map((n, i) => n.fret - notes[i].fret)
    const stringSteps = notes.slice(1).map((n, i) => n.string - notes[i].string)
    const rising = fretSteps.every((s) => s > 0)
    const falling = fretSteps.every((s) => s < 0)
    if (
        (rising || falling) &&
        notes.length >= 3 &&
        fretSteps.every((s) => Math.abs(s) === 1) &&
        stringSteps.every((s) => s === 1)
    ) {
        return 'staircase'
    }
    if (rising) return 'diagonal'
    if (falling) return 'reverseDiagonal'

    const rowSizes = [...rows.values()].map((r) => r.length).sort((a, b) => b - a)
    const stringSpan = span(notes.map((n) => n.string))
    const fretSpan = span(notes.map((n) => n.fret))
    if (notes.length === 3 && rowSizes[0] === 2 && fretSpan === 1 && stringSpan <= 3) return 'triangle'
    if (notes.length === 4 && rowSizes[0] === 2 && rowSizes[1] === 2) {
        const [lower, upper] = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, strings]) => strings)
        const alternates = (a: number[], b: number[]) => a[0] < b[0] && b[0] < a[1] && a[1] < b[1]
        return alternates(lower, upper) || alternates(upper, lower) ? 'parallelogram' : 'box'
    }
    if (rows.size >= 3 && fretSteps.every((s) => s >= 0)) return 'diagonal'
    if (rows.size >= 3 && fretSteps.every((s) => s <= 0)) return 'reverseDiagonal'
    // A span of at least one string per finger means strings are skipped
    return stringSpan >= notes.length ? 'fan' : 'cluster'
}

/** The same signature anywhere on the neck is the same hand shape. */
export function shapeSignature(notes: FrettedNote[]): string {
    const lowString = Math.min(...notes.map((n) => n.string))
    const lowFret = Math.min(...notes.map((n) => n.fret))
    return notes.map((n) => `${n.string - lowString}.${n.fret - lowFret}.${n.finger}`).join(' ')
}

/** Words for the geometry, e.g. "Relative frets 1-2-1 on adjacent strings". */
export function shapeLayout(notes: FrettedNote[]): string {
    const lowFret = Math.min(...notes.map((n) => n.fret))
    const frets = notes.map((n) => n.fret - lowFret + 1).join('-')
    const skipped = span(notes.map((n) => n.string)) + 1 - new Set(notes.map((n) => n.string)).size
    const strings =
        skipped === 0 ? 'on adjacent strings' : `skipping ${skipped} ${skipped === 1 ? 'string' : 'strings'}`
    return `Relative frets ${frets} ${strings}`
}

export interface ShapeExample {
    id: string
    chord: Chord
    name: string
    description: string
    chordType: ShapeChordType
    /** Ready for the notation renderer: written notes with left-hand fingers */
    event: ChordEvent
    family: ShapeFamily
    signature: string
    /** Fingers of the fretted notes from the lowest string up, e.g. "2–3–1–4" */
    fingerPattern: string
    layout: string
    fretRange: [number, number]
    /** Guitar string numbers (6 = low E), lowest string first */
    stringRange: [number, number]
    /** RCM level the voicing is printed in, if any */
    source: string | null
    weight: number
}

const toGuitarString = (stringIdx: number) => 6 - stringIdx

function toExample(voicing: GuitarVoicing, chord: Chord, source: string | null): ShapeExample | null {
    const notes = frettedNotes(voicing)
    const family = classifyShape(notes)
    if (!family) return null
    // Keyed by placement, so enharmonic spellings of the same fingering (e.g. C♯°7 and A♯°7) appear once
    const id = voicing.strings.map((s, i) => `${s}:${voicing.frets[i]}:${voicing.fingerings[i]}`).join(' ')
    const frets = notes.map((n) => n.fret)
    return {
        id,
        chord,
        name: chordName(chord),
        description: chordDescription(chord),
        chordType: chord.tones.length === 4 ? 'sevenths' : 'triads',
        event: {
            id,
            romanNumeral: chord.romanNumeral,
            symbol: chord.symbol,
            notes: voicing.notes,
            fingerings: voicing.fingerings,
            durationBeats: 4,
            beatUnit: 4,
        },
        family,
        signature: shapeSignature(notes),
        fingerPattern: notes.map((n) => n.finger).join('–'),
        layout: shapeLayout(notes),
        fretRange: [Math.min(...frets), Math.max(...frets)],
        stringRange: [toGuitarString(notes[0].string), toGuitarString(notes[notes.length - 1].string)],
        source,
        weight: source ? 2 : 1,
    }
}

/** Keys most of the classical guitar repertoire is written in. */
const REPERTOIRE_KEYS = new Set([
    ...['C', 'G', 'D', 'A', 'E', 'F'].map((tonic) => keyId(tonic, 'major')),
    ...['A', 'E', 'D', 'B', 'G'].map((tonic) => keyId(tonic, 'minor')),
])

/** Diatonic chords, by Roman numeral in their key, that recur in classical guitar repertoire. */
const REPERTOIRE_CHORDS = new Set([
    ...['I', 'i', 'IV', 'iv'].flatMap((n) => [n, `${n}6`, `${n}6/4`]),
    'V', 'V6', 'V6/4', 'V7', 'V6/5', 'V4/3', 'V4/2',
    'ii', 'ii6', 'ii°6', 'ii7', 'ii6/5', 'iiø7', 'iiø6/5',
    'vi', 'vi6', 'VI', 'VI6', 'III', 'VII',
    'vii°6', 'vii°7', 'vii°6/5', 'vii°4/3', 'vii°4/2', 'viiø7',
])

/** RCM book voicings first, then common diatonic chords in common guitar keys, sorted into shape families. */
export function buildShapeExamples(curriculum: Curriculum): ShapeExample[] {
    const examples = new Map<string, ShapeExample>()
    const add = (voicing: GuitarVoicing | null, chord: Chord | null, source: string | null) => {
        if (!voicing || !chord) return
        const example = toExample(voicing, chord, source)
        if (example && !examples.has(example.id)) examples.set(example.id, example)
    }

    for (const [grade, scales] of Object.entries(curriculum.grades)) {
        for (const scale of scales) {
            for (const event of scale.sequence) {
                if (!event.fingerings) continue
                add(locateVoicing(event.notes, event.fingerings), identifyChord(event.notes), gradeDisplayName(grade))
            }
        }
    }

    const pool = buildChordPool({
        keys: curriculumKeys(curriculum).filter((k) => REPERTOIRE_KEYS.has(k.id)),
        minorForms: ['natural', 'harmonic'],
        vocabulary: buildVocabulary(['triads', 'sevenths'], [0, 1, 2, 3]),
        weighting: 'uniform',
    })
    for (const { chord } of pool) {
        if (REPERTOIRE_CHORDS.has(chord.romanNumeral)) add(voiceChord(chord), chord, null)
    }

    return [...examples.values()]
}

export interface ShapeGroup {
    signature: string
    fingerPattern: string
    layout: string
    examples: ShapeExample[]
}

/** One group per hand shape, largest first; each group's chords run up the neck. */
export function groupBySignature(examples: ShapeExample[]): ShapeGroup[] {
    const groups = new Map<string, ShapeExample[]>()
    for (const e of examples) groups.set(e.signature, [...(groups.get(e.signature) ?? []), e])
    return [...groups.entries()]
        .map(([signature, items]) => ({
            signature,
            fingerPattern: items[0].fingerPattern,
            layout: items[0].layout,
            examples: [...items].sort(
                (a, b) => a.fretRange[0] - b.fretRange[0] || b.stringRange[0] - a.stringRange[0] || a.name.localeCompare(b.name),
            ),
        }))
        .sort((a, b) => b.examples.length - a.examples.length || a.signature.localeCompare(b.signature))
}

/** Small seeded PRNG so an exercise is stable across re-renders. */
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Up to `size` chords for one exercise: one hand shape moved to different chords where possible,
 * topped up from the rest of the family.
 */
export function buildExercise(
    examples: ShapeExample[],
    random: () => number,
    previousSignature: string | null = null,
    size = 4,
): ShapeExample[] {
    const groups = groupBySignature(examples).map((g) => ({ ...g, id: g.signature, weight: Math.min(g.examples.length, size) }))
    const group = pickChord(groups, previousSignature, random)
    if (!group) return []

    const take = (pool: ShapeExample[], count: number) => {
        const chosen: ShapeExample[] = []
        let remaining = pool
        while (chosen.length < count && remaining.length > 0) {
            const pick = pickChord(remaining, null, random)!
            chosen.push(pick)
            remaining = remaining.filter((e) => e.id !== pick.id)
        }
        return chosen
    }

    const fromShape = take(group.examples, size).sort((a, b) => a.fretRange[0] - b.fretRange[0])
    const others = examples.filter((e) => e.signature !== group.signature)
    return [...fromShape, ...take(others, size - fromShape.length)]
}
