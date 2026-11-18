import { fileURLToPath } from 'node:url'
import { ensureEnvironment } from './environment.mjs'
process.chdir(fileURLToPath(new URL('..', import.meta.url)))
ensureEnvironment()
