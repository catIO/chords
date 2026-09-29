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
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
} from '@mui/material'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import { ChordLogoIcon } from './components/ChordLogoIcon'
import { ThemeProvider } from '@mui/material/styles'
import { curriculum, curriculumError, gradeDisplayName, gradeOptions } from './data/curriculum'
import { ValidationErrorScreen } from './components/ValidationErrorScreen'
import { buildTheme } from './theme/theme'
import { CadencePanel } from './features/cadences/CadencePanel'
import { mergeMinorForms, type CadenceScale } from './features/cadences/mergeMinorForms'
import { ChordDrillPanel } from './features/drill/ChordDrillPanel'
import { UpdateBanner } from './components/UpdateBanner'

type CadenceFilter = 'all' | 'major' | 'minor'
type PracticeTab = 'cadences' | 'drill'

const STORAGE_KEY = 'scale-chord-practice/v2'

function loadSaved(): { grade: string; expandedScaleId: string | null; tab: PracticeTab } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        grade: typeof parsed.grade === 'string' && gradeOptions.includes(parsed.grade) ? parsed.grade : gradeOptions[0],
        expandedScaleId: typeof parsed.expandedScaleId === 'string' ? parsed.expandedScaleId : null,
        tab: parsed.tab === 'drill' ? 'drill' : 'cadences',
      }
    }
  } catch { /* ignore */ }
  return { grade: gradeOptions[0], expandedScaleId: null, tab: 'cadences' }
}

function filterScales(scales: CadenceScale[], filter: CadenceFilter): CadenceScale[] {
  if (filter === 'all') return scales
  return scales.filter((s) => s.mode === filter)
}

function PracticeApp() {
  const appCurriculum = curriculum!
  const saved = useMemo(() => loadSaved(), [])

  const [grade, setGrade] = useState(saved.grade)
  const [expandedScaleId, setExpandedScaleId] = useState<string | null>(saved.expandedScaleId)
  const [tab, setTab] = useState<PracticeTab>(saved.tab)
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all')
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | 'system'>('system')
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<null | HTMLElement>(null)

  const paletteMode = useMemo(() => {
    if (themeChoice === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return themeChoice
  }, [themeChoice])

  const scales = useMemo(() => mergeMinorForms(appCurriculum.grades[grade] ?? []), [appCurriculum.grades, grade])
  const filteredScales = useMemo(() => filterScales(scales, cadenceFilter), [scales, cadenceFilter])

  // Persist grade, expanded scale and tab to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grade, expandedScaleId, tab }))
  }, [grade, expandedScaleId, tab])

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
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            borderBottom: 1,
            borderColor: paletteMode === 'light' ? 'rgba(175,120,64,0.15)' : 'rgba(255,255,255,0.06)',
            color: 'text.primary',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <Container maxWidth="md">
            <Toolbar disableGutters>
              <ChordLogoIcon sx={{ mr: 1.25, fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Chord Practice
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton
                aria-label="Open settings"
                edge="end"
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
          </Container>
        </AppBar>

        <Container maxWidth="md" sx={{ mt: 2 }}>
          <Paper sx={{ p: { xs: 2, sm: 3 }, transition: 'box-shadow 0.3s ease' }} elevation={4}>
            <Stack spacing={2.5}>
              <Tabs value={tab} onChange={(_, value: PracticeTab) => setTab(value)} variant="fullWidth" aria-label="Practice mode">
                <Tab value="cadences" label="Cadences" />
                <Tab value="drill" label="Random chords" />
              </Tabs>

              {tab === 'cadences' ? (
                <>
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
                    value={cadenceFilter}
                    exclusive
                    onChange={(_, value) => value && setCadenceFilter(value)}
                    aria-label="Key filter"
                    size="small"
                    fullWidth
                  >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="major">Major</ToggleButton>
                    <ToggleButton value="minor">Minor</ToggleButton>
                  </ToggleButtonGroup>

                  <CadencePanel
                    scales={filteredScales}
                    expandedScaleId={expandedScaleId}
                    onExpandChange={setExpandedScaleId}
                  />
                </>
              ) : (
                <ChordDrillPanel curriculum={appCurriculum} />
              )}
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
