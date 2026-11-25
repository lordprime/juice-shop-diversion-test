import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import jws from 'jws'
import { SessionInsights, insights } from '../../lib/insights'
import * as security from '../../lib/insecurity'

const ADMIN = 'admin@juice-sh.op'

// A stand-in for the host's collector: records every note it gets and answers each
// connection the way the real one does.
class Collector {
  readonly notes: any[] = []
  readonly raw: string[] = []
  readonly socketPath: string
  private readonly server: net.Server
  private readonly dir: string

  constructor () {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insights-'))
    this.socketPath = path.join(this.dir, 'events.sock')
    this.server = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => { data += chunk.toString() })
      conn.on('end', () => {
        this.raw.push(data)
        for (const line of data.split('\n').filter(Boolean)) this.notes.push(JSON.parse(line))
        conn.end('ok\n')
      })
    })
  }

  async start () {
    await new Promise<void>((resolve) => this.server.listen(this.socketPath, resolve))
  }

  async stop () {
    await new Promise<void>((resolve) => this.server.close(() => { resolve() }))
    fs.rmSync(this.dir, { recursive: true, force: true })
  }

  // Wait until at least `count` notes arrived, then a little longer for strays.
  async settle (count = 0) {
    const deadline = Date.now() + 2000
    while (this.notes.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
    await new Promise(resolve => setTimeout(resolve, 100))
    return this.notes
  }
}

