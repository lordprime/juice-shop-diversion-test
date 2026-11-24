/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

// Builds the shop's content pack (products, customers and reviews) from a
// fixed seed. Nothing here reads the clock or the environment, so the same
// seed always gives the same pack.

import { SeededRandom } from './random.mjs'

const FRUITS = [
  { name: 'Apple', image: 'apple_juice.jpg' },
  { name: 'Banana', image: 'banana_juice.jpg' },
  { name: 'Blackberry', image: 'berry_juice.jpg' },
  { name: 'Blueberry', image: 'berry_juice.jpg' },
  { name: 'Carrot', image: 'carrot_juice.jpeg' },
  { name: 'Cherry', image: 'raspberry_juice.jpg' },
  { name: 'Cranberry', image: 'raspberry_juice.jpg' },
  { name: 'Dragonfruit', image: 'dragonfruit_juice.jpg' },
  { name: 'Elderberry', image: 'elderflower_cordial.jpg' },
  { name: 'Grape', image: 'grape_juice.jpg' },
  { name: 'Grapefruit', image: 'orange_juice.jpg' },
  { name: 'Guava', image: 'eggfruit_juice.jpg' },
  { name: 'Kiwi', image: 'green_smoothie.jpg' },
  { name: 'Lemon', image: 'lemon_juice.jpg' },
  { name: 'Lime', image: 'lemon_juice.jpg' },
  { name: 'Mango', image: 'pineapple_juice.jpg' },
  { name: 'Melon', image: 'melon_juice.jpg' },
  { name: 'Orange', image: 'orange_juice.jpg' },
  { name: 'Papaya', image: 'eggfruit_juice.jpg' },
  { name: 'Passion Fruit', image: 'pineapple_juice.jpg' },
  { name: 'Peach', image: 'quince.jpg' },
  { name: 'Pear', image: 'quince.jpg' },
  { name: 'Pineapple', image: 'pineapple_juice.jpg' },
  { name: 'Plum', image: 'grape_juice.jpg' },
  { name: 'Pomegranate', image: 'pomegranate_drink.jpg' },
  { name: 'Quince', image: 'quince.jpg' },
  { name: 'Raspberry', image: 'raspberry_juice.jpg' },
  { name: 'Rhubarb', image: 'strawberry_juice.jpeg' },
  { name: 'Sea Buckthorn', image: 'sea_buckthorn_juice.jpg' },
  { name: 'Strawberry', image: 'strawberry_juice.jpeg' },
  { name: 'Watermelon', image: 'melon_juice.jpg' }
]

const PARTNERS = ['Ginger', 'Mint', 'Basil', 'Lemongrass', 'Turmeric', 'Vanilla', 'Cinnamon', 'Rosemary', 'Lavender', 'Hibiscus']
const ADJECTIVES = ['Sunny', 'Orchard', 'Harvest', 'Morning', 'Garden', 'Coastal', 'Alpine', 'Meadow', 'Summer', 'Winter']
const COLOURS = ['Lime Green', 'Sunset Orange', 'Berry Red', 'Ocean Blue', 'Charcoal', 'Sand', 'Plum', 'Lemon Yellow']
const MERCHANDISE = [
  { item: 'Tote Bag', image: 'fan_shirt.jpg', words: 'sturdy cotton bag with long handles, big enough for a full shop' },
  { item: 'Water Bottle (750 ml)', image: 'fan_mug.jpg', words: 'leak-proof steel bottle that keeps drinks cold for a whole afternoon' },
  { item: 'Travel Mug', image: 'fan_mug.jpg', words: 'double-walled mug with a snap lid that fits most cup holders' },
  { item: 'Apron', image: 'fan_hoodie.jpg', words: 'heavy apron with two front pockets and adjustable neck strap' },
  { item: 'Baseball Cap', image: 'fan_hoodie.jpg', words: 'six-panel cap with an embroidered fruit logo and a brass buckle' },
  { item: 'Glass Set (4 pcs)', image: 'coaster.jpg', words: 'set of four tall glasses, dishwasher safe' },
  { item: 'Reusable Straw Set', image: 'coaster.jpg', words: 'steel straws with a cleaning brush and a cloth pouch' },
  { item: 'Coaster Set (6 pcs)', image: 'coaster.jpg', words: 'cork-backed coasters printed with our seasonal fruit art' },
  { item: 'Hoodie', image: 'fan_hoodie.jpg', words: 'soft fleece hoodie with a kangaroo pocket' },
  { item: 'T-Shirt', image: 'fan_shirt.jpg', words: 'organic cotton shirt with a small chest print' }
]
const FIRST_NAMES = [
  'Ada', 'Alex', 'Amara', 'Anton', 'Aria', 'Ben', 'Bianca', 'Carlos', 'Chen', 'Clara', 'Dana', 'David', 'Elena', 'Emil',
  'Farah', 'Felix', 'Greta', 'Hana', 'Hugo', 'Ines', 'Ivan', 'Jada', 'Jonas', 'Kai', 'Kofi', 'Lena', 'Liam', 'Lucia',
  'Mara', 'Mateo', 'Mia', 'Nadia', 'Nils', 'Noor', 'Omar', 'Olga', 'Pablo', 'Priya', 'Quinn', 'Rosa', 'Rui', 'Sami',
  'Sofia', 'Tariq', 'Tessa', 'Uma', 'Victor', 'Wen', 'Yara', 'Zoe'
]
const LAST_NAMES = [
  'Abbott', 'Baker', 'Costa', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jensen', 'Kowalski', 'Lindqvist',
  'Moreau', 'Nakamura', 'Okafor', 'Petrov', 'Quintero', 'Rossi', 'Schmidt', 'Tanaka', 'Usman', 'Varga', 'Weber', 'Yilmaz', 'Zeller'
]
const MAIL_DOMAINS = ['example.com', 'example.net', 'example.org']

