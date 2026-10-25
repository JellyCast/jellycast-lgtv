import { describe, expect, it } from 'vitest'
import { listScroll } from './Rows'

describe('listScroll', () => {
    it('keeps the first row at the top', () => {
        expect(listScroll([138, 180], 32, 0, 74)).toBe(0)
    })

    it('puts every focused row card at the same height, headers included', () => {
        const heights = [138, 180, 180, 180]
        const cardTopOnScreen = (row: number) => {
            let rowTop = 0
            for (let index = 0; index < row; index++) rowTop += 32 + heights[index] + 28
            return rowTop + 32 - listScroll(heights, 32, row, 74)
        }

        expect([1, 2, 3].map(cardTopOnScreen)).toEqual([74, 74, 74])
    })
})
