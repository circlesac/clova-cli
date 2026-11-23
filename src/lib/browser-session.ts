import { execFileSync } from "node:child_process"
import { createDecipheriv, pbkdf2Sync } from "node:crypto"
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { basename, join } from "node:path"
import { AuthError } from "./errors.ts"

// Reads the NAVER login cookies (NID_AUT, NID_SES) that a Chromium-based browser on
// macOS already holds, so `clova auth login --from-browser` needs no password and no
// remote-debugging port. Each product has its own data root and Keychain service; the
// SQLite reading and AES decryption are shared.

export interface BrowserProduct {
	id: string
	name: string
	/** User data root, relative to the home directory. */
	root: string
	keychainService: string
}

export const BROWSER_PRODUCTS: BrowserProduct[] = [
	{ id: "chrome", name: "Google Chrome", root: "Library/Application Support/Google/Chrome", keychainService: "Chrome Safe Storage" },
	{ id: "chromium", name: "Chromium", root: "Library/Application Support/Chromium", keychainService: "Chromium Safe Storage" },
	{ id: "comet", name: "Comet", root: "Library/Application Support/Comet", keychainService: "Comet Safe Storage" },
	{ id: "arc", name: "Arc", root: "Library/Application Support/Arc/User Data", keychainService: "Arc Safe Storage" },
	{ id: "edge", name: "Microsoft Edge", root: "Library/Application Support/Microsoft Edge", keychainService: "Microsoft Edge Safe Storage" },
	{ id: "brave", name: "Brave", root: "Library/Application Support/BraveSoftware/Brave-Browser", keychainService: "Brave Safe Storage" }
]

export interface CookieStore {
	product: BrowserProduct
	/** Profile directory name, e.g. "Default" or "Profile 1". */
	profile: string
	/** Display name from the browser's Local State, when it has one. */
	profileName?: string
	path: string
}

export interface BrowserSession {
	/** Human-readable source, e.g. "Google Chrome (Profile 1)". */
	source: string
	cookie: string
}

/** Why a store produced no usable session. Never collapse these into "not logged in". */
export type StoreFailureKind = "missing-or-expired" | "permission-blocked" | "storage-locked"

export interface StoreFailure {
	source: string
	kind: StoreFailureKind
	detail: string
}

export function storeLabel(store: CookieStore): string {
	const profile = store.profileName && store.profileName !== store.profile ? `${store.profile}: ${store.profileName}` : store.profile
	return `${store.product.name} (${profile})`
}

/** Chromium stores times as microseconds since 1601-01-01 UTC; 0 means a session cookie. */
export function chromiumTimeToMs(value: number | bigint): number {
	const micros = typeof value === "bigint" ? Number(value) : value
	return micros / 1000 - 11_644_473_600_000
}

export function isExpired(expiresUtc: number | bigint, now = Date.now()): boolean {
	if (Number(expiresUtc) === 0) return false
	return chromiumTimeToMs(expiresUtc) <= now
}

function profileNames(root: string): Record<string, string> {
	try {
		const state = JSON.parse(readFileSync(join(root, "Local State"), "utf8")) as {
			profile?: { info_cache?: Record<string, { name?: string }> }
		}
		const names: Record<string, string> = {}
		for (const [dir, info] of Object.entries(state.profile?.info_cache ?? {})) if (info.name) names[dir] = info.name
		return names
	} catch {
		return {}
	}
}

export interface Discovery {
	stores: CookieStore[]
	/** Installed products whose data root exists but could not be listed. */
	unreadable: StoreFailure[]
}

