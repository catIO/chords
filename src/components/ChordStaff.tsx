import { useEffect, useRef } from 'react'
import { Accidental, Formatter, FretHandFinger, Renderer, Stave, StaveNote, Voice, VoiceMode } from 'vexflow'
import { Box } from '@mui/material'
import type { ChordEvent } from '../types/curriculum'
import { allocateChordVoicing, toVexAccidental, getKeySignatureAccidentals } from '../music/noteUtils'

interface ChordStaffProps {
    events: ChordEvent[]
    currentIndex?: number
    keySignature?: string  // VexFlow key string e.g. 'G', 'Bb', 'Am', 'F#m'
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

export function ChordStaff({ events, currentIndex = -1, keySignature }: ChordStaffProps) {
    const rootRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const host = rootRef.current
        if (!host) return

        host.innerHTML = ''

        // Size the stave to fit content, not fill the container
        const clefWidth = 60
        const keySigWidth = keySignature ? Math.max(keySignature.length * 12, 20) : 0
        const noteSpace = Math.max(events.length * 80, 100)
        const staveWidth = clefWidth + keySigWidth + noteSpace + 40
        const scale = 1.4
        const canvasWidth = Math.ceil(staveWidth * scale) + 16
        const canvasHeight = 180

        const renderer = new Renderer(host, Renderer.Backends.SVG)
        renderer.resize(canvasWidth, canvasHeight)

        const ctx = renderer.getContext()
        ctx.setFillStyle('#1a1a1a')
        ctx.setStrokeStyle('#1a1a1a')
        ctx.setLineWidth(1.2)
        ctx.scale(scale, scale)

        const stave = new Stave(8, 20, staveWidth)
        // Guitar notation: treble clef with subscript "8" (sounds an octave lower)
        stave.addClef('treble', 'default', '8vb')
        if (keySignature) {
            stave.addKeySignature(keySignature)
        }
        stave.setContext(ctx).draw()

        // Build set of accidentals implied by the key signature so we skip them on notes
        const keySigAccidentals = keySignature ? getKeySignatureAccidentals(keySignature) : new Map<string, string>()

        const totalQuarterBeats = events
            .map((event) => event.durationBeats * (4 / event.beatUnit))
            .reduce((sum, beats) => sum + beats, 0)

        // SOFT mode: don't error on partial bars (e.g. a 2-beat chord in 4/4)
        const voice = new Voice({
            numBeats: Math.max(1, Math.ceil(totalQuarterBeats)),
            beatValue: 4,
        }).setMode(VoiceMode.SOFT)

        const notes = events.map((event, eventIndex) => {
            const voiced = allocateChordVoicing(event.notes)
            const note = new StaveNote({
                clef: 'treble',
                keys: voiced.map((entry) => entry.vexKey),
                duration: toVexDuration(event),
            })

            voiced.forEach((entry, keyIndex) => {
                const acc = toVexAccidental(entry.accidental)
                if (acc) {
                    // Only add explicit accidental if it's NOT already in the key signature
                    const keySigAcc = keySigAccidentals.get(entry.letter)
                    if (acc !== keySigAcc) {
                        note.addModifier(new Accidental(acc), keyIndex)
                    }
                }
            })

            // Add fingering annotations if provided
            if (event.fingerings) {
                // Fingerings correspond to the original notes; for triads we doubled the
                // root so the array has 3 entries but voiced has 4. Map accordingly.
                const fingerArr = event.fingerings
                voiced.forEach((_, keyIndex) => {
                    const fingerIndex = keyIndex < fingerArr.length ? keyIndex : undefined
                    if (fingerIndex !== undefined && fingerArr[fingerIndex] !== undefined) {
                        const finger = new FretHandFinger(fingerArr[fingerIndex])
                        finger.setPosition(1) // LEFT of notehead
                        finger.setXShift(-12)
                        note.addModifier(finger, keyIndex)
                    }
                })
            }

            if (eventIndex === currentIndex) {
                note.setStyle({
                    fillStyle: '#5f3b20',
                    strokeStyle: '#5f3b20',
                })
            }

            return note
        })

        voice.addTickables(notes)
        new Formatter().joinVoices([voice]).format([voice], Math.max(60, noteSpace))
        voice.draw(ctx, stave)

    }, [events, currentIndex, keySignature])

    return (
        <Box
            ref={rootRef}
            aria-label="Treble staff chord notation"
            sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 2,
                borderRadius: 2,
                border: '1px solid #b89e7a',
                bgcolor: '#f4e4c8',
                backgroundImage: 'linear-gradient(180deg, #f6e6c7 0%, #edd7b0 100%)',
                '& svg': {
                    display: 'block',
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
