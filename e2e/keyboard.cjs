// Keyboard-only walkthrough. Run `npm run build && npx vite preview --port 4173`, then `node e2e/keyboard.cjs`.
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } })
  const errs = []; pg.on('pageerror', e => errs.push(String(e)))
  const res = []
  const ok = (name, cond) => res.push(`${cond ? 'PASS' : 'FAIL'} ${name}`)
  await pg.goto('http://localhost:4173/'); await pg.waitForSelector('text=Where to start')
  const active = () => pg.evaluate(() => { const a = document.activeElement; return { tag: a?.tagName, text: (a?.textContent || '').trim().slice(0, 40), label: a?.getAttribute('aria-label'), role: a?.getAttribute('role'), outline: a ? getComputedStyle(a).outlineStyle : '' } })
  const tabTo = async (pred, max = 400) => { for (let i = 0; i < max; i++) { await pg.keyboard.press('Tab'); const a = await active(); if (pred(a)) return a } return null }
  // Setup (mouse): a prepared project with data.
  await pg.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Missions', exact: true }).click()
  await pg.locator('section', { hasText: 'M9 · Spot the suspicious sites' }).getByRole('button', { name: 'Open' }).click()
  await pg.getByRole('button', { name: 'Start in a new project' }).click()
  await pg.waitForSelector('text=This project is the prepared project for M9', { timeout: 60000 })
  await pg.getByLabel('Acting as').selectOption('pkulk')
  await pg.locator('body').click({ position: { x: 5, y: 890 } })
  // 1. Main navigation by keyboard.
  const nav = await tabTo((a) => a.text === 'Casebook' && a.tag === 'BUTTON')
  ok('nav button reachable by Tab', !!nav); ok('focus is visible (outline)', nav && nav.outline !== 'none')
  await pg.keyboard.press('Enter'); ok('Enter opens Casebook', await pg.locator('text=Green: clean').count() > 0)
  // 2. Subject and form chips.
  const subj = await tabTo((a) => a.text.startsWith('101-001')); ok('subject chip reachable', !!subj); await pg.keyboard.press('Enter')
  const form = await tabTo((a) => a.text.startsWith('Vital signs')); ok('form chip reachable', !!form); await pg.keyboard.press('Enter')
  const edit = await tabTo((a) => a.text === 'Edit'); ok('Edit button reachable', !!edit); await pg.keyboard.press('Enter')
  let a = await active(); ok('dialog focuses its first field', a.tag === 'INPUT' || a.tag === 'SELECT')
  await pg.keyboard.press('Escape'); ok('Escape closes the dialog', await pg.locator('[role=dialog]').count() === 0)
  a = await active(); ok('focus returns to the Edit button', a.text === 'Edit')
  await pg.keyboard.press('Enter')
  const input = await active()
  if (input.tag === 'INPUT') { await pg.keyboard.press('Control+A'); await pg.keyboard.type('78') }
  await pg.keyboard.press('Enter')
  ok('Enter saves the edit', await pg.locator('[role=dialog]').count() === 0)
  // Tab trap inside a dialog.
  await pg.keyboard.press('Enter'); for (let i = 0; i < 12; i++) await pg.keyboard.press('Tab')
  ok('Tab stays inside the dialog', await pg.evaluate(() => !!document.activeElement?.closest('[role=dialog]')))
  await pg.keyboard.press('Escape')
  // 3. Tabs with arrow keys.
  await pg.getByLabel('Acting as').selectOption('arao'); await pg.locator('body').click({ position: { x: 5, y: 890 } })
  await tabTo((a) => a.text === 'Listings' && a.tag === 'BUTTON'); await pg.keyboard.press('Enter')
  const t = await tabTo((a) => a.role === 'tab'); ok('first tab reachable', !!t)
  await pg.keyboard.press('ArrowRight'); a = await active()
  ok('ArrowRight moves to the next tab', a.text === 'Possible duplicate AEs' && (await pg.getByRole('tab', { name: 'Possible duplicate AEs' }).getAttribute('aria-selected')) === 'true')
  await pg.keyboard.press('End'); a = await active(); ok('End jumps to the last tab', a.text === 'Concomitant medications')
  // 4. Raise a query from a listing by keyboard.
  const q = await tabTo((a) => a.text === 'Query'); ok('listing Query button reachable', !!q); await pg.keyboard.press('Enter')
  a = await active(); ok('query dialog focuses the text box', a.tag === 'TEXTAREA')
  await pg.keyboard.type('The dose recorded is 20 mg. Please confirm it against the source document?')
  await pg.keyboard.press('Control+Enter'); ok('Ctrl+Enter raises the query', await pg.locator('[role=dialog]').count() === 0)
  console.log(res.join('\n')); console.log('errors', errs); await b.close()
})().catch(e => { console.error(e); process.exit(1) })
