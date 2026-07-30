import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pricingSurfaces = [
  'src/components/landing/PricingSection.jsx',
  'src/components/dashboard/PricingModal.jsx',
  'landing-next/components/HomePricingSection.jsx',
]

for (const relativePath of pricingSurfaces) {
  const source = await readFile(path.join(projectRoot, relativePath), 'utf8')
  assert.match(
    source,
    /const \[billing, setBilling\] = useState\('yearly'\)/,
    `${relativePath} must show yearly pricing by default`,
  )
  assert.doesNotMatch(
    source,
    /const \[billing, setBilling\] = useState\('monthly'\)/,
    `${relativePath} still defaults to monthly pricing`,
  )
}

// The marketing /pricing page is a static server component with no toggle, so it
// is "default yearly" by leading with the annual figure rather than by state.
const staticPricingPage = 'landing-next/app/pricing/page.js'
const staticSource = await readFile(path.join(projectRoot, staticPricingPage), 'utf8')
assert.match(
  staticSource,
  /<small>\/year<\/small>/,
  `${staticPricingPage} must headline the yearly price`,
)
assert.doesNotMatch(
  staticSource,
  /<small>\/month<\/small>/,
  `${staticPricingPage} still headlines the monthly price`,
)
assert.doesNotMatch(
  staticSource,
  /Monthly prices shown/,
  `${staticPricingPage} still tells visitors monthly prices are shown`,
)

console.log(`Yearly pricing is the default on ${pricingSurfaces.length + 1} pricing surfaces`)
