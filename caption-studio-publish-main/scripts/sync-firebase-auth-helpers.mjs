import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const firebaseHostingOrigin = 'https://captionstudio-9dfde.firebaseapp.com'
const helperPaths = [
  '__/auth/handler',
  '__/auth/handler.js',
  '__/auth/experiments.js',
  '__/auth/iframe',
  '__/auth/iframe.js',
  '__/auth/links',
  '__/auth/links.js',
]

for (const helperPath of helperPaths) {
  const response = await fetch(`${firebaseHostingOrigin}/${helperPath}`)
  if (!response.ok) {
    throw new Error(`Firebase helper download failed for ${helperPath}: HTTP ${response.status}`)
  }

  const destination = path.join(root, 'public', ...helperPath.split('/'))
  await fs.mkdir(path.dirname(destination), { recursive: true })
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()))
  console.log(`Synced ${helperPath}`)
}
