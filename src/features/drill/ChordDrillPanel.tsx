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
import { describeCadence } from '../../music/cadence'
import { voiceChord, voiceWithRisingBass } from '../../music/guitarVoicings'
import { toVexKeySignature } from '../../music/noteUtils'
import { MINOR_FORM_LABEL, type MinorForm } from '../../music/theory'
import {
    buildChordPool,
    buildScaleSequence,
    buildVocabulary,
    pickChord,
    resolveChordOptions,
    type CadenceProgression,
    type ChordFocus,
    type ChordType,
    type DisplayMode,
    type DrillEntry,
} from './drill'
import { curatedCadences, positionLabel } from './curatedCadences'
import { loadDrillSettings, saveDrillSettings, type DrillSettings, type Practice } from './drillSettings'
import { curriculumKeys, KEY_TIERS, keysForTier, type KeyChoice, type KeyTier } from './keys'

interface ChordDrillPanelProps {
    curriculum: Curriculum
}

const PRIMARY_MINOR_FORMS: { value: MinorForm; label: string }[] = [
    { value: 'natural', label: 'Natural' },
    { value: 'harmonic', label: 'Harmonic' },
]

const PRACTICE_OPTIONS: { value: Practice; label: string; tooltip: string }[] = [
    { value: 'cadences', label: 'Cadences', tooltip: 'A cadence progression in one key at a time.' },
    { value: 'scale', label: 'Scale chords', tooltip: 'All seven chords of one key, in scale order.' },
    { value: 'tonic', label: 'Tonic inversions', tooltip: 'The tonic chord of one key in root position and its inversions.' },
    { value: 'flashcards', label: 'Flashcards', tooltip: 'One random chord at a time from all the chosen keys.' },
]

const PRACTICE_VIEW: Record<Practice, { displayMode: DisplayMode; focus: ChordFocus }> = {
    cadences: { displayMode: 'sequence', focus: 'cadence' },
    scale: { displayMode: 'sequence', focus: 'all' },
    tonic: { displayMode: 'sequence', focus: 'tonic' },
    flashcards: { displayMode: 'flashcard', focus: 'all' },
}

const CADENCE_PROGRESSIONS: { value: CadenceProgression; label: string; tooltip: string }[] = [
    {
        value: 'basic',
        label: 'V–I',
        tooltip: 'Dominant to tonic: the perfect cadence on its own.',
    },
    {
        value: 'subdominant',
        label: 'I–IV–V–I',
        tooltip: 'Tonic, subdominant, dominant, tonic.',
    },
    {
        value: 'cadential64',
        label: 'Cadential 6/4',
        tooltip:
            'I–IV–V6/4–5/3–I: the tonic chord over the dominant bass (C/G in C major) resolves to V before the tonic.',
    },
    {
        value: 'extended',
        label: 'With vi and V7',
        tooltip: 'I–vi–IV–V6/4–V–V7–I: the cadential 6/4, then V moving to V7 before the tonic.',
    },
]

const TIER_CADENCE: Record<KeyTier, CadenceProgression> = {
    beginner: 'basic',
    intermediate: 'subdominant',
    advanced: 'cadential64',
}

const CHORD_TYPES: { value: ChordType; label: string; tooltip: string }[] = [
    {
        value: 'triads',
        label: 'Triads',
        tooltip: 'Three notes stacked in thirds, one per string: root, 3rd and 5th. In C major: C (C E G), Dm (D F A), G (G B D).',
    },
    {
        value: 'sevenths',
        label: '7th chords',
        tooltip:
            'Adds the 7th above the root, so all four notes are different: Cmaj7 (C E G B), Dm7 (D F A C), G7 (G B D F). Flashcards draw ii7, V7 and vii7.',
    },
    {
        value: 'chromatic',
        label: 'Chromatic',
        tooltip:
            'Chords using notes outside the key. V7/V, the dominant of the dominant: D7 in C, leading to G. N6, the Neapolitan sixth: D♭/F in C, leading to V.',
    },
]

