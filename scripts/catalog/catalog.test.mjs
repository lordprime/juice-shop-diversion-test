/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CatalogGenerator, DEFAULT_SEED } from './catalog.mjs'
import { SeededRandom } from './random.mjs'
import { ContentPack } from './generate.mjs'
import { ContentLinter } from './lint.mjs'

describe('SeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new SeededRandom(7)
    const b = new SeededRandom(7)
    assert.deepEqual([a.next(), a.next(), a.next()], [b.next(), b.next(), b.next()])
  })
  it('stays inside the requested range', () => {
    const random = new SeededRandom(1)
    for (let i = 0; i < 1000; i++) {
      const n = random.int(3, 5)
      assert.ok(n >= 3 && n <= 5)
    }
  })
  it('rejects bad seeds and ranges', () => {
    for (const seed of [-1, 1.5, 2 ** 32, NaN, '7']) {
      assert.throws(() => new SeededRandom(seed), RangeError)
    }
    assert.throws(() => new SeededRandom(1).int(5, 3), RangeError)
    assert.throws(() => new SeededRandom(1).pick([]), RangeError)
  })
})

describe('CatalogGenerator', () => {
  const pack = new CatalogGenerator().generate()

  it('has the default size: 150 products, 200 customers, 600 reviews', () => {
    assert.equal(pack.seed, DEFAULT_SEED)
    assert.equal(pack.products.length, 150)
    assert.equal(pack.users.length, 200)
    assert.equal(pack.reviews.length, 600)
  })
  it('is the same every time for the same seed', () => {
    const generator = new CatalogGenerator()
    assert.deepEqual(generator.generate(), pack)
    assert.deepEqual(generator.generate(), pack)
  })
  it('differs for another seed', () => {
    assert.notDeepEqual(new CatalogGenerator({ seed: DEFAULT_SEED + 1 }).generate().products, pack.products)
  })
  it('has unique product names and customer e-mails', () => {
    assert.equal(new Set(pack.products.map(p => p.name)).size, pack.products.length)
    assert.equal(new Set(pack.users.map(u => u.email)).size, pack.users.length)
  })
  it('gives every product at least one and at most six reviews', () => {
    const counts = pack.products.map((_, index) => pack.reviews.filter(r => r.product === index).length)
    assert.ok(counts.every(n => n >= 1 && n <= 6), JSON.stringify(counts))
  })
  it('points reviews at real products and customers', () => {
    assert.ok(pack.reviews.every(r => r.product >= 0 && r.product < pack.products.length))
    assert.ok(pack.reviews.every(r => r.author >= 0 && r.author < pack.users.length))
  })
  it('has sane prices and stock', () => {
    for (const p of pack.products) {
      assert.ok(p.price > 0 && p.deluxePrice > 0 && p.deluxePrice <= p.price, p.name)
      assert.ok(Number.isInteger(p.quantity) && p.quantity >= 20, p.name)
    }
  })
  it('holds no passwords and only customer roles', () => {
    assert.ok(pack.users.every(u => !('password' in u)))
    assert.ok(pack.users.every(u => ['customer', 'deluxe'].includes(u.role)))
  })
  it('passes the content lint', () => {
    assert.deepEqual(new ContentLinter().checkJson(pack, 'pack'), [])
  })
  it('rejects impossible sizes', () => {
    for (const options of [{ products: 0 }, { users: -1 }, { reviews: 1.5 }, { products: 10, reviews: 5 }, { products: '3' }]) {
      assert.throws(() => new CatalogGenerator(options), RangeError, JSON.stringify(options))
    }
  })
  it('stops instead of looping forever when names run out', () => {
    assert.throws(() => new CatalogGenerator({ products: 100000, reviews: 100000 }).generate(), /distinct product names/)
  })
})

describe('ContentPack', () => {
  it('the committed pack matches its seed', () => {
    assert.deepEqual(new ContentPack().drift(), [])
  })
  it('reports missing and edited files, and write() repairs them', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'content-pack-'))
    const pack = new ContentPack(root)
    assert.ok(pack.drift().length > 0)
    pack.write()
    assert.deepEqual(pack.drift(), [])
    const [first] = pack.files().keys()
    fs.appendFileSync(path.join(root, first), ' ')
    assert.deepEqual(pack.drift(), [first])
  })
})
