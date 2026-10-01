import { useEffect, useRef } from 'react'
import {
    Accidental,
    Annotation,
    AnnotationVerticalJustify,
    BarlineType,
    Formatter,
    FretHandFinger,
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
    minWidth = 560,
}: ChordStaffProps) {
    const rootRef = useRef<HTMLDivElement | null>(null)

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
                    if (fingerArr[0]) {
                        const finger = new FretHandFinger(fingerArr[0])
                        finger.setPosition(1)
                        finger.setXShift(-10)
                        bassNote.addModifier(finger, 0)
                    }

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
                        if (fi < fingerArr.length && fingerArr[fi]) {
                            const finger = new FretHandFinger(fingerArr[fi])
                            finger.setPosition(1)
                            finger.setXShift(-10)
                            trebleNote.addModifier(finger, ki)
                        }
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
                        if (ki < fingerArr.length && fingerArr[ki]) {
                            const finger = new FretHandFinger(fingerArr[ki])
                            finger.setPosition(1)
                            finger.setXShift(-10)
                            note.addModifier(finger, ki)
                        }
                    })
                    bassVoice.addTickables([note])
                    trebleVoice.addTickables([new StaveNote({
                        clef: 'treble',
                        keys: ['b/4'],
                        duration: duration + 'r',
                    })])
                }
            })

            const formatWidth = Math.max(60, staveWidth - (stave.getNoteStartX() - 16) - 25)
            new Formatter().joinVoices([bassVoice, trebleVoice]).format([bassVoice, trebleVoice], formatWidth)
            bassVoice.draw(ctx, stave)
            trebleVoice.draw(ctx, stave)
        }

        // Make SVG responsive so it fills the score canvas without horizontal scroll
        const svg = host.querySelector('svg')
        if (svg) {
            svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`)
            svg.setAttribute('width', '100%')
            svg.setAttribute('height', 'auto')
            svg.style.display = 'block'
            svg.style.maxWidth = '100%'
        }
    }, [events, currentIndex, keySignature, showAnnotations, showFingerings, clef, endBarline, minWidth])

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
