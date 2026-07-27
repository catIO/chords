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
}

export const buildTheme = (mode: PaletteMode) =>
    createTheme({
        palette: {
            mode,
            primary: {
                main: mode === 'light' ? '#005a9c' : '#7cc4ff',
                contrastText: mode === 'light' ? '#ffffff' : '#0b1220',
            },
            secondary: {
                main: mode === 'light' ? '#7b4a26' : '#e0b27e',
                contrastText: mode === 'light' ? '#fff9f2' : '#1d1208',
            },
            background:
                mode === 'light'
                    ? {
                        default: '#fff8ef',
                        paper: '#fffdf8',
                    }
                    : {
                        default: '#0f141d',
                        paper: '#171f2c',
                    },
            text:
                mode === 'light'
                    ? {
                        primary: '#2f241a',
                        secondary: '#6f5a49',
                    }
                    : {
                        primary: '#f2f5fb',
                        secondary: '#c5d0e0',
                        disabled: '#8b98ad',
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
                        backgroundImage:
                            mode === 'light'
                                ? 'linear-gradient(165deg, rgba(255,253,248,0.98), rgba(247,236,217,0.9))'
                                : 'linear-gradient(165deg, rgba(25,33,47,0.98), rgba(17,23,33,0.98))',
                        color: mode === 'light' ? '#2f241a' : '#f2f5fb',
                    },
                },
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#6f5a49' : '#c5d0e0',
                    },
                },
            },
            MuiOutlinedInput: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#2f241a' : '#f2f5fb',
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: mode === 'light' ? '#ccb89f' : '#3d4e6a',
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: mode === 'light' ? '#9e7d62' : '#7aa5d8',
                        },
                    },
                },
            },
            MuiTab: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#6f5a49' : '#c5d0e0',
                    },
                },
            },
            MuiToggleButton: {
                styleOverrides: {
                    root: {
                        color: mode === 'light' ? '#5f4b3a' : '#d6deea',
                    },
                },
            },
        },
    })
