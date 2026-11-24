/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// Builds the shop's static pages (blog, help and changelog) from a fixed seed.
// The seed decides dates, authors and which changes land in which release; the
// wording itself is plain shop copy written here.

import { SeededRandom } from './random.mjs'
import { DEFAULT_SEED } from './catalog.mjs'

const BLOG_POSTS = [
  ['why-we-press-cold', 'Why we press cold', [
    'Every bottle on our shelves starts as whole fruit that goes through a hydraulic press, not a spinning blade.',
    'Pressing slowly keeps the juice cool, which keeps the colour bright and the taste close to the fruit itself.',
    'It takes longer and gives a little less juice per crate, but we think the difference is worth it.'
  ]],
  ['five-uses-for-pomace', 'Five uses for leftover pomace', [
    'Pomace is what stays behind after pressing: skins, pulp and seeds. Most of ours goes back to the farms as compost.',
    'At home you can bake it into muffins, stir it into porridge, dry it for tea, or mix it into a marinade.',
    'If you collect more than you can use, the recycling page lets you send it back to us for free.'
  ]],
  ['meet-the-orchards', 'Meet the orchards', [
    'We buy from eleven family orchards, most of them less than a day by truck from our pressing room.',
    'This spring we visited the apple growers in the north and the berry farms along the coast.',
    'Each farm has its own harvest calendar, which is why some juices only appear for a few weeks a year.'
  ]],
  ['a-summer-of-berries', 'A summer of berries', [
    'Berry season is short and busy. For six weeks the pressing room runs two shifts.',
    'This year we are trying a blackberry and lemongrass blend and bringing back the raspberry cordial.',
    'Both are limited, so the shop shows how many bottles are left for each.'
  ]],
  ['packaging-that-comes-back', 'Packaging that comes back', [
    'Our glass bottles can be returned with your next delivery. Rinse them, put them in the crate, and we collect them.',
    'Returned glass is washed, checked and refilled. A bottle makes the trip around twenty times on average.',
    'Caps and labels are recycled separately.'
  ]],
  ['smoothies-for-busy-mornings', 'Smoothies for busy mornings', [
    'A smoothie is the fastest breakfast we know. Our tip: freeze ripe fruit the night before.',
    'Blend one cup of frozen fruit, half a cup of juice and a spoon of oats. Add a little mint if you have it.',
    'The shop carries ready-made smoothies too, delivered cold.'
  ]],
  ['winter-citrus', 'Winter citrus is here', [
    'When the days get short, citrus is at its best. Oranges, grapefruit and limes arrive from the south every week.',
    'Grapefruit and rosemary is the new pressing this winter, a little bitter and very fresh.',
    'Citrus juices keep for five days in the fridge once opened.'
  ]],
  ['juice-of-the-month', 'How we choose the juice of the month', [
    'Each month the team tastes three or four new blends side by side, without labels.',
    'The favourite becomes the juice of the month and gets a small discount for regular customers.',
    'Suggestions are welcome through the contact page.'
  ]]
]

const HELP_ARTICLES = [
  ['ordering', 'Placing an order', [
    'Add products to your basket, choose a delivery address and a delivery speed, then pay with a saved card or your wallet.',
    'You will get an order confirmation with a tracking number right away.'
  ]],
  ['delivery', 'Delivery times', [
    'Standard delivery takes three to five working days. Fast delivery takes one to two working days.',
    'Chilled products travel in insulated boxes with ice packs, so they arrive cold.'
  ]],
  ['returns', 'Returns and refunds', [
    'Unopened products can be returned within fourteen days. Opened food products cannot be returned for hygiene reasons.',
    'Refunds go back to the original payment method within five working days.'
  ]],
  ['payment', 'Payment methods', [
    'We accept major credit and debit cards and the shop wallet. Cards can be saved in your account for faster checkout.',
    'Coupons are entered in the basket before checkout.'
  ]],
  ['account', 'Your account', [
    'You can change your password, set up two-factor sign-in and export your data from the account menu.',
    'If you forget your password, use the forgotten password page and answer your security question.'
  ]],
  ['deluxe', 'Deluxe membership', [
    'Deluxe members get lower prices on most products, free fast delivery and early access to seasonal blends.',
    'Membership is billed once a year and can be cancelled at any time.'
  ]],
  ['gift-boxes', 'Gift boxes', [
    'Gift boxes come in three, six, nine or twelve bottles and include a handwritten card.',
    'Add your message in the order notes and choose the recipient address at checkout.'
  ]],
  ['contact', 'Contacting us', [
    'Use the contact page for questions and feedback. Our support team answers within one working day.',
    'For problems with a delivery, include your order number so we can find it quickly.'
  ]]
]

