import { parsePitchSpelling } from './noteUtils'

export type Mode = 'major' | 'minor'
export type MinorForm = 'natural' | 'harmonic' | 'melodic'
export type ScaleType = 'major' | MinorForm
export type ChromaticChord = 'V7/V' | 'N6'

export type ChordQuality =
    | 'major'
    | 'minor'
    | 'diminished'
    | 'augmented'
    | 'dominant7'
    | 'major7'
    | 'minor7'
    | 'halfDiminished7'
    | 'diminished7'

export interface Chord {
    root: string
    quality: ChordQuality
    inversion: number
    /** Spelled chord tones in root-position order, without octaves */
    tones: string[]
    bass: string
    symbol: string
    romanNumeral: string
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11]

const SCALE_STEPS: Record<ScaleType, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    natural: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    melodic: [0, 2, 3, 5, 7, 9, 11],
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
const TRIAD_FIGURES = ['', '6', '6/4']
const SEVENTH_FIGURES = ['7', '6/5', '4/3', '4/2']
const UPPERCASE_QUALITIES = new Set<ChordQuality>(['major', 'augmented', 'dominant7', 'major7'])

const SYMBOL_SUFFIX: Record<ChordQuality, string> = {
    major: '',
    minor: 'm',
    diminished: '°',
    augmented: '+',
    dominant7: '7',
    major7: 'maj7',
    minor7: 'm7',
    halfDiminished7: 'm7b5',
    diminished7: '°7',
}

const ROMAN_MARK: Record<ChordQuality, string> = {
    major: '',
    minor: '',
    diminished: '°',
    augmented: '+',
    dominant7: '',
    major7: 'M',
    minor7: '',
    halfDiminished7: 'ø',
    diminished7: '°',
}

export const ALL_MINOR_FORMS: MinorForm[] = ['natural', 'harmonic', 'melodic']

export const MINOR_FORM_LABEL: Record<MinorForm, string> = {
    natural: 'Natural',
    harmonic: 'Harmonic',
    melodic: 'Melodic',
}

export function pitchClass(note: string): number {
    return ((parsePitchSpelling(note).semitone % 12) + 12) % 12
}

/** Spell the note `letterSteps` letters and `semitones` half steps above `note`. */
export function transpose(note: string, letterSteps: number, semitones: number): string {
    const { letter } = parsePitchSpelling(note)
    const letterIdx = (LETTERS.indexOf(letter) + letterSteps) % 7
    const targetPc = (pitchClass(note) + semitones) % 12
    const offset = ((targetPc - NATURAL_PC[letterIdx] + 18) % 12) - 6
    if (Math.abs(offset) > 2) {
        throw new Error(`Cannot spell ${semitones} semitones above ${note}`)
    }
    return LETTERS[letterIdx] + (offset > 0 ? '#'.repeat(offset) : 'b'.repeat(-offset))
}

export function buildScale(tonic: string, scaleType: ScaleType): string[] {
    return SCALE_STEPS[scaleType].map((semitones, degree) => transpose(tonic, degree, semitones))
}

const interval = (from: string, to: string) => (pitchClass(to) - pitchClass(from) + 12) % 12

function triadQuality(tones: string[]): ChordQuality {
    const third = interval(tones[0], tones[1])
    const fifth = interval(tones[0], tones[2])
    if (third === 4 && fifth === 7) return 'major'
    if (third === 3 && fifth === 7) return 'minor'
    if (third === 3 && fifth === 6) return 'diminished'
    if (third === 4 && fifth === 8) return 'augmented'
    throw new Error(`Unsupported triad: ${tones.join(' ')}`)
}

function seventhQuality(tones: string[]): ChordQuality {
    const triad = triadQuality(tones.slice(0, 3))
    const seventh = interval(tones[0], tones[3])
    if (triad === 'major' && seventh === 10) return 'dominant7'
    if (triad === 'major' && seventh === 11) return 'major7'
    if (triad === 'minor' && seventh === 10) return 'minor7'
    if (triad === 'diminished' && seventh === 10) return 'halfDiminished7'
    if (triad === 'diminished' && seventh === 9) return 'diminished7'
    throw new Error(`Unsupported seventh chord: ${tones.join(' ')}`)
}

