/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SiteGenerator } from './pages.mjs'
import { ContentLinter } from './lint.mjs'

describe('SiteGenerator', () => {
  const pages = new SiteGenerator().generate()

  it('has an index for each section', () => {
    for (const section of ['blog', 'help', 'changelog']) {
      assert.ok(pages.has(`pages/${section}/index.html`), section)
    }
  })
  it('only writes under pages/, and only HTML', () => {
    assert.ok([...pages.keys()].every(file => /^pages\/(blog|help|changelog)\/[\w.-]+\.html$/.test(file)))
  })
  it('links each index to pages that exist', () => {
    for (const [file, html] of pages) {
      if (!file.endsWith('/index.html')) continue
      const links = [...html.matchAll(/href="([^"#:/]+\.html)"/g)].map(m => m[1])
      assert.ok(links.length > 0, file)
      const dir = file.slice(0, file.lastIndexOf('/') + 1)
      for (const link of links) {
        assert.ok(pages.has(dir + link), `${file} links to missing ${link}`)
      }
    }
  })
  it('is the same every time for the same seed, and differs for another', () => {
    const generator = new SiteGenerator()
    assert.deepEqual(generator.generate(), pages)
    assert.deepEqual(generator.generate(), pages)
    assert.notDeepEqual(new SiteGenerator({ seed: 1 }).generate(), pages)
  })
  it('passes the content lint', () => {
    const linter = new ContentLinter()
    for (const [file, html] of pages) {
      assert.deepEqual(linter.checkHtml(html, file), [])
    }
  })
  it('writes real dates', () => {
    const site = new SiteGenerator()
    assert.equal(site.date(0), '1 January 2024')
    assert.equal(site.date(59), '29 February 2024')
    assert.equal(site.date(366), '1 January 2025')
  })
  it('rejects an impossible number of releases', () => {
    for (const releases of [0, -3, 2.5, 51, '4']) {
      assert.throws(() => new SiteGenerator({ releases }), RangeError, String(releases))
    }
  })
})
