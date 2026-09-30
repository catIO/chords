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
    Tooltip,
    Typography,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ChordEvent, Curriculum } from '../../types/curriculum'
import { ChordStaff } from '../../components/ChordStaff'
import { voiceChord, voiceWithRisingBass } from '../../music/guitarVoicings'
import { toVexKeySignature } from '../../music/noteUtils'
import { MINOR_FORM_LABEL, closePositionNotes, type MinorForm } from '../../music/theory'
import {
    buildChordPool,
    buildScaleSequence,
    buildVocabulary,
    pickChord,
    resolveChordOptions,
    type ChordFocus,
    type ChordType,
    type DrillEntry,
} from './drill'
import { loadDrillSettings, saveDrillSettings, type DrillSettings } from './drillSettings'
import { curriculumKeys, KEY_TIERS, keysForTier, type KeyChoice, type KeyTier } from './keys'

interface ChordDrillPanelProps {
    curriculum: Curriculum
}

const PRIMARY_MINOR_FORMS: { value: MinorForm; label: string }[] = [
    { value: 'natural', label: 'Natural' },
    { value: 'harmonic', label: 'Harmonic' },
]

const CHORD_FOCUS_OPTIONS: { value: ChordFocus; label: string }[] = [
    { value: 'cadence', label: 'Cadence (tonic–dominant–tonic)' },
    { value: 'tonic', label: 'Tonic only' },
    { value: 'all', label: 'All degrees' },
]

const CHORD_TYPES: { value: ChordType; label: string; tooltip: string }[] = [
    {
        value: 'triads',
        label: 'Triads',
        tooltip: 'Three notes stacked in thirds: root, 3rd, 5th. In C major: C (C E G), Dm (D F A), G (G B D).',
    },
    {
        value: 'sevenths',
        label: '7th chords',
        tooltip:
            'A triad plus the 7th above the root. Drills ii7, V7 and vii7 — in C major: Dm7 (D F A C), G7 (G B D F), Bø7 (B D F A). With Cadence focus only V7 is used.',
    },
    {
        value: 'chromatic',
        label: 'Chromatic',
        tooltip:
            'Chords using notes outside the key. V7/V, the dominant of the dominant: D7 in C, leading to G. N6, the Neapolitan sixth: D♭/F in C, leading to V. Requires Single chord flashcard with All degrees.',
    },
]

