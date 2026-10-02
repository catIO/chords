import { useEffect, useMemo, useState } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { z } from 'zod'
import { ChordStaff } from '../../components/ChordStaff'
import type { Curriculum } from '../../types/curriculum'
import {
    buildExercise,
    buildShapeExamples,
    groupBySignature,
    seededRandom,
    SHAPE_FAMILIES,
    type ShapeChordType,
    type ShapeExample,
    type ShapeFamily,
} from './shapes'

const STORAGE_KEY = 'scale-chord-practice/shapes/v1'

const settingsSchema = z.object({
    family: z.enum(SHAPE_FAMILIES.map((f) => f.value) as [ShapeFamily, ...ShapeFamily[]]),
    mode: z.enum(['browse', 'practice']),
    chordTypes: z.array(z.enum(['triads', 'sevenths'])).min(1),
})

type ShapeSettings = z.infer<typeof settingsSchema>

const DEFAULT_SETTINGS: ShapeSettings = { family: 'triangle', mode: 'browse', chordTypes: ['triads', 'sevenths'] }

function loadSettings(): ShapeSettings {
    try {
        const parsed = settingsSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
        return parsed.success ? parsed.data : DEFAULT_SETTINGS
    } catch {
        return DEFAULT_SETTINGS
    }
}

const CHORD_TYPES: { value: ShapeChordType; label: string }[] = [
    { value: 'triads', label: 'Triads' },
    { value: 'sevenths', label: '7th chords' },
]

const newSeed = () => Math.floor(Math.random() * 2 ** 32)

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, [role="button"], [contenteditable="true"]'))
}

function positionLabel(example: ShapeExample): string {
    const [lowFret, highFret] = example.fretRange
    const [lowString, highString] = example.stringRange
    const frets = lowFret === highFret ? `Fret ${lowFret}` : `Frets ${lowFret}–${highFret}`
    const strings = lowString === highString ? `string ${lowString}` : `strings ${lowString}–${highString}`
    return `Fingers ${example.fingerPattern} · ${frets} · ${strings}`
}

function ChordHeading({ example }: { example: ShapeExample }) {
    return (
        <Stack spacing={0.25}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {example.name}
                </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {example.description}
            </Typography>
        </Stack>
    )
}

function ExampleCard({ example, pitchRange }: { example: ShapeExample; pitchRange: string[] }) {
    const [showResolution, setShowResolution] = useState(false)
    const resolution = example.resolution
    return (
        // Subgrid rows (heading, staff, footer) line up across every card in a grid row
        <Card
            variant="outlined"
            sx={{ display: 'grid', gridRow: 'span 3', gridTemplateRows: 'subgrid', rowGap: 1, p: 2, alignItems: 'start' }}
        >
            <ChordHeading example={example} />
            {/* Same canvas width and pitch range for every card in the group, so all staves match in size */}
            <ChordStaff
                events={showResolution && resolution ? resolution.events : [example.event]}
                minWidth={240}
                pitchRange={pitchRange}
            />
            <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ alignSelf: 'end', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
            >
                <Typography variant="caption" color="text.secondary">
                    {positionLabel(example)}
                </Typography>
                {resolution ? (
                    <Button
                        size="small"
                        onClick={() => setShowResolution((open) => !open)}
                        aria-expanded={showResolution}
                        sx={{ px: 0.5, minWidth: 0, textTransform: 'none' }}
                    >
                        → {resolution.name}
                    </Button>
                ) : null}
            </Stack>
        </Card>
    )
}

