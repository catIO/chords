import { useEffect, useRef } from 'react'
import {
    Accidental,
    Annotation,
    AnnotationVerticalJustify,
    BarlineType,
    Formatter,
    FretHandFinger,
    GhostNote,
    Modifier,
    Renderer,
    Stave,
    StaveNote,
    Voice,
    VoiceMode,
    Stem,
} from 'vexflow'
import { Box } from '@mui/material'
import type { ChordEvent } from '../types/curriculum'
import { allocateChordVoicing, toVexAccidental, getKeySignatureAccidentals } from '../music/noteUtils'

export interface ChordStaffProps {
    events: ChordEvent[]
    currentIndex?: number
    keySignature?: string // VexFlow key string e.g. 'G', 'Bb', 'Am', 'F#m'
    showAnnotations?: boolean
    showFingerings?: boolean
    clef?: 'treble' | '8vb'
    endBarline?: boolean
    /** Narrowest score canvas in px; lower it for a single chord */
    minWidth?: number
    /** Written pitches (e.g. ['E3', 'A5']) the canvas always makes room for, so staves sharing them are the same height */
    pitchRange?: string[]
}

/** Left-hand finger beside a notehead; a notehead pushed right of the stem (a second above its neighbour) takes it on the right, clear of the others. */
function addFinger(note: StaveNote, finger: string, index: number) {
    const modifier = new FretHandFinger(finger)
    if (note.noteHeads[index]?.isDisplaced()) {
        modifier.setPosition(Modifier.Position.RIGHT)
    } else {
        modifier.setPosition(Modifier.Position.LEFT)
        modifier.setXShift(-10)
    }
    note.addModifier(modifier, index)
}

const toVexDuration = (event: ChordEvent): string => {
    const quarterUnits = event.durationBeats * (4 / event.beatUnit)
    if (quarterUnits >= 4) return 'w'
    if (quarterUnits >= 3) return 'hd'
    if (quarterUnits >= 2) return 'h'
    if (quarterUnits >= 1.5) return 'qd'
    if (quarterUnits >= 1) return 'q'
    if (quarterUnits >= 0.75) return '8d'
    return '8'
}

