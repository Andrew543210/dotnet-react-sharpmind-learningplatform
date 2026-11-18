import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const lock = JSON.parse(readFileSync('web/package-lock.json', 'utf8'))
const notices = ['SharpMind — third-party software notices', 'Licenses below apply to their respective packages. Application branding and course text are separate.']
for (const [path, info] of Object.entries(lock.packages).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
  if (!path || info.dev || !path.startsWith('node_modules/')) continue
  const root = join('web', path)
  if (!existsSync(root)) continue
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const files = readdirSync(root).filter(name => /^(license|licence|copying|notice)(\.|$)/i.test(name))
  notices.push(`\n${'='.repeat(72)}\n${manifest.name} ${manifest.version}\nLicense: ${info.license ?? manifest.license ?? 'See package distribution'}\n${manifest.homepage ?? ''}`)
  for (const file of files) notices.push(`\n${file}\n${readFileSync(join(root, file), 'utf8')}`)
}
writeFileSync('web/public/third-party-notices.txt', notices.join('\n') + '\n')
console.log('Preserved production npm package licenses in web/public/third-party-notices.txt.')