function buildChord(tones: string[], inversion: number, numeral: string): Chord {
    if (inversion < 0 || inversion >= tones.length) {
        throw new Error(`Invalid inversion ${inversion} for ${tones.join(' ')}`)
    }
    const quality = tones.length === 4 ? seventhQuality(tones) : triadQuality(tones)
    const figures = tones.length === 4 ? SEVENTH_FIGURES : TRIAD_FIGURES
    const bass = tones[inversion]
    const casedNumeral = UPPERCASE_QUALITIES.has(quality) ? numeral : numeral.toLowerCase()

    return {
        root: tones[0],
        quality,
        inversion,
        tones,
        bass,
        symbol: tones[0] + SYMBOL_SUFFIX[quality] + (inversion ? `/${bass}` : ''),
        romanNumeral: casedNumeral + ROMAN_MARK[quality] + figures[inversion],
    }
}

/** Chord built from scale degree `degree` (0 = tonic) by stacking diatonic thirds. */
export function diatonicChord(
    tonic: string,
    scaleType: ScaleType,
    degree: number,
    { seventh = false, inversion = 0 }: { seventh?: boolean; inversion?: number } = {},
): Chord {
    const scale = buildScale(tonic, scaleType)
    const tones = Array.from({ length: seventh ? 4 : 3 }, (_, i) => scale[(degree + i * 2) % 7])
    return buildChord(tones, inversion, NUMERALS[degree])
}

export function chromaticChord(tonic: string, kind: ChromaticChord): Chord {
    if (kind === 'V7/V') {
        const root = transpose(tonic, 1, 2)
        const tones = [root, transpose(root, 2, 4), transpose(root, 4, 7), transpose(root, 6, 10)]
        return { ...buildChord(tones, 0, 'V'), romanNumeral: 'V7/V' }
    }
    const root = transpose(tonic, 1, 1)
    const tones = [root, transpose(root, 2, 4), transpose(root, 4, 7)]
    return { ...buildChord(tones, 1, 'II'), romanNumeral: 'N6' }
}

/** Builds close-position textbook treble staff notes for a diatonic chord (e.g. C4-E4-G4). */
export function diatonicCloseNotes(
    tonic: string,
    scaleType: ScaleType,
    degree: number,
    { seventh = false, inversion = 0 }: { seventh?: boolean; inversion?: number } = {},
): string[] {
    const scale = buildScale(tonic, scaleType)
    const tonicLetter = parsePitchSpelling(tonic).letter
    const tonicOctave = ['A', 'B'].includes(tonicLetter) ? 3 : 4

    let currentOctave = tonicOctave
    let prevLetterIdx = LETTERS.indexOf(tonicLetter)
    for (let d = 1; d <= degree; d++) {
        const letterIdx = LETTERS.indexOf(parsePitchSpelling(scale[d]).letter)
        if (letterIdx < prevLetterIdx) {
            currentOctave++
        }
        prevLetterIdx = letterIdx
    }

    const numTones = seventh ? 4 : 3
    const voicedRootTones: { tone: string; octave: number }[] = []
    let toneOctave = currentOctave
    let lastLetterIdx = LETTERS.indexOf(parsePitchSpelling(scale[degree]).letter)

    for (let i = 0; i < numTones; i++) {
        const tone = scale[(degree + i * 2) % 7]
        const letterIdx = LETTERS.indexOf(parsePitchSpelling(tone).letter)
        if (i > 0 && letterIdx <= lastLetterIdx) {
            toneOctave++
        }
        voicedRootTones.push({ tone, octave: toneOctave })
        lastLetterIdx = letterIdx
    }

    const inverted: { tone: string; octave: number }[] = []
    for (let i = 0; i < numTones; i++) {
        const item = voicedRootTones[(i + inversion) % numTones]
        const octave = i < numTones - inversion ? item.octave : item.octave + 1
        inverted.push({ tone: item.tone, octave })
    }

    return inverted.map((t) => `${t.tone}${t.octave}`)
}
