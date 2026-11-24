/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Server } from 'socket.io'

const globalWithSocketIO = global as typeof globalThis & {
  io: Server
}

// The browser app still opens a socket on start; nothing is pushed over it.
const registerWebsocketEvents = (server: any) => {
  const io = new Server(server, { cors: { origin: 'http://localhost:4200' } })
  globalWithSocketIO.io = io
}

export default registerWebsocketEvents
