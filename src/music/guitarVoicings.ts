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
        // Another finger on the barre's own fret is wasted: the barre could cover that string
        cost += fretted.filter((p, k) => fingers[k] !== finger && p.fret === barred[0].fret).length * 1.2
    }

    fretted.forEach((p, k) => (cost += Math.abs(p.fret - fingers[k] + 1 - position) * 0.5 + fingers[k] * 0.01))
    return cost
}

function scoreVoicing(placements: Placement[], chord: Chord, bassMidi?: number, from?: GuitarVoicing): number {
    const frets = placements.filter((p) => p.fret > 0).map((p) => p.fret)
    const minFret = frets.length ? Math.min(...frets) : 0
    const span = frets.length ? Math.max(...frets) - minFret : 0
    const count = (tone: string) => placements.filter((p) => p.tone === tone).length

    let score = minFret + span * 0.6 + (span === MAX_SPAN ? 1 : 0) + frets.length * 0.4 + placements[0].stringIdx * 0.3
    // Large enough that an octave off always loses to the requested bass when one is playable
    if (bassMidi !== undefined) score += Math.abs(placements[0].midi - bassMidi) * 5
    if (from) {
        const midis = placements.map((p) => p.midi)
        score += voiceLeading(voicingMidis(from), handPosition(from.frets), midis, frets.length ? minFret : 0) * 1.5
    }
    // Avoid doubling a major third (often the leading tone); doubling the bass of N6 is standard
    const majorThird = ['major', 'augmented', 'dominant7'].includes(chord.quality) && chord.romanNumeral !== 'N6'
    if (majorThird && count(chord.tones[1]) > 1) score += 6
    // A diminished triad's root (usually the leading tone) and 5th both pull to resolve, so double its 3rd
    if (chord.quality === 'diminished') {
        if (count(chord.tones[0]) > 1) score += 6
        if (count(chord.tones[2]) > 1) score += 3
    }
    if (chord.tones.length === 4) {
        if (count(chord.tones[3]) > 1) score += 10
        if (count(chord.tones[2]) === 0) score += 2
    }
    return score
}