const CADENCE_CHORD_TYPES: Partial<Record<ChordType, { label: string; tooltip: string }>> = {
    triads: { label: 'V', tooltip: 'The dominant as a plain triad, as in the curated cadences.' },
    sevenths: { label: 'V7', tooltip: 'Adds the 7th to the dominant: G7 (G B D F) in C major.' },
}

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

    const practice = settings.practice
    const { displayMode, focus } = PRACTICE_VIEW[practice]
    const cadence = settings.cadence
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
        update({ keyIds, activeKeyId: keyIds[0], cadence: TIER_CADENCE[tier] })
    }

    const clearKeys = () => {
        update({ keyIds: [] })
    }

    const [roll, setRoll] = useState(() => ({ value: Math.random(), previousId: null as string | null, count: 1 }))

    useEffect(() => {
        saveDrillSettings(settings)
    }, [settings])

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
                    cadence,
                )
                : [],
        [activeKey, focus, settings.minorForms, chordOptions, cadence],
    )

    // Curated voicings, exactly as written, whenever the key has one and plain root-position triads are chosen
    const curated = useMemo(() => {
        if (!activeKey || chordOptions.chordTypes[0] !== 'triads') return []
        const rootOnly = chordOptions.inversions.length === 1 && chordOptions.inversions[0] === 0
        if (!rootOnly) return []
        if (focus === 'cadence') return curatedCadences(curriculum, activeKey, cadence)
        if (focus === 'tonic') return curatedCadences(curriculum, activeKey, 'tonic')
        return []
    }, [activeKey, chordOptions, focus, cadence, curriculum])

    const chipLabels = curated.length > 0 ? curated[0].map((e) => e.romanNumeral) : sequenceChords.map((item) => item.label)

    const cadenceDescription = useMemo(
        () => (focus === 'cadence' ? describeCadence(curated[0]?.map((e) => e.romanNumeral) ?? sequenceChords.map((item) => item.romanNumeral)) : null),
        [focus, curated, sequenceChords],
    )

    const sequenceEvents: ChordEvent[] = useMemo(() => {
        const chords = sequenceChords.map((item) => item.chord)
        // Cadences keep the four-note guitar shapes of the curated cadences
        const threeNoteTriads = practice !== 'cadences'
        const voicings =
            focus === 'all'
                ? voiceWithRisingBass(chords, { threeNoteTriads })
                : chords.map((chord) => voiceChord(chord, { threeNoteTriads }))
        const events: ChordEvent[] = []
        sequenceChords.forEach((item, idx) => {
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
        })
        return events
    }, [sequenceChords, focus, practice])

    // Single chord pool for flashcard mode
    const pool = useMemo(
        () =>
            buildChordPool({
                keys: allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id)),
                minorForms: settings.minorForms,
                vocabulary: buildVocabulary(chordOptions.chordTypes, chordOptions.inversions, focus, cadence),
                weighting: 'common',
            }),
        [allCurriculumKeys, settings.keyIds, settings.minorForms, chordOptions, focus, cadence],
    )

    const current: DrillEntry | null = useMemo(
        () => pickChord(pool, roll.previousId, () => roll.value),
        [pool, roll],
    )

    const singleVoicing = useMemo(() => (current ? voiceChord(current.chord, { threeNoteTriads: true }) : null), [current])

    const next = () => {
        const value = Math.random()
        const previousId = current?.id ?? null
        setRoll((r) => ({ value, previousId, count: r.count + 1 }))
        if (displayMode === 'sequence') {
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
        if (!current || !singleVoicing) return null
        return [{
            id: current.id,
            romanNumeral: current.chord.romanNumeral,
            symbol: current.chord.symbol,
            durationBeats: 4,
            beatUnit: 4,
            notes: singleVoicing.notes,
            fingerings: singleVoicing.fingerings,
        }]
    }, [current, singleVoicing])

    const keySetSummary = activeTier ? `${activeTier.label} keys` : 'Custom keys'

    const focusSummary = useMemo(() => {
        const label = PRACTICE_OPTIONS.find((p) => p.value === practice)?.label ?? ''
        if (practice !== 'cadences') return label
        return `${label} ${CADENCE_PROGRESSIONS.find((p) => p.value === cadence)?.label ?? ''}`
    }, [practice, cadence])

    const hasSelectedMinorKey = useMemo(
        () => allCurriculumKeys.some((k) => k.mode === 'minor' && settings.keyIds.includes(k.id)),
        [allCurriculumKeys, settings.keyIds],
    )
    // Scale chords show one key at a time, so the choice matters only while that key is minor
    const showMinorHarmony =
        practice === 'flashcards' ? hasSelectedMinorKey : practice === 'scale' && activeKey?.mode === 'minor'

    const settingsSummary = useMemo(
        () =>
            [
                keySetSummary,
                `${settings.keyIds.length} ${settings.keyIds.length === 1 ? 'key' : 'keys'}`,
                focusSummary,
            ].join(' · '),
        [keySetSummary, settings.keyIds.length, focusSummary],
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
                        {/* Practice comes first: it decides which options apply below */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Practice</Typography>
                            <ToggleButtonGroup
                                value={practice}
                                exclusive
                                onChange={(_, value: Practice | null) => value && update({ practice: value })}
                                aria-label="Practice"
                                size="small"
                                fullWidth
                            >
                                {PRACTICE_OPTIONS.map((opt) => (
                                    <Tooltip key={opt.value} title={opt.tooltip} describeChild enterTouchDelay={400}>
                                        <ToggleButton value={opt.value}>{opt.label}</ToggleButton>
                                    </Tooltip>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        {practice === 'cadences' && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Cadence progression</Typography>
                                <ToggleButtonGroup
                                    value={cadence}
                                    exclusive
                                    onChange={(_, value: CadenceProgression | null) => value && update({ cadence: value })}
                                    aria-label="Cadence progression"
                                    size="small"
                                    fullWidth
                                >
                                    {CADENCE_PROGRESSIONS.map((p) => (
                                        <Tooltip key={p.value} title={p.tooltip} describeChild enterTouchDelay={400}>
                                            <ToggleButton value={p.value}>{p.label}</ToggleButton>
                                        </Tooltip>
                                    ))}
                                </ToggleButtonGroup>
                            </Stack>
                        )}

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

                        {/* Chord types (Tonic inversions always uses triads) */}
                        {practice !== 'tonic' && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">{practice === 'cadences' ? 'Dominant' : 'Chords'}</Typography>
                                <ToggleButtonGroup
                                    value={chordOptions.singleChoice ? chordOptions.chordTypes[0] : chordOptions.chordTypes}
                                    exclusive={chordOptions.singleChoice}
                                    onChange={(_, value: ChordType | ChordType[] | null) => handleChordTypesChange(value)}
                                    aria-label="Chords"
                                    size="small"
                                    fullWidth
                                >
                                    {CHORD_TYPES.filter((type) => chordOptions.allowedTypes.includes(type.value)).map((type) => {
                                        const cadence = practice === 'cadences' ? CADENCE_CHORD_TYPES[type.value] : undefined
                                        return (
                                            <Tooltip key={type.value} title={cadence?.tooltip ?? type.tooltip} describeChild enterTouchDelay={400}>
                                                <ToggleButton value={type.value}>{cadence?.label ?? type.label}</ToggleButton>
                                            </Tooltip>
                                        )
                                    })}
                                </ToggleButtonGroup>
                            </Stack>
                        )}

                        {/* Inversions: one at a time in Cadences and Scale chords */}
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
                                {INVERSIONS.filter((inversion) => inversion.value <= chordOptions.maxInversion).map((inversion) => (
                                    <ToggleButton key={inversion.value} value={inversion.value}>
                                        {inversion.label}
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Minor Harmony */}
                        {showMinorHarmony && (
                            <Stack spacing={1}>
                                <Typography variant="subtitle2">Minor keys use</Typography>
                                <ToggleButtonGroup
                                    value={settings.minorForms[0] === 'natural' ? 'natural' : 'harmonic'}
                                    exclusive
                                    onChange={(_, value: MinorForm | null) => value && update({ minorForms: [value] })}
                                    aria-label="Minor keys use"
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
                        /* Sequence View: renders all chords of the active key at once */
                        <Stack spacing={2.5}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                                <Button size="small" onClick={prevScale} startIcon={<ChevronLeftIcon />}>
                                    Previous key
                                </Button>
                                <Stack spacing={0.25} sx={{ alignItems: 'center' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                                        {keyName(activeKey)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {focusSummary}
                                    </Typography>
                                </Stack>
                                <Button size="small" onClick={nextScale} endIcon={<ChevronRightIcon />}>
                                    Next key
                                </Button>
                            </Stack>

                            {/* Scale degree pills */}
                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                                {chipLabels.map((label, i) => (
                                    <Chip
                                        key={`${i}:${label}`}
                                        label={label}
                                        color="primary"
                                        variant="filled"
                                        sx={{ fontWeight: 700, fontSize: '0.95rem', py: 0.25 }}
                                    />
                                ))}
                            </Stack>

                            {cadenceDescription && (
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                                        {cadenceDescription.name} ({cadenceDescription.numerals})
                                    </Box>
                                    {' — '}
                                    {cadenceDescription.description}
                                </Typography>
                            )}

                            {/* Staff rendering all chords together */}
                            {curated.length > 0 ? (
                                curated.map((events, i) => {
                                    const position = positionLabel(events)
                                    const caption = [i > 0 ? 'Alternative fingering' : null, position].filter(Boolean).join(' · ')
                                    return (
                                        <Stack key={events[0].id} spacing={0.5}>
                                            {caption ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    {caption}
                                                </Typography>
                                            ) : null}
                                            <ChordStaff
                                                events={events}
                                                keySignature={toVexKeySignature(activeKey.tonic, activeKey.mode)}
                                                endBarline={true}
                                            />
                                        </Stack>
                                    )
                                })
                            ) : sequenceEvents.length > 0 ? (
                                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    <ChordStaff
                                        events={sequenceEvents}
                                        keySignature={toVexKeySignature(activeKey.tonic, activeKey.mode)}
                                        endBarline={true}
                                    />
                                </Box>
                            ) : (
                                <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                                    No playable voicings found for these settings.
                                </Typography>
                            )}

                            <Typography variant="body2" color="text.secondary">
                                Key {activeKeyIndex + 1} of {settings.keyIds.length}
                            </Typography>

                            <Button variant="contained" onClick={next} fullWidth>
                                Next key
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                Space, Enter or →: next key · ←: previous key
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
