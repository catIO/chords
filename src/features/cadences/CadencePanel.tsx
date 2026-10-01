import { useEffect } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { ChordStaff } from '../../components/ChordStaff'
import { describeCadence } from '../../music/cadence'
import { toVexKeySignature } from '../../music/noteUtils'
import type { CadenceScale } from './mergeMinorForms'

interface CadencePanelProps {
    scales: CadenceScale[]
    expandedScaleId: string | null
    onExpandChange: (scaleId: string | null) => void
}

export function CadencePanel({ scales, expandedScaleId, onExpandChange }: CadencePanelProps) {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            if (scales.length === 0) return

            const currentIdx = expandedScaleId
                ? scales.findIndex((s) => s.id === expandedScaleId)
                : -1

            let nextIdx: number
            if (e.key === 'ArrowRight') {
                nextIdx = currentIdx < scales.length - 1 ? currentIdx + 1 : 0
            } else {
                nextIdx = currentIdx > 0 ? currentIdx - 1 : scales.length - 1
            }

            onExpandChange(scales[nextIdx].id)
        }

        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [scales, expandedScaleId, onExpandChange])
    if (scales.length === 0) {
        return (
            <Card>
                <CardContent>
                    <Typography>No scales match this filter.</Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Stack spacing={1.5}>
            {scales.map((scale) => {
                const cadence = describeCadence(scale.sequence.map((event) => event.romanNumeral))
                return (
                    <Accordion
                        key={scale.id}
                        expanded={expandedScaleId === scale.id}
                        onChange={(_, isExpanded) => onExpandChange(isExpanded ? scale.id : null)}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                            >
                                <Typography variant="h6" sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' } }}>{scale.scaleName}</Typography>
                                <Chip label={scale.mode} size="small" color="secondary" variant="outlined" />
                                {scale.minorForms.length > 0 ? (
                                    <Chip label={scale.minorForms.join(' & ')} size="small" variant="outlined" />
                                ) : null}
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={1.5}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    useFlexGap
                                    sx={{
                                        flexWrap: scale.sequence.length <= 2 ? 'nowrap' : 'wrap',
                                    }}
                                >
                                    {scale.sequence.map((event) => (
                                        <Chip
                                            key={event.id}
                                            label={`${event.romanNumeral} ${event.symbol}`}
                                            color="primary"
                                            variant="filled"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: '0.95rem',
                                                py: 0.25,
                                                ...(scale.sequence.length <= 2 ? { flex: 1 } : {}),
                                            }}
                                        />
                                    ))}
                                </Stack>
                                {cadence && (
                                    <Typography variant="body2" color="text.secondary">
                                        <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                            {cadence.name} ({cadence.numerals})
                                        </Box>
                                        {' — '}
                                        {cadence.description}
                                    </Typography>
                                )}
                                <ChordStaff
                                    events={scale.sequence}
                                    keySignature={toVexKeySignature(scale.tonic, scale.mode)}
                                />
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                )
            })}
        </Stack>
    )
}
