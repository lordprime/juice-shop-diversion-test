import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'

// The shop takes its administrator password from a file descriptor at start.
// Hand it the one these tests log in with.
const passwordFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'juice-shop-test-')), 'admin_password')
fs.writeFileSync(passwordFile, 'admin123\n', { mode: 0o600 })
process.env.ADMIN_PASSWORD_FD = String(fs.openSync(passwordFile, 'r'))
