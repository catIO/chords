import { describe, expect, it } from 'vitest'
import curriculumData from '../../data/royal_conservatory_pwa_chords.json'
import { curriculumSchema, type ChordEvent } from '../../types/curriculum'
import { curatedCadences, positionLabel, progressionOf } from './curatedCadences'
import { buildScaleSequence } from './drill'
import { keyId, type KeyChoice } from './keys'

const curriculum = curriculumSchema.parse(curriculumData)
const scales = Object.values(curriculum.grades).flat()
const keyOf = (s: { tonic: string; mode: 'major' | 'minor' }): KeyChoice => ({ id: keyId(s.tonic, s.mode), tonic: s.tonic, mode: s.mode })

describe('curated cadences in the drills', () => {
    it('reaches every curated cadence, note for note, finger for finger, rhythm for rhythm', () => {
        // Event ids differ between identical harmonic/melodic copies; everything played must match
        const played = (events: ChordEvent[]) =>
            events.map((e) => [e.romanNumeral, e.symbol, e.notes, e.fingerings, e.durationBeats, e.beatUnit])
        for (const scale of scales) {
            const progression = scale.sequence.length === 1 ? 'tonic' : progressionOf(scale.sequence.map((e) => e.romanNumeral))
            expect(progression, scale.id).not.toBeNull()
            expect(curatedCadences(curriculum, keyOf(scale), progression!).map(played), scale.id).toContainEqual(played(scale.sequence))
        }
    })

    it('names the left-hand position of each version, including shifts', () => {
        const labels = (tonic: string, mode: 'major' | 'minor') =>
            curatedCadences(curriculum, keyOf({ tonic, mode }), 'basic').map(positionLabel)
        expect(labels('D', 'major')).toEqual(['Position I', 'Position V'])
        expect(labels('E', 'minor')).toEqual(['Position II → I', 'Position II → III'])
        expect(curatedCadences(curriculum, keyOf({ tonic: 'D', mode: 'major' }), 'subdominant').map(positionLabel)).toEqual(['Position V'])
    })

    it('lists identical harmonic and melodic minor versions once', () => {
        const eMinor = curatedCadences(curriculum, keyOf({ tonic: 'E', mode: 'minor' }), 'basic')
        expect(new Set(eMinor.map((v) => JSON.stringify(v))).size).toBe(eMinor.length)
        expect(eMinor.length).toBeLessThan(scales.filter((s) => s.tonic === 'E' && s.mode === 'minor' && s.sequence.length === 2).length)
    })

    it('generates the same progression, in the same key, for every curated cadence', () => {
        for (const scale of scales.filter((s) => s.sequence.length > 1)) {
            const progression = progressionOf(scale.sequence.map((e) => e.romanNumeral))!
            const generated = buildScaleSequence(keyOf(scale), 'cadence', ['harmonic'], [0], ['triads'], progression)
            expect(generated.map((c) => c.symbol), scale.id).toEqual(scale.sequence.map((e) => e.symbol))
        }
    })
})