export function ChordStaff({
    events,
    currentIndex = -1,
    keySignature,
    showAnnotations = false,
    showFingerings = true,
    clef = '8vb',
    endBarline = false,
    minWidth = 360,
    pitchRange,
}: ChordStaffProps) {
    const rootRef = useRef<HTMLDivElement | null>(null)
    const rangeKey = pitchRange?.join(' ') ?? ''

    useEffect(() => {
        const host = rootRef.current
        if (!host) return

        host.innerHTML = ''

        // Size the stave to fill the score canvas width
        const canvasWidth = showAnnotations
            ? Math.max(780, events.length * 105)
            : Math.max(minWidth, events.length * 110)
        const staveWidth = canvasWidth - 32
        const canvasHeight = showAnnotations ? 180 : 210

        const renderer = new Renderer(host, Renderer.Backends.SVG)
        renderer.resize(canvasWidth, canvasHeight)

        const ctx = renderer.getContext()
        ctx.setFillStyle('#1a1a1a')
        ctx.setStrokeStyle('#1a1a1a')
        ctx.setLineWidth(1.2)

        const staveY = showAnnotations ? 24 : 20
        const stave = new Stave(16, staveY, staveWidth)
        if (clef === '8vb') {
            stave.addClef('treble', 'default', '8vb')
        } else {
            stave.addClef('treble')
        }
        if (keySignature) {
            stave.addKeySignature(keySignature)
        }
        if (endBarline) {
            stave.setEndBarType(BarlineType.END)
        }
        stave.setContext(ctx).draw()

        // Build set of accidentals implied by the key signature so we skip them on notes
        const keySigAccidentals = keySignature ? getKeySignatureAccidentals(keySignature) : new Map<string, string>()
        const displayedAccidental = (entry: { letter: string; accidental: string }): string | null => {
            const keySigAcc = keySigAccidentals.get(entry.letter)
            const acc = toVexAccidental(entry.accidental)
            if (acc) return acc === keySigAcc ? null : acc
            return keySigAcc ? 'n' : null
        }

        let cropTop = 0
        let cropBottom = canvasHeight
        if (showAnnotations) {
            // Textbook close-position scale score: single voice, whole notes, chord symbol below note (Roman numerals on pills above)
            const staveNotes = events.map((event) => {
                const voiced = allocateChordVoicing(event.notes)
                const note = new StaveNote({
                    clef: 'treble',
                    keys: voiced.map((e) => e.vexKey),
                    duration: 'w',
                })
                voiced.forEach((entry, ki) => {
                    const acc = displayedAccidental(entry)
                    if (acc) note.addModifier(new Accidental(acc), ki)
                })
                // Chord symbol directly below notehead
                if (event.symbol) {
                    const bottomAnn = new Annotation(event.symbol)
                        .setVerticalJustification(AnnotationVerticalJustify.BOTTOM)
                        .setFont('Public Sans, sans-serif', 15, 'bold')
                    note.addModifier(bottomAnn, 0)
                }
                return note
            })

            const voice = new Voice({
                numBeats: Math.max(1, events.length * 4),
                beatValue: 4,
            }).setMode(VoiceMode.SOFT)

            voice.addTickables(staveNotes)
            const formatWidth = Math.max(60, staveWidth - (stave.getNoteStartX() - 16) - 25)
            new Formatter().joinVoices([voice]).format([voice], formatWidth)
            voice.draw(ctx, stave)
        } else {
            // Standard multi-voice guitar cadences with fingerings
            const totalQuarterBeats = events
                .map((event) => event.durationBeats * (4 / event.beatUnit))
                .reduce((sum, beats) => sum + beats, 0)

            const voiceParams = {
                numBeats: Math.max(1, Math.ceil(totalQuarterBeats)),
                beatValue: 4,
            }

            const bassVoice = new Voice(voiceParams).setMode(VoiceMode.SOFT)
            const trebleVoice = new Voice(voiceParams).setMode(VoiceMode.SOFT)

            events.forEach((event) => {
                const voiced = allocateChordVoicing(event.notes)
                const duration = toVexDuration(event)
                const fingerArr = showFingerings !== false ? (event.fingerings ?? []) : []

                if (voiced.length >= 3) {
                    const bassVoiced = [voiced[0]]
                    const trebleVoiced = voiced.slice(1)

                    const bassNote = new StaveNote({
                        clef: 'treble',
                        keys: bassVoiced.map((e) => e.vexKey),
                        duration,
                        stemDirection: Stem.DOWN,
                    })
                    bassVoiced.forEach((entry, ki) => {
                        const acc = displayedAccidental(entry)
                        if (acc) bassNote.addModifier(new Accidental(acc), ki)
                    })
                    if (fingerArr[0]) addFinger(bassNote, fingerArr[0], 0)

                    const trebleNote = new StaveNote({
                        clef: 'treble',
                        keys: trebleVoiced.map((e) => e.vexKey),
                        duration,
                        stemDirection: Stem.UP,
                    })
                    trebleVoiced.forEach((entry, ki) => {
                        const acc = displayedAccidental(entry)
                        if (acc) trebleNote.addModifier(new Accidental(acc), ki)
                        const fi = ki + 1
                        if (fi < fingerArr.length && fingerArr[fi]) addFinger(trebleNote, fingerArr[fi], ki)
                    })

                    bassVoice.addTickables([bassNote])
                    trebleVoice.addTickables([trebleNote])
                } else {
                    const note = new StaveNote({
                        clef: 'treble',
                        keys: voiced.map((e) => e.vexKey),
                        duration,
                        stemDirection: Stem.UP,
                    })
                    voiced.forEach((entry, ki) => {
                        const acc = displayedAccidental(entry)
                        if (acc) note.addModifier(new Accidental(acc), ki)
                        if (ki < fingerArr.length && fingerArr[ki]) addFinger(note, fingerArr[ki], ki)
                    })
                    bassVoice.addTickables([note])
                    // Keeps the two voices aligned without drawing a rest over the chord
                    trebleVoice.addTickables([new GhostNote({ duration })])
                }
            })

            const formatWidth = Math.max(60, staveWidth - (stave.getNoteStartX() - 16) - 25)
            new Formatter().joinVoices([bassVoice, trebleVoice]).format([bassVoice, trebleVoice], formatWidth)
            bassVoice.draw(ctx, stave)
            trebleVoice.draw(ctx, stave)
            // Trim the empty space above and below the music; the full width keeps staves aligned
            const noteYs = [...bassVoice.getTickables(), ...trebleVoice.getTickables()].flatMap((tickable) => {
                if (!(tickable instanceof StaveNote)) return []
                const note = tickable
                if (!note.hasStem()) return note.getYs()
                const { topY, baseY } = note.getStemExtents()
                return [...note.getYs(), topY, baseY]
            })
            const rangeYs = rangeKey
                ? allocateChordVoicing(rangeKey.split(' ')).map((entry) => {
                    const note = new StaveNote({ clef: 'treble', keys: [entry.vexKey], duration: 'w' })
                    return stave.getYForNote(note.getKeyProps()[0].line)
                })
                : []
            noteYs.push(...rangeYs)
            cropTop = Math.min(stave.getYForLine(0), ...noteYs) - 18
            cropBottom = Math.max(stave.getYForLine(4) + 38, ...noteYs.map((y) => y + 18))
        }

        // Make SVG responsive so it fills the score canvas without horizontal scroll
        const svg = host.querySelector('svg')
        if (svg) {
            svg.setAttribute('viewBox', `0 ${cropTop} ${canvasWidth} ${cropBottom - cropTop}`)
            svg.setAttribute('width', '100%')
            svg.removeAttribute('height')
            // VexFlow's resize() also sets a fixed inline size, which would keep the uncropped height
            svg.style.width = '100%'
            svg.style.height = 'auto'
            svg.style.display = 'block'
            svg.style.maxWidth = '100%'
        }
    }, [events, currentIndex, keySignature, showAnnotations, showFingerings, clef, endBarline, minWidth, rangeKey])

    return (
        <Box
            ref={rootRef}
            aria-label="Treble staff chord notation"
            sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: { xs: 0.75, sm: 1.5 },
                borderRadius: 2,
                border: '1px solid #b89e7a',
                bgcolor: '#f4e4c8',
                backgroundImage: 'linear-gradient(180deg, #f6e6c7 0%, #edd7b0 100%)',
                boxSizing: 'border-box',
                overflow: 'hidden',
                '& svg': {
                    display: 'block',
                    maxWidth: '100%',
                    height: 'auto',
                },
                '& svg path': {
                    strokeWidth: '0.6px !important',
                },
                '& svg line': {
                    strokeWidth: '1.2px !important',
                },
                '& svg rect': {
                    strokeWidth: '0 !important',
                },
            }}
        />
    )
}
