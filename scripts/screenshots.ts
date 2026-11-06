// Walks DEMO_SCRIPT.md end-to-end (no reloads) and saves 1440x900 @2x PNGs into screenshots/.
// Also asserts the ACCEPTANCE.md numbers along the way, so a green run doubles as a smoke test.
//   npm run screenshots
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'screenshots')
mkdirSync(OUT, { recursive: true })

const failures: string[] = []
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`)
  if (!cond) failures.push(msg)
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(150)
  await page.screenshot({ path: resolve(OUT, `${name}.png`) })
  console.log(`📸 ${name}.png`)
}

const text = async (page: Page, sel: string) => (await page.locator(sel).first().innerText()).trim()

async function main() {
  const server = await createServer({ root: ROOT, server: { port: 5199, strictPort: false }, logLevel: 'warn' })
  await server.listen()
  const url = server.resolvedUrls!.local[0]
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const consoleErrors: string[] = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'assert') && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  try {
    await page.goto(url)
    await page.waitForSelector('[data-testid="row-BW-10001"]')

    // ---------------------------------------------------------------- A. Harold
    console.log('\nA. Harold Brennan (P1)')
    const rows = await page.locator('[data-row]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row))
    check(rows.slice(0, 4).join() === 'BW-10001,BW-10003,BW-10005,BW-10004', 'queue order Harold, Marcus, Esperanza, Leah')
    for (const [b, n] of [['Urgent', 3], ['Today', 15], ['This week', 18], ['Monitor', 12]] as const)
      check((await text(page, `[data-testid="band-count-${b}"]`)) === String(n), `band ${b} = ${n}`)
    const cap = await text(page, '[data-testid="capacity"]')
    check(/48\s*cases/.test(cap) && /7\s*due today/.test(cap) && /6\s*new since Fri/.test(cap), 'header: 48 cases · 7 due today · 6 new since Fri')
    check((await text(page, '[data-testid="score-BW-10002"]')).startsWith('52.3'), 'Devon 52.3')
    await shot(page, '01-queue')
    await page.hover('[data-testid="score-BW-10001"]')
    await page.waitForTimeout(200)
    check((await text(page, '[data-testid="score-formula"]')).includes('0.35×92 + 0.30×80 + 0.25×80 + 0.10×60'), 'score tooltip breakdown')
    await shot(page, '01b-queue-score-breakdown')
    await page.mouse.move(10, 600)

    await page.click('[data-testid="row-BW-10001"]', { position: { x: 120, y: 18 } })
    await page.waitForSelector('[data-testid="brief"] >> text=Sources', { state: 'detached' }).catch(() => {})
    await page.waitForTimeout(1200 + 6 * 260 + 300)
    check((await page.locator('[data-testid="brief-bullet"]').count()) === 6, 'brief has 6 bullets')
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('2'), 'P1 2 open conflicts')
    await shot(page, '02-member360-brief')

    await page.locator('button[title="Open source record RX-1002"]').first().click()
    await page.waitForSelector('[data-testid="record-drawer"]')
    check(await page.locator('[data-testid="imp-IMP-02"]').isVisible(), 'RX-1002 drawer shows IMP-02')
    await shot(page, '03-record-drawer-rx1002')
    await page.keyboard.press('Escape')

    await page.click('[data-testid="opt-CF-1A-Both true (create gap task)"]')
    await page.waitForTimeout(1000)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('1'), 'counter drops to 1')
    await shot(page, '04-resolve-safety-conflict')

    await page.locator('[data-testid="med-diff"]').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -120))
    await shot(page, '05-med-diff')

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.click('[data-testid="opt-CF-1B-Mark invalid"]')
    await page.waitForTimeout(1000)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('0'), 'all P1 conflicts resolved')
    await shot(page, '06-resolve-phone-conflict')

    await page.click('[data-testid="act"]')
    for (const n of ['NBA-1', 'NBA-2', 'NBA-3', 'NBA-4']) await page.click(`[data-testid="accept-${n}"]`)
    await page.click('[data-testid="snooze-NBA-5"]')
    await shot(page, '07-act-nba')

    check((await page.locator('[data-testid^="contact-"]').first().getAttribute('data-testid')) === 'contact-C-1002', "Karen's mobile ranked first")
    await page.click('[data-testid="call-C-1002"]')
    await page.waitForSelector('[data-testid="outcome-Connected"]')
    await shot(page, '08a-call-dialing-outcomes')
    await page.click('[data-testid="outcome-Connected"]')
    await page.waitForTimeout(12 * 250 + 600)
    await page.waitForTimeout(1700)
    await page.locator('[data-testid="note-draft"]').scrollIntoViewIfNeeded()
    await shot(page, '08-call-transcript-note')
    await page.click('[data-testid="accept-note"]')

    await page.click('[data-testid="open-doc"]')
    await page.waitForSelector('[data-testid="doc-drawer"]')
    const counts = await text(page, '[data-testid="field-counts"]')
    check(/27\s*pre-filled/.test(counts) && /9\s*from call/.test(counts) && /4\s*need you/.test(counts), 'P1 counts 27 / 9 / 4')
    await shot(page, '09a-documentation-drawer')
    while (await page.locator('[data-testid="use-suggested"]').count()) await page.locator('[data-testid="use-suggested"]').first().click()
    await page.waitForTimeout(1100)
    for (const chip of await page.locator('[data-testid="care-plan-chip"]').all()) await chip.click()
    await page.locator('[data-testid="care-plan-suggestions"]').scrollIntoViewIfNeeded()
    check(await page.locator('[data-testid="sign-submit"]').isEnabled(), 'Sign and submit enabled')
    await shot(page, '09-documentation-ready-to-sign')
    await page.click('[data-testid="sign-submit"]')

    await page.waitForSelector('[data-testid="wrap-up"]')
    await shot(page, '10-wrap-up')
    await page.click('[data-testid="back-to-queue"]')
    await page.waitForTimeout(400)
    await shot(page, '10b-queue-reranking')
    await page.waitForTimeout(1500)
    const rows2 = await page.locator('[data-row]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row))
    check(rows2[0] === 'BW-10003', 'Marcus is #1 after Harold')
    check((await text(page, '[data-testid="score-BW-10001"]')).startsWith('38.2'), 'Harold 38.2')
    check((await text(page, '[data-testid="score-BW-10001"]')).includes('This week'), 'Harold This week')
    const cap2 = await text(page, '[data-testid="capacity"]')
    check(/1\s*conversations today/.test(cap2) && /18 min\s*prep time saved/.test(cap2), 'counters: 1 conversation, 18 min saved')
    await page.locator('[data-testid="row-BW-10001"]').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -250))
    await shot(page, '10c-queue-after-harold')
    await page.evaluate(() => window.scrollTo(0, 0))

    // ---------------------------------------------------------------- B. Marcus
    console.log('\nB. Marcus Reid (P3)')
    await page.click('[data-testid="row-BW-10003"]', { position: { x: 120, y: 18 } })
    await page.waitForTimeout(1200 + 6 * 260 + 300)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('2'), 'P3 2 open conflicts')
    await shot(page, '11-marcus-brief')
    await page.click('[data-testid="act"]')
    const order = await page.locator('[data-testid^="contact-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    check(order.join() === 'contact-MS-3001,contact-C-3004,contact-C-3002,contact-C-3001', 'contacts: new mobile → sister → old mobile → roommate')
    check((await page.locator('[data-testid="contact-C-3004"] [data-testid="phi-warning"]').count()) === 1, 'PHI warning for Denise')
    await shot(page, '12-marcus-outreach')

    // Wrong-number path: adds an attempt and demotes the number.
    await page.click('[data-testid="call-C-3002"]')
    await page.click('[data-testid="outcome-Wrong number"]')
    check((await text(page, '[data-testid="contact-C-3002"]')).includes('Wrong number reported'), 'wrong number demotes the number')

    await page.click('[data-testid="send-sms"]')
    await page.click('[data-testid="sms-send-confirm"]')
    await page.waitForTimeout(1900)
    await page.click('[data-testid="call-MS-3001"]')
    await page.waitForSelector('[data-testid="outcome-Connected"]')
    await page.click('[data-testid="outcome-Connected"]')
    await page.waitForTimeout(4 * 250 + 2200)
    await page.click('[data-testid="accept-NBA-1"]')
    await shot(page, '13-marcus-sms-call')
    await page.click('[data-testid="log-close"]')
    await page.waitForSelector('[data-testid="wrap-up"]')
    await shot(page, '13b-marcus-wrap-up')
    await page.click('[data-testid="back-to-queue"]')
    await page.waitForTimeout(1900)
    check((await text(page, '[data-testid="score-BW-10003"]')).includes('This week'), 'Marcus moves to This week')

    // ---------------------------------------------------------------- C. Esperanza
    console.log('\nC. Esperanza Ruiz (P5)')
    await page.click('[data-testid="row-BW-10005"]', { position: { x: 120, y: 18 } })
    await page.waitForTimeout(1200 + 6 * 260 + 300)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('3'), 'P5 3 open conflicts')
    await shot(page, '14a-esperanza-conflicts')
    await page.click('[data-testid="opt-CF-5A-Accept outreach log"]')
    await page.waitForTimeout(950)
    await page.click('[data-testid="opt-CF-5B-Accept lab-backed value"]')
    await page.waitForTimeout(950)
    await page.click('[data-testid="opt-CF-5C-Flag to PCP"]')
    await page.waitForTimeout(950)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('0'), 'P5 conflicts resolved')
    await shot(page, '14-esperanza-resolved')
    await page.click('[data-testid="act"]')
    check((await page.locator('[data-testid="contact-C-5002"] [data-testid="phi-warning"]').count()) === 1, 'PHI warning for Lucia (expired)')
    await page.click('[data-testid="accept-NBA-1"]')
    await shot(page, '15-esperanza-outreach-phi')
    await page.click('[data-testid="call-C-5002"]')
    await page.waitForSelector('[data-testid="outcome-Connected"]')
    await page.click('[data-testid="outcome-Connected"]')
    await page.waitForTimeout(6 * 250 + 2200)
    await page.click('[data-testid="accept-note"]')
    await page.click('[data-testid="open-doc"]')
    const counts5 = await text(page, '[data-testid="field-counts"]')
    check(/29\s*pre-filled/.test(counts5) && /8\s*from call/.test(counts5) && /3\s*need you/.test(counts5), 'P5 counts 29 / 8 / 3')
    while (await page.locator('[data-testid="use-suggested"]').count()) await page.locator('[data-testid="use-suggested"]').first().click()
    await shot(page, '16-esperanza-documentation')
    await page.click('[data-testid="sign-submit"]')
    await page.waitForSelector('[data-testid="wrap-up"]')
    await shot(page, '16b-esperanza-wrap-up')
    await page.click('[data-testid="back-to-queue"]')
    await page.waitForTimeout(1900)

    // ---------------------------------------------------------------- D. Quick looks
    console.log('\nD. Devon (P2) and Leah (P4)')
    await page.click('[data-testid="row-BW-10002"]', { position: { x: 120, y: 18 } })
    await page.waitForTimeout(1200 + 5 * 260 + 300)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('2'), 'P2 2 open conflicts')
    await page.click('[data-testid="claims-only"]')
    check((await text(page, '[data-testid="identity"]')).includes('37.3'), 'claims-only view scores 37.3')
    await shot(page, '17-devon-claims-only')
    await page.click('[data-testid="claims-only"]')
    check((await text(page, '[data-testid="identity"]')).includes('52.3'), 'toggle back to 52.3')
    await shot(page, '17b-devon-full-view')
    await page.click('text=Today queue')

    await page.click('[data-testid="row-BW-10004"]', { position: { x: 120, y: 18 } })
    await page.waitForTimeout(1200 + 6 * 260 + 300)
    check((await text(page, '[data-testid="conflict-count"]')).startsWith('2'), 'P4 2 open conflicts')
    check((await page.locator('[data-testid="sdoh-age"]').innerText()).includes('Stale'), 'P4 SDOH red')
    await shot(page, '18-leah-member360')
    await page.click('[data-testid="tab-timeline"]')
    await page.locator('[data-testid="timeline"]').scrollIntoViewIfNeeded()
    check((await page.locator('[data-testid="timeline"] [data-testid="merged"]').count()) >= 1, 'Leah duplicate discharge summary merged')
    await shot(page, '18b-leah-timeline-merged')
    await page.click('[data-testid="act"]')
    await page.click('[data-testid="send-sms"]')
    await page.click('[data-testid="sms-send-confirm"]')
    await page.waitForTimeout(1900)
    await shot(page, '18c-leah-sms-first')

    // ---------------------------------------------------------------- Reset
    console.log('\nReset')
    await page.click('[data-testid="reset"]')
    await page.waitForTimeout(300)
    const rows3 = await page.locator('[data-row]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.row))
    check(rows3.join() === rows.join(), 'Reset restores the initial order')
    check(/0\s*conversations today/.test(await text(page, '[data-testid="capacity"]')), 'Reset clears counters')

    check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ': ' + consoleErrors.join(' | ') : ''}`)
  } finally {
    await browser.close()
    await server.close()
  }
  if (failures.length) {
    console.error(`\n${failures.length} check(s) failed`)
    process.exit(1)
  }
  console.log(`\nAll checks passed. PNGs in ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
