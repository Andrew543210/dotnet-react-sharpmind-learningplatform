import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function ensureEnvironment() {
  if (existsSync('.env')) return
  const db = randomBytes(24).toString('hex')
  const demo = randomBytes(18).toString('base64url')
  writeFileSync('.env', `POSTGRES_PASSWORD=${db}\nPOSTGRES_PORT=54329\nConnectionStrings__Database=Host=localhost;Port=54329;Database=sharpmind;Username=sharpmind;Password=${db}\nASPNETCORE_ENVIRONMENT=Development\nASPNETCORE_URLS=http://localhost:5080\nMedia__RootPath=${resolve('data/media')}\nDataProtection__KeyPath=${resolve('data/keys')}\nDemo__Password=${demo}\nContent__MentorEmail=mentor@demo.sharpmind.test\n`, { mode: 0o600 })
  console.log('Created ignored .env with random local credentials. Existing configuration is never overwritten.')
}