/** Find every cookie database of every installed product: Default and Profile *, in both layouts. */
export function discoverCookieStores(home = homedir(), products = BROWSER_PRODUCTS): Discovery {
	const stores: CookieStore[] = []
	const unreadable: StoreFailure[] = []
	for (const product of products) {
		const root = join(home, product.root)
		if (!existsSync(root)) continue
		const names = profileNames(root)
		let entries: string[]
		try {
			entries = readdirSync(root)
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code
			const kind: StoreFailureKind = code === "EACCES" || code === "EPERM" ? "permission-blocked" : "storage-locked"
			unreadable.push({ source: product.name, kind, detail: `cannot list ${root} (${code ?? "error"})` })
			continue
		}
		const profiles = entries.filter((e) => e === "Default" || /^Profile \d+$/.test(e)).sort()
		for (const profile of profiles) {
			for (const rel of ["Network/Cookies", "Cookies"]) {
				const path = join(root, profile, rel)
				if (existsSync(path)) stores.push({ product, profile, profileName: names[profile], path })
			}
		}
	}
	return { stores, unreadable }
}

/** Narrow the discovered stores to an explicit --browser / --profile selection. */
export function filterStores(stores: CookieStore[], browser?: string, profile?: string): CookieStore[] {
	return stores.filter((s) => {
		if (browser && s.product.id !== browser.toLowerCase()) return false
		if (profile) {
			const p = profile.toLowerCase()
			if (s.profile.toLowerCase() !== p && s.profileName?.toLowerCase() !== p) return false
		}
		return true
	})
}

export function deriveKey(safeStoragePassword: string): Buffer {
	return pbkdf2Sync(safeStoragePassword, "saltysalt", 1003, 16, "sha1")
}

/**
 * Decrypt a macOS Chromium cookie value (v10/v11 prefix, AES-128-CBC, IV of 16 spaces).
 * Databases at meta version 24 and later prefix the plaintext with SHA-256(host_key).
 */
export function decryptCookieValue(encrypted: Buffer, key: Buffer, metaVersion: number): string {
	const prefix = encrypted.subarray(0, 3).toString("utf8")
	if (prefix !== "v10" && prefix !== "v11") return encrypted.toString("utf8")
	const decipher = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, " "))
	const plain = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()])
	return (metaVersion >= 24 ? plain.subarray(32) : plain).toString("utf8")
}

class StoreError extends Error {
	constructor(
		public kind: StoreFailureKind,
		message: string
	) {
		super(message)
	}
}

const keyCache = new Map<string, Buffer>()

function productKey(product: BrowserProduct): Buffer {
	const cached = keyCache.get(product.id)
	if (cached) return cached
	let password: string
	try {
		password = execFileSync("security", ["find-generic-password", "-w", "-s", product.keychainService], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"]
		}).trim()
	} catch (error) {
		const status = (error as { status?: number }).status
		// 44: item not found. Anything else (denied, cancelled) is a permission failure.
		if (status === 44) throw new StoreError("missing-or-expired", `no "${product.keychainService}" Keychain item`)
		throw new StoreError("permission-blocked", `Keychain access to "${product.keychainService}" was denied`)
	}
	const key = deriveKey(password)
	keyCache.set(product.id, key)
	return key
}

interface CookieRow {
	name: string
	encrypted_value: Uint8Array
	value: string
	expires_utc: number | bigint
}

