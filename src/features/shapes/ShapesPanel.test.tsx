import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema } from '../../types/curriculum'
import { ShapesPanel } from './ShapesPanel'

vi.mock('../../components/ChordStaff', () => ({
    ChordStaff: ({ events }: { events: { notes: string[]; fingerings?: string[] }[] }) => (
        <div data-testid="staff">{events.map((e) => `${e.notes.join(' ')} [${e.fingerings?.join('')}]`).join(' | ')}</div>
    ),
}))

const curriculum = curriculumSchema.parse(curriculumData)

describe('ShapesPanel', () => {
    beforeEach(() => localStorage.clear())

    it('lists hand shapes for a family and shows chords in notation when one is opened', async () => {
        render(<ShapesPanel curriculum={curriculum} />)

        expect(screen.getByRole('button', { name: /^Triangle/ })).toHaveAttribute('aria-pressed', 'true')
        expect(screen.queryByTestId('staff')).not.toBeInTheDocument()

        await userEvent.click(screen.getAllByText(/^Fingers /)[0])
        expect(screen.getAllByTestId('staff').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/^(Major|Minor|Diminished|Augmented) triad|seventh/).length).toBeGreaterThan(0)
    })

    it('practises a family as a sequence of named chords with fingering', async () => {
        render(<ShapesPanel curriculum={curriculum} />)

        await userEvent.click(screen.getByRole('button', { name: 'Practice' }))

        expect(screen.getByText('Triangle shapes')).toBeInTheDocument()
        expect(screen.getByTestId('staff').textContent?.split(' | ')).toHaveLength(4)
        expect(screen.getByText('Exercise 1')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Next exercise' }))
        expect(screen.getByText('Exercise 2')).toBeInTheDocument()
    })

    it('opens the resolution of a tension chord on the staff', async () => {
        render(<ShapesPanel curriculum={curriculum} />)
        await userEvent.click(screen.getByRole('button', { name: /^Parallelogram/ }))
        await userEvent.click(screen.getAllByText(/^Fingers /)[0])

        const toggle = screen.getAllByRole('button', { name: /^→ / })[0]
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        const staff = screen.getAllByTestId('staff')[0]
        expect(staff.textContent?.split(' | ')).toHaveLength(1)

        await userEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getAllByTestId('staff')[0].textContent?.split(' | ')).toHaveLength(2)
    })

    it('disables families with no chords', () => {
        render(<ShapesPanel curriculum={curriculum} />)
        expect(screen.getByRole('button', { name: 'Box (0)' })).toHaveAttribute('aria-disabled', 'true')
    })
})
