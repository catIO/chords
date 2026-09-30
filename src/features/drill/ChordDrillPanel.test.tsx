import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../../types/curriculum'
import { ChordDrillPanel } from './ChordDrillPanel'

vi.mock('../../components/ChordStaff', () => ({
    ChordStaff: ({ events }: { events: { notes: string[] }[] }) => <div data-testid="staff">{events[0].notes.join(' ')}</div>,
}))

const curriculum = curriculumSchema.parse(curriculumData)

describe('ChordDrillPanel', () => {
    beforeEach(() => localStorage.clear())

    it('always shows the chord name and notation', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        expect(screen.getByText('Chord 1')).toBeInTheDocument()
        expect(screen.getByTestId('staff')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Next chord' }))
        expect(screen.getByText('Chord 2')).toBeInTheDocument()
        expect(screen.getByTestId('staff')).toBeInTheDocument()
    })

    it('asks for a key when none are selected', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
        expect(screen.getByText('Select at least one key to start.')).toBeInTheDocument()
    })

    it('governs Minor harmony visibility based on key selection and Harmony focus', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        // Open practice settings
        await userEvent.click(screen.getByText('Practice settings'))

        // Clear all keys first
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

        // Select only C major (only major keys selected)
        await userEvent.click(screen.getByRole('button', { name: 'C major' }))

        // Even with All degrees selected, Minor harmony should remain hidden
        await userEvent.click(screen.getByRole('button', { name: 'All degrees' }))
        expect(screen.queryByText('Minor harmony')).not.toBeInTheDocument()

        // Now select A minor (mixed major and minor keys selected)
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))

        // With All degrees and at least one minor key selected, Minor harmony MUST be visible
        expect(screen.getByText('Minor harmony')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Natural' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Harmonic' })).toBeInTheDocument()

        // When Cadence is selected, Minor harmony should be hidden
        await userEvent.click(screen.getByRole('button', { name: 'Cadence (tonic–dominant–tonic)' }))
        expect(screen.queryByText('Minor harmony')).not.toBeInTheDocument()

        // When Tonic only is selected, Minor harmony should be hidden
        await userEvent.click(screen.getByRole('button', { name: 'Tonic only' }))
        expect(screen.queryByText('Minor harmony')).not.toBeInTheDocument()

        // Switch back to All degrees -> Minor harmony should be visible again
        await userEvent.click(screen.getByRole('button', { name: 'All degrees' }))
        expect(screen.getByText('Minor harmony')).toBeInTheDocument()
    })

    it('switches between Cadence and All degrees without losing previous Natural/Harmonic selection', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        // Open settings
        await userEvent.click(screen.getByText('Practice settings'))

        // Select All degrees
        await userEvent.click(screen.getByRole('button', { name: 'All degrees' }))

        // Select Natural in Minor harmony
        const naturalBtn = screen.getByRole('button', { name: 'Natural' })
        await userEvent.click(naturalBtn)
        expect(naturalBtn).toHaveAttribute('aria-pressed', 'true')

        // Switch to Cadence (Minor harmony is hidden)
        await userEvent.click(screen.getByRole('button', { name: 'Cadence (tonic–dominant–tonic)' }))
        expect(screen.queryByText('Minor harmony')).not.toBeInTheDocument()

        // Switch back to All degrees (Minor harmony is shown again)
        await userEvent.click(screen.getByRole('button', { name: 'All degrees' }))
        expect(screen.getByText('Minor harmony')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Natural' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('preserves unrelated filter selections when changing keys in mixed key sets', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        // Open settings
        await userEvent.click(screen.getByText('Practice settings'))

        // Select All degrees
        await userEvent.click(screen.getByRole('button', { name: 'All degrees' }))

        // Change Inversions to include 1st inv.
        const firstInvBtn = screen.getByRole('button', { name: '1st inv.' })
        await userEvent.click(firstInvBtn)
        expect(firstInvBtn).toHaveAttribute('aria-pressed', 'true')

        // Select Natural minor
        const naturalBtn = screen.getByRole('button', { name: 'Natural' })
        await userEvent.click(naturalBtn)

        // Switch active key to A minor then G major
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))
        await userEvent.click(screen.getByRole('button', { name: 'G major' }))

        // Inversions and Harmony focus remain intact
        expect(screen.getByRole('button', { name: 'All degrees' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: '1st inv.' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Natural' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('only shows Triad voicing texture when Triads is selected in Chords', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        // Open settings
        await userEvent.click(screen.getByText('Practice settings'))

        // By default Triads is selected -> Triad voicing texture is visible
        expect(screen.getByText('Triad voicing texture')).toBeInTheDocument()

        // Select 7ths as well
        const seventhsBtn = screen.getByRole('button', { name: 'ii7 · V7 · vii7' })
        await userEvent.click(seventhsBtn)

        // Deselect Triads
        const triadsBtn = screen.getByRole('button', { name: 'Triads' })
        await userEvent.click(triadsBtn)

        // Triad voicing texture should now be hidden
        expect(screen.queryByText('Triad voicing texture')).not.toBeInTheDocument()

        // Re-select Triads
        await userEvent.click(triadsBtn)

        // Triad voicing texture is visible again
        expect(screen.getByText('Triad voicing texture')).toBeInTheDocument()
    })
})
