import { useEffect, useMemo, useState } from 'react'
import {
  AppBar,
  Box,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded'
import { ThemeProvider } from '@mui/material/styles'
import { curriculum, curriculumError, gradeDisplayName, gradeOptions } from './data/curriculum'
import { ValidationErrorScreen } from './components/ValidationErrorScreen'
import { buildTheme } from './theme/theme'
import { GradeReviewPanel } from './features/review/GradeReviewPanel'
import { UpdateBanner } from './components/UpdateBanner'
import type { ScaleExercise } from './types/curriculum'

type ReviewFilter = 'all' | 'major' | 'harmonic' | 'melodic'

const STORAGE_KEY = 'scale-chord-practice/v2'

function loadSaved(): { grade: string; expandedScaleId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        grade: typeof parsed.grade === 'string' && gradeOptions.includes(parsed.grade) ? parsed.grade : gradeOptions[0],
        expandedScaleId: typeof parsed.expandedScaleId === 'string' ? parsed.expandedScaleId : null,
      }
    }
  } catch { /* ignore */ }
  return { grade: gradeOptions[0], expandedScaleId: null }
}

function filterScales(scales: ScaleExercise[], filter: ReviewFilter): ScaleExercise[] {
  if (filter === 'all') return scales
  if (filter === 'major') return scales.filter((s) => s.mode === 'major')
  if (filter === 'harmonic') return scales.filter((s) => s.minorForm === 'harmonic')
  return scales.filter((s) => s.minorForm === 'melodic')
}

function PracticeApp() {
  const appCurriculum = curriculum!
  const saved = useMemo(() => loadSaved(), [])

  const [grade, setGrade] = useState(saved.grade)
  const [expandedScaleId, setExpandedScaleId] = useState<string | null>(saved.expandedScaleId)
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all')
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | 'system'>('system')
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null)

  const paletteMode = useMemo(() => {
    if (themeChoice === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeChoice
  }, [themeChoice])

  const scales = useMemo(() => appCurriculum.grades[grade] ?? [], [appCurriculum.grades, grade])
  const filteredScales = useMemo(() => filterScales(scales, reviewFilter), [scales, reviewFilter])

  // Persist grade and expanded scale to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grade, expandedScaleId }))
  }, [grade, expandedScaleId])

  return (
    <ThemeProvider theme={buildTheme(paletteMode)}>
      <Box
        sx={{
          minHeight: '100vh',
          pb: 6,
          bgcolor: paletteMode === 'light' ? '#f5ede3' : '#111318',
          background:
            paletteMode === 'light'
              ? 'radial-gradient(circle at 18% 0%, rgba(175,120,64,0.1), transparent 48%), radial-gradient(circle at 90% 12%, rgba(118,72,35,0.08), transparent 36%), #f5ede3'
              : '#111318',
        }}
      >
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: paletteMode === 'light' ? 'rgba(175,120,64,0.15)' : 'rgba(255,255,255,0.06)', color: 'text.primary' }}>
          <Toolbar sx={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
            <MusicNoteRoundedIcon sx={{ mr: 1, opacity: 0.7, fontSize: 22 }} />
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
              Scale Chord Practice
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton
              aria-label="Open settings"
              onClick={(event) => setSettingsAnchorEl(event.currentTarget)}
              color="inherit"
            >
              <SettingsOutlinedIcon />
            </IconButton>
            <Menu
              anchorEl={settingsAnchorEl}
              open={Boolean(settingsAnchorEl)}
              onClose={() => setSettingsAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <ListSubheader>Settings</ListSubheader>
              <MenuItem disableRipple disableTouchRipple>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="theme-label">Theme</InputLabel>
                  <Select
                    labelId="theme-label"
                    value={themeChoice}
                    label="Theme"
                    onChange={(evt) => setThemeChoice(evt.target.value as 'light' | 'dark' | 'system')}
                  >
                    <MenuItem value="light">Light</MenuItem>
                    <MenuItem value="dark">Dark</MenuItem>
                    <MenuItem value="system">System</MenuItem>
                  </Select>
                </FormControl>
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 2 }}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, transition: 'box-shadow 0.3s ease' }} elevation={4}>
            <Stack spacing={2.5}>
              <FormControl fullWidth>
                <InputLabel id="grade-label">Level</InputLabel>
                <Select
                  labelId="grade-label"
                  value={grade}
                  label="Level"
                  onChange={(evt) => setGrade(evt.target.value)}
                >
                  {gradeOptions.map((g) => (
                    <MenuItem key={g} value={g}>
                      {gradeDisplayName(g)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <ToggleButtonGroup
                value={reviewFilter}
                exclusive
                onChange={(_, value) => value && setReviewFilter(value)}
                aria-label="Scale filter"
                size="small"
                fullWidth
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="major">Major</ToggleButton>
                <ToggleButton value="harmonic">Harmonic Minor</ToggleButton>
                <ToggleButton value="melodic">Melodic Minor</ToggleButton>
              </ToggleButtonGroup>

              <GradeReviewPanel
                scales={filteredScales}
                expandedScaleId={expandedScaleId}
                onExpandChange={setExpandedScaleId}
              />
            </Stack>
          </Paper>
        </Container>

        <UpdateBanner />
      </Box>
    </ThemeProvider>
  )
}

function App() {
  if (!curriculum || curriculumError) {
    return <ValidationErrorScreen message={curriculumError ?? 'Unknown validation issue.'} />
  }

  return <PracticeApp />
}

export default App
