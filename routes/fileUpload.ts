/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type NextFunction, type Request, type Response } from 'express'

function ensureFileIsPassed ({ file }: Request, res: Response, next: NextFunction) {
  if (file != null) {
    next()
  } else {
    return res.status(400).json({ error: 'File is not passed' })
  }
}

async function handleZipFileUpload ({ file }: Request, res: Response, next: NextFunction) {
  if (!(file?.originalname?.toLowerCase().endsWith('.zip') ?? false)) {
    next()
    return
  }
  res.status(204).end()
}

async function handleXmlUpload ({ file }: Request, res: Response, next: NextFunction) {
  if (!(file?.originalname?.toLowerCase().endsWith('.xml') ?? false)) {
    next()
    return
  }
  res.status(410)
  next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
}

function handleYamlUpload ({ file }: Request, res: Response, next: NextFunction) {
  if (!((file?.originalname?.toLowerCase().endsWith('.yml') ?? false) || (file?.originalname?.toLowerCase().endsWith('.yaml') ?? false))) {
    res.status(204).end()
    return
  }
  res.status(410)
  next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
}

export {
  ensureFileIsPassed,
  handleZipFileUpload,
  handleXmlUpload,
  handleYamlUpload
}
