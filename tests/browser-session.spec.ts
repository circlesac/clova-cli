import { createCipheriv, createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
	BROWSER_PRODUCTS,
	chromiumTimeToMs,
	decryptCookieValue,
	deriveKey,
	describeFailures,
	discoverCookieStores,
	filterStores,
	isExpired,
	selectAccount,
	storeLabel
} from "../src/lib/browser-session.ts"

const chrome = BROWSER_PRODUCTS.find((p) => p.id === "chrome")!
const comet = BROWSER_PRODUCTS.find((p) => p.id === "comet")!

function encrypt(plain: Buffer, key: Buffer): Buffer {
	const cipher = createCipheriv("aes-128-cbc", key, Buffer.alloc(16, " "))
	return Buffer.concat([Buffer.from("v10"), cipher.update(plain), cipher.final()])
}

describe("decryptCookieValue", () => {
	const key = deriveKey("test-safe-storage")

	it("strips the SHA-256 host prefix at meta version 24 and later", () => {
		const plain = Buffer.concat([createHash("sha256").update(".naver.com").digest(), Buffer.from("aut-value")])
		expect(decryptCookieValue(encrypt(plain, key), key, 24)).toBe("aut-value")
	})

	it("keeps the whole plaintext before meta version 24", () => {
		expect(decryptCookieValue(encrypt(Buffer.from("ses-value"), key), key, 23)).toBe("ses-value")
	})

	it("returns unencrypted values unchanged", () => {
		expect(decryptCookieValue(Buffer.from("plain"), key, 24)).toBe("plain")
	})

	it("fails with the wrong key instead of returning garbage", () => {
		const plain = Buffer.from("value")
		expect(() => decryptCookieValue(encrypt(plain, key), deriveKey("other"), 23)).toThrow()
	})
})

describe("expiry", () => {
	it("converts Chromium microseconds since 1601 to Unix milliseconds", () => {
		expect(chromiumTimeToMs(11_644_473_600_000_000)).toBe(0)
		expect(chromiumTimeToMs(13_000_000_000_000_000n)).toBe(1_355_526_400_000)
	})

	it("treats 0 as a session cookie and past times as expired", () => {
		const now = Date.UTC(2026, 10, 23)
		const microsFor = (ms: number) => (ms + 11_644_473_600_000) * 1000
		expect(isExpired(0, now)).toBe(false)
		expect(isExpired(microsFor(now - 1000), now)).toBe(true)
		expect(isExpired(microsFor(now + 86_400_000), now)).toBe(false)
	})
})

describe("discoverCookieStores", () => {
	let home: string
	afterEach(() => rmSync(home, { recursive: true, force: true }))

	function touch(path: string) {
		mkdirSync(join(path, ".."), { recursive: true })
		writeFileSync(path, "")
	}

	it("finds Default and Profile * in both cookie layouts, with display names", () => {
		home = mkdtempSync(join(tmpdir(), "clova-home-"))
		const root = join(home, chrome.root)
		touch(join(root, "Default", "Network", "Cookies"))
		touch(join(root, "Profile 1", "Cookies"))
		touch(join(root, "System Profile", "Cookies"))
		writeFileSync(join(root, "Local State"), JSON.stringify({ profile: { info_cache: { "Profile 1": { name: "Work" } } } }))
		touch(join(home, comet.root, "Default", "Cookies"))

		const { stores } = discoverCookieStores(home)
		expect(stores.map(storeLabel)).toEqual(["Google Chrome (Default)", "Google Chrome (Profile 1: Work)", "Comet (Default)"])
		expect(stores[0]!.path.endsWith(join("Default", "Network", "Cookies"))).toBe(true)
	})

	it("filters by browser and by profile directory or display name", () => {
		home = mkdtempSync(join(tmpdir(), "clova-home-"))
		const root = join(home, chrome.root)
		touch(join(root, "Default", "Cookies"))
		touch(join(root, "Profile 1", "Cookies"))
		writeFileSync(join(root, "Local State"), JSON.stringify({ profile: { info_cache: { "Profile 1": { name: "Work" } } } }))
		touch(join(home, comet.root, "Default", "Cookies"))

		const { stores } = discoverCookieStores(home)
		expect(filterStores(stores, "comet").map(storeLabel)).toEqual(["Comet (Default)"])
		expect(filterStores(stores, "chrome", "work").map(storeLabel)).toEqual(["Google Chrome (Profile 1: Work)"])
		expect(filterStores(stores, undefined, "Profile 1").map(storeLabel)).toEqual(["Google Chrome (Profile 1: Work)"])
	})

	it("returns nothing when no browser is installed", () => {
		home = mkdtempSync(join(tmpdir(), "clova-home-"))
		expect(discoverCookieStores(home)).toEqual({ stores: [], unreadable: [] })
	})
})

describe("selectAccount", () => {
	it("returns the only account, even when several profiles hold it", () => {
		const chosen = selectAccount([
			{ source: "Google Chrome (Default)", cookie: "a", accountKey: "u1" },
			{ source: "Comet (Default)", cookie: "b", accountKey: "u1" }
		])
		expect(chosen.source).toBe("Google Chrome (Default)")
	})

	it("stops on several accounts and lists their sources without cookie values", () => {
		const call = () =>
			selectAccount([
				{ source: "Google Chrome (Default)", cookie: "secret-a", accountKey: "u1" },
				{ source: "Google Chrome (Profile 1)", cookie: "secret-b", accountKey: "u2" }
			])
		expect(call).toThrow(/account 1: Google Chrome \(Default\)/)
		expect(call).toThrow(/account 2: Google Chrome \(Profile 1\)/)
		expect(call).not.toThrow(/secret/)
	})
})

describe("describeFailures", () => {
	it("says no browser was found when there are no stores", () => {
		expect(describeFailures([], 0)).toMatch(/No Chromium-based browser profile/)
	})

	it("reports an unreadable browser folder as blocked, not as no browser", () => {
		const message = describeFailures([{ source: "Google Chrome", kind: "permission-blocked", detail: "cannot list (EPERM)" }], 0)
		expect(message).not.toMatch(/No Chromium-based browser profile/)
		expect(message).toMatch(/Full Disk Access/)
	})

	it("keeps permission failures distinct from missing sessions", () => {
		const message = describeFailures([{ source: "Google Chrome (Default)", kind: "permission-blocked", detail: "denied" }], 1)
		expect(message).toMatch(/permission-blocked/)
		expect(message).toMatch(/Keychain/)
	})
})
