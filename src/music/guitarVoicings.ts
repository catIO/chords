import { parsePitchSpelling } from './noteUtils'
import { pitchClass, type Chord } from './theory'

export interface GuitarVoicing {
    /** Written pitches (guitar sounds an octave lower), low to high */
    notes: string[]
    /** Left-hand finger per note: '0' = open string */
    fingerings: string[]
}

interface Placement {
    stringIdx: number
    fret: number
    midi: number
    tone: string
}

// Written MIDI pitch of open strings, index 0 = 6th string
const OPEN_STRINGS = [52, 57, 62, 67, 71, 76]
const MAX_FRET = 12
const MAX_SPAN = 3
const BASS_STRINGS = [0, 1, 2]
// Three adjacent treble strings played by i-m-a above the thumb's bass note
const UPPER_STRING_SETS = [
    [2, 3, 4],
    [3, 4, 5],
]

function placementsOnString(stringIdx: number, tones: string[]): Placement[] {
    const result: Placement[] = []
    for (let fret = 0; fret <= MAX_FRET; fret++) {
        const midi = OPEN_STRINGS[stringIdx] + fret
        const tone = tones.find((t) => pitchClass(t) === midi % 12)
        if (tone) result.push({ stringIdx, fret, midi, tone })
    }
    return result
}

function spell(placement: Placement): string {
    const { semitone } = parsePitchSpelling(placement.tone)
    const octave = (placement.midi - semitone) / 12 - 1
    return `${placement.tone}${octave}`
}

/** Returns a finger per placement (0 = open), or null if the shape needs more than four fingers. */
function assignFingerings(placements: Placement[]): number[] | null {
    const fingers = placements.map(() => 0)
    const fretted = placements.map((p, i) => ({ ...p, i })).filter((p) => p.fret > 0)
    if (fretted.length === 0) return fingers

    // First position: one finger per fret
    const frettedFrets = fretted.map((p) => p.fret)
    if (Math.max(...frettedFrets) <= 4 && new Set(frettedFrets).size === frettedFrets.length) {
        return placements.map((p) => p.fret)
    }

    const minFret = Math.min(...fretted.map((p) => p.fret))
    const lowestString = Math.min(...fretted.map((p) => p.stringIdx))
    const highestString = Math.max(...fretted.map((p) => p.stringIdx))
    const atMin = fretted.filter((p) => p.fret === minFret)
    const isBarre =
        atMin.length >= 3 ||
        (atMin.length === 2 &&
            highestString - lowestString >= 3 &&
            atMin.some((p) => p.stringIdx === lowestString) &&
            atMin.some((p) => p.stringIdx === highestString))

    let nextFinger = 1
    let remaining = fretted
    if (isBarre) {
        atMin.forEach((p) => (fingers[p.i] = 1))
        nextFinger = 2
        remaining = fretted.filter((p) => p.fret !== minFret)
    }

    const frets = [...new Set(remaining.map((p) => p.fret))].sort((a, b) => a - b)
    for (const fret of frets) {
        const group = remaining.filter((p) => p.fret === fret).sort((a, b) => a.stringIdx - b.stringIdx)
        const naturalFinger = fret - minFret + 1
        if (group.length >= 3) {
            const finger = Math.max(nextFinger, naturalFinger)
            group.forEach((p) => (fingers[p.i] = finger))
            nextFinger = finger + 1
        } else {
            for (const p of group) {
                const finger = Math.max(nextFinger, naturalFinger)
                fingers[p.i] = finger
                nextFinger = finger + 1
            }
        }
    }

    return fingers.every((f) => f <= 4) ? fingers : null
}

function scoreVoicing(placements: Placement[], chord: Chord, bassMidi?: number): number {
    const frets = placements.filter((p) => p.fret > 0).map((p) => p.fret)
    const minFret = frets.length ? Math.min(...frets) : 0
    const span = frets.length ? Math.max(...frets) - minFret : 0
    const count = (tone: string) => placements.filter((p) => p.tone === tone).length

    let score = minFret + span * 0.6 + (span === MAX_SPAN ? 1 : 0) + frets.length * 0.4 + placements[0].stringIdx * 0.3
    // Large enough that an octave off always loses to the requested bass when one is playable
    if (bassMidi !== undefined) score += Math.abs(placements[0].midi - bassMidi) * 5
    // Avoid doubling a major third (often the leading tone); doubling the bass of N6 is standard
    const majorThird = ['major', 'augmented', 'dominant7'].includes(chord.quality) && chord.romanNumeral !== 'N6'
    if (majorThird && count(chord.tones[1]) > 1) score += 6
    if (chord.tones.length === 4) {
        if (count(chord.tones[3]) > 1) score += 10
        if (count(chord.tones[2]) === 0) score += 2
    }
    return score
}

/** Finds the easiest four-note, thumb-plus-three-fingers voicing in standard tuning. */
export function generateVoicing(chord: Chord, bassMidi?: number): GuitarVoicing | null {
    // The fifth of a seventh chord may be omitted
    const required = chord.tones.filter((_, i) => !(chord.tones.length === 4 && i === 2))
    let best: { placements: Placement[]; fingers: number[]; score: number } | null = null

    for (const bassIdx of BASS_STRINGS) {
        const bassOptions = placementsOnString(bassIdx, [chord.bass])
        for (const upperSet of UPPER_STRING_SETS) {
            if (upperSet[0] <= bassIdx) continue
            const [aOptions, bOptions, cOptions] = upperSet.map((s) => placementsOnString(s, chord.tones))
            for (const bass of bassOptions) {
                for (const a of aOptions) {
                    if (a.midi <= bass.midi) continue
                    for (const b of bOptions) {
                        if (b.midi <= a.midi) continue
                        for (const c of cOptions) {
                            if (c.midi <= b.midi) continue
                            const placements = [bass, a, b, c]
                            const frets = placements.filter((p) => p.fret > 0).map((p) => p.fret)
                            if (frets.length && Math.max(...frets) - Math.min(...frets) > MAX_SPAN) continue
                            if (!required.every((tone) => placements.some((p) => p.tone === tone))) continue
                            const fingers = assignFingerings(placements)
                            if (!fingers) continue
                            const score = scoreVoicing(placements, chord, bassMidi)
                            if (!best || score < best.score) best = { placements, fingers, score }
                        }
                    }
                }
            }
        }
    }

    if (!best) return null
    return {
        notes: best.placements.map(spell),
        fingerings: best.fingers.map(String),
    }
}

const cache = new Map<string, GuitarVoicing | null>()

export function voiceChord(chord: Chord, options?: { bassMidi?: number }): GuitarVoicing | null {
    const bassMidi = options?.bassMidi
    const cacheKey = `${chord.tones.join(' ')}/${chord.bass}/${bassMidi ?? ''}`
    if (!cache.has(cacheKey)) {
        cache.set(cacheKey, generateVoicing(chord, bassMidi))
    }
    return cache.get(cacheKey) ?? null
}

/** Voices chords so the bass rises stepwise from the lowest playable tonic, e.g. the chords of a scale. */
export function voiceWithRisingBass(chords: Chord[]): (GuitarVoicing | null)[] {
    let previousBass = OPEN_STRINGS[0] - 1
    return chords.map((chord) => {
        let bassMidi = previousBass + 1
        while (bassMidi % 12 !== pitchClass(chord.bass)) bassMidi++
        previousBass = bassMidi
        return voiceChord(chord, { bassMidi })
    })
}
