import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import { ServerInfoSchema, type ServerInfo } from '@agenticapps/dashboard-shared'

import { SERVER_FILE } from '../constants.js'

import { atomicWriteFile } from './atomicWrite.js'
import { agentError } from './logging.js'

function ensureDir(filePath: string): void {
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
}

export function writeServerInfo(info: ServerInfo, file: string = SERVER_FILE): void {
  ensureDir(file)
  const validated = ServerInfoSchema.parse(info)
  atomicWriteFile(file, JSON.stringify(validated, null, 2), 0o600)
}

export function readServerInfo(file: string = SERVER_FILE): ServerInfo | null {
  if (!existsSync(file)) return null
  try {
    return ServerInfoSchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch (err) {
    // Corrupt server.json — log to stderr so the user gets a hint instead of
    // a silent "daemon not reachable" from CLI consumers (status/stop/list).
    agentError(`server.json parse failed at ${file}: ${(err as Error).message}`)
    return null
  }
}

export function removeServerInfo(file: string = SERVER_FILE): void {
  if (existsSync(file)) unlinkSync(file)
}