const CHANGES = [
  'Faster product search', 'New gift box sizes', 'Fixed a layout problem on small screens',
  'Clearer delivery estimates at checkout', 'Saved addresses can now be edited', 'Improved image loading on the product pages',
  'Added the seasonal smoothie range', 'Reviews now show the newest first', 'Fixed rounding of deluxe prices',
  'Wallet top-ups show a receipt', 'Order history can be filtered by date', 'New help pages for delivery and returns',
  'Better contrast for the dark theme', 'Fixed a rare basket total mismatch', 'Address form accepts longer street names',
  'Recycling pickups can be rescheduled', 'More languages in the language menu', 'Shorter checkout for returning customers'
]

const AUTHORS = ['Clara', 'Jonas', 'Priya', 'Mateo', 'Hana', 'Felix', 'Noor', 'Rosa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export class SiteGenerator {
  constructor ({ seed = DEFAULT_SEED, releases = 10 } = {}) {
    if (!Number.isInteger(releases) || releases < 1 || releases > 50) {
      throw new RangeError('releases must be a whole number from 1 to 50')
    }
    this.seed = seed
    this.releases = releases
  }

  // Relative path -> HTML, for every page.
  generate () {
    this.random = new SeededRandom(this.seed)
    return new Map([
      ...this.articles('blog', 'Blog', 'News and stories from the pressing room.', BLOG_POSTS, true),
      ...this.articles('help', 'Help', 'Answers to common questions about orders, delivery and your account.', HELP_ARTICLES, false),
      ...this.changelog()
    ])
  }

  articles (section, heading, intro, entries, dated) {
    const pages = new Map()
    const items = []
    let day = this.random.int(0, 20)
    for (const [slug, title, paragraphs] of entries) {
      day += this.random.int(9, 30)
      const byline = dated ? `<p class="meta">${this.date(day)} &middot; ${this.random.pick(AUTHORS)}</p>\n` : ''
      const body = paragraphs.map(text => `<p>${text}</p>`).join('\n')
      pages.set(`pages/${section}/${slug}.html`, this.page(title, `${byline}${body}\n<p><a href="index.html">Back to ${heading.toLowerCase()}</a></p>`))
      items.push(`<li><a href="${slug}.html">${title}</a></li>`)
    }
    const list = dated ? items.reverse() : items
    pages.set(`pages/${section}/index.html`, this.page(heading, `<p>${intro}</p>\n<ul>\n${list.join('\n')}\n</ul>`))
    return pages
  }

  changelog () {
    const pages = new Map()
    const items = []
    let day = this.random.int(0, 20)
    for (let release = 1; release <= this.releases; release++) {
      day += this.random.int(20, 45)
      const version = `2.${release}.0`
      const picked = new Set()
      const count = this.random.int(2, 4)
      while (picked.size < count) {
        picked.add(this.random.pick(CHANGES))
      }
      const changes = [...picked].map(text => `<li>${text}</li>`).join('\n')
      pages.set(`pages/changelog/${version}.html`, this.page(`Version ${version}`,
        `<p class="meta">Released ${this.date(day)}</p>\n<ul>\n${changes}\n</ul>\n<p><a href="index.html">All releases</a></p>`))
      items.push(`<li><a href="${version}.html">Version ${version}</a> &middot; ${this.date(day)}</li>`)
    }
    pages.set('pages/changelog/index.html', this.page('Changelog', `<p>What changed in each release of the shop.</p>\n<ul>\n${items.reverse().join('\n')}\n</ul>`))
    return pages
  }

  // Days since the first of January of the shop's first year, as a date.
  date (day) {
    const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    let year = 2024
    let rest = day
    for (;;) {
      for (let month = 0; month < 12; month++) {
        const length = lengths[month] + (month === 1 && year % 4 === 0 ? 1 : 0)
        if (rest < length) {
          return `${rest + 1} ${MONTHS[month]} ${year}`
        }
        rest -= length
      }
      year++
    }
  }

  page (title, content) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { font-family: sans-serif; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; color: #263238; }
nav a { margin-right: 1rem; }
.meta { color: #607d8b; font-size: 0.9rem; }
</style>
</head>
<body>
<nav><a href="/">Shop</a><a href="/blog/">Blog</a><a href="/help/">Help</a><a href="/changelog/">Changelog</a></nav>
<h1>${title}</h1>
${content}
</body>
</html>
`
  }
}
