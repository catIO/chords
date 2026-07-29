import { createTheme, type PaletteMode } from '@mui/material/styles'

const baseTypography = {
    fontFamily: '"Public Sans", "Avenir Next", "Segoe UI", sans-serif',
    h4: {
        fontWeight: 700,
        letterSpacing: '-0.01em',
    },
    h5: {
        fontWeight: 700,
        letterSpacing: '-0.01em',
    },
    h6: {
        fontWeight: 700,
        letterSpacing: '-0.005em',
    },
}

export const buildTheme = (mode: PaletteMode) =>
    createTheme({
        palette: {
            mode,
            primary: {
                main: mode === 'light' ? '#005a9c' : '#a0d4ff',
                contrastText: mode === 'light' ? '#ffffff' : '#003258',
            },
            secondary: {
                main: mode === 'light' ? '#7b4a26' : '#f0c896',
                contrastText: mode === 'light' ? '#fff9f2' : '#2d1600',
            },
            background:
                mode === 'light'
                    ? {
                        default: '#fff8ef',
                        paper: '#fffdf8',
                    }
                    : {
                        default: '#111318',
                        paper: '#1d2028',
                    },
            text:
                mode === 'light'
                    ? {
                        primary: '#2f241a',
                        secondary: '#6f5a49',
                    }
                    : {
                        primary: '#e4e8f0',
                        secondary: '#b0bac9',
                        disabled: '#6b7688',
                    },
        },
        shape: {
            borderRadius: 14,
        },
        typography: baseTypography,
        components: {
            MuiButton: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                        backgroundColor: mode === 'light' ? '#fffdf8' : '#1d2028',
                        border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : undefined,
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#6f5a49' : '#b0bac9',
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#2f241a' : '#e4e8f0',
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: mode === 'light' ? '#ccb89f' : 'rgba(255,255,255,0.15)',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: mode === 'light' ? '#9e7d62' : 'rgba(160,212,255,0.5)',
                        },
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#6f5a49' : '#b0bac9',
                    },
                },
            },
            MuiToggleButtonGroup: {
                styleOverrides: {
                    root: {
                        border: mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : undefined,
                    },
                },
            },
            MuiToggleButton: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#5f4b3a' : '#b0bac9',
                        borderColor: mode === 'light' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'none',
                        transition: 'all 0.2s ease',
                        '&.Mui-selected': {
                            fontWeight: 700,
                            color: mode === 'light' ? '#2f241a' : '#e4e8f0',
                            backgroundColor: mode === 'light' ? 'rgba(0,90,156,0.08)' : 'rgba(160,212,255,0.12)',
                        },
                    },
                },
            },
            MuiAccordion: {
                styleOverrides: {
                    root: {
                        transition: 'all 0.25s ease',
                        borderRadius: '14px !important',
                        backgroundColor: mode === 'light' ? '#fffdf8' : '#252830',
                        border: mode === 'dark' ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
                        '&::before': { display: 'none' },
                        '&.Mui-expanded': {
                            margin: '0 !important',
                            boxShadow: mode === 'light'
                                ? '0 4px 20px rgba(127,89,50,0.12)'
                                : '0 4px 24px rgba(0,0,0,0.4)',
                        },
                    },
                },
            },
            MuiAccordionSummary: {
                styleOverrides: {
                    root: {
                        borderRadius: '14px',
                        color: mode === 'light' ? '#2f241a' : '#e4e8f0',
                        transition: 'background 0.2s ease',
                        '&:hover': {
                            background: mode === 'light'
                                ? 'rgba(175,120,64,0.06)'
                                : 'rgba(160,212,255,0.04)',
                        },
                        '& .MuiAccordionSummary-expandIconWrapper': {
                            color: mode === 'light' ? '#6f5a49' : '#b0bac9',
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                        transition: 'all 0.2s ease',
                    },
                    outlined: {
                        borderColor: mode === 'light' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)',
                        color: mode === 'light' ? '#5f4b3a' : '#b0bac9',
                    },
                    colorSecondary: {
                        ...(mode === 'dark' && {
                            backgroundColor: 'rgba(240,200,150,0.12)',
                            color: '#f0c896',
                            borderColor: 'rgba(240,200,150,0.3)',
                        }),
                    },
                },
            },
        },
    })