void describe('SessionInsights', () => {
  let collector: Collector
  let subject: SessionInsights

  beforeEach(async () => {
    collector = new Collector()
    await collector.start()
    subject = new SessionInsights(collector.socketPath, ADMIN)
    subject.setAdminId(1)
  })

  afterEach(async () => {
    await collector.stop()
  })

  void it('notes a login that returned the administrator for some other email, once', async () => {
    subject.loggedIn("' OR 1=1--", { id: 1, email: ADMIN }, 'token-a')
    subject.accepted('token-a', { data: { id: 1, email: ADMIN } }, 'session')
    subject.accepted('token-a', { data: { id: 1, email: ADMIN } }, 'bearer')
    const notes = await collector.settle(1)
    assert.deepEqual(notes, [{ kind: 'login_mismatch', user: 1, email: "' OR 1=1--" }])
  })

  void it('notes the comment-style injection on the exact email too', async () => {
    subject.loggedIn(ADMIN + "'--", { id: 1, email: ADMIN }, 'token-b')
    const notes = await collector.settle(1)
    assert.equal(notes.length, 1)
    assert.equal(notes[0].kind, 'login_mismatch')
  })

  void it('says nothing about the administrator signing in with their own email and password', async () => {
    subject.loggedIn(ADMIN, { id: 1, email: ADMIN }, 'token-c')
    subject.accepted('token-c', { data: { id: 1, email: ADMIN } }, 'session')
    subject.accepted('token-c', { data: { id: 1, email: ADMIN } }, 'signature')
    assert.deepEqual(await collector.settle(), [])
  })

  void it('notes an administrator token that no login issued (a forged one), once per token', async () => {
    subject.accepted('forged-1', { data: { id: 1, email: ADMIN } }, 'signature')
    subject.accepted('forged-1', { data: { id: 1, email: ADMIN } }, 'session')
    subject.accepted('forged-2', { data: { id: 1 } }, 'bearer')
    const notes = await collector.settle(2)
    assert.deepEqual(notes.map(n => [n.kind, n.user, n.via]).sort(), [
      ['privileged_session', 1, 'bearer'],
      ['privileged_session', 1, 'signature']
    ])
  })

  void it('takes the administrator by exact email or by id, never by role', async () => {
    subject.accepted('by-email', { data: { id: 77, email: ADMIN } }, 'signature')
    subject.accepted('by-string-id', { data: { id: '1', email: 'x@y.z' } }, 'signature')
    subject.accepted('by-role', { data: { id: 99, email: 'me@example.com', role: 'admin' } }, 'signature')
    subject.accepted('other-case', { data: { id: 98, email: 'Admin@juice-sh.op' } }, 'signature')
    subject.accepted('padded', { data: { id: 97, email: ADMIN + ' ' } }, 'signature')
    subject.accepted('odd-id', { data: { id: '1 OR 1', email: 'x@y.z' } }, 'signature')
    subject.accepted('float-id', { data: { id: 1.5 } }, 'signature')
    subject.accepted('object-id', { data: { id: { toString: () => '1' } } }, 'signature')
    subject.loggedIn('me@example.com', { id: 99, email: 'me@example.com', role: 'admin' } as any, 'self-made')
    const notes = await collector.settle(2)
    assert.deepEqual(notes.map(n => n.user).sort(), [1, 77])
  })

  void it('ignores whatever is not a token or carries no user', async () => {
    for (const token of [undefined, null, '', 42, {}, ['x']]) subject.accepted(token, { data: { id: 1 } }, 'signature')
    for (const payload of [undefined, null, 'x', 42, {}, { data: null }, { data: 'admin' }, { data: [] }]) subject.accepted('t', payload, 'signature')
    subject.loggedIn(ADMIN + 'x', undefined, 'u')
    subject.loggedIn(undefined, { id: 2, email: 'a@b.c' }, 'v')
    assert.deepEqual(await collector.settle(), [])
  })

  void it('cuts a long submitted email', async () => {
    subject.loggedIn("' OR 1=1--" + 'x'.repeat(10000), { id: 1 }, 'long')
    const [note] = await collector.settle(1)
    assert.equal(note.email.length, 256)
  })

  void it('carries a verified session over to the token issued in its place', async () => {
    subject.loggedIn(ADMIN, { id: 1, email: ADMIN }, 'first')
    subject.reissued('first', 'second')
    subject.accepted('second', { data: { id: 1, email: ADMIN } }, 'session')
    // a token issued from a session that was not verified stays unverified
    subject.reissued('never-seen', 'third')
    subject.accepted('third', { data: { id: 1, email: ADMIN } }, 'session')
    const notes = await collector.settle(1)
    assert.deepEqual(notes.map(n => n.kind), ['privileged_session'])
  })

  void it('keeps only digests of the tokens it remembers', () => {
    subject.loggedIn(ADMIN, { id: 1 }, 'plain-token-value')
    assert.ok(!JSON.stringify([...(subject as any).verified]).includes('plain-token-value'))
  })

  void it('before the administrator id is known, still goes by the exact email', async () => {
    const early = new SessionInsights(collector.socketPath, ADMIN)
    early.accepted('e1', { data: { id: 1 } }, 'signature')
    early.accepted('e2', { data: { id: 5, email: ADMIN } }, 'signature')
    const notes = await collector.settle(1)
    assert.deepEqual(notes.map(n => n.user), [5])
  })

  void it('sends one line per connection, ending in a newline', async () => {
    subject.accepted('n1', { data: { id: 1 } }, 'signature')
    await collector.settle(1)
    assert.equal(collector.raw.length, 1)
    assert.ok(collector.raw[0].endsWith('\n'))
    assert.equal(collector.raw[0].split('\n').length, 2)
  })

  void it('carries on quietly when no collector is listening', async () => {
    const away = new SessionInsights(path.join(os.tmpdir(), 'no-such-dir', 'events.sock'), ADMIN)
    away.setAdminId(1)
    assert.doesNotThrow(() => { away.accepted('a', { data: { id: 1 } }, 'signature') })
    assert.doesNotThrow(() => { away.loggedIn('x', { id: 1 }, 'b') })
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  void it('tries again when the collector is not there yet or its queue is full', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insights-'))
    const late = new SessionInsights(path.join(dir, 'events.sock'), ADMIN)
    late.setAdminId(1)
    late.accepted('late', { data: { id: 1 } }, 'signature')
    await new Promise(resolve => setTimeout(resolve, 150))
    const notes: any[] = []
    const server = net.createServer((conn) => {
      let data = ''
      conn.on('data', (chunk) => { data += chunk.toString() })
      conn.on('end', () => { notes.push(JSON.parse(data)); conn.end('ok\n') })
    })
    await new Promise<void>((resolve) => server.listen(path.join(dir, 'events.sock'), resolve))
    try {
      const deadline = Date.now() + 3000
      while (notes.length === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
      assert.deepEqual(notes.map(n => n.kind), ['privileged_session'])
    } finally {
      await new Promise<void>((resolve) => server.close(() => { resolve() }))
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  void it('carries on when the collector never answers', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insights-'))
    const silentPath = path.join(dir, 'silent.sock')
    const sockets: net.Socket[] = []
    const silent = net.createServer((conn) => { sockets.push(conn) })
    await new Promise<void>((resolve) => silent.listen(silentPath, resolve))
    try {
      const quiet = new SessionInsights(silentPath, ADMIN, 50)
      quiet.setAdminId(1)
      quiet.accepted('q', { data: { id: 1 } }, 'signature')
      await new Promise(resolve => setTimeout(resolve, 300))
      assert.ok(sockets.length === 1 && sockets[0].destroyed === false)
      // the shop's side gave up on its own
      await new Promise(resolve => setTimeout(resolve, 100))
    } finally {
      for (const s of sockets) s.destroy()
      await new Promise<void>((resolve) => silent.close(() => { resolve() }))
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

void describe('token checks report what they accept', () => {
  afterEach(() => { mock.restoreAll() })

  void it('verify() reports a token whose signature it accepted, forged ones included', () => {
    const accepted = mock.method(insights, 'accepted', () => {})
    const publicKey = fs.readFileSync('encryptionkeys/jwt.pub', 'utf8')
    // the old algorithm-confusion forgery: HS256 keyed with the public key
    const forged = jws.sign({ header: { alg: 'HS256', typ: 'JWT' }, payload: { data: { id: 1, email: ADMIN } }, secret: publicKey })
    assert.ok(security.verify(forged))
    assert.equal(accepted.mock.callCount(), 1)
    assert.deepEqual(accepted.mock.calls[0].arguments, [forged, { data: { id: 1, email: ADMIN } }, 'signature'])
  })

  void it('verify() reports nothing for a token it rejects', () => {
    const accepted = mock.method(insights, 'accepted', () => {})
    const bad = jws.sign({ header: { alg: 'HS256', typ: 'JWT' }, payload: { data: { id: 1 } }, secret: 'not the key' })
    assert.ok(!security.verify(bad))
    assert.ok(!security.verify(''))
    assert.equal(accepted.mock.callCount(), 0)
  })

  void it('a session lookup reports the token it found', () => {
    const accepted = mock.method(insights, 'accepted', () => {})
    const entry = { data: { id: 1, email: ADMIN } } as any
    security.authenticatedUsers.put('looked-up', entry)
    assert.equal(security.authenticatedUsers.get('looked-up'), entry)
    assert.equal(security.authenticatedUsers.get('missing'), undefined)
    assert.deepEqual(accepted.mock.calls.map(c => c.arguments), [['looked-up', entry, 'session']])
  })

  void it('isAuthorized() reports the bearer token it accepted, and nothing when it refuses', async () => {
    const accepted = mock.method(insights, 'accepted', () => {})
    const token = security.authorize({ data: { id: 1, email: ADMIN } })
    const run = async (authorization: string) => await new Promise<unknown>((resolve) => {
      const req: any = { method: 'GET', headers: { authorization }, url: '/' }
      security.isAuthorized()(req, {} as any, (error?: unknown) => { resolve(error) })
    })
    assert.equal(await run('Bearer ' + token), undefined)
    assert.ok(await run('Bearer nonsense') !== undefined)
    assert.equal(accepted.mock.callCount(), 1)
    assert.equal(accepted.mock.calls[0].arguments[0], token)
    assert.equal((accepted.mock.calls[0].arguments[1] as any).data.id, 1)
    assert.equal(accepted.mock.calls[0].arguments[2], 'bearer')
  })
})