const INVERSIONS = [
    { value: 0, label: 'Root pos.' },
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

function KeyChips({
    keys,
    selected,
    onToggle,
}: {
    keys: KeyChoice[]
    selected: string[]
    onToggle: (id: string) => void
}) {
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
    const allCurriculumKeys = useMemo(() => curriculumKeys(curriculum), [curriculum])

    const [settings, setSettings] = useState<DrillSettings>(() =>
        loadDrillSettings(allCurriculumKeys.map((k) => k.id)),
    )

    const tierKeyIds = useMemo(
        () => new Map(KEY_TIERS.map((t) => [t.value, keysForTier(curriculum, t.value).map((k) => k.id)])),
        [curriculum],
    )

    // Derived rather than stored, so editing individual keys shows as a custom set.
    const activeTier = useMemo(() => {
        const selected = new Set(settings.keyIds)
        return KEY_TIERS.find((t) => {
            const ids = tierKeyIds.get(t.value) ?? []
            return ids.length === selected.size && ids.every((id) => selected.has(id))
        }) ?? null
    }, [settings.keyIds, tierKeyIds])

    const update = (patch: Partial<DrillSettings>) => setSettings((s) => ({ ...s, ...patch }))

    const displayMode = settings.displayMode ?? 'sequence'
    const focus = settings.chordFocus ?? 'cadence'
    const chordOptions = useMemo(
        () => resolveChordOptions(displayMode, focus, settings.chordTypes, settings.inversions),
        [displayMode, focus, settings.chordTypes, settings.inversions],
    )

    const activeKey = useMemo(() => {
        const selectedKeys = allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id))
        if (selectedKeys.length === 0) return allCurriculumKeys[0] ?? null
        if (settings.activeKeyId) {
            const found = selectedKeys.find((k) => k.id === settings.activeKeyId)
            if (found) return found
        }
        return selectedKeys[0]
    }, [allCurriculumKeys, settings.activeKeyId, settings.keyIds])

    const activeKeyIndex = useMemo(() => {
        const selectedKeys = allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id))
        return activeKey ? selectedKeys.findIndex((k) => k.id === activeKey.id) : 0
    }, [allCurriculumKeys, settings.keyIds, activeKey])

    const nextScale = () => {
        const selectedKeys = allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id))
        if (selectedKeys.length === 0) return
        const nextIdx = (activeKeyIndex + 1) % selectedKeys.length
        update({ activeKeyId: selectedKeys[nextIdx].id })
    }

    const prevScale = () => {
        const selectedKeys = allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id))
        if (selectedKeys.length === 0) return
        const prevIdx = (activeKeyIndex - 1 + selectedKeys.length) % selectedKeys.length
        update({ activeKeyId: selectedKeys[prevIdx].id })
    }

    const toggleKey = (id: string) => {
        const isSelected = settings.keyIds.includes(id)
        if (!isSelected) {
            update({
                keyIds: [...settings.keyIds, id],
                activeKeyId: id,
            })
        } else {
            if (settings.activeKeyId !== id) {
                update({ activeKeyId: id })
            } else if (settings.keyIds.length > 1) {
                const updatedKeyIds = settings.keyIds.filter((k) => k !== id)
                update({
                    keyIds: updatedKeyIds,
                    activeKeyId: updatedKeyIds[0],
                })
            }
        }
    }

    const handleChordTypesChange = (value: ChordType | ChordType[] | null) => {
        const types = value === null ? [] : Array.isArray(value) ? value : [value]
        if (types.length > 0) update({ chordTypes: types })
    }

    const handleInversionsChange = (value: number | number[] | null) => {
        const invs = value === null ? [] : Array.isArray(value) ? value : [value]
        if (invs.length > 0) update({ inversions: invs })
    }

    const selectTier = (tier: KeyTier) => {
        const keyIds = tierKeyIds.get(tier) ?? []
        update({ keyIds, activeKeyId: keyIds[0] })
    }

    const clearKeys = () => {
        update({ keyIds: [] })
    }

    const [roll, setRoll] = useState(() => ({ value: Math.random(), previousId: null as string | null, count: 1 }))

    useEffect(() => {
        saveDrillSettings(settings)
    }, [settings])

    const useGuitarVoicings = settings.voicing === 'guitar'
    const voicingSummary = useGuitarVoicings ? 'Guitar voicing' : 'Close position'

    // Full sequence for active key
    const sequenceChords = useMemo(
        () =>
            activeKey
                ? buildScaleSequence(
                    activeKey,
                    focus,
                    settings.minorForms,
                    chordOptions.inversions,
                    chordOptions.chordTypes,
                )
                : [],
        [activeKey, focus, settings.minorForms, chordOptions],
    )

    const sequenceEvents: ChordEvent[] = useMemo(() => {
        const chords = sequenceChords.map((item) => item.chord)
        const voicings = !useGuitarVoicings
            ? []
            : focus === 'all'
                ? voiceWithRisingBass(chords)
                : chords.map((chord) => voiceChord(chord))
        const events: ChordEvent[] = []
        sequenceChords.forEach((item, idx) => {
            if (useGuitarVoicings) {
                const v = voicings[idx]
                if (v) {
                    events.push({
                        id: item.id,
                        romanNumeral: item.romanNumeral,
                        symbol: item.symbol,
                        notes: v.notes,
                        durationBeats: 4,
                        beatUnit: 4,
                        fingerings: v.fingerings,
                    })
                }
            } else {
                events.push({
                    id: item.id,
                    romanNumeral: item.romanNumeral,
                    symbol: item.symbol,
                    notes: item.notes,
                    durationBeats: 4,
                    beatUnit: 4,
                })
            }
        })
        return events
    }, [sequenceChords, useGuitarVoicings, focus])

    // Single chord pool for flashcard mode
    const pool = useMemo(
        () =>
            buildChordPool({
                keys: allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id)),
                minorForms: settings.minorForms,
                vocabulary: buildVocabulary(chordOptions.chordTypes, chordOptions.inversions, focus),
                weighting: 'common',
            }),
        [allCurriculumKeys, settings.keyIds, settings.minorForms, chordOptions, focus],
    )

    const current: DrillEntry | null = useMemo(
        () => pickChord(pool, roll.previousId, () => roll.value),
        [pool, roll],
    )

    const singleVoicing = useMemo(
        () => (current && useGuitarVoicings ? voiceChord(current.chord) : null),
        [current, useGuitarVoicings],
    )

    const next = () => {
        const value = Math.random()
        const previousId = current?.id ?? null
        setRoll((r) => ({ value, previousId, count: r.count + 1 }))
        if ((settings.displayMode ?? 'sequence') === 'sequence') {
            nextScale()
        }
    }

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (isInteractiveTarget(e.target)) return
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                next()
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault()
                prevScale()
            }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    })

    const flashcardStaffEvents: ChordEvent[] | null = useMemo(() => {
        if (!current) return null
        const event = {
            id: current.id,
            romanNumeral: current.chord.romanNumeral,
            symbol: current.chord.symbol,
            durationBeats: 4,
            beatUnit: 4,
        }
        if (!useGuitarVoicings) return [{ ...event, notes: closePositionNotes(current.chord) }]
        return singleVoicing ? [{ ...event, notes: singleVoicing.notes, fingerings: singleVoicing.fingerings }] : null
    }, [current, singleVoicing, useGuitarVoicings])

    const keySetSummary = activeTier ? `${activeTier.label} keys` : 'Custom keys'

    const focusSummary = useMemo(() => {
        if (focus === 'tonic') return 'Tonic only'
        if (focus === 'all') return 'All degrees'
        return 'Cadence (tonic–dominant–tonic)'
    }, [focus])

    const hasSelectedMinorKey = useMemo(
        () => allCurriculumKeys.some((k) => k.mode === 'minor' && settings.keyIds.includes(k.id)),
        [allCurriculumKeys, settings.keyIds],
    )
    const showMinorHarmony = hasSelectedMinorKey && focus === 'all'

    const settingsSummary = useMemo(
        () =>
            [
                keySetSummary,
                `${settings.keyIds.length} ${settings.keyIds.length === 1 ? 'scale' : 'scales'}`,
                focusSummary,
                displayMode === 'sequence' ? 'Sequence view' : 'Flashcard',
                voicingSummary,
            ].join(' · '),
        [keySetSummary, settings.keyIds.length, focusSummary, displayMode, voicingSummary],
    )

    return (
        <Stack spacing={2}>
            <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack spacing={0.25}>
                        <Typography sx={{ fontWeight: 700 }}>Practice settings</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {settingsSummary}
                        </Typography>
                    </Stack>
                </AccordionSummary>
                <AccordionDetails>
                    <Stack spacing={2.5}>
                        {/* Display format comes first: it decides which chord options apply below */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Display format</Typography>
                            <ToggleButtonGroup
                                value={displayMode}
                                exclusive
                                onChange={(_, value) => value && update({ displayMode: value })}
                                aria-label="Display format"
                                size="small"
                                fullWidth
                            >
                                <ToggleButton value="sequence">Scale sequence (all chords at once)</ToggleButton>
                                <ToggleButton value="flashcard">Single chord flashcard</ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Key set */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Key set</Typography>
                            <ToggleButtonGroup
                                value={activeTier?.value ?? null}
                                exclusive
                                onChange={(_, value: KeyTier | null) => value && selectTier(value)}
                                aria-label="Key set"
                                size="small"
                                fullWidth
                            >
                                {KEY_TIERS.map((tier) => (
                                    <ToggleButton key={tier.value} value={tier.value}>
                                        {tier.label} ({tierKeyIds.get(tier.value)?.length ?? 0})
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Major & Minor Keys */}
                        <Stack spacing={1}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2">Major keys</Typography>
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" onClick={() => update({ keyIds: allCurriculumKeys.map((k) => k.id) })}>
                                        All keys
                                    </Button>
                                    <Button size="small" onClick={clearKeys}>
                                        Clear
                                    </Button>
                                </Stack>
                            </Stack>
                            <KeyChips
                                keys={allCurriculumKeys.filter((k) => k.mode === 'major')}
                                selected={settings.keyIds}
                                onToggle={toggleKey}
                            />

                            <Typography variant="subtitle2" sx={{ mt: 1 }}>Minor keys</Typography>
                            <KeyChips
                                keys={allCurriculumKeys.filter((k) => k.mode === 'minor')}
                                selected={settings.keyIds}
                                onToggle={toggleKey}
                            />
                        </Stack>

                        {/* Harmony Focus */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Harmony focus</Typography>
                            <ToggleButtonGroup
                                value={focus}
                                exclusive
                                onChange={(_, value: ChordFocus | null) => value && update({ chordFocus: value })}
                                aria-label="Harmony focus"
                                size="small"
                                fullWidth
                            >
                                {CHORD_FOCUS_OPTIONS.map((opt) => (
                                    <ToggleButton key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Chord Types (Tonic only always uses triads) */}
                        {focus !== 'tonic' && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Chords</Typography>
                                <ToggleButtonGroup
                                    value={chordOptions.singleChoice ? chordOptions.chordTypes[0] : chordOptions.chordTypes}
                                    exclusive={chordOptions.singleChoice}
                                    onChange={(_, value: ChordType | ChordType[] | null) => handleChordTypesChange(value)}
                                    aria-label="Chords"
                                    size="small"
                                    fullWidth
                                >
                                    {CHORD_TYPES.map((type) => (
                                        // Span wrapper lets the tooltip show on the disabled Chromatic button.
                                        <Tooltip key={type.value} title={type.tooltip} describeChild enterTouchDelay={400}>
                                            <Box component="span" sx={{ flex: 1, display: 'flex' }}>
                                                <ToggleButton
                                                    value={type.value}
                                                    disabled={!chordOptions.allowedTypes.includes(type.value)}
                                                >
                                                    {type.label}
                                                </ToggleButton>
                                            </Box>
                                        </Tooltip>
                                    ))}
                                </ToggleButtonGroup>
                            </Stack>
                        )}

                        {/* Voicing */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Voicing</Typography>
                            <ToggleButtonGroup
                                value={settings.voicing ?? 'close'}
                                exclusive
                                onChange={(_, value) => value && update({ voicing: value })}
                                aria-label="Voicing"
                                size="small"
                                fullWidth
                            >
                                <Tooltip
                                    title="Every chord tone stacked as tightly as possible on a plain treble staff, e.g. C E G. Shows how the chord is built."
                                    describeChild
                                    enterTouchDelay={400}
                                >
                                    <ToggleButton value="close">Close position</ToggleButton>
                                </Tooltip>
                                <Tooltip
                                    title="A playable classical guitar shape: thumb on the bass, i-m-a on three higher strings, with left-hand fingerings."
                                    describeChild
                                    enterTouchDelay={400}
                                >
                                    <ToggleButton value="guitar">Guitar</ToggleButton>
                                </Tooltip>
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Inversions: one at a time in a scale sequence, except Tonic only which shows each */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Inversions</Typography>
                            <ToggleButtonGroup
                                value={chordOptions.singleChoice ? chordOptions.inversions[0] : chordOptions.inversions}
                                exclusive={chordOptions.singleChoice}
                                onChange={(_, value: number | number[] | null) => handleInversionsChange(value)}
                                aria-label="Inversions"
                                size="small"
                                fullWidth
                            >
                                {INVERSIONS.map((inversion) => (
                                    <ToggleButton
                                        key={inversion.value}
                                        value={inversion.value}
                                        disabled={inversion.value > chordOptions.maxInversion}
                                    >
                                        {inversion.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Minor Harmony */}
                        {showMinorHarmony && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Minor harmony</Typography>
                                <ToggleButtonGroup
                                    value={settings.minorForms[0] === 'natural' ? 'natural' : 'harmonic'}
                                    exclusive
                                    onChange={(_, value: MinorForm | null) => value && update({ minorForms: [value] })}
                                    aria-label="Minor harmony"
                                    size="small"
                                    fullWidth
                                >
                                    {PRIMARY_MINOR_FORMS.map((form) => (
                                        <ToggleButton key={form.value} value={form.value}>
                                            {form.label}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Stack>
                        )}
                    </Stack>
                </AccordionDetails>
            </Accordion>

            <Card>
                <CardContent>
                    {settings.keyIds.length === 0 ? (
                        <Typography>
                            Select at least one key to start.
                        </Typography>
                    ) : displayMode === 'sequence' && activeKey ? (
                        /* Sequence View: Renders all chords of the active scale at once */
                        <Stack spacing={2.5}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Button size="small" onClick={prevScale} startIcon={<ChevronLeftIcon />}>
                                    Prev scale
                                </Button>
                                <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                        {keyName(activeKey)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {focusSummary} · {voicingSummary}
                                    </Typography>
                                </Stack>
                                <Button size="small" onClick={nextScale} endIcon={<ChevronRightIcon />}>
                                    Next scale
                                </Button>
                            </Stack>

                            {/* Scale degree pills */}
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                                {sequenceChords.map((item) => (
                                    <Chip
                                        key={item.id}
                                        label={item.label}
                                        color="primary"
                                        variant="filled"
                                        sx={{ fontWeight: 700, fontSize: '0.95rem', py: 0.25 }}
                                    />
                                ))}
                            </Stack>

                            {/* Staff rendering all chords together */}
                            {sequenceEvents.length > 0 ? (
                                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <ChordStaff
                                        events={sequenceEvents}
                                        keySignature={toVexKeySignature(activeKey.tonic, activeKey.mode)}
                                        showAnnotations={!useGuitarVoicings}
                                        showFingerings={useGuitarVoicings}
                                        clef={useGuitarVoicings ? '8vb' : 'treble'}
                                        endBarline={true}
                                    />
                                </Box>
                            ) : (
                                <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                                    No playable voicings found for these settings.
                                </Typography>
                            )}

                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    Scale {activeKeyIndex + 1} of {settings.keyIds.length}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Chord {roll.count}
                                </Typography>
                            </Stack>

                            <Button variant="contained" onClick={next} fullWidth>
                                Next chord
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Space, Enter or →: next chord / scale · ←: previous scale
                            </Typography>
                        </Stack>
                    ) : current ? (
                        /* Flashcard View: Single chord */
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

                            <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                                <Typography component="p" variant="h3" sx={{ fontWeight: 800 }}>
                                    {current.chord.symbol}
                                </Typography>
                                <Typography component="p" variant="h5" color="text.secondary">
                                    {current.chord.romanNumeral}
                                    {current.chord.inversion > 0
                                        ? ` · ${INVERSIONS.find((inv) => inv.value === current.chord.inversion)?.label ?? ''}`
                                        : ' · Root pos.'}
                                </Typography>
                            </Stack>

                            <Stack spacing={1} sx={{ alignItems: 'center' }}>
                                {flashcardStaffEvents ? (
                                    <ChordStaff
                                        events={flashcardStaffEvents}
                                        keySignature={toVexKeySignature(current.key.tonic, current.key.mode)}
                                        showFingerings={useGuitarVoicings}
                                        clef={useGuitarVoicings ? '8vb' : 'treble'}
                                    />
                                ) : (
                                    <Typography color="text.secondary">No playable voicing found.</Typography>
                                )}
                            </Stack>

                            <Button variant="contained" onClick={next} fullWidth>
                                Next chord
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Space, Enter or →: next chord
                            </Typography>
                        </Stack>
                    ) : (
                        <Typography>
                            No chords match these settings.
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Stack>
    )
}
