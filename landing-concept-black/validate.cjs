const { chromium } = require('../caption-studio-publish-main/node_modules/playwright')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const catalog = require('../caption-studio-publish-main/shared/planCatalog.json')
;(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8')
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1])
  const browser = await chromium.launch({headless:true})
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text())})
  await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href)
  const anchors = await page.locator('a[href^="#"]').evaluateAll(links => links.map(link => ({href:link.getAttribute('href'),exists:!!document.getElementById(link.hash.slice(1))})))
  assert(anchors.every(link => link.exists), JSON.stringify(anchors))
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id))
  assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs')
  await page.locator('[data-style="kinetic"]').first().click()
  assert.equal(await page.locator('#style-phrase').getAttribute('data-style'), 'kinetic')
  await page.locator('.style-control[data-style="outline"]').click()
  assert.equal(await page.locator('#style-phrase').getAttribute('data-style'), 'outline')
  await page.locator('.style-control[data-style="highlight"]').click()
  for (const currency of ['INR','USD']) {
    await page.selectOption('#currency',currency)
    for (const billing of ['monthly','yearly']) {
      await page.locator(`[data-billing="${billing}"]`).click()
      for (const tier of ['starter','creator','pro']) {
        const plan = catalog[tier + (billing === 'yearly' ? '_yearly' : '')]
        const card = page.locator(`[data-plan="${tier}"]`)
        const price = (await card.locator('[data-price]').textContent()).replace(/[^0-9.]/g,'')
        assert.equal(Number(price),(currency === 'INR' ? plan.inr_paise : plan.usd_cents)/100)
        assert.equal(Number((await card.locator('[data-credits]').textContent()).split(' ')[0].replace(/,/g,'')),plan.credits)
      }
    }
  }
  await page.selectOption('#currency','INR')
  for (const demo of ['workflow','templates']) {
    await page.locator(`[data-demo="${demo}"]`).first().click()
    await page.waitForFunction(() => document.querySelector('#demo-video').readyState >= 2)
    assert(await page.locator('#demo-modal').evaluate(el => el.open))
    await page.keyboard.press('Escape')
    assert(!(await page.locator('#demo-modal').evaluate(el => el.open)))
    await page.waitForFunction(() => document.querySelector('#demo-video').paused && !document.querySelector('#demo-video').hasAttribute('src'))
  }
  await page.locator('summary').first().click()
  assert(await page.locator('details').first().getAttribute('open') !== null)
  await page.locator('summary').first().click()
  const dimensions = []
  for (const width of [1440,1024,768,620,390,320]) {
    await page.setViewportSize({width,height:1000})
    await page.evaluate(() => window.scrollTo(0,0))
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`Overflow at ${width}`)
    const logo = await page.locator('.nav .brand').boundingBox()
    assert(logo.x < width / 2, 'Logo must remain at top-left')
    const badImages = await page.locator('img').evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src))
    assert.equal(badImages.length,0,JSON.stringify(badImages))
    dimensions.push(width)
    if (width === 1440 || width === 390) await page.screenshot({path:path.join(__dirname,`preview-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:390,height:844})
  await page.locator('.menu-toggle').click()
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true')
  await page.locator('#nav-links a[href="#pricing"]').click()
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false')
  assert.equal(new URL(page.url()).hash,'#pricing')
  await page.locator('.menu-toggle').click()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false')
  assert.equal(errors.length,0,errors.join('\n'))
  const result = {javascript:'valid', internalAnchors:anchors.length, uniqueIds:ids.length, pricing:'12 catalog-matched prices and credit allocations', styles:'3 working previews', media:'both local videos loaded, Escape closes and pauses', mobileMenu:'open, navigate, and Escape verified', viewportWidths:dimensions, horizontalOverflow:false, browserErrors:errors, directFileOpen:true}
  fs.writeFileSync(path.join(__dirname,'validation.json'),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result,null,2))
  await browser.close()
})().catch(error => {console.error(error);process.exit(1)})