/** Finds the easiest four-note, thumb-plus-three-fingers voicing in standard tuning. */
export function generateVoicing(chord: Chord, bassMidi?: number, from?: GuitarVoicing): GuitarVoicing | null {
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
                            const score = scoreVoicing(placements, chord, bassMidi, from)
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

interface Candidate {
    placements: Placement[]
    fingers: number[]
    score: number
}

const toVoicing = ({ placements, fingers }: Candidate): GuitarVoicing => ({
    notes: placements.map(spell),
    fingerings: fingers.map(String),
    strings: placements.map((p) => p.stringIdx),
    frets: placements.map((p) => p.fret),
})

/** Every playable close-position triad: three notes stacked within an octave, one per string on neighbouring strings. */
function triadCandidates(chord: Chord, bassMidi?: number, from?: GuitarVoicing): Candidate[] {
    if (chord.tones.length !== 3) return []
    const stacked = [0, 1, 2].map((i) => chord.tones[(chord.inversion + i) % 3])
    const candidates: Candidate[] = []

    for (let lowString = 0; lowString <= OPEN_STRINGS.length - 3; lowString++) {
        const [lowOptions, midOptions, topOptions] = stacked.map((tone, i) => placementsOnString(lowString + i, [tone]))
        for (const low of lowOptions) {
            for (const mid of midOptions) {
                if (mid.midi <= low.midi) continue
                for (const top of topOptions) {
                    if (top.midi <= mid.midi || top.midi - low.midi >= 12) continue
                    const placements = [low, mid, top]
                    const frets = placements.filter((p) => p.fret > 0).map((p) => p.fret)
                    if (frets.length && Math.max(...frets) - Math.min(...frets) > MAX_SPAN) continue
                    const fingers = assignFingerings(placements)
                    if (!fingers) continue
                    candidates.push({ placements, fingers, score: scoreVoicing(placements, chord, bassMidi, from) })
                }
            }
        }
    }
    return candidates
}

/** A triad as written on paper: its three notes stacked in close position, one per string on three neighbouring strings. */
export function generateTriadVoicing(chord: Chord, bassMidi?: number, from?: GuitarVoicing): GuitarVoicing | null {
    const best = triadCandidates(chord, bassMidi, from).reduce<Candidate | null>((a, b) => (!a || b.score < a.score ? b : a), null)
    return best ? toVoicing(best) : null
}

/**
 * Three-note triads whose bass climbs one scale step at a time, choosing the starting octave and each chord's
 * string set so the hand moves as little as possible. When no exact line fits the neck, a chord may sit an
 * octave away. Null when even that fails.
 */
function voiceTriadsStepwise(chords: Chord[]): GuitarVoicing[] | null {
    return planTriadLine(chords, false) ?? planTriadLine(chords, true)
}

function planTriadLine(chords: Chord[], allowOctaveShift: boolean): GuitarVoicing[] | null {
    let best: { total: number; path: Candidate[] } | null = null
    const lowest = OPEN_STRINGS[0]
    for (let start = lowest; start < lowest + 24; start++) {
        if (start % 12 !== pitchClass(chords[0].bass)) continue
        let target = start
        const options = chords.map((chord, i) => {
            if (i > 0) {
                target++
                while (target % 12 !== pitchClass(chord.bass)) target++
            }
            const bass = target
            return triadCandidates(chord)
                .filter((c) => {
                    const offset = Math.abs(c.placements[0].midi - bass)
                    return offset === 0 || (allowOctaveShift && offset === 12)
                })
                .map((c) => (c.placements[0].midi === bass ? c : { ...c, score: c.score + 15 }))
        })
        if (options.some((o) => o.length === 0)) continue

        // Cheapest path through the options, paying for each shift of hand position or string set
        let layer = options[0].map((c) => ({ total: c.score, path: [c] }))
        for (const next of options.slice(1)) {
            layer = next.map((c) => {
                const position = handPosition(c.placements.map((p) => p.fret))
                const cheapest = layer
                    .map((prev) => {
                        const last = prev.path[prev.path.length - 1]
                        const shift = Math.abs(position - handPosition(last.placements.map((p) => p.fret)))
                        const stringMove = Math.abs(c.placements[0].stringIdx - last.placements[0].stringIdx)
                        return { prev, cost: prev.total + c.score + shift + stringMove * 0.5 }
                    })
                    .reduce((a, b) => (b.cost < a.cost ? b : a))
                return { total: cheapest.cost, path: [...cheapest.prev.path, c] }
            })
        }
        const done = layer.reduce((a, b) => (b.total < a.total ? b : a))
        if (!best || done.total < best.total) best = done
    }
    return best ? best.path.map(toVoicing) : null
}

const cache = new Map<string, GuitarVoicing | null>()

interface VoiceOptions {
    bassMidi?: number
    /** The previous chord, to voice-lead from it */
    from?: GuitarVoicing
    /** Play triads as three stacked notes rather than the four-note thumb-plus-three-fingers shape */
    threeNoteTriads?: boolean
}

export function voiceChord(chord: Chord, options: VoiceOptions = {}): GuitarVoicing | null {
    const { bassMidi, from, threeNoteTriads = false } = options
    const asTriad = threeNoteTriads && chord.tones.length === 3
    const cacheKey = `${chord.tones.join(' ')}/${chord.bass}/${bassMidi ?? ''}/${from ? `${from.notes.join(' ')}:${from.frets.join(' ')}` : ''}/${asTriad}`
    if (!cache.has(cacheKey)) {
        cache.set(cacheKey, asTriad ? generateTriadVoicing(chord, bassMidi, from) : generateVoicing(chord, bassMidi, from))
    }
    return cache.get(cacheKey) ?? null
}

const voicingMidis = (voicing: GuitarVoicing) => voicing.strings.map((s, i) => OPEN_STRINGS[s] + voicing.frets[i])

/** Lowest fretted fret, or 0 for an all-open chord. */
const handPosition = (frets: number[]) => {
    const fretted = frets.filter((f) => f > 0)
    return fretted.length ? Math.min(...fretted) : 0
}

/** Semitones the voices move (bass to bass, each upper note to its nearest previous note) plus frets the hand shifts. */
function voiceLeading(fromMidis: number[], fromPosition: number, toMidis: number[], toPosition: number): number {
    let distance = Math.abs(toMidis[0] - fromMidis[0]) + Math.abs(toPosition - fromPosition)
    for (const m of toMidis.slice(1)) distance += Math.min(...fromMidis.map((f) => Math.abs(m - f)))
    return distance
}

export function voiceLeadingDistance(from: GuitarVoicing, to: GuitarVoicing): number {
    return voiceLeading(voicingMidis(from), handPosition(from.frets), voicingMidis(to), handPosition(to.frets))
}

/** Carcassi's diminished-seventh grip on the top four strings, frets n, n+1, n, n+1, placed so the chord's bass is on the 4th string. */
export function voiceDiminishedGrip(chord: Chord): GuitarVoicing | null {
    if (chord.quality !== 'diminished7') return null
    const strings = [2, 3, 4, 5]
    let position = 1
    while ((OPEN_STRINGS[strings[0]] + position) % 12 !== pitchClass(chord.bass)) position++

    const placements: Placement[] = []
    for (const [i, stringIdx] of strings.entries()) {
        const fret = position + (i % 2)
        const midi = OPEN_STRINGS[stringIdx] + fret
        const tone = chord.tones.find((t) => pitchClass(t) === midi % 12)
        if (!tone) return null
        placements.push({ stringIdx, fret, midi, tone })
    }
    const fingers = assignFingerings(placements)
    if (!fingers) return null
    return {
        notes: placements.map(spell),
        fingerings: fingers.map(String),
        strings,
        frets: placements.map((p) => p.fret),
    }
}

/** Voices chords so the bass rises stepwise from the lowest playable tonic, e.g. the chords of a scale. */
export function voiceWithRisingBass(chords: Chord[], options: { threeNoteTriads?: boolean } = {}): (GuitarVoicing | null)[] {
    if (options.threeNoteTriads && chords.every((c) => c.tones.length === 3)) {
        const stepwise = voiceTriadsStepwise(chords)
        if (stepwise) return stepwise
    }
    let previousBass = OPEN_STRINGS[0] - 1
    return chords.map((chord) => {
        let bassMidi = previousBass + 1
        while (bassMidi % 12 !== pitchClass(chord.bass)) bassMidi++
        const voicing = voiceChord(chord, { bassMidi, threeNoteTriads: options.threeNoteTriads })
        // Continue from where the bass actually landed, in case the requested octave was out of reach
        previousBass = voicing ? OPEN_STRINGS[voicing.strings[0]] + voicing.frets[0] : bassMidi
        return voicing
    })
}

const writtenMidi = (note: string) => {
    const { semitone, specifiedOctave } = parsePitchSpelling(note)
    return specifiedOctave === undefined ? null : (specifiedOctave + 1) * 12 + semitone
}

/**
 * Finds the strings and frets of a written voicing from its notes and left-hand fingers.
 * `nearFret`: the previous chord's position, since a cadence stays in place unless the fingers force a shift.
 */
export function locateVoicing(notes: string[], fingerings: string[], nearFret?: number): GuitarVoicing | null {
    const midis = notes.map(writtenMidi)
    const fingers = fingerings.map(Number)
    if (midis.some((m) => m === null) || fingers.length !== notes.length || fingers.some((f) => !(f >= 0 && f <= 4))) {
        return null
    }

    let best: { strings: number[]; frets: number[]; cost: number } | null = null
    const search = (i: number, strings: number[], frets: number[]) => {
        if (i === notes.length) {
            const cost = placementCost(strings, frets, fingers)
            const shift = nearFret === undefined ? 0 : Math.abs(handPosition(frets.filter((_, k) => fingers[k] > 0)) - nearFret)
            if (cost !== null && (!best || cost + shift < best.cost)) best = { strings, frets, cost: cost + shift }
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
