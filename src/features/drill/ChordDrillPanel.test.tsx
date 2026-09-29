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
})
