import { defineComponent, h } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { mounts, registerMount, unregisterMount } from './widgetMounts'

const Dummy = defineComponent({ render: () => h('div') })

describe('widgetMounts', () => {
  beforeEach(() => {
    mounts.splice(0, mounts.length)
  })

  it('registers a mount entry', () => {
    const el = document.createElement('div')
    registerMount('a', el, Dummy, { foo: 1 })
    expect(mounts).toHaveLength(1)
    expect(mounts[0]).toMatchObject({ key: 'a', container: el })
    expect(mounts[0].props.foo).toBe(1)
  })

  it('unregisters by key', () => {
    registerMount('a', document.createElement('div'), Dummy, {})
    registerMount('b', document.createElement('div'), Dummy, {})
    unregisterMount('a')
    expect(mounts.map((m) => m.key)).toEqual(['b'])
  })

  it('is a no-op when unregistering an unknown key', () => {
    registerMount('a', document.createElement('div'), Dummy, {})
    unregisterMount('missing')
    expect(mounts).toHaveLength(1)
  })
})
