import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Card,
    CardContent,
    Chip,
    Stack,
    Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ScaleExercise } from '../../types/curriculum'
import { ChordStaff } from '../../components/ChordStaff'
import { toVexKeySignature } from '../../music/noteUtils'

interface GradeReviewPanelProps {
    scales: ScaleExercise[]
    expandedScaleId: string | null
    onExpandChange: (scaleId: string | null) => void
}

export function GradeReviewPanel({ scales, expandedScaleId, onExpandChange }: GradeReviewPanelProps) {
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
            {scales.map((scale) => (
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
                            <Typography variant="h6">{scale.scaleName}</Typography>
                            <Chip label={scale.mode} size="small" />
                            {scale.minorForm ? <Chip label={scale.minorForm} size="small" variant="outlined" /> : null}
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
                                        sx={scale.sequence.length <= 2 ? { flex: 1 } : undefined}
                                    />
                                ))}
                            </Stack>
                            <ChordStaff
                                events={scale.sequence}
                                keySignature={toVexKeySignature(scale.tonic, scale.mode)}
                            />
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            ))}
        </Stack>
    )
}
