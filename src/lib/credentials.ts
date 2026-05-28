import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Credentials } from "../types.ts"
import { getConfigDir } from "./config.ts"
import { AuthError } from "./errors.ts"

const CREDENTIALS_DIR = join(getConfigDir(), "credentials")

async function ensureDir(): Promise<void> {
	await mkdir(CREDENTIALS_DIR, { recursive: true })
}

export async function storeCredentials(creds: Credentials): Promise<void> {
	await ensureDir()
	await writeFile(join(CREDENTIALS_DIR, `${creds.name}.json`), JSON.stringify(creds, null, 2) + "\n")
}

export async function listAccounts(): Promise<Credentials[]> {
	try {
		await ensureDir()
		const files = await readdir(CREDENTIALS_DIR)
		const accounts: Credentials[] = []
		for (const file of files) {
			if (!file.endsWith(".json")) continue
			accounts.push(JSON.parse(await readFile(join(CREDENTIALS_DIR, file), "utf-8")) as Credentials)
		}
		return accounts
	} catch {
		return []
	}
}

export async function getAccount(name?: string): Promise<Credentials> {
	const accounts = await listAccounts()
	if (accounts.length === 0) {
		throw new AuthError("Not logged in. Run: clova auth login")
	}
	if (name) {
		const found = accounts.find((a) => a.name === name)
		if (!found) throw new AuthError(`Account "${name}" not found. Run: clova auth login`)
		return found
	}
	if (accounts.length === 1) return accounts[0]!
	throw new AuthError(`Multiple accounts configured. Use --account to specify: ${accounts.map((a) => a.name).join(", ")}`)
}

export async function removeAccount(name: string): Promise<boolean> {
	try {
		await unlink(join(CREDENTIALS_DIR, `${name}.json`))
		return true
	} catch {
		return false
	}
}
