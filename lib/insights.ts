/*
 * Session insights: a short note to the host's local collector whenever an
 * administrator session shows up that the administrator did not open with their
 * own email and password.
 *
 * The collector listens on a Unix socket only the shop process itself can use, so
 * nothing here goes over the network. A note is one JSON line per connection:
 *
 *   login_mismatch      a login returned the administrator although the email sent
 *                       was not the administrator's own
 *   privileged_session  the shop accepted an administrator token that no login with
 *                       the administrator's own email and password issued
 *
 * "The administrator" is the user with the administrator's id or exact email, never
 * anyone whose token merely says role "admin": a new account can ask for that role.
 */
import crypto from 'node:crypto'
import net from 'node:net'
import config from 'config'

interface SessionUser {
  id?: unknown
  email?: unknown
}

export class SessionInsights {
  static readonly SOCKET_PATH = '/run/insights/events.sock'
  static readonly MAX_REMEMBERED = 10000
  static readonly MAX_EMAIL_CHARS = 256
  static readonly ANSWER_TIMEOUT_MS = 5000

  // SHA-256 digests only, never the tokens themselves
  private readonly verified = new Set<string>()
  private readonly reported = new Set<string>()
  private adminId: number | undefined

  constructor (
    private readonly socketPath: string,
    readonly adminEmail: string,
    private readonly answerTimeoutMs = SessionInsights.ANSWER_TIMEOUT_MS
  ) {}

  /** The administrator's user id, once the user table is seeded. */
  setAdminId (id: number | undefined) {
    this.adminId = id
  }

  /**
   * A login returned `token` for `user`. `submittedEmail` is the email the client
   * sent. When it is exactly the administrator's, the database matched that email
   * and the password together, so the session is the administrator's own doing.
   */
  loggedIn (submittedEmail: unknown, user: SessionUser | undefined, token: string) {
    const digest = this.digest(token)
    if (submittedEmail === this.adminEmail) {
      this.remember(this.verified, digest)
      return
    }
    if (this.isAdmin(user) && this.remember(this.reported, digest)) {
      this.send({ kind: 'login_mismatch', user: this.idOf(user), email: String(submittedEmail ?? '').slice(0, SessionInsights.MAX_EMAIL_CHARS) })
    }
  }

  /** The shop accepted `token` for a request; `payload` is what it carries, `via` which check took it. */
  accepted (token: unknown, payload: unknown, via: string) {
    if (typeof token !== 'string' || token === '') return
    const user = this.userOf(payload)
    if (!this.isAdmin(user)) return
    const digest = this.digest(token)
    if (this.verified.has(digest) || !this.remember(this.reported, digest)) return
    this.send({ kind: 'privileged_session', user: this.idOf(user), via })
  }

  /** `next` was issued in place of `previous` for the same signed-in user. */
  reissued (previous: unknown, next: string) {
    if (typeof previous === 'string' && this.verified.has(this.digest(previous))) {
      this.remember(this.verified, this.digest(next))
    }
  }

  private isAdmin (user: SessionUser | undefined) {
    if (user === undefined) return false
    if (user.email === this.adminEmail) return true
    return this.adminId !== undefined && this.idOf(user) === this.adminId
  }

  // The user id as a number when it is one (or all digits), else undefined.
  private idOf (user: SessionUser | undefined) {
    const id = user?.id
    if (typeof id === 'number' && Number.isInteger(id)) return id
    if (typeof id === 'string' && /^[0-9]{1,15}$/.test(id)) return Number(id)
    return undefined
  }

  private userOf (payload: unknown): SessionUser | undefined {
    const data = (payload !== null && typeof payload === 'object') ? (payload as { data?: unknown }).data : undefined
    return (data !== null && typeof data === 'object' && !Array.isArray(data)) ? data : undefined
  }

  private digest (token: string) {
    return crypto.createHash('sha256').update(token).digest('hex')
  }

  // Adds the digest; false when it was already there. A full set still says true,
  // so a note is sent rather than lost.
  private remember (set: Set<string>, digest: string) {
    if (set.has(digest)) return false
    if (set.size < SessionInsights.MAX_REMEMBERED) set.add(digest)
    return true
  }

  // One note, one connection. The shop never waits for it and never fails over it.
  private send (note: Record<string, unknown>) {
    const socket = net.createConnection({ path: this.socketPath })
    socket.setTimeout(this.answerTimeoutMs, () => socket.destroy())
    socket.on('error', () => { socket.destroy() })
    socket.on('connect', () => { socket.end(JSON.stringify(note) + '\n') })
    socket.on('data', () => { socket.destroy() })
  }
}

export const insights = new SessionInsights(SessionInsights.SOCKET_PATH, 'admin@' + config.get<string>('application.domain'))
