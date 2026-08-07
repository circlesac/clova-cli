import { execSync } from "node:child_process"
import { createRequire } from "node:module"
import { join } from "node:path"
import { cwd } from "node:process"
import { pathToFileURL } from "node:url"
import { AuthError } from "./errors.ts"

// NID login is gated by NAVER's WTM nCAPTCHA, which is only defeated by a real browser.
// So automated login drives a real (headless) Chrome via Playwright to mint NID_AUT/NID_SES,
// then everything else is plain HTTP. Playwright is an optional, lazily-loaded dependency.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
const LOGIN_URL = "https://nid.naver.com/nidlogin.login?mode=form&url=https://www.naver.com"

export interface BrowserLoginOptions {
	headed?: boolean
}

// Playwright is built as --external, so the standalone (bun-compiled) binary
// must resolve it from disk at runtime. A bare import("playwright") only finds a
// local node_modules; resolve the npm global root too so `npm i -g playwright` works.
async function loadChromium(): Promise<typeof import("playwright").chromium> {
	const require = createRequire(pathToFileURL(join(cwd(), "clova.js")).href)
	let entry: string
	try {
		entry = require.resolve("playwright")
	} catch {
		const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim()
		entry = require.resolve("playwright", { paths: [globalRoot] })
	}
	const { chromium } = await import(pathToFileURL(entry).href)
	return chromium
}

// When id/pw are omitted in headed mode, skip the auto-fill and let the user
// log in by hand — we just open the login page and wait for the NID cookies to appear.
export async function browserLogin(id: string | undefined, pw: string | undefined, opts: BrowserLoginOptions = {}): Promise<string> {
	const manual = !id || !pw
	let chromium: typeof import("playwright").chromium
	try {
		chromium = await loadChromium()
	} catch {
		throw new AuthError(
			"Automated login needs Playwright and a Chrome install.\n" +
				"  npm i -g playwright   (uses your installed Google Chrome)\n" +
				'Or log in with cookies instead: clova auth login --cookie "NID_AUT=...; NID_SES=..."'
		)
	}

	if (manual && !opts.headed) {
		throw new AuthError("Manual login (no --id/--pw) needs --headed so you can log in in the browser.")
	}

	let browser: import("playwright").Browser
	try {
		browser = await chromium.launch({
			channel: "chrome",
			headless: !opts.headed,
			// Drop the automation switches NAVER's WTM anti-bot fingerprints on.
			ignoreDefaultArgs: ["--enable-automation"],
			args: ["--disable-blink-features=AutomationControlled"]
		})
	} catch (error) {
		throw new AuthError(
			"Could not launch Chrome via Playwright. Ensure Google Chrome is installed.\n" +
				`  ${(error as Error).message}\n` +
				'Or use cookie login: clova auth login --cookie "NID_AUT=...; NID_SES=..."'
		)
	}

	try {
		const ctx = await browser.newContext({ locale: "ko-KR", userAgent: UA })
		// Mask the automation fingerprints anti-bot checks key on, before any page script runs.
		await ctx.addInitScript(() => {
			const def = (obj: object, prop: string, get: () => unknown) => {
				try {
					Object.defineProperty(obj, prop, { get })
				} catch {}
			}
			def(navigator, "webdriver", () => undefined)
			def(navigator, "languages", () => ["ko-KR", "ko"])
			def(navigator, "plugins", () => [1, 2, 3, 4, 5])
			try {
				// @ts-expect-error window.chrome exists in real Chrome, absent under automation
				if (!window.chrome) window.chrome = { runtime: {} }
			} catch {}
			try {
				const q = navigator.permissions?.query?.bind(navigator.permissions)
				if (q) navigator.permissions.query = (p) => (p && p.name === "notifications" ? Promise.resolve({ state: Notification.permission } as PermissionStatus) : q(p))
			} catch {}
			try {
				const gp = WebGLRenderingContext.prototype.getParameter
				WebGLRenderingContext.prototype.getParameter = function (x: number) {
					if (x === 37445) return "Intel Inc."
					if (x === 37446) return "Intel Iris OpenGL Engine"
					return gp.call(this, x)
				}
			} catch {}
		})
		const page = await ctx.newPage()
		await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
		await page.waitForTimeout(800)
		if (!manual) {
			await page.locator("#id").click()
			await page.locator("#id").pressSequentially(id, { delay: 55 })
			await page.locator("#pw").click()
			await page.locator("#pw").pressSequentially(pw, { delay: 55 })
			// Keep-logged-in (#nvlong) → longer-lived session, fewer re-logins.
			try {
				const keep = page.locator("#nvlong")
				if ((await keep.count()) && !(await keep.isChecked())) await keep.check({ force: true })
			} catch {}
			await page.waitForTimeout(300)
			await page.locator('button[type="submit"], #log\\.login').first().click()
		} else {
			console.info("Browser opened — log in to NAVER yourself. Waiting for the session…")
		}

		// Headed mode allows the user to clear a CAPTCHA / 2FA prompt — or, in manual
		// mode, perform the entire login — by hand. Give manual logins a longer window.
		const deadline = Date.now() + (manual ? 300_000 : opts.headed ? 180_000 : 12_000)
		const hasNid = (cs: Array<{ name: string }>) => cs.some((c) => c.name === "NID_AUT") && cs.some((c) => c.name === "NID_SES")
		let cookies = await ctx.cookies()
		while (!hasNid(cookies) && Date.now() < deadline) {
			await page.waitForTimeout(1000)
			cookies = await ctx.cookies()
		}

		if (!hasNid(cookies)) {
			const text = await page
				.locator("body")
				.innerText()
				.catch(() => "")
			const captcha = /자동입력 방지|보안문자|영수증|captcha/i.test(text)
			if (captcha && !opts.headed) {
				throw new AuthError("NAVER showed a CAPTCHA. Re-run with --headed to solve it in the browser, or use --cookie.")
			}
			throw new AuthError(`Login failed${captcha ? " (CAPTCHA shown — try --headed)" : " — check your NAVER ID/password"}.`)
		}

		return cookies
			.filter((c) => c.domain.replace(/^\./, "").endsWith("naver.com"))
			.map((c) => `${c.name}=${c.value}`)
			.join("; ")
	} finally {
		await browser.close()
	}
}
