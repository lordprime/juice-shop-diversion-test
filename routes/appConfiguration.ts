/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import config from 'config'
import { type Request, type Response } from 'express'

// The browser app reads only the server and application settings, so only
// those are published. Product and memory seeding stays on the server.
export function retrieveAppConfiguration () {
  return (_req: Request, res: Response) => {
    const { server, application } = config.util.toObject(config)
    res.json({ config: { server, application } })
  }
}