const REVIEW_OPENERS = [
  'Bought this for a family picnic.', 'Second time ordering this.', 'Picked it up on a whim.',
  'Got it as part of a weekly order.', 'A friend recommended it.', 'Ordered it for the office fridge.',
  'Tried it after reading the description.', 'Had it with breakfast all week.'
]
const REVIEW_BODIES = {
  good: [
    'Tastes fresh and not too sweet.', 'Arrived well packed and cold.', 'Great value for the size.',
    'The flavour is bright and clean.', 'Everyone at the table liked it.', 'Exactly as described.'
  ],
  mixed: [
    'Good taste, but the bottle is smaller than I expected.', 'Nice, though a bit too sweet for me.',
    'Delivery took a day longer than promised.', 'Fine overall, nothing special.'
  ],
  poor: [
    'Not my favourite, the taste was rather flat.', 'The cap was loose when it arrived.', 'Too sour for my liking.'
  ]
}
const REVIEW_CLOSERS = ['Would buy again.', 'Will try another flavour next time.', 'Recommended.', 'Three of us shared it.', 'Keeping it on my list.', '']

export const DEFAULT_SEED = 20261124

export class CatalogGenerator {
  constructor ({ seed = DEFAULT_SEED, products = 150, users = 200, reviews = 600 } = {}) {
    for (const [name, count] of Object.entries({ products, users, reviews })) {
      if (!Number.isInteger(count) || count < 1) {
        throw new RangeError(`${name} must be a positive whole number`)
      }
    }
    if (reviews < products) {
      throw new RangeError('reviews must be at least one per product')
    }
    this.seed = seed
    this.counts = { products, users, reviews }
    this.random = new SeededRandom(seed)
  }

  // Starts again from the seed each time, so every call gives the same pack.
  generate () {
    this.random = new SeededRandom(this.seed)
    const products = this.products()
    const users = this.users()
    const reviews = this.reviews(products, users)
    return { seed: this.seed, products, users, reviews }
  }

  products () {
    const makers = [
      () => this.pressedJuice(), () => this.pressedJuice(), () => this.smoothie(), () => this.cordial(),
      () => this.tea(), () => this.preserve(), () => this.driedFruit(), () => this.giftBox(), () => this.merchandise()
    ]
    const byName = new Map()
    let misses = 0
    while (byName.size < this.counts.products) {
      if (misses > 5000) {
        throw new Error('ran out of distinct product names; lower the product count')
      }
      const product = this.random.pick(makers)()
      if (byName.has(product.name)) {
        misses++
      } else {
        byName.set(product.name, product)
        misses = 0
      }
    }
    return [...byName.values()]
  }

  users () {
    const users = []
    const seen = new Set()
    while (users.length < this.counts.users) {
      const first = this.random.pick(FIRST_NAMES)
      const last = this.random.pick(LAST_NAMES)
      const number = this.random.int(1, 99)
      const email = `${first}.${last}${number}@${this.random.pick(MAIL_DOMAINS)}`.toLowerCase()
      if (seen.has(email)) {
        continue
      }
      seen.add(email)
      users.push({
        email,
        username: `${first.toLowerCase()}${last[0].toLowerCase()}${number}`,
        role: this.random.chance(0.08) ? 'deluxe' : 'customer'
      })
    }
    return users
  }

