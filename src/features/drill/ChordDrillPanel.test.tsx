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

        expect(screen.getByText('Key 1 of 24')).toBeInTheDocument()
        expect(screen.getAllByTestId('staff').length).toBeGreaterThan(0)

        await userEvent.click(screen.getAllByRole('button', { name: 'Next key' })[0])
        expect(screen.getByText('Key 2 of 24')).toBeInTheDocument()
        expect(screen.getAllByTestId('staff').length).toBeGreaterThan(0)
    })

    it('shows every curated voicing of a cadence exactly as written', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        const written = Object.values(curriculum.grades)
            .flat()
            .filter((s) => s.tonic === 'C' && s.mode === 'major' && s.sequence.length === 2)
            .map((s) => s.sequence[0].notes.join(' '))
        expect(screen.getAllByTestId('staff').map((s) => s.textContent)).toEqual([...new Set(written)])
        expect(screen.getByText('Position I')).toBeInTheDocument()
        expect(screen.getByText('Alternative fingering · Position III')).toBeInTheDocument()

        // V7 is not in the curated cadences, so the V7–I is generated
        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'V7' }))
        expect(screen.getAllByTestId('staff')).toHaveLength(1)
        expect(screen.queryByText(/Alternative fingering/)).not.toBeInTheDocument()
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
        expect(screen.getByRole('button', { name: 'Cadential 6/4' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByText('Perfect cadence with cadential 6/4 (V–I)')).toBeInTheDocument()
    })

    it('asks for a key when none are selected', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
        expect(screen.getByText('Select at least one key to start.')).toBeInTheDocument()
    })

    it('shows the minor-key choice only while it applies', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
        await userEvent.click(screen.getByRole('button', { name: 'C major' }))

        await userEvent.click(screen.getByRole('button', { name: 'Scale chords' }))
        expect(screen.queryByText('Minor keys use')).not.toBeInTheDocument()

        // Adding a key makes it the one shown
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))
        expect(screen.getByText('Minor keys use')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Natural' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Harmonic' })).toBeInTheDocument()

        // Back on C major the choice has no effect
        await userEvent.click(screen.getByRole('button', { name: 'C major' }))
        expect(screen.queryByText('Minor keys use')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Cadences' }))
        expect(screen.queryByText('Minor keys use')).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Tonic inversions' }))
        expect(screen.queryByText('Minor keys use')).not.toBeInTheDocument()
        // Flashcards mix keys, so any minor key in the set counts
        await userEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
        expect(screen.getByText('Minor keys use')).toBeInTheDocument()
    })

    it('keeps the Natural/Harmonic choice when switching between practices', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Scale chords' }))
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))

        const naturalBtn = screen.getByRole('button', { name: 'Natural' })
        await userEvent.click(naturalBtn)
        expect(naturalBtn).toHaveAttribute('aria-pressed', 'true')

        await userEvent.click(screen.getByRole('button', { name: 'Cadences' }))
        expect(screen.queryByText('Minor keys use')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Scale chords' }))
        expect(screen.getByRole('button', { name: 'Natural' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('preserves other selections when changing keys in mixed key sets', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Scale chords' }))

        const firstInvBtn = screen.getByRole('button', { name: '1st inv.' })
        await userEvent.click(firstInvBtn)
        expect(firstInvBtn).toHaveAttribute('aria-pressed', 'true')
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))
        await userEvent.click(screen.getByRole('button', { name: 'Natural' }))

        await userEvent.click(screen.getByRole('button', { name: 'G major' }))
        await userEvent.click(screen.getByRole('button', { name: 'A minor' }))

        expect(screen.getByRole('button', { name: 'Scale chords' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: '1st inv.' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Natural' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows triads as three notes and 7th chords as four on a flashcard', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByText('Practice settings'))
        await userEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
        expect(screen.getByRole('button', { name: 'Chromatic' })).toBeInTheDocument()
        expect(screen.getByTestId('staff').textContent?.split(' ')).toHaveLength(3)

        await userEvent.click(screen.getByRole('button', { name: '7th chords' }))
        await userEvent.click(screen.getByRole('button', { name: 'Triads' }))
        expect(screen.getByTestId('staff').textContent?.split(' ')).toHaveLength(4)
    })

    it('uses one dominant and inversion at a time in Cadences', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))

        const triad = screen.getByRole('button', { name: 'V' })
        const seventh = screen.getByRole('button', { name: 'V7' })
        await userEvent.click(seventh)
        expect(seventh).toHaveAttribute('aria-pressed', 'true')
        expect(triad).toHaveAttribute('aria-pressed', 'false')
        expect(screen.queryByRole('button', { name: 'Chromatic' })).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: '2nd inv.' }))
        expect(screen.getByRole('button', { name: '2nd inv.' })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.getByRole('button', { name: 'Root pos.' })).toHaveAttribute('aria-pressed', 'false')
        // Cadence tonic chords stay triads, so no 3rd inversion
        expect(screen.queryByRole('button', { name: '3rd inv. (7ths)' })).not.toBeInTheDocument()
    })

    it('hides the Chords choice for Tonic inversions', async () => {
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))

        await userEvent.click(screen.getByRole('button', { name: 'Tonic inversions' }))
        expect(screen.queryByRole('group', { name: 'Chords' })).not.toBeInTheDocument()
    })

    it('opens older saved settings in the matching practice', async () => {
        localStorage.setItem(
            'scale-chord-practice/drill/v2',
            JSON.stringify({ keyIds: ['C-major'], displayMode: 'flashcard', chordFocus: 'cadence', minorForms: ['harmonic'], chordTypes: ['triads'], inversions: [0] }),
        )
        render(<ChordDrillPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByText('Practice settings'))
        expect(screen.getByRole('button', { name: 'Flashcards' })).toHaveAttribute('aria-pressed', 'true')
    })
})
