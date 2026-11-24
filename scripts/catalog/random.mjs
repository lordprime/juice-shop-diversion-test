/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// A small seeded random source (mulberry32). The same seed always gives the
// same sequence on every platform, which keeps the content pack byte-stable.
export class SeededRandom {
  constructor (seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('seed must be an integer between 0 and 2^32 - 1')
    }
    this.state = seed
  }

  next () {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int (min, max) {
    if (max < min) {
      throw new RangeError('max must not be below min')
    }
    return min + Math.floor(this.next() * (max - min + 1))
  }

  pick (items) {
    if (items.length === 0) {
      throw new RangeError('cannot pick from an empty list')
    }
    return items[this.int(0, items.length - 1)]
  }

  chance (probability) {
    return this.next() < probability
  }
}
