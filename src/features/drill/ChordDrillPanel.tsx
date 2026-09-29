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
import type { ChordEvent, Curriculum } from '../../types/curriculum'
import { ChordStaff } from '../../components/ChordStaff'
import { voiceChord } from '../../music/guitarVoicings'
import { toVexKeySignature } from '../../music/noteUtils'
import { MINOR_FORM_LABEL, type MinorForm } from '../../music/theory'
import { buildChordPool, buildVocabulary, pickChord, type ChordType, type DrillEntry } from './drill'
import { loadDrillSettings, saveDrillSettings, type DrillSettings } from './drillSettings'
import { curriculumKeys, type KeyChoice } from './keys'

interface ChordDrillPanelProps {
    curriculum: Curriculum
}

const MINOR_FORMS: MinorForm[] = ['natural', 'harmonic', 'melodic']

const CHORD_TYPES: { value: ChordType; label: string }[] = [
    { value: 'triads', label: 'Triads' },
    { value: 'sevenths', label: 'ii7 · V7 · vii7' },
    { value: 'chromatic', label: 'V7/V · N6' },
]

const INVERSIONS = [
    { value: 0, label: 'Root' },
    { value: 1, label: '1st inv.' },
    { value: 2, label: '2nd inv.' },
    { value: 3, label: '3rd inv. (7ths)' },
]

function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && Boolean(target.closest('button, input, select, textarea, [role="button"], [contenteditable="true"]'))
}

function keyName(key: KeyChoice): string {
    return `${key.tonic} ${key.mode}`
}

function KeyChips({ keys, selected, onToggle }: { keys: KeyChoice[]; selected: string[]; onToggle: (id: string) => void }) {
    return (
        <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {keys.map((key) => {
                const isSelected = selected.includes(key.id)
                return (
                    <Chip
                        key={key.id}
                        label={key.mode === 'minor' ? `${key.tonic}m` : key.tonic}
                        size="small"
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        onClick={() => onToggle(key.id)}
                        aria-pressed={isSelected}
                        aria-label={keyName(key)}
                    />
                )
            })}
        </Stack>
    )
}

