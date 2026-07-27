import { Alert, Button, Snackbar } from '@mui/material'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdateBanner() {
    const { needRefresh, updateServiceWorker } = useRegisterSW()

    return (
        <Snackbar open={needRefresh[0]} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
            <Alert
                severity="info"
                action={
                    <Button color="inherit" size="small" onClick={() => void updateServiceWorker(true)}>
                        Update
                    </Button>
                }
            >
                A new version is ready.
            </Alert>
        </Snackbar>
    )
}