export function ShapesPanel({ curriculum }: { curriculum: Curriculum }) {
    const allExamples = useMemo(() => buildShapeExamples(curriculum), [curriculum])
    const [settings, setSettings] = useState<ShapeSettings>(loadSettings)
    const update = (patch: Partial<ShapeSettings>) => setSettings((s) => ({ ...s, ...patch }))

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    }, [settings])

    const examples = useMemo(
        () => allExamples.filter((e) => settings.chordTypes.includes(e.chordType)),
        [allExamples, settings.chordTypes],
    )
    const familyCounts = useMemo(() => {
        const counts = new Map<ShapeFamily, number>()
        for (const e of examples) counts.set(e.family, (counts.get(e.family) ?? 0) + 1)
        return counts
    }, [examples])

    const family = SHAPE_FAMILIES.find((f) => f.value === settings.family) ?? SHAPE_FAMILIES[0]
    const familyExamples = useMemo(() => examples.filter((e) => e.family === family.value), [examples, family.value])
    const groups = useMemo(() => groupBySignature(familyExamples), [familyExamples])

    const [exercise, setExercise] = useState(() => ({ seed: newSeed(), count: 1, previousSignature: null as string | null }))
    const exerciseChords = useMemo(
        () => buildExercise(familyExamples, seededRandom(exercise.seed), exercise.previousSignature),
        [familyExamples, exercise],
    )
    const nextExercise = () =>
        setExercise((e) => ({ seed: newSeed(), count: e.count + 1, previousSignature: exerciseChords[0]?.signature ?? null }))

    useEffect(() => {
        if (settings.mode !== 'practice') return
        const handleKey = (e: KeyboardEvent) => {
            if (isInteractiveTarget(e.target)) return
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                nextExercise()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    })

    const handleChordTypes = (value: ShapeChordType[]) => {
        if (value.length > 0) update({ chordTypes: value })
    }

    return (
        <Stack spacing={2.5}>
            <Stack spacing={1}>
                <Typography variant="subtitle2">Shape family</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {SHAPE_FAMILIES.map((f) => {
                        const count = familyCounts.get(f.value) ?? 0
                        const selected = f.value === family.value
                        return (
                            <Chip
                                key={f.value}
                                label={`${f.label} (${count})`}
                                color={selected ? 'primary' : 'default'}
                                variant={selected ? 'filled' : 'outlined'}
                                onClick={() => update({ family: f.value })}
                                disabled={count === 0}
                                aria-pressed={selected}
                            />
                        )
                    })}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {family.description}
                </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <ToggleButtonGroup
                    value={settings.chordTypes}
                    onChange={(_, value: ShapeChordType[]) => handleChordTypes(value)}
                    aria-label="Chords"
                    size="small"
                    fullWidth
                >
                    {CHORD_TYPES.map((t) => (
                        <ToggleButton key={t.value} value={t.value}>
                            {t.label}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <ToggleButtonGroup
                    value={settings.mode}
                    exclusive
                    onChange={(_, value: ShapeSettings['mode'] | null) => value && update({ mode: value })}
                    aria-label="Shapes mode"
                    size="small"
                    fullWidth
                >
                    <ToggleButton value="browse">Browse</ToggleButton>
                    <ToggleButton value="practice">Practice</ToggleButton>
                </ToggleButtonGroup>
            </Stack>

            {familyExamples.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography>No chords use this shape with the chosen chord types.</Typography>
                    </CardContent>
                </Card>
            ) : settings.mode === 'browse' ? (
                <Stack spacing={1.5}>
                    <Typography variant="body2" color="text.secondary">
                        {groups.length} {groups.length === 1 ? 'hand shape' : 'hand shapes'} · {familyExamples.length}{' '}
                        {familyExamples.length === 1 ? 'chord' : 'chords'}. Each hand shape is listed with every chord it makes on the neck.
                    </Typography>
                    {groups.map((group) => (
                        <Accordion key={group.signature} slotProps={{ transition: { unmountOnExit: true } }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Stack spacing={0.25}>
                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                        <Typography sx={{ fontWeight: 700 }}>Fingers {group.fingerPattern}</Typography>
                                        <Chip
                                            label={`${group.examples.length} ${group.examples.length === 1 ? 'chord' : 'chords'}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Stack>
                                    <Typography variant="body2">{group.layout}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {group.examples.slice(0, 4).map((e) => e.name).join(' · ')}
                                        {group.examples.length > 4 ? ' …' : ''}
                                    </Typography>
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                                    {group.examples.map((example) => (
                                        <ExampleCard key={example.id} example={example} pitchRange={group.pitchRange} />
                                    ))}
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Stack>
            ) : (
                <Card>
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Typography variant="h6">{family.label} shapes</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Exercise {exercise.count}
                                </Typography>
                            </Stack>
                            <ChordStaff events={exerciseChords.map((e) => e.event)} endBarline />
                            <Stack spacing={1.5}>
                                {exerciseChords.map((example, i) => (
                                    <Stack key={example.id} direction="row" spacing={1.5}>
                                        <Typography sx={{ fontWeight: 700, minWidth: '1.25rem' }} color="text.secondary">
                                            {i + 1}
                                        </Typography>
                                        <Stack spacing={0.25}>
                                            <ChordHeading example={example} />
                                            {example.resolution ? (
                                                <Typography variant="body2" color="primary">
                                                    → {example.resolution.name}
                                                </Typography>
                                            ) : null}
                                            <Typography variant="caption" color="text.secondary">
                                                {positionLabel(example)}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                            <Button variant="contained" onClick={nextExercise} fullWidth>
                                Next exercise
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Space, Enter or →: next exercise
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Stack>
    )
}
