import { describe, expect, test } from 'bun:test'
import { emptyComments, emptyForks } from '../../src/gists/social'

describe('mock social behavior', () => {
  test('returns empty social collections', () => {
    expect(emptyForks()).toEqual([])
    expect(emptyComments()).toEqual([])
  })
})