/** Copy the store with its -wal/-shm journals, so rows not yet checkpointed are read too. */
function snapshot(path: string): { file: string; cleanup: () => void } {
	const dir = mkdtempSync(join(tmpdir(), "clova-browser-session-"))
	const file = join(dir, basename(path))
	try {
		copyFileSync(path, file)
		for (const suffix of ["-wal", "-shm"]) if (existsSync(path + suffix)) copyFileSync(path + suffix, file + suffix)
	} catch (error) {
		rmSync(dir, { recursive: true, force: true })
		const code = (error as NodeJS.ErrnoException).code
		if (code === "EACCES" || code === "EPERM") throw new StoreError("permission-blocked", `cannot read ${path}`)
		throw new StoreError("storage-locked", `cannot copy ${path}`)
	}
	return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

async function readStore(store: CookieStore): Promise<string> {
	const { Database } = await import("bun:sqlite")
	const { file, cleanup } = snapshot(store.path)
	try {
		let rows: CookieRow[]
		let metaVersion = 0
		try {
			const db = new Database(file, { readonly: true })
			try {
				const meta = db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'version'").get()
				metaVersion = Number(meta?.value ?? 0)
				rows = db
					.query<CookieRow, []>(
						"SELECT name, encrypted_value, value, expires_utc FROM cookies " +
							"WHERE host_key IN ('.naver.com', 'naver.com') AND name IN ('NID_AUT', 'NID_SES')"
					)
					.all()
			} finally {
				db.close()
			}
		} catch {
			throw new StoreError("storage-locked", "the cookie database could not be read consistently")
		}

		const live = rows.filter((r) => !isExpired(r.expires_utc))
		const found = new Map<string, string>()
		for (const row of live) {
			const encrypted = Buffer.from(row.encrypted_value)
			let value = row.value
			if (encrypted.length > 0) {
				try {
					value = decryptCookieValue(encrypted, productKey(store.product), metaVersion)
				} catch (error) {
					if (error instanceof StoreError) throw error
					throw new StoreError("permission-blocked", "cookie values could not be decrypted with the Keychain key")
				}
			}
			if (value) found.set(row.name, value)
		}
		const aut = found.get("NID_AUT")
		const ses = found.get("NID_SES")
		if (!aut || !ses) {
			const reason = rows.length > live.length ? "the NAVER session cookies have expired" : "no NAVER session cookies"
			throw new StoreError("missing-or-expired", reason)
		}
		return `NID_AUT=${aut}; NID_SES=${ses}`
	} finally {
		cleanup()
	}
}

/** Extract a NAVER session from every matching store. Values are never logged. */
export async function collectBrowserSessions(stores: CookieStore[]): Promise<{ sessions: BrowserSession[]; failures: StoreFailure[] }> {
	const sessions: BrowserSession[] = []
	const failures: StoreFailure[] = []
	for (const store of stores) {
		const source = storeLabel(store)
		try {
			const cookie = await readStore(store)
			if (!sessions.some((s) => s.cookie === cookie)) sessions.push({ source, cookie })
		} catch (error) {
			if (error instanceof StoreError) failures.push({ source, kind: error.kind, detail: error.message })
			else failures.push({ source, kind: "storage-locked", detail: "unexpected read failure" })
		}
	}
	return { sessions, failures }
}

export interface ValidatedSession extends BrowserSession {
	accountKey: string
}

/**
 * Choose one account from server-validated sessions. The only account wins; several
 * distinct accounts stop with their sources, never a guess by filesystem order.
 */
export function selectAccount(valid: ValidatedSession[]): ValidatedSession {
	const accounts = new Map<string, ValidatedSession[]>()
	for (const s of valid) accounts.set(s.accountKey, [...(accounts.get(s.accountKey) ?? []), s])
	if (accounts.size === 1) return valid[0] as ValidatedSession
	const lines = [...accounts.values()].map((group, i) => `  account ${i + 1}: ${group.map((s) => s.source).join(", ")}`)
	throw new AuthError(
		"Several NAVER accounts are logged in across browser profiles:\n" +
			lines.join("\n") +
			"\nPick one with --browser and/or --profile, e.g. clova auth login --from-browser --browser chrome --profile 'Profile 1'"
	)
}

export function describeFailures(failures: StoreFailure[], storesFound: number): string {
	if (storesFound === 0 && failures.length === 0) {
		return "No Chromium-based browser profile was found (checked Chrome, Chromium, Comet, Arc, Edge, Brave)."
	}
	const lines = failures.map((f) => `  ${f.source}: ${f.kind} — ${f.detail}`)
	const hint = failures.some((f) => f.kind === "permission-blocked")
		? "\nGrant this terminal access to the browser data (Full Disk Access) and allow Keychain access when macOS asks, then retry."
		: failures.some((f) => f.kind === "storage-locked")
			? "\nQuit the browser normally and retry."
			: "\nLog in at clovanote.naver.com in the browser. If you just did, quit the browser normally so it writes the cookies, then retry."
	return `No usable NAVER session was found in the browser profiles:\n${lines.join("\n")}${hint}`
}
