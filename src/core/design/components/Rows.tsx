import type { ComponentChildren } from 'preact'
import { memo } from 'preact/compat'
import './rows.css'

export interface RowModel<T> {
    key: string
    title: string
    items: T[]
    hint?: ComponentChildren
}

interface RowsProps<T> {
    rows: RowModel<T>[]
    focusedRow: number
    focusedCol: number
    /** Whether the rows have the remote's focus; without it no card shows focus. */
    active: boolean
    itemWidth: (row: RowModel<T>) => number
    /** Distance from the top of the list to the focused row's card top, as Android's column pivot. */
    cardTop: number
    headerHeight: number
    rowHeight: (row: RowModel<T>) => number
    renderItem: (item: T, focused: boolean, row: number, col: number) => ComponentChildren
}

const rowPadding = 48
const itemGap = 20
const rowGap = 28
const viewportWidth = 960
const pivotFraction = 0.3

/** Scroll that puts the focused item's left edge at 30% of the row, clamped at both ends. */
export function rowScroll(col: number, itemWidth: number, count: number): number {
    const itemLeft = rowPadding + col * (itemWidth + itemGap)
    const contentWidth = rowPadding * 2 + count * itemWidth + Math.max(0, count - 1) * itemGap
    const max = Math.max(0, contentWidth - viewportWidth)
    return Math.min(max, Math.max(0, itemLeft - pivotFraction * viewportWidth))
}

/**
 * Vertical scroll that puts the focused row's card top `cardTop` below the list top, as Android's
 * column pivot. A row is its header, its cards and the gap below it.
 */
export function listScroll(cardHeights: number[], headerHeight: number, focusedRow: number, cardTop: number): number {
    let rowTop = 0
    for (let row = 0; row < focusedRow; row++) rowTop += headerHeight + cardHeights[row] + rowGap
    return Math.max(0, rowTop + headerHeight - cardTop)
}

/** Rows of cards that scroll with the focus by transforms only. */
export function Rows<T>({ rows, focusedRow, focusedCol, active, itemWidth, cardTop, headerHeight, rowHeight, renderItem }: RowsProps<T>) {
    const scroll = listScroll(rows.map(rowHeight), headerHeight, focusedRow, cardTop)
    return (
        <div class="rows" style={{ transform: `translateY(${-scroll}px)` }}>
            {rows.map((row, index) => (
                <ShelfRow
                    key={row.key}
                    row={row}
                    index={index}
                    focusedCol={active && index === focusedRow ? focusedCol : -1}
                    scroll={index === focusedRow ? rowScroll(focusedCol, itemWidth(row), row.items.length) : 0}
                    renderItem={renderItem}
                />
            ))}
        </div>
    )
}

interface ShelfRowProps<T> {
    row: RowModel<T>
    index: number
    focusedCol: number
    scroll: number
    renderItem: RowsProps<T>['renderItem']
}

const ShelfRow = memo(function ShelfRow<T>({ row, index, focusedCol, scroll, renderItem }: ShelfRowProps<T>) {
    return (
        <section class="shelf-row">
            <div class="shelf-header">
                <span class="title-medium">{row.title}</span>
                {row.hint}
            </div>
            <div class="shelf-track" style={{ transform: scroll ? `translateX(${-scroll}px)` : undefined }}>
                {row.items.map((item, col) => renderItem(item, col === focusedCol, index, col))}
            </div>
        </section>
    )
}) as <T>(props: ShelfRowProps<T>) => ComponentChildren
