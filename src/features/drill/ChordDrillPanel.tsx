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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { ChordEvent, Curriculum } from '../../types/curriculum'
import { gradeDisplayName, gradeOptions } from '../../data/curriculum'
import { ChordStaff } from '../../components/ChordStaff'
import { voiceChord } from '../../music/guitarVoicings'
import { toVexKeySignature } from '../../music/noteUtils'
import { MINOR_FORM_LABEL, type MinorForm } from '../../music/theory'
import {
    buildChordPool,
    buildScaleSequence,
    buildVocabulary,
    pickChord,
    type ChordFocus,
    type ChordType,
    type DrillEntry,
} from './drill'
import { loadDrillSettings, saveDrillSettings, type DrillSettings } from './drillSettings'
import { curriculumKeys, keysForGrades, type KeyChoice } from './keys'

interface ChordDrillPanelProps {
    curriculum: Curriculum
    grade?: string
    onGradeChange?: (grade: string) => void
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

const CHORD_TYPES: { value: ChordType; label: string }[] = [
    { value: 'triads', label: 'Triads' },
    { value: 'sevenths', label: 'ii7 · V7 · vii7' },
    { value: 'chromatic', label: 'V7/V · N6' },
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

export function ChordDrillPanel({ curriculum, grade: externalGrade, onGradeChange }: ChordDrillPanelProps) {
    const allCurriculumKeys = useMemo(() => curriculumKeys(curriculum), [curriculum])

    const [settings, setSettings] = useState<DrillSettings>(() =>
        loadDrillSettings(allCurriculumKeys.map((k) => k.id), externalGrade ?? 'all'),
    )

    const selectedGrades = useMemo(() => settings.selectedGrades ?? [], [settings.selectedGrades])

    const update = (patch: Partial<DrillSettings>) => setSettings((s) => ({ ...s, ...patch }))

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

    const handleChordTypesChange = (newTypes: ChordType[]) => {
        if (newTypes.length === 0) return
        const patch: Partial<DrillSettings> = { chordTypes: newTypes }
        if (!newTypes.includes('sevenths') && settings.inversions.includes(3)) {
            const newInvs = settings.inversions.filter((i) => i !== 3)
            patch.inversions = newInvs.length > 0 ? newInvs : [0]
        }
        update(patch)
    }

    const handleInversionsChange = (newInvs: number[]) => {
        if (newInvs.length === 0) return
        const validInvs = !settings.chordTypes.includes('sevenths')
            ? newInvs.filter((i) => i !== 3)
            : newInvs
        if (validInvs.length > 0) {
            update({ inversions: validInvs })
        }
    }

    const toggleGrade = (gradeToToggle: string) => {
        const isCurrentlySelected = selectedGrades.includes(gradeToToggle)
        const newSelectedGrades = isCurrentlySelected
            ? selectedGrades.filter((g) => g !== gradeToToggle)
            : [...selectedGrades, gradeToToggle]

        if (!isCurrentlySelected) {
            const keysOfNewGrade = keysForGrades(curriculum, [gradeToToggle]).map((k) => k.id)
            const combinedKeyIds = Array.from(new Set([...settings.keyIds, ...keysOfNewGrade]))
            update({
                selectedGrades: newSelectedGrades,
                keyIds: combinedKeyIds,
                activeKeyId: keysOfNewGrade[0] ?? settings.activeKeyId,
            })
            if (onGradeChange) onGradeChange(gradeToToggle)
        } else {
            const remainingGradeKeys = new Set(keysForGrades(curriculum, newSelectedGrades).map((k) => k.id))
            const removedGradeKeys = new Set(keysForGrades(curriculum, [gradeToToggle]).map((k) => k.id))
            const updatedKeyIds = settings.keyIds.filter(
                (id) => !removedGradeKeys.has(id) || remainingGradeKeys.has(id),
            )
            update({
                selectedGrades: newSelectedGrades,
                keyIds: updatedKeyIds,
            })
        }
    }

    const selectAllGrades = () => {
        update({
            selectedGrades: gradeOptions,
            keyIds: allCurriculumKeys.map((k) => k.id),
        })
    }

    const clearGrades = () => {
        update({
            selectedGrades: [],
            keyIds: [],
        })
    }

    const [roll, setRoll] = useState(() => ({ value: Math.random(), previousId: null as string | null, count: 1 }))

    useEffect(() => {
        saveDrillSettings(settings)
    }, [settings])

    const isThreeNote = (settings.triadVoicing ?? '3-note') === '3-note'
    const useGuitarVoicings = settings.triadVoicing === '4-note'

    // Full sequence for active key
    const sequenceChords = useMemo(
        () =>
            activeKey
                ? buildScaleSequence(
                    activeKey,
                    settings.chordFocus ?? 'cadence',
                    settings.minorForms,
                    settings.inversions,
                    settings.chordTypes,
                )
                : [],
        [activeKey, settings.chordFocus, settings.minorForms, settings.inversions, settings.chordTypes],
    )

    const sequenceEvents: ChordEvent[] = useMemo(() => {
        const events: ChordEvent[] = []
        for (const item of sequenceChords) {
            if (useGuitarVoicings) {
                const v = voiceChord(item.chord, { threeNote: false })
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
        }
        return events
    }, [sequenceChords, useGuitarVoicings])

    // Single chord pool for flashcard mode
    const pool = useMemo(
        () =>
            buildChordPool({
                keys: allCurriculumKeys.filter((k) => settings.keyIds.includes(k.id)),
                minorForms: settings.minorForms,
                vocabulary: buildVocabulary(settings.chordTypes, settings.inversions, settings.chordFocus ?? 'cadence'),
                weighting: settings.weighting,
            }),
        [allCurriculumKeys, settings.keyIds, settings.minorForms, settings.chordTypes, settings.inversions, settings.chordFocus, settings.weighting],
    )

    const current: DrillEntry | null = useMemo(
        () => pickChord(pool, roll.previousId, () => roll.value),
        [pool, roll],
    )

    const singleVoicing = useMemo(
        () => (current ? voiceChord(current.chord, { threeNote: isThreeNote }) : null),
        [current, isThreeNote],
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

    const flashcardStaffEvents: ChordEvent[] | null = useMemo(
        () =>
            current && singleVoicing
                ? [
                    {
                        id: current.id,
                        romanNumeral: current.chord.romanNumeral,
                        symbol: current.chord.symbol,
                        notes: singleVoicing.notes,
                        durationBeats: 4,
                        beatUnit: 4,
                        fingerings: singleVoicing.fingerings,
                    },
                ]
                : null,
        [current, singleVoicing],
    )

    const levelsSummary = useMemo(() => {
        if (selectedGrades.length === 0) return 'Custom keys'
        if (selectedGrades.length === gradeOptions.length) return 'All levels'
        return `Levels ${selectedGrades.map((g) => (g === 'Preparatory' ? 'Prep' : g)).join(', ')}`
    }, [selectedGrades])

    const focusSummary = useMemo(() => {
        const focus = settings.chordFocus ?? 'cadence'
        if (focus === 'tonic') return 'Tonic only'
        if (focus === 'all') return 'All degrees'
        return 'Cadence (tonic–dominant–tonic)'
    }, [settings.chordFocus])

    const hasSelectedMinorKey = useMemo(
        () => allCurriculumKeys.some((k) => k.mode === 'minor' && settings.keyIds.includes(k.id)),
        [allCurriculumKeys, settings.keyIds],
    )
    const showMinorHarmony = hasSelectedMinorKey && (settings.chordFocus ?? 'cadence') === 'all'

    const displayMode = settings.displayMode ?? 'sequence'

    const settingsSummary = useMemo(() => {
        const parts = [
            levelsSummary,
            `${settings.keyIds.length} ${settings.keyIds.length === 1 ? 'scale' : 'scales'}`,
            focusSummary,
            displayMode === 'sequence' ? 'Sequence view' : 'Flashcard',
        ]
        if (settings.chordTypes.includes('triads')) {
            parts.push(isThreeNote ? '3-note triads' : '4-note voicings')
        }
        return parts.join(' · ')
    }, [levelsSummary, settings.keyIds.length, focusSummary, displayMode, settings.chordTypes, isThreeNote])

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
                        {/* Section 1: Curriculum Levels */}
                        <Stack spacing={1}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2">Curriculum levels</Typography>
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" onClick={selectAllGrades}>
                                        All levels
                                    </Button>
                                    <Button size="small" onClick={() => update({ selectedGrades: [] })}>
                                        Deselect levels
                                    </Button>
                                </Stack>
                            </Stack>
                            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
                                {gradeOptions.map((g) => {
                                    const isSelected = selectedGrades.includes(g)
                                    return (
                                        <Chip
                                            key={g}
                                            label={gradeDisplayName(g)}
                                            size="small"
                                            color={isSelected ? 'primary' : 'default'}
                                            variant={isSelected ? 'filled' : 'outlined'}
                                            onClick={() => toggleGrade(g)}
                                            aria-pressed={isSelected}
                                        />
                                    )
                                })}
                            </Stack>
                        </Stack>

                        {/* Section 2: Major & Minor Keys */}
                        <Stack spacing={1}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="subtitle2">Major keys</Typography>
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" onClick={() => update({ keyIds: allCurriculumKeys.map((k) => k.id) })}>
                                        All keys
                                    </Button>
                                    <Button size="small" onClick={clearGrades}>
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

                        {/* Section 3: Display Mode */}
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

                        {/* Section 4: Harmony Focus */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Harmony focus</Typography>
                            <ToggleButtonGroup
                                value={settings.chordFocus ?? 'cadence'}
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

                        {/* Section 5: Chord Types */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Chords</Typography>
                            <ToggleButtonGroup
                                value={settings.chordTypes}
                                onChange={(_, value: ChordType[]) => handleChordTypesChange(value)}
                                aria-label="Chords"
                                size="small"
                                fullWidth
                            >
                                {CHORD_TYPES.map((type) => {
                                    const isDisabled = type.value === 'chromatic' && settings.chordFocus !== 'all'
                                    return (
                                        <ToggleButton key={type.value} value={type.value} disabled={isDisabled}>
                                            {type.label}
                                        </ToggleButton>
                                    )
                                })}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Section 6: Triad Voicing Texture (only applies when Triads are selected) */}
                        {settings.chordTypes.includes('triads') && (
                            <Stack spacing={0.75}>
                                <Typography variant="subtitle2">Triad voicing texture</Typography>
                                <ToggleButtonGroup
                                    value={settings.triadVoicing ?? '3-note'}
                                    exclusive
                                    onChange={(_, value) => value && update({ triadVoicing: value })}
                                    aria-label="Triad voicing texture"
                                    size="small"
                                    fullWidth
                                >
                                    <ToggleButton value="3-note">3 notes (pure triad: 1 · 3 · 5)</ToggleButton>
                                    <ToggleButton value="4-note">4 notes (classical guitar p-i-m-a)</ToggleButton>
                                </ToggleButtonGroup>
                                <Typography variant="caption" color="text.secondary">
                                    Triads have 3 notes (root, 3rd, 5th). 4-note voicings double the root or octave across thumb + 3 fingers.
                                </Typography>
                            </Stack>
                        )}

                        {/* Section 7: Inversions */}
                        <Stack spacing={1}>
                            <Typography variant="subtitle2">Inversions</Typography>
                            <ToggleButtonGroup
                                value={settings.inversions}
                                onChange={(_, value: number[]) => handleInversionsChange(value)}
                                aria-label="Inversions"
                                size="small"
                                fullWidth
                            >
                                {INVERSIONS.map((inversion) => {
                                    const isDisabled = inversion.value === 3 && !settings.chordTypes.includes('sevenths')
                                    return (
                                        <ToggleButton key={inversion.value} value={inversion.value} disabled={isDisabled}>
                                            {inversion.label}
                                        </ToggleButton>
                                    )
                                })}
                            </ToggleButtonGroup>
                        </Stack>

                        {/* Section 8: Minor Harmony */}
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

                        {/* Section 9: Frequency */}
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
                                        {focusSummary} · {isThreeNote ? '3-note pure triads' : '4-note guitar SATB'}
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
                                    Scale {activeKeyIndex + 1} of {allCurriculumKeys.length}
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
