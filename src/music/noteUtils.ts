const LETTER_TO_SEMITONE: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
}

export interface ParsedNote {
    letter: string
    accidental: string
    semitone: number
    specifiedOctave?: number
}

export interface VoicedNote extends ParsedNote {
    midi: number
    octave: number
    vexKey: string
}

export function parsePitchSpelling(note: string): ParsedNote {
    const match = /^([A-G])(#{1,2}|b{1,2})?(\d)?$/.exec(note)
    if (!match) {
        throw new Error(`Invalid pitch spelling: ${note}`)
    }

    const [, letter, accidentalRaw = '', octaveStr] = match
    let accidentalShift = 0
    for (const char of accidentalRaw) {
        accidentalShift += char === '#' ? 1 : -1
    }

    return {
        letter,
        accidental: accidentalRaw,
        semitone: LETTER_TO_SEMITONE[letter] + accidentalShift,
        specifiedOctave: octaveStr ? Number(octaveStr) : undefined,
    }
}

const toMidi = (note: ParsedNote, octave: number): number => {
    return (octave + 1) * 12 + note.semitone
}

export function midiToFrequency(midi: number): number {
    return 440 * 2 ** ((midi - 69) / 12)
}

export function allocateChordVoicing(notes: string[]): VoicedNote[] {
    const hasOctaves = /\d$/.test(notes[0])
    const spellings = notes.length === 3 && !hasOctaves ? [...notes, notes[0]] : notes
    const parsed = spellings.map(parsePitchSpelling)

    // If notes have explicit octaves (e.g. "F#3"), use them directly
    if (hasOctaves) {
        return parsed.map((item) => {
            const octave = item.specifiedOctave!
            return {
                ...item,
                midi: toMidi(item, octave),
                octave,
                vexKey: `${item.letter.toLowerCase()}/${octave}`,
            }
        })
    }

    // Fallback: ascending algorithm for notes without octaves
    let previous = Number.NEGATIVE_INFINITY
    const rootOctave = parsed[0].semitone >= 7 ? 3 : 4

    return parsed.map((item) => {
        let octave = rootOctave
        let midi = toMidi(item, octave)

        while (midi <= previous) {
            midi += 12
            octave += 1
        }

        previous = midi

        return {
            ...item,
            midi,
            octave,
            vexKey: `${item.letter.toLowerCase()}/${octave}`,
        }
    })
}

export function toVexAccidental(accidental: string): string | null {
    if (!accidental) return null
    if (accidental === '#') return '#'
    if (accidental === '##') return '##'
    if (accidental === 'b') return 'b'
    if (accidental === 'bb') return 'bb'
    return null
}

/**
 * Return a VexFlow key-signature string for a given tonic + mode.
 * e.g. ('G', 'major') → 'G',  ('A', 'minor') → 'Am'
 */
export function toVexKeySignature(tonic: string, mode: 'major' | 'minor'): string {
    return mode === 'minor' ? `${tonic}m` : tonic
}

// Sharp/flat order used in key signatures
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

// Number of sharps/flats for each major key
const KEY_SIG_MAP: Record<string, number> = {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
}

// Relative major for minor keys
const MINOR_TO_MAJOR: Record<string, string> = {
    A: 'C', E: 'G', B: 'D', 'F#': 'A', 'C#': 'E', 'G#': 'B', 'D#': 'F#', 'A#': 'C#',
    D: 'F', G: 'Bb', C: 'Eb', F: 'Ab', Bb: 'Db', Eb: 'Gb', Ab: 'Cb',
}

/**
 * Returns a Map of letter → VexFlow accidental string for notes altered by a key signature.
 * e.g. for key 'G' (1 sharp) → Map { 'F' → '#' }
 * e.g. for key 'F' (1 flat) → Map { 'B' → 'b' }
 */
export function getKeySignatureAccidentals(vexKey: string): Map<string, string> {
    const result = new Map<string, string>()
    const isMinor = vexKey.endsWith('m')
    const keyRoot = isMinor ? vexKey.slice(0, -1) : vexKey

    let majorKey: string
    if (isMinor) {
        majorKey = MINOR_TO_MAJOR[keyRoot] ?? 'C'
    } else {
        majorKey = keyRoot
    }

    const sigCount = KEY_SIG_MAP[majorKey] ?? 0
    if (sigCount > 0) {
        for (let i = 0; i < sigCount; i++) {
            result.set(SHARP_ORDER[i], '#')
        }
    } else if (sigCount < 0) {
        for (let i = 0; i < -sigCount; i++) {
            result.set(FLAT_ORDER[i], 'b')
        }
    }

    return result
}

export function beatsToSeconds(durationBeats: number, beatUnit: number, tempo: number): number {
    const quarterBeats = durationBeats * (4 / beatUnit)
    return (60 / tempo) * quarterBeats
}
