import { Alert, AlertTitle, Box, Paper, Typography } from '@mui/material'

interface ValidationErrorScreenProps {
    message: string
}

export function ValidationErrorScreen({ message }: ValidationErrorScreenProps) {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                p: 2,
                bgcolor: 'background.default',
            }}
        >
            <Paper sx={{ p: 3, maxWidth: 760, width: '100%' }} elevation={2}>
                <Alert severity="error" variant="filled" sx={{ mb: 2 }}>
                    <AlertTitle>Curriculum Validation Failed</AlertTitle>
                    The app could not start because curriculum data did not match the expected schema.
                </Alert>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                    {message}
                </Typography>
            </Paper>
        </Box>
    )
}
