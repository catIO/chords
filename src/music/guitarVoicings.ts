import { parsePitchSpelling } from './noteUtils'
import { pitchClass, type Chord } from './theory'

export interface GuitarVoicing {
    /** Written pitches (guitar sounds an octave lower), low to high */
    notes: string[]
    /** Left-hand finger per note: '0' = open string */
    fingerings: string[]
    /** String per note, 0 = 6th (low E) string */
    strings: number[]
    frets: number[]
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

    const idiom = alternatingGrip(fretted)
    if (idiom) {
        fretted.forEach((p, k) => (fingers[p.i] = idiom[k]))
        return fingers
    }

    let best: { choice: number[]; cost: number } | null = null
    const choice: number[] = []
    const search = (k: number) => {
        if (k === fretted.length) {
            const cost = fingeringCost(fretted, choice, placements)
            if (cost !== null && (!best || cost < best.cost)) best = { choice: [...choice], cost }
            return
        }
        for (let finger = 1; finger <= 4; finger++) {
            choice[k] = finger
            search(k + 1)
        }
    }
    search(0)

    const found = best as { choice: number[] } | null
    if (!found) return null
    fretted.forEach((p, k) => (fingers[p.i] = found.choice[k]))
    return fingers
}

/**
 * Four fingers on adjacent strings alternating low–high–low–high fret (e.g. a diminished seventh):
 * the classical fingering 2–3–1–4, which keeps the hand angled for the next shift.
 */
function alternatingGrip(fretted: Placement[]): number[] | null {
    if (fretted.length !== 4) return null
    const [a, b, c, d] = fretted
    const adjacent = fretted.every((p, i) => i === 0 || p.stringIdx === fretted[i - 1].stringIdx + 1)
    const alternating = a.fret === c.fret && b.fret === d.fret && b.fret === a.fret + 1
    return adjacent && alternating ? [2, 3, 1, 4] : null
}

/** Lower is easier; null when the fingers cannot form the shape. Placements are ordered low string to high. */
function fingeringCost(fretted: Placement[], fingers: number[], placements: Placement[]): number | null {
    const frets = fretted.map((p) => p.fret)
    const minFret = Math.min(...frets)
    // Open chords sit in first position: the index finger covers fret 1 even when nothing is played there
    const isOpenChord = Math.max(...frets) <= 4 && (minFret === 1 || placements.some((p) => p.fret === 0))
    const position = isOpenChord ? 1 : minFret
    let cost = 0

    for (let i = 0; i < fretted.length; i++) {
        for (let j = i + 1; j < fretted.length; j++) {
            if (fingers[i] === fingers[j]) {
                if (frets[i] !== frets[j]) return null
                continue
            }
            const [lo, hi] = fingers[i] < fingers[j] ? [i, j] : [j, i]
            const gap = frets[hi] - frets[lo]
            const fingerGap = fingers[hi] - fingers[lo]
            // A higher finger never sits behind a lower one, and stretches one fret at most
            if (gap < 0 || gap > fingerGap + 1) return null
            cost += Math.max(0, gap - fingerGap) * 2 + Math.max(0, fingerGap - gap - 1) * 0.5
            // On one fret the lower finger normally takes the lower string
            if (gap === 0 && fretted[hi].stringIdx < fretted[lo].stringIdx) cost += 0.5
        }
    }

    for (const finger of new Set(fingers)) {
        const barred = fretted.filter((_, k) => fingers[k] === finger)
        if (barred.length < 2) continue
        if (finger !== 1) return null
        const low = barred[0].stringIdx
        const high = barred[barred.length - 1].stringIdx
        // Every string sounded under the barre must be stopped at or above it
        if (placements.some((p) => p.stringIdx > low && p.stringIdx < high && p.fret < barred[0].fret)) return null
        // Flattening the index over two neighbouring strings is easy; a longer barre takes effort
        cost += barred.length === 2 && high - low === 1 ? 0.4 : 1.5
    }

    fretted.forEach((p, k) => (cost += Math.abs(p.fret - fingers[k] + 1 - position) * 0.5 + fingers[k] * 0.01))
    return cost
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
        strings: best.placements.map((p) => p.stringIdx),
        frets: best.placements.map((p) => p.fret),
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

const writtenMidi = (note: string) => {
    const { semitone, specifiedOctave } = parsePitchSpelling(note)
    return specifiedOctave === undefined ? null : (specifiedOctave + 1) * 12 + semitone
}

/** Finds the strings and frets of a written voicing (e.g. from the RCM book) from its notes and left-hand fingers. */
export function locateVoicing(notes: string[], fingerings: string[]): GuitarVoicing | null {
    const midis = notes.map(writtenMidi)
    const fingers = fingerings.map(Number)
    if (midis.some((m) => m === null) || fingers.length !== notes.length || fingers.some((f) => !(f >= 0 && f <= 4))) {
        return null
    }

    let best: { strings: number[]; frets: number[]; cost: number } | null = null
    const search = (i: number, strings: number[], frets: number[]) => {
        if (i === notes.length) {
            const cost = placementCost(strings, frets, fingers)
            if (cost !== null && (!best || cost < best.cost)) best = { strings, frets, cost }
            return
        }
        for (let s = 0; s < OPEN_STRINGS.length; s++) {
            if (strings.includes(s)) continue
            const fret = midis[i]! - OPEN_STRINGS[s]
            if (fret < 0 || fret > MAX_FRET + 3 || (fret === 0) !== (fingers[i] === 0)) continue
            search(i + 1, [...strings, s], [...frets, fret])
        }
    }
    search(0, [], [])

    const found = best as { strings: number[]; frets: number[] } | null
    return found ? { notes, fingerings, strings: found.strings, frets: found.frets } : null
}

/** Lower is more natural; null when the fingers cannot reach the frets. */
function placementCost(strings: number[], frets: number[], fingers: number[]): number | null {
    const fretted = fingers.map((finger, i) => ({ finger, fret: frets[i] })).filter((p) => p.finger > 0)
    let cost = 0
    for (const a of fretted) {
        for (const b of fretted) {
            if (a.finger === b.finger && a.fret !== b.fret) return null
            if (a.finger < b.finger) {
                const gap = b.fret - a.fret
                // A higher finger never sits behind a lower one, and may stretch one fret at most
                if (gap < 0 || gap > b.finger - a.finger + 1) return null
                cost += Math.abs(gap - (b.finger - a.finger)) * 0.5
            }
        }
    }
    const fretValues = fretted.map((p) => p.fret)
    if (fretValues.length) cost += (Math.max(...fretValues) - Math.min(...fretValues)) * 3 + Math.min(...fretValues) * 0.1
    // Notes are written low to high, so their strings normally rise too
    strings.forEach((s, i) => {
        if (i > 0 && s < strings[i - 1]) cost += 10
    })
    return cost
}
