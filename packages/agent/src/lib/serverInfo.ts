import { existsSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { ServerInfoSchema, type ServerInfo } from '@agenticapps/dashboard-shared'

import { SERVER_FILE } from '../constants.js'

function ensureDir(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
}

export function writeServerInfo(info: ServerInfo, file: string = SERVER_FILE): void {
  ensureDir(file)
  const validated = ServerInfoSchema.parse(info)
  writeFileSync(file, JSON.stringify(validated, null, 2), { mode: 0o600 })
  chmodSync(file, 0o600)
}

export function readServerInfo(file: string = SERVER_FILE): ServerInfo | null {
  if (!existsSync(file)) return null
  try {
    return ServerInfoSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return null
  }
}

export function removeServerInfo(file: string = SERVER_FILE): void {
  if (existsSync(file)) unlinkSync(file)
}
