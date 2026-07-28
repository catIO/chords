import { useEffect, useRef } from 'react'
import { Accidental, Formatter, FretHandFinger, Renderer, Stave, StaveNote, Voice, VoiceMode, Stem } from 'vexflow'
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
        const canvasHeight = 240

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

        const voiceParams = {
            numBeats: Math.max(1, Math.ceil(totalQuarterBeats)),
            beatValue: 4,
        }

        // Build two voices: bass (stem down) and treble (stem up)
        const bassVoice = new Voice(voiceParams).setMode(VoiceMode.SOFT)
        const trebleVoice = new Voice(voiceParams).setMode(VoiceMode.SOFT)

        events.forEach((event) => {
            const voiced = allocateChordVoicing(event.notes)
            const duration = toVexDuration(event)
            const fingerArr = event.fingerings ?? []

            if (voiced.length >= 3) {
                // Split: bass note (stem down), upper notes (stem up)
                const bassVoiced = [voiced[0]]
                const trebleVoiced = voiced.slice(1)

                // Bass note
                const bassNote = new StaveNote({
                    clef: 'treble',
                    keys: bassVoiced.map((e) => e.vexKey),
                    duration,
                    stemDirection: Stem.DOWN,
                })
                bassVoiced.forEach((entry, ki) => {
                    const acc = toVexAccidental(entry.accidental)
                    if (acc) {
                        const keySigAcc = keySigAccidentals.get(entry.letter)
                        if (acc !== keySigAcc) bassNote.addModifier(new Accidental(acc), ki)
                    }
                })
                if (fingerArr[0]) {
                    const finger = new FretHandFinger(fingerArr[0])
                    finger.setPosition(1)
                    finger.setXShift(-10)
                    bassNote.addModifier(finger, 0)
                }

                // Treble notes
                const trebleNote = new StaveNote({
                    clef: 'treble',
                    keys: trebleVoiced.map((e) => e.vexKey),
                    duration,
                    stemDirection: Stem.UP,
                })
                trebleVoiced.forEach((entry, ki) => {
                    const acc = toVexAccidental(entry.accidental)
                    if (acc) {
                        const keySigAcc = keySigAccidentals.get(entry.letter)
                        if (acc !== keySigAcc) trebleNote.addModifier(new Accidental(acc), ki)
                    }
                    // Fingering: offset by 1 since index 0 went to bass
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
                // 2 or fewer notes: single voice, stem up
                const note = new StaveNote({
                    clef: 'treble',
                    keys: voiced.map((e) => e.vexKey),
                    duration,
                    stemDirection: Stem.UP,
                })
                voiced.forEach((entry, ki) => {
                    const acc = toVexAccidental(entry.accidental)
                    if (acc) {
                        const keySigAcc = keySigAccidentals.get(entry.letter)
                        if (acc !== keySigAcc) note.addModifier(new Accidental(acc), ki)
                    }
                    if (ki < fingerArr.length && fingerArr[ki]) {
                        const finger = new FretHandFinger(fingerArr[ki])
                        finger.setPosition(1)
                        finger.setXShift(-10)
                        note.addModifier(finger, ki)
                    }
                })
                bassVoice.addTickables([note])
                // Add ghost note to treble voice to keep alignment
                trebleVoice.addTickables([new StaveNote({
                    clef: 'treble',
                    keys: ['b/4'],
                    duration: duration + 'r',  // rest
                })])
            }
        })

        new Formatter().joinVoices([bassVoice, trebleVoice]).format([bassVoice, trebleVoice], Math.max(60, noteSpace))
        bassVoice.draw(ctx, stave)
        trebleVoice.draw(ctx, stave)

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
