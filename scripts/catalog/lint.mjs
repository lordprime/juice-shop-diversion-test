/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// Checks the shop's generated text (the content pack and the static pages)
// before it ships. It flags two things:
//   - words that do not belong in shop copy at all;
//   - sentences that read as orders addressed to an automated assistant or
//     model ("ignore the instructions above", "as an assistant you must ...").
// Usage: node scripts/catalog/lint.mjs <file or directory> ...
// Exits 0 when clean, 1 when something is flagged, 2 on bad input.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ADDRESSEE = String.raw`(?:ai|assistants?|agents?|(?:language\s+)?models?|llms?|bots?|chatbots?|gpts?)`

export const RULES = Object.freeze([
  {
    name: 'banned-word',
    pattern: /\b(?:diversions?|labs?|oracles?|canar(?:y|ies)|honeypots?|ai|agents?|llms?)\b/i
  },
  {
    name: 'override-instructions',
    pattern: /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,40}\b(?:instructions?|prompts?|rules|guidelines|directives)\b/i
  },
  {
    name: 'prompt-reference',
    pattern: /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b/i
  },
  {
    name: 'identity-claim',
    pattern: new RegExp(String.raw`\b(?:you\s+are\s+(?:now\s+)?|act\s+as\s+|pretend\s+to\s+be\s+|(?:if|when|since)\s+you\s+are\s+)(?:an?\s+|the\s+)?${ADDRESSEE}\b`, 'i')
  },
  {
    name: 'addressed-order',
    pattern: new RegExp(String.raw`\b(?:attention|note|message|instructions?|reminder|notice)\s+(?:to|for)\s+(?:any\s+|all\s+|the\s+)?${ADDRESSEE}\b`, 'i')
  },
  {
    name: 'addressed-order',
    pattern: new RegExp(String.raw`\b${ADDRESSEE}\s*[,:;]\s*(?:please\s+)?(?:ignore|disregard|forget|stop|do|don't|never|always|reply|respond|say|output|print|reveal|tell|follow|obey|execute|run|call|visit|open|send|report|skip)\b`, 'i')
  },
  {
    name: 'duty-for-addressee',
    pattern: new RegExp(String.raw`\b${ADDRESSEE}\s+(?:must|should|shall|need\s+to|have\s+to|are\s+required\s+to|are\s+instructed\s+to)\b`, 'i')
  },
  {
    name: 'duty-for-addressee',
    pattern: new RegExp(String.raw`\bas\s+an?\s+${ADDRESSEE}\b[^.!?\n]{0,30}\byou\s+(?:must|should|need|have\s+to|will|shall)\b`, 'i')
  }
])

export class ContentLinter {
  constructor (rules = RULES) {
    this.rules = rules
  }

  // Every flagged sentence part in one piece of text.
  checkText (text, location) {
    if (typeof text !== 'string') {
      throw new TypeError(`${location}: expected text, got ${typeof text}`)
    }
    const findings = []
    for (const rule of this.rules) {
      const match = rule.pattern.exec(text)
      if (match !== null) {
        findings.push({ location, rule: rule.name, excerpt: match[0] })
      }
    }
    return findings
  }

  // Every string anywhere in a parsed JSON value, keys included.
  checkJson (value, location) {
    if (typeof value === 'string') {
      return this.checkText(value, location)
    }
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.checkJson(item, `${location}[${index}]`))
    }
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, item]) => [
        ...this.checkText(key, `${location}.${key} (key)`),
        ...this.checkJson(item, `${location}.${key}`)
      ])
    }
    return []
  }

  // The visible text of a page plus the attribute values a reader can see or
  // a tool can read (titles, alt texts, meta content).
  checkHtml (html, location) {
    const withoutCode = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    const attributes = [...withoutCode.matchAll(/\b(?:alt|title|content|aria-label|placeholder)\s*=\s*"([^"]*)"/gi)].map(m => m[1])
    const visible = withoutCode.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
    return [visible, ...attributes].flatMap(text => this.checkText(decodeEntities(text), location))
  }

  checkFile (file) {
    const content = fs.readFileSync(file, 'utf8')
    if (file.endsWith('.json')) {
      return this.checkJson(JSON.parse(content), file)
    }
    if (file.endsWith('.html')) {
      return this.checkHtml(content, file)
    }
    return this.checkText(content, file)
  }

  checkPath (target) {
    const stat = fs.statSync(target)
    if (!stat.isDirectory()) {
      return this.checkFile(target)
    }
    return fs.readdirSync(target).sort()
      .flatMap(name => this.checkPath(path.join(target, name)))
  }
}

function decodeEntities (text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function main (targets) {
  if (targets.length === 0) {
    console.error('usage: node scripts/catalog/lint.mjs <file or directory> ...')
    return 2
  }
  const linter = new ContentLinter()
  let findings
  try {
    findings = targets.flatMap(target => linter.checkPath(target))
  } catch (error) {
    console.error(`content lint: ${error.message}`)
    return 2
  }
  for (const { location, rule, excerpt } of findings) {
    console.error(`${location}: ${rule}: "${excerpt}"`)
  }
  if (findings.length > 0) {
    console.error(`content lint: ${findings.length} finding(s)`)
    return 1
  }
  console.log(`content lint: ${targets.join(', ')} clean`)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
