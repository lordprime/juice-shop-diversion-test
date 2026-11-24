/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import {
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  DataTypes,
  type CreationOptional,
  type Sequelize
} from 'sequelize'
import { type BasketItemModel } from './basketitem'
import * as security from '../lib/insecurity'

export type AlternateImage = {
  file: string
  format: string
} & (
  | { density: string, width?: never }
  | { width: string, density?: never }
)

class Product extends Model<
InferAttributes<Product>,
InferCreationAttributes<Product>
> {
  declare id: CreationOptional<number>
  declare name: string
  declare description: string
  declare price: number
  declare deluxePrice: number
  declare image: string
  declare alternateImages: CreationOptional<AlternateImage[] | null>
  declare BasketItem?: CreationOptional<BasketItemModel> // Note this is optional since it's only populated when explicitly requested in code
}

const ProductModelInit = (sequelize: Sequelize) => {
  Product.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: DataTypes.STRING,
      description: {
        type: DataTypes.STRING,
        set (description: string) {
          this.setDataValue('description', security.sanitizeSecure(description))
        }
      },
      price: DataTypes.DECIMAL,
      deluxePrice: DataTypes.DECIMAL,
      image: DataTypes.STRING,
      alternateImages: DataTypes.JSON
    },
    {
      tableName: 'Products',
      sequelize,
      paranoid: true
    }
  )
}

export { Product as ProductModel, ProductModelInit }