  // Spreads the reviews over the products (at least one each, at most six)
  // so the counts look like a real shop rather than a fixed pattern.
  reviews (products, users) {
    const perProduct = products.map(() => 1)
    let left = this.counts.reviews - products.length
    while (left > 0) {
      const index = this.random.int(0, products.length - 1)
      if (perProduct[index] < 6 || perProduct.every(count => count >= 6)) {
        perProduct[index]++
        left--
      }
    }
    const reviews = []
    perProduct.forEach((count, product) => {
      for (let i = 0; i < count; i++) {
        reviews.push({ product, author: this.random.int(0, users.length - 1), message: this.reviewText() })
      }
    })
    return reviews
  }

  reviewText () {
    const tone = this.random.chance(0.7) ? 'good' : (this.random.chance(0.6) ? 'mixed' : 'poor')
    return [this.random.pick(REVIEW_OPENERS), this.random.pick(REVIEW_BODIES[tone]), this.random.pick(REVIEW_CLOSERS)]
      .filter(Boolean).join(' ')
  }

  price (min, max) {
    return this.random.int(min, max) + 0.49 + (this.random.chance(0.5) ? 0.5 : 0)
  }

  pressedJuice () {
    const fruit = this.random.pick(FRUITS)
    const partner = this.random.pick(PARTNERS)
    const size = this.random.pick([250, 330, 500, 750, 1000])
    return this.product(`${fruit.name} & ${partner} Pressed Juice (${size} ml)`,
      `Cold-pressed ${fruit.name.toLowerCase()} juice with a touch of ${partner.toLowerCase()}. Bottled the day it is pressed, no added sugar.`,
      this.price(2, 7), fruit.image)
  }

  smoothie () {
    const fruit = this.random.pick(FRUITS)
    const other = this.random.pick(FRUITS)
    if (fruit === other) {
      return this.smoothie()
    }
    return this.product(`${fruit.name} ${other.name} Smoothie`,
      `Thick blend of ${fruit.name.toLowerCase()} and ${other.name.toLowerCase()} with oat milk. Shake well before drinking.`,
      this.price(3, 6), 'basil_smoothie.jpg')
  }

  cordial () {
    const fruit = this.random.pick(FRUITS)
    const size = this.random.pick([250, 500])
    return this.product(`${fruit.name} Cordial (${size} ml)`,
      `Concentrated ${fruit.name.toLowerCase()} cordial. Mix one part with six parts still or sparkling water.`,
      this.price(4, 9), 'elderflower_cordial.jpg')
  }

  tea () {
    const fruit = this.random.pick(FRUITS)
    const base = this.random.pick(['Green', 'Rooibos', 'Black', 'Herbal'])
    return this.product(`${fruit.name} ${base} Tea (20 bags)`,
      `${base} tea blended with dried ${fruit.name.toLowerCase()} pieces. Steep for four minutes, good hot or iced.`,
      this.price(3, 8), 'woodruff_syrup.jpg')
  }

  preserve () {
    const fruit = this.random.pick(FRUITS)
    const weight = this.random.pick([220, 340, 450])
    return this.product(`${fruit.name} Preserve (${weight} g)`,
      `Small-batch ${fruit.name.toLowerCase()} preserve, cooked slowly in copper pans. Keep refrigerated once opened.`,
      this.price(3, 7), 'apple_pressings.jpg')
  }

  driedFruit () {
    const fruit = this.random.pick(FRUITS)
    const weight = this.random.pick([100, 250, 500])
    return this.product(`Dried ${fruit.name} Pieces (${weight} g)`,
      `Gently dried ${fruit.name.toLowerCase()} with nothing added. A good snack for long walks.`,
      this.price(2, 9), 'fruit_press.jpg')
  }

  giftBox () {
    const adjective = this.random.pick(ADJECTIVES)
    const count = this.random.pick([3, 6, 9, 12])
    return this.product(`${adjective} Gift Box (${count} bottles)`,
      `A wooden crate of ${count} assorted juices from this season's pressings, with a handwritten card.`,
      this.price(15, 45), 'lego_case.jpg')
  }

  merchandise () {
    const colour = this.random.pick(COLOURS)
    const merch = this.random.pick(MERCHANDISE)
    return this.product(`${colour} ${merch.item}`,
      `A ${merch.words}. Colour: ${colour.toLowerCase()}.`,
      this.price(6, 35), merch.image)
  }

  product (name, description, price, image) {
    const deluxePrice = Math.round(price * 85) / 100
    return { name, description, price, deluxePrice, image, quantity: this.random.int(20, 120) }
  }
}
