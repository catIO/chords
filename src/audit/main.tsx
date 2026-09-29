import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/700.css'
import { buildTheme } from '../theme/theme'
import { AuditPage } from './AuditPage'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider theme={buildTheme('light')}>
            <CssBaseline />
            <AuditPage />
        </ThemeProvider>
    </StrictMode>,
)
