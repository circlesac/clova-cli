import { AuthError } from "./errors.ts"

// NID login is gated by NAVER's WTM nCAPTCHA, which is only defeated by a real browser.
// So automated login drives a real (headless) Chrome via Playwright to mint NID_AUT/NID_SES,
// then everything else is plain HTTP. Playwright is an optional, lazily-loaded dependency.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
const LOGIN_URL = "https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com"

export interface BrowserLoginOptions {
	headed?: boolean
}

export async function browserLogin(id: string, pw: string, opts: BrowserLoginOptions = {}): Promise<string> {
	let chromium: typeof import("playwright").chromium
	try {
		;({ chromium } = await import("playwright"))
	} catch {
		throw new AuthError(
			"Automated login needs Playwright and a Chrome install.\n" +
				"  npm i -g playwright   (uses your installed Google Chrome)\n" +
				'Or log in with cookies instead: clova auth login --cookie "NID_AUT=...; NID_SES=..."'
		)
	}

	let browser: import("playwright").Browser
	try {
		browser = await chromium.launch({ channel: "chrome", headless: !opts.headed })
	} catch (error) {
		throw new AuthError(
			"Could not launch Chrome via Playwright. Ensure Google Chrome is installed.\n" +
				`  ${(error as Error).message}\n` +
				'Or use cookie login: clova auth login --cookie "NID_AUT=...; NID_SES=..."'
		)
	}

	try {
		const ctx = await browser.newContext({ locale: "ko-KR", userAgent: UA })
		await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => false }))
		const page = await ctx.newPage()
		await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
		await page.waitForTimeout(800)
		await page.locator("#id").click()
		await page.locator("#id").pressSequentially(id, { delay: 55 })
		await page.locator("#pw").click()
		await page.locator("#pw").pressSequentially(pw, { delay: 55 })
		await page.waitForTimeout(300)
		await page.locator('button[type="submit"], #log\\.login').first().click()

		// Headed mode allows the user to clear a CAPTCHA / 2FA prompt manually.
		const deadline = Date.now() + (opts.headed ? 180_000 : 12_000)
		const hasNid = (cs: Array<{ name: string }>) => cs.some((c) => c.name === "NID_AUT") && cs.some((c) => c.name === "NID_SES")
		let cookies = await ctx.cookies()
		while (!hasNid(cookies) && Date.now() < deadline) {
			await page.waitForTimeout(1000)
			cookies = await ctx.cookies()
		}

		if (!hasNid(cookies)) {
			const text = await page.locator("body").innerText().catch(() => "")
			const captcha = /자동입력 방지|보안문자|영수증|captcha/i.test(text)
			if (captcha && !opts.headed) {
				throw new AuthError("NAVER showed a CAPTCHA. Re-run with --headed to solve it in the browser, or use --cookie.")
			}
			throw new AuthError(`Login failed${captcha ? " (CAPTCHA shown — try --headed)" : " — check your NAVER ID/password"}.`)
		}

		return cookies
			.filter((c) => /naver\.com$/.test(c.domain.replace(/^\./, "")))
			.map((c) => `${c.name}=${c.value}`)
			.join("; ")
	} finally {
		await browser.close()
	}
}
