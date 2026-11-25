/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// Checks the text the shop serves (the generated content pack and pages, and
// the upstream copy: configuration, translations, views, FTP files) before it
// ships. It flags two things:
//   - words that do not belong in shop copy at all;
//   - sentences that read as orders addressed to an automated assistant or
//     model ("ignore the instructions above", "as an assistant you must ...").
// Findings listed in lint-allow.json (next to this file) are accepted; each
// entry names the file, the exact text and why it is legitimate there.
// Usage: node scripts/catalog/lint.mjs <file or directory> ...
// Exits 0 when clean, 1 when something is flagged, 2 on bad input.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Who an order could be aimed at: generic names and the names of well-known models.
const ADDRESSEE = String.raw`(?:ai|assistants?|agents?|(?:language\s+)?models?|llms?|bots?|chatbots?|gpts?|` +
  String.raw`automated\s+systems?|claude|chatgpt|gemini|copilot|llama|qwen|deepseek)`
// Up to four words between the addressee and the verb ("assistants reading this page must").
const GAP = String.raw`(?:\s+[\w'-]+){0,4}?`
// Files the lint reads; anything else (images, archives, compiled files) is skipped.
const TEXT_FILES = /\.(?:json|html?|md|ya?ml|txt|hbs|pug|vtt|csv|bak)$/i

export const RULES = Object.freeze([
  {
    name: 'banned-word',
    pattern: /\b(?:diversions?|labs?|oracles?|canar(?:y|ies)|honeypots?|ai|agents?|llms?)\b/i
  },
  {
    name: 'override-instructions',
    pattern: /\b(?:ignore|disregard|forget|override)\b[^.!?\n]{0,40}\b(?:instructions?|prompts?|rules|guidelines|directives|directions)\b/i
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
    name: 'identity-claim',
    pattern: new RegExp(String.raw`\b(?:if|when|since)\s+you(?:\s+are|'re)\s+(?:reading|processing|parsing|crawling|scanning|summari[sz]ing)\s+this\b[^.!?\n]{0,40}\b(?:automat\w*|${ADDRESSEE}|crawlers?|scripts?|programs?|tools?)\b`, 'i')
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
    pattern: new RegExp(String.raw`\b${ADDRESSEE}${GAP}\s+(?:must|should|shall|need\s+to|have\s+to|are\s+required\s+to|are\s+instructed\s+to)\b`, 'i')
  },
  {
    name: 'duty-for-addressee',
    pattern: new RegExp(String.raw`\bas\s+an?\s+${ADDRESSEE}\b[^.!?\n]{0,30}\byou\s+(?:must|should|need|have\s+to|will|shall)\b`, 'i')
  }
])

export class ContentLinter {
  // allowed: [{ file, excerpt, why }]. An entry applies to the file whose path is
  // exactly `file` or ends in `/file` (whole names only), and to that excerpt in
  // any case.
  constructor (rules = RULES, allowed = []) {
    this.rules = rules
    this.allowed = allowed
  }

  // Every flagged sentence part in one piece of text, except allowed ones.
  // `location` says where in the file the text sits; `file` is the file itself.
  checkText (text, location, file = location) {
    if (typeof text !== 'string') {
      throw new TypeError(`${location}: expected text, got ${typeof text}`)
    }
    const findings = []
    for (const rule of this.rules) {
      const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : rule.pattern.flags + 'g')
      for (const match of text.matchAll(global)) {
        if (!this.isAllowed(file, match[0])) {
          findings.push({ location, rule: rule.name, excerpt: match[0] })
        }
      }
    }
    return findings
  }

  isAllowed (file, excerpt) {
    const where = file.replaceAll('\\', '/')
    return this.allowed.some(entry =>
      (where === entry.file || where.endsWith('/' + entry.file)) &&
      entry.excerpt.toLowerCase() === excerpt.toLowerCase())
  }

  // Every string anywhere in a parsed JSON value, keys included.
  checkJson (value, location, file = location) {
    if (typeof value === 'string') {
      return this.checkText(value, location, file)
    }
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.checkJson(item, `${location}[${index}]`, file))
    }
    if (value !== null && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, item]) => [
        ...this.checkText(key, `${location}.${key} (key)`, file),
        ...this.checkJson(item, `${location}.${key}`, file)
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
    if (content.includes('\u0000')) {
      return []
    }
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
      .map(name => path.join(target, name))
      .filter(child => fs.statSync(child).isDirectory() || TEXT_FILES.test(child))
      .flatMap(child => this.checkPath(child))
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

// The accepted findings, from lint-allow.json next to this file.
export function loadAllowList (file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lint-allow.json')) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(entries) || !entries.every(e => typeof e?.file === 'string' && e.file !== '' &&
      typeof e.excerpt === 'string' && e.excerpt !== '' && typeof e.why === 'string' && e.why !== '')) {
    throw new Error(`${file}: every entry needs a file, an excerpt and a why`)
  }
  return entries
}

function main (targets) {
  if (targets.length === 0) {
    console.error('usage: node scripts/catalog/lint.mjs <file or directory> ...')
    return 2
  }
  let findings
  try {
    const linter = new ContentLinter(RULES, loadAllowList())
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
