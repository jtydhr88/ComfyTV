import { describe, it, expect } from 'vitest'

import { extractRunError } from './runError'

describe('extractRunError', () => {
  it('returns this node\'s validation errors joined with semicolons', () => {
    const e = {
      response: {
        error: { type: 'X' },
        node_errors: {
          '5': {
            errors: [
              { message: 'bad', details: 'too big' },
              { message: 'missing' },
            ],
          },
        },
      },
    }
    const out = extractRunError(e, 5)
    expect(out.message).toBe('bad: too big; missing')
    expect(out.type).toBe('X')
  })

  it('falls back to ValidationError type when top type absent', () => {
    const e = { response: { node_errors: { '1': { errors: [{ message: 'x' }] } } } }
    expect(extractRunError(e, 1).type).toBe('ValidationError')
  })

  it('matches node id by string or number key', () => {
    const e = { response: { node_errors: { 7: { errors: [{ message: 'numkey' }] } } } }
    expect(extractRunError(e, '7').message).toBe('numkey')
  })

  it('aggregates other nodes errors when this node has none', () => {
    const e = {
      response: {
        node_errors: {
          '9': { class_type: 'KSampler', errors: [{ message: 'oops', details: 'd' }] },
        },
      },
    }
    const out = extractRunError(e, 1)
    expect(out.message).toContain('KSampler (#9): oops — d')
    expect(out.type).toBe('ValidationError')
  })

  it('uses top-level prompt error when no node errors', () => {
    const e = { response: { error: { message: 'fail', details: 'why', type: 'Boom' } } }
    const out = extractRunError(e, 1)
    expect(out.message).toBe('fail: why')
    expect(out.type).toBe('Boom')
  })

  it('falls back to Error message and stack', () => {
    const err = new Error('kaboom')
    const out = extractRunError(err, 1)
    expect(out.message).toBe('kaboom')
    expect(out.traceback).toBe(err.stack)
  })

  it('handles string errors', () => {
    expect(extractRunError('plain', 1).message).toBe('plain')
  })

  it('defaults message for unknown error shape', () => {
    expect(extractRunError({}, 1).message).toBe('queuePrompt failed')
  })
})
