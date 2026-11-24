import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { safeLoad } from 'js-yaml'
import logger from '../lib/logger'

// YAML files by default; JSON parses the same way, so the content pack uses it too.
export async function loadStaticData (file: string, extension: 'yml' | 'json' = 'yml') {
  const filePath = path.resolve('./data/static/' + file + '.' + extension)
  return await readFile(filePath, 'utf8')
    .then(safeLoad)
    .catch(() => logger.error('Could not open file: "' + filePath + '"'))
}

export interface StaticUser {
  email: string
  // left out for the administrator, whose password is set at start
  password?: string
  key: string
  role: 'admin' | 'customer' | 'deluxe' | 'accounting'

  username?: string
  profileImage?: string
  walletBalance?: number
  lastLoginIp?: string
  deletedFlag?: boolean
  totpSecret?: string
  customDomain?: boolean
  securityQuestion?: StaticUserSecurityQuestion
  feedback?: StaticUserFeedback
  address?: StaticUserAddress[]
  card?: StaticUserCard[]
}
export interface StaticUserSecurityQuestion {
  id: number
  // left out for the administrator, whose answer nobody knows
  answer?: string
}
export interface StaticUserFeedback {
  comment: string
  rating: 1 | 2 | 3 | 4 | 5
}
export interface StaticUserAddress {
  fullName: string
  mobileNum: number
  zipCode: string
  streetAddress: string
  city: string
  state: string
  country: string
}
export interface StaticUserCard {
  fullName: string
  cardNum: number
  expMonth: number
  expYear: number
}
export async function loadStaticUserData (): Promise<StaticUser[]> {
  return await loadStaticData('users') as StaticUser[]
}

export interface StaticDelivery {
  name: string
  price: number
  deluxePrice: number
  eta: number
  icon: string
}
export async function loadStaticDeliveryData (): Promise<StaticDelivery[]> {
  return await loadStaticData('deliveries') as StaticDelivery[]
}

// The seeded content pack, built by scripts/catalog/generate.mjs. Reviews point
// at products and customers by their position in the pack.
export interface StaticCatalog {
  seed: number
  products: Array<{ name: string, description: string, price: number, deluxePrice: number, image: string, quantity: number }>
  users: Array<{ email: string, username: string, role: 'customer' | 'deluxe' }>
  reviews: Array<{ product: number, author: number, message: string }>
}
export async function loadStaticCatalogData (): Promise<StaticCatalog> {
  return await loadStaticData('catalog', 'json') as StaticCatalog
}

export interface StaticSecurityQuestions {
  question: string
}
export async function loadStaticSecurityQuestionsData (): Promise<StaticSecurityQuestions[]> {
  return await loadStaticData('securityQuestions') as StaticSecurityQuestions[]
}
