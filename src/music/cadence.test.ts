import { describe, expect, it } from 'vitest'
import { describeCadence } from './cadence'

describe('describeCadence', () => {
    it('names cadences from the last two chords', () => {
        expect(describeCadence(['I', 'IV', 'V', 'I'])?.name).toBe('Perfect cadence')
        expect(describeCadence(['i', 'iv', 'V', 'i'])?.numerals).toBe('V–i')
        expect(describeCadence(['I', 'IV', 'I'])?.name).toBe('Plagal cadence')
        expect(describeCadence(['I', 'IV', 'V'])?.name).toBe('Imperfect cadence')
        expect(describeCadence(['I', 'V', 'vi'])?.name).toBe('Interrupted cadence')
    })

    it('mentions the cadential 6/4 and drops voice-motion figures', () => {
        const cadence = describeCadence(['I', 'IV', 'V6/4', 'V5/3', 'I'])
        expect(cadence?.name).toBe('Perfect cadence with cadential 6/4')
        expect(cadence?.numerals).toBe('V–I')
        expect(describeCadence(['I', 'vi', 'IV', 'V6/4', 'V8', 'V7', 'I'])?.numerals).toBe('V7–I')
    })

    it('returns null when there is no cadence', () => {
        expect(describeCadence(['I'])).toBeNull()
        expect(describeCadence(['I', 'ii'])).toBeNull()
    })
})
