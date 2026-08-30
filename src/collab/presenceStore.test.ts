import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { usePresenceStore } from './presenceStore'

const bobWire = {
  conn_id: 'c2', peer_id: 'pb', name: 'Bob', color: 'hsl(120, 80%, 62%)',
  project_id: 'p1',
  presence: { cursor: { x: 1, y: 2 }, selected: ['5'], idle: 'active' },
}

describe('presenceStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('welcome seeds self ids, peers and docs', () => {
    const store = usePresenceStore()
    store.applyMessage({
      type: 'welcome', conn_id: 'c1', peer_id: 'pa', peers: [bobWire],
      docs: { p1: 3 },
    })
    expect(store.connected).toBe(true)
    expect(store.selfConnId).toBe('c1')
    expect(store.selfPeerId).toBe('pa')
    expect(store.peers.c2.cursor).toEqual({ x: 1, y: 2 })
    expect(store.docs.p1).toBe(3)
  })

  it('join then leave', () => {
    const store = usePresenceStore()
    store.applyMessage({ type: 'welcome', conn_id: 'c1', peer_id: 'pa', peers: [] })
    store.applyMessage({ type: 'peer-join', peer: bobWire })
    expect(store.peerCount).toBe(1)
    store.applyMessage({ type: 'peer-leave', conn_id: 'c2' })
    expect(store.peerCount).toBe(0)
  })

  it('peer-presence updates cursor/selection, keeps identity', () => {
    const store = usePresenceStore()
    store.applyMessage({ type: 'welcome', conn_id: 'c1', peer_id: 'pa', peers: [bobWire] })
    store.applyMessage({
      type: 'peer-presence', conn_id: 'c2', project_id: 'p2',
      cursor: null, selected: ['9'], idle: 'idle',
    })
    const bob = store.peers.c2
    expect(bob.name).toBe('Bob')
    expect(bob.projectId).toBe('p2')
    expect(bob.cursor).toBeNull()
    expect(bob.selected).toEqual(['9'])
    expect(bob.idle).toBe('idle')
  })

  it('peer-canvas stored with its source conn; edit_state tracks docs', () => {
    const store = usePresenceStore()
    store.applyMessage({ type: 'welcome', conn_id: 'c1', peer_id: 'pa', peers: [] })
    store.applyMessage({ type: 'peer-canvas', project_id: 'p1', conn_id: 'c2',
      stages: [{ uid: 's1' }] })
    expect(store.driverCanvas?.stages).toHaveLength(1)
    expect(store.driverCanvas?.fromConn).toBe('c2')
    store.applyMessage({ type: 'edit_state', project_id: 'p1', clock: 4 })
    expect(store.docs.p1).toBe(4)
  })

  it('reset clears everything', () => {
    const store = usePresenceStore()
    store.applyMessage({ type: 'welcome', conn_id: 'c1', peer_id: 'pa', peers: [bobWire] })
    store.reset()
    expect(store.connected).toBe(false)
    expect(store.peerCount).toBe(0)
    expect(store.driverCanvas).toBeNull()
  })
})