export function ChordDrillPanel({ curriculum }: ChordDrillPanelProps) {
    const allKeys = useMemo(() => curriculumKeys(curriculum), [curriculum])

    const [settings, setSettings] = useState<DrillSettings>(() => loadDrillSettings(allKeys.map((k) => k.id)))
    const [roll, setRoll] = useState(() => ({ value: Math.random(), previousId: null as string | null, count: 1 }))

    useEffect(() => {
        saveDrillSettings(settings)
    }, [settings])

    const pool = useMemo(
        () =>
            buildChordPool({
                keys: allKeys.filter((k) => settings.keyIds.includes(k.id)),
                minorForms: settings.minorForms,
                vocabulary: buildVocabulary(settings.chordTypes, settings.inversions),
                weighting: settings.weighting,
            }),
        [allKeys, settings.keyIds, settings.minorForms, settings.chordTypes, settings.inversions, settings.weighting],
    )
    const current: DrillEntry | null = useMemo(
        () => pickChord(pool, roll.previousId, () => roll.value),
        [pool, roll],
    )
    const voicing = useMemo(() => (current ? voiceChord(current.chord) : null), [current])

    const update = (patch: Partial<DrillSettings>) => setSettings((s) => ({ ...s, ...patch }))
    const toggleKey = (id: string) =>
        update({ keyIds: settings.keyIds.includes(id) ? settings.keyIds.filter((k) => k !== id) : [...settings.keyIds, id] })

    const next = () => {
        const value = Math.random()
        const previousId = current?.id ?? null
        setRoll((r) => ({ value, previousId, count: r.count + 1 }))
    }

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (isInteractiveTarget(e.target) || !current) return
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                next()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    })

    const staffEvents: ChordEvent[] | null = useMemo(
        () =>
            current && voicing
                ? [
                    {
                        id: current.id,
                        romanNumeral: current.chord.romanNumeral,
                        symbol: current.chord.symbol,
                        notes: voicing.notes,
                        durationBeats: 4,
                        beatUnit: 4,
                        fingerings: voicing.fingerings,
                    },
                ]
                : null,
        [current, voicing],
    )

    const nameBlock = current ? (
        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography component="p" variant="h3" sx={{ fontWeight: 800 }}>
                {current.chord.symbol}
            </Typography>
            <Typography component="p" variant="h5" color="text.secondary">
                {current.chord.romanNumeral}
            </Typography>
        </Stack>
    ) : null

    const staffBlock = current ? (
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
            {staffEvents ? (
                <ChordStaff events={staffEvents} keySignature={toVexKeySignature(current.key.tonic, current.key.mode)} />
            ) : (
                <Typography color="text.secondary">No playable four-note voicing found.</Typography>
            )}
        </Stack>
    ) : null

    return (
        <Stack spacing={2}>
            <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 700 }}>Practice settings</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {settings.keyIds.length} {settings.keyIds.length === 1 ? 'key' : 'keys'} ·{' '}
                            {CHORD_TYPES.filter((t) => settings.chordTypes.includes(t.value)).map((t) => t.label).join(', ')} ·{' '}
                            {INVERSIONS.filter((i) => settings.inversions.includes(i.value)).map((i) => i.label).join(', ')}
                        </Typography>
                    </Stack>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack spacing={2}>
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Major keys</Typography>
                            <KeyChips keys={allKeys.filter((k) => k.mode === 'major')} selected={settings.keyIds} onToggle={toggleKey} />
                            <Typography variant="subtitle2">Minor keys</Typography>
                            <KeyChips keys={allKeys.filter((k) => k.mode === 'minor')} selected={settings.keyIds} onToggle={toggleKey} />
                            <Stack direction="row" spacing={1}>
                                <Button size="small" onClick={() => update({ keyIds: allKeys.map((k) => k.id) })}>
                                    All keys
                                </Button>
                                <Button size="small" onClick={() => update({ keyIds: [] })}>
                                    Clear
                                </Button>
                            </Stack>
                        </Stack>

                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Chords</Typography>
                            <ToggleButtonGroup
                                value={settings.chordTypes}
                                onChange={(_, value: ChordType[]) => value.length > 0 && update({ chordTypes: value })}
                                aria-label="Chords"
                                size="small"
                                fullWidth
                            >
                                {CHORD_TYPES.map((type) => (
                                    <ToggleButton key={type.value} value={type.value}>
                                        {type.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Inversions</Typography>
                            <ToggleButtonGroup
                                value={settings.inversions}
                                onChange={(_, value: number[]) => value.length > 0 && update({ inversions: value })}
                                aria-label="Inversions"
                                size="small"
                                fullWidth
                            >
                                {INVERSIONS.map((inversion) => (
                                    <ToggleButton key={inversion.value} value={inversion.value}>
                                        {inversion.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Minor forms</Typography>
                            <ToggleButtonGroup
                                value={settings.minorForms}
                                onChange={(_, value: MinorForm[]) => value.length > 0 && update({ minorForms: value })}
                                aria-label="Minor forms"
                                size="small"
                                fullWidth
                            >
                                {MINOR_FORMS.map((form) => (
                                    <ToggleButton key={form} value={form}>
                                        {MINOR_FORM_LABEL[form]}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Chord frequency</Typography>
                            <ToggleButtonGroup
                                value={settings.weighting}
                                exclusive
                                onChange={(_, value) => value && update({ weighting: value })}
                                aria-label="Chord frequency"
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="common">Common in repertoire</ToggleButton>
                                <ToggleButton value="uniform">Equal</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>
                    </Stack>
                </AccordionDetails>
            </Accordion>

            <Card>
                <CardContent>
                    {current ? (
                        <Stack spacing={2.5}>
                            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                                <Typography variant="h6">{keyName(current.key)}</Typography>
                                {current.forms.map((form) => (
                                    <Chip key={form} label={MINOR_FORM_LABEL[form]} size="small" variant="outlined" />
                                ))}
                                <Box sx={{ flexGrow: 1 }} />
                                <Typography variant="body2" color="text.secondary">
                                    Chord {roll.count}
                                </Typography>
                            </Stack>

                            {nameBlock}

                            {staffBlock}

                            <Button variant="contained" onClick={next} fullWidth>
                                Next chord
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Space, Enter or →: next chord
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography>
                            {settings.keyIds.length === 0 ? 'Select at least one key to start.' : 'No chords match these settings.'}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Stack>
    )
}
