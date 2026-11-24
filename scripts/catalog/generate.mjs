/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// Writes the content pack from its fixed seed, or with --check confirms that
// the files in the repository are exactly what the seed produces.
// Usage: node scripts/catalog/generate.mjs [--check]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CatalogGenerator } from './catalog.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export class ContentPack {
  constructor (root = ROOT, generator = new CatalogGenerator()) {
    this.root = root
    this.generator = generator
  }

  // Relative path -> file content, for everything the pack consists of.
  files () {
    const catalog = this.generator.generate()
    return new Map([['data/static/catalog.json', JSON.stringify(catalog, null, 2) + '\n']])
  }

  write () {
    for (const [relative, content] of this.files()) {
      const target = path.join(this.root, relative)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, content)
    }
  }

  // Files that are missing or differ from what the seed produces.
  drift () {
    const drifted = []
    for (const [relative, content] of this.files()) {
      const target = path.join(this.root, relative)
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
        drifted.push(relative)
      }
    }
    return drifted
  }
}

function main (args) {
  const pack = new ContentPack()
  if (args.length === 0) {
    pack.write()
    return 0
  }
  if (args.length === 1 && args[0] === '--check') {
    const drifted = pack.drift()
    for (const relative of drifted) {
      console.error(`content pack: ${relative} does not match its seed; run node scripts/catalog/generate.mjs`)
    }
    return drifted.length === 0 ? 0 : 1
  }
  console.error('usage: node scripts/catalog/generate.mjs [--check]')
  return 2
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
