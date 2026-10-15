import { describe, expect, it } from 'vitest'
import { filterRoutines, sortByLastUsed } from './routines'

const r = (id: string, name: string, archived = false) => ({ id, name, archived })

describe('sortByLastUsed', () => {
  it('puts the most recently used first and never-used routines last, A to Z', () => {
    const list = [r('z', 'Zed'), r('a', 'Abs'), r('old', 'Old'), r('new', 'New')]
    expect(sortByLastUsed(list, new Map([['old', 5], ['new', 9]])).map((x) => x.id)).toEqual(['new', 'old', 'a', 'z'])
  })
})

describe('filterRoutines', () => {
  const list = [r('1', 'Push day'), r('2', 'Pull day'), r('3', 'Legs', true)]
  const muscles = new Map([['1', new Set(['chest'])], ['2', new Set(['back'])], ['3', new Set(['legs'])]])
  const none = new Set<string>()

  it('filters by status', () => {
    expect(filterRoutines(list, { query: '', status: 'active', muscleIds: none }, muscles).map((x) => x.id)).toEqual(['1', '2'])
    expect(filterRoutines(list, { query: '', status: 'archived', muscleIds: none }, muscles).map((x) => x.id)).toEqual(['3'])
    expect(filterRoutines(list, { query: '', status: 'all', muscleIds: none }, muscles)).toHaveLength(3)
  })
  it('searches names case-insensitively and by muscle', () => {
    expect(filterRoutines(list, { query: ' PULL', status: 'all', muscleIds: none }, muscles).map((x) => x.id)).toEqual(['2'])
    expect(filterRoutines(list, { query: '', status: 'all', muscleIds: new Set(['chest', 'legs']) }, muscles).map((x) => x.id)).toEqual(['1', '3'])
  })
})
