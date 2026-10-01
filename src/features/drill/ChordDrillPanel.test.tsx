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

    it('selects a key tier and shows custom keys after editing it', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByText('Practice settings'))
        const beginner = screen.getByRole('button', { name: 'Beginner (10)' })
        await userEvent.click(beginner)

        expect(beginner).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'D major' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'B major' })).toHaveAttribute('aria-pressed', 'false')

        await userEvent.click(screen.getByRole('button', { name: 'B major' }))
        expect(beginner).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByText(/^Custom keys/)).toBeInTheDocument()
    })

    it('names the cadence and matches the progression to the key tier', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        expect(screen.getByText('Perfect cadence (V–I)')).toBeInTheDocument()

        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: /^Intermediate/ }))
        expect(screen.getByRole('button', { name: 'I–IV–V–I' })).toHaveAttribute('aria-pressed', 'true')

        await userEvent.click(screen.getByRole('button', { name: /^Advanced/ }))
        expect(screen.getByRole('button', { name: 'I–IV–V6/4–5/3–I' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Perfect cadence with cadential 6/4 (V–I)')).toBeInTheDocument()
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
        await userEvent.click(screen.getByRole('button', { name: 'Cadence' }))
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
        await userEvent.click(screen.getByRole('button', { name: 'Cadence' }))
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

    it('shows a four-note guitar voicing on a flashcard', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Single chord flashcard' }))
        expect(screen.queryByRole('group', { name: 'Voicing' })).not.toBeInTheDocument()
        expect(screen.getByTestId('staff').textContent?.split(' ')).toHaveLength(4)
    })

    it('uses one chord type and inversion at a time in a scale sequence', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))

        const triads = screen.getByRole('button', { name: 'Triads' })
        const sevenths = screen.getByRole('button', { name: '7th chords' })
        await userEvent.click(sevenths)
        expect(sevenths).toHaveAttribute('aria-pressed', 'true')
        expect(triads).toHaveAttribute('aria-pressed', 'false')
        expect(screen.getByRole('button', { name: 'Chromatic' })).toBeDisabled()

        await userEvent.click(screen.getByRole('button', { name: '2nd inv.' }))
        expect(screen.getByRole('button', { name: '2nd inv.' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Root pos.' })).toHaveAttribute('aria-pressed', 'false')
        // Cadence tonic chords stay triads, so no 3rd inversion
        expect(screen.getByRole('button', { name: '3rd inv. (7ths)' })).toBeDisabled()
    })

    it('hides the Chords choice for Tonic only', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))

        await userEvent.click(screen.getByRole('button', { name: 'Tonic only' }))
        expect(screen.queryByRole('group', { name: 'Chords' })).not.toBeInTheDocument()
    })
})
