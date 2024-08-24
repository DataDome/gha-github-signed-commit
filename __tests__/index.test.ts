import * as core from '@actions/core'
import * as main from '../src/main'
import { describe, jest, beforeEach, it, expect } from '@jest/globals'

describe('index', () => {
  it('calls run when imported', async () => {
    const runMock = jest.spyOn(main, 'run').mockReturnThis()

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../src/index')

    expect(runMock).toHaveBeenCalled()
  })
})
