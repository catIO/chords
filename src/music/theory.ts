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
    | 'minorMajor7'
    | 'augmentedMajor7'
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
const UPPERCASE_QUALITIES = new Set<ChordQuality>(['major', 'augmented', 'dominant7', 'major7', 'augmentedMajor7'])

const SYMBOL_SUFFIX: Record<ChordQuality, string> = {
    major: '',
    minor: 'm',
    diminished: '°',
    augmented: '+',
    dominant7: '7',
    major7: 'maj7',
    minor7: 'm7',
    minorMajor7: 'm(maj7)',
    augmentedMajor7: '+maj7',
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
    minorMajor7: 'M',
    augmentedMajor7: '+M',
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
    if (triad === 'minor' && seventh === 11) return 'minorMajor7'
    if (triad === 'augmented' && seventh === 11) return 'augmentedMajor7'
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

const stripOctave = (note: string) => note.replace(/\d+$/, '')

/** Names the chord spelled by written notes (bass first), e.g. ['F#3', 'C4', 'D4', 'A4'] → D7/F#. Key-free, so romanNumeral is empty. */
export function identifyChord(notes: string[]): Chord | null {
    const tones = [...new Set(notes.map(stripOctave))]
    const bass = stripOctave(notes[0])
    const letterIdx = (tone: string) => LETTERS.indexOf(parsePitchSpelling(tone).letter)

    for (const root of tones) {
        // Spelled in thirds above the root: letters 0, 2, 4 and 6 steps up
        const byStep = new Map<number, string>()
        const stacked = tones.every((tone) => {
            const step = (letterIdx(tone) - letterIdx(root) + 7) % 7
            if (step % 2 !== 0 || byStep.has(step)) return false
            byStep.set(step, tone)
            return true
        })
        const third = byStep.get(2)
        if (!stacked || !third) continue

        const seventh = byStep.get(6)
        // Guitar voicings often leave out the fifth; assume a perfect one
        const fifth = byStep.get(4) ?? transpose(root, 4, 7)
        const full = seventh ? [root, third, fifth, seventh] : [root, third, fifth]
        try {
            return { ...buildChord(full, full.indexOf(bass), 'I'), romanNumeral: '' }
        } catch {
            return null
        }
    }
    return null
}

const QUALITY_NAME: Record<ChordQuality, string> = {
    major: ' major',
    minor: ' minor',
    diminished: ' diminished',
    augmented: ' augmented',
    dominant7: '7',
    major7: ' major 7',
    minor7: ' minor 7',
    minorMajor7: ' minor-major 7',
    augmentedMajor7: ' augmented major 7',
    halfDiminished7: ' half-diminished 7',
    diminished7: ' diminished 7',
}

const QUALITY_DESCRIPTION: Record<ChordQuality, string> = {
    major: 'Major triad',
    minor: 'Minor triad',
    diminished: 'Diminished triad',
    augmented: 'Augmented triad',
    dominant7: 'Dominant seventh',
    major7: 'Major seventh',
    minor7: 'Minor seventh',
    minorMajor7: 'Minor-major seventh',
    augmentedMajor7: 'Augmented major seventh',
    halfDiminished7: 'Half-diminished seventh',
    diminished7: 'Fully diminished seventh',
}

const INVERSION_NAME = ['', 'first inversion', 'second inversion', 'third inversion']

/** Displays sharps and flats as ♯ and ♭, e.g. "F#" → "F♯". */
export function prettyPitch(text: string): string {
    return text.replace(/([A-G])(#{1,2}|b{1,2})/g, (_, letter: string, acc: string) =>
        letter + acc.replace(/#/g, '♯').replace(/b/g, '♭'),
    )
}

/** Full chord name with a slash bass for inversions, e.g. "C major", "F♯ minor 7", "D7/F♯". */
export function chordName(chord: Chord): string {
    return prettyPitch(chord.root + QUALITY_NAME[chord.quality] + (chord.inversion ? `/${chord.bass}` : ''))
}

/** e.g. "Major triad" or "Dominant seventh, first inversion". */
export function chordDescription(chord: Chord): string {
    const inversion = INVERSION_NAME[chord.inversion]
    return QUALITY_DESCRIPTION[chord.quality] + (inversion ? `, ${inversion}` : '')
}

/**
 * The chord a tension chord normally resolves to in `tonic`/`mode` (dominant 7ths and leading-tone chords
 * to the tonic; ii7, iiø7, ii°6 and the cadential 6/4 to the dominant), in root position and first inversion
 * so the voices can move by step. Empty for other chords.
 */
export function resolutionTargets(tonic: string, mode: Mode, chord: Chord): Chord[] {
    const scale: ScaleType = mode === 'major' ? 'major' : 'harmonic'
    const degree = (pitchClass(chord.root) - pitchClass(tonic) + 12) % 12
    const leadingTone = ['diminished', 'diminished7', 'halfDiminished7'].includes(chord.quality)
    const supertonic = ['minor7', 'halfDiminished7'].includes(chord.quality) || (chord.quality === 'diminished' && chord.inversion === 1)
    const cadential64 = chord.tones.length === 3 && degree === 0 && chord.inversion === 2
    const inversions = (target: number) => [0, 1].map((inversion) => diatonicChord(tonic, scale, target, { inversion }))

    if ((chord.quality === 'dominant7' && degree === 7) || (leadingTone && degree === 11)) return inversions(0)
    // The cadential 6/4 keeps its bass, so its V stays in root position
    if (cadential64) return [diatonicChord(tonic, scale, 4)]
    if (supertonic && degree === 2) return inversions(4)
    return []
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

/** Close-position treble staff notes for any chord, bass first (e.g. C/E → E4 G4 C5). */
export function closePositionNotes(chord: Chord): string[] {
    const ordered = [...chord.tones.slice(chord.inversion), ...chord.tones.slice(0, chord.inversion)]
    let previous = -Infinity
    return ordered.map((tone, i) => {
        const { letter, semitone } = parsePitchSpelling(tone)
        let octave = i === 0 && !['A', 'B'].includes(letter) ? 4 : 3
        while ((octave + 1) * 12 + semitone <= previous) octave++
        previous = (octave + 1) * 12 + semitone
        return `${tone}${octave}`
    })
}
