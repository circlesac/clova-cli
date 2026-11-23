import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import { ClovaClient } from "../../api/client.ts"
import { browserLogin } from "../../lib/browser-login.ts"
import {
	BROWSER_PRODUCTS,
	collectBrowserSessions,
	describeFailures,
	discoverCookieStores,
	filterStores,
	selectAccount,
	type ValidatedSession
} from "../../lib/browser-session.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { storeCredentials } from "../../lib/credentials.ts"
import { AuthError, handleError } from "../../lib/errors.ts"
import { resolveSecretRef } from "../../lib/secret-ref.ts"
import type { Credentials } from "../../types.ts"

function normalizeCookie(raw: string): string {
	// Accept a full "name=value; name2=value2" string, or a bare NID_AUT value.
	const trimmed = raw.trim().replace(/^Cookie:\s*/i, "")
	if (/(^|;\s*)NID_AUT=/.test(trimmed)) return trimmed
	return trimmed
}

function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = ""
		process.stdin.setEncoding("utf-8")
		process.stdin.on("data", (c) => (data += c))
		process.stdin.on("end", () => resolve(data.trim()))
		process.stdin.resume()
	})
}

/** Read the NAVER session a local browser already holds, validate each one, and pick the account. */
async function browserSessionCookie(browser?: string, profile?: string): Promise<string> {
	if (process.platform !== "darwin") throw new AuthError("--from-browser currently supports macOS only.")
	if (browser && !BROWSER_PRODUCTS.some((p) => p.id === browser.toLowerCase())) {
		throw new AuthError(`Unknown --browser "${browser}". Use one of: ${BROWSER_PRODUCTS.map((p) => p.id).join(", ")}`)
	}
	const { stores: all, unreadable } = discoverCookieStores()
	const stores = filterStores(all, browser, profile)
	const blocked = unreadable.filter((f) => !browser || BROWSER_PRODUCTS.find((p) => p.id === browser.toLowerCase())?.name === f.source)
	if (all.length > 0 && stores.length === 0 && blocked.length === 0) {
		throw new AuthError(`No browser profile matches --browser ${browser ?? "*"} --profile ${profile ?? "*"}.`)
	}
	const { sessions, failures: readFailures } = await collectBrowserSessions(stores)
	const failures = [...blocked, ...readFailures]
	const valid: ValidatedSession[] = []
	for (const session of sessions) {
		try {
			const user = await new ClovaClient({ name: "probe", cookie: session.cookie, deviceId: randomUUID() }).getUser()
			valid.push({ ...session, accountKey: user.eUserId })
		} catch {
			failures.push({ source: session.source, kind: "missing-or-expired", detail: "NAVER rejected the session" })
		}
	}
	if (valid.length === 0) throw new AuthError(describeFailures(failures, stores.length))
	const chosen = selectAccount(valid)
	console.info(`Using the NAVER session from ${chosen.source}`)
	return chosen.cookie
}

// Prompt on the TTY; when hidden, suppress echo of the typed characters.
function promptLine(question: string, hidden = false): Promise<string> {
	return new Promise((resolve) => {
		const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
		if (hidden) {
			// @ts-expect-error _writeToOutput is internal but the standard way to mute input
			rl._writeToOutput = (s: string) => {
				if (s.includes(question)) process.stdout.write(question)
			}
		}
		rl.question(question, (answer) => {
			rl.close()
			if (hidden) process.stdout.write("\n")
			resolve(answer.trim())
		})
	})
}

export const loginCommand = defineLeafCommand({
	meta: {
		name: "login",
		description: "Log in with NAVER credentials (automated browser) or session cookies"
	},
	args: {
		id: { type: "string", description: "NAVER ID — logs in via an automated headless browser" },
		pw: { type: "string", description: "NAVER password (omit with --id to be prompted securely; accepts an op:// secret reference)" },
		headed: { type: "boolean", description: "Show the browser during login to clear a CAPTCHA / 2FA" },
		"from-browser": {
			type: "boolean",
			description: "Reuse the NAVER session already logged in to a local Chrome, Chromium, Comet, Arc, Edge, or Brave profile (macOS)"
		},
		browser: { type: "string", description: "With --from-browser: read only this browser (chrome, chromium, comet, arc, edge, brave)" },
		profile: { type: "string", description: "With --from-browser: read only this profile directory or name, e.g. Default or \"Profile 1\"" },
		cookie: { type: "string", description: 'Full cookie string, e.g. "NID_AUT=...; NID_SES=..." (accepts an op:// secret reference)' },
		aut: { type: "string", description: "NID_AUT cookie value (accepts an op:// secret reference)" },
		ses: { type: "string", description: "NID_SES cookie value (accepts an op:// secret reference)" },
		workspace: { type: "string", description: "Workspace ID to use (defaults to your personal workspace)", alias: "w" },
		stdin: { type: "boolean", description: "Read the cookie string from stdin" }
	},
	async run({ args }) {
		try {
			// Any credential input may be an `op://` secret reference (resolved via `vlt read`)
			// instead of a plaintext value; plain values pass through untouched.
			const [argCookie, argAut, argSes, argPw, envCookie, envPw] = await Promise.all([
				resolveSecretRef(args.cookie),
				resolveSecretRef(args.aut),
				resolveSecretRef(args.ses),
				resolveSecretRef(args.pw),
				resolveSecretRef(process.env["CLOVA_COOKIE"]),
				resolveSecretRef(process.env["CLOVA_NAVER_PW"])
			])

			let cookie = ""
			if (args["from-browser"] || args.browser || args.profile) cookie = await browserSessionCookie(args.browser, args.profile)
			else if (argCookie) cookie = normalizeCookie(argCookie)
			else if (argAut || argSes) {
				const parts: string[] = []
				if (argAut) parts.push(`NID_AUT=${argAut}`)
				if (argSes) parts.push(`NID_SES=${argSes}`)
				cookie = parts.join("; ")
			} else if (args.stdin) cookie = normalizeCookie(await readStdin())
			else if (envCookie) cookie = normalizeCookie(envCookie)
			else if (args.headed && !args.id && !process.env["CLOVA_NAVER_ID"]) {
				// Manual login: open the browser to NAVER and let the user log in by hand,
				// then capture the session. No NAVER ID/password ever touches the CLI.
				console.info("Opening browser for manual NAVER login…")
				cookie = await browserLogin(undefined, undefined, { headed: true })
			} else {
				// Automated browser login from NAVER credentials (id/pw via flags, env, or prompt).
				const id = args.id || process.env["CLOVA_NAVER_ID"]
				if (id) {
					const pw = argPw || envPw || (await promptLine("NAVER password: ", true))
					if (!pw) throw new AuthError("NAVER password is required.")
					console.info("Logging in via browser…")
					cookie = await browserLogin(id, pw, { headed: !!args.headed })
				}
			}

			if (!cookie) {
				throw new AuthError(
					"No credentials provided. Either log in automatically:\n" +
						"  clova auth login --id <NAVER_ID>            (prompts for password)\n" +
						"reuse the session already logged in to your browser (macOS):\n" +
						"  clova auth login --from-browser\n" +
						"or paste cookies from your browser (devtools → Application → Cookies → naver.com):\n" +
						'  clova auth login --cookie "NID_AUT=...; NID_SES=..."'
				)
			}
			if (!/NID_AUT=/.test(cookie) || !/NID_SES=/.test(cookie)) {
				throw new AuthError("Cookie must include both NID_AUT and NID_SES.")
			}

			const deviceId = randomUUID()
			const probe = new ClovaClient({ name: "probe", cookie, deviceId })
			const user = await probe.getUser()

			if (!user.workspaces?.length) {
				throw new AuthError("No CLOVA Note workspaces found for this account.")
			}
			const ws = args.workspace
				? user.workspaces.find((w) => w.workspaceId === args.workspace)
				: (user.workspaces.find((w) => w.workspaceType === "PERSONAL") ?? user.workspaces[0])
			if (!ws) throw new AuthError(`Workspace "${args.workspace}" not found.`)

			const name = (user.email?.split("@")[0] || "default").toLowerCase()
			const creds: Credentials = {
				name,
				cookie,
				deviceId,
				eUserId: user.eUserId,
				email: user.email,
				userName: user.userName,
				workspaceId: ws.workspaceId
			}
			await storeCredentials(creds)

			// Create the device session up front so later commands are ready.
			await new ClovaClient(creds).createSession()

			console.info(`\x1b[32m✓\x1b[0m Logged in as ${user.userName} (${user.email})`)
			console.info(`  workspace: ${ws.name} [${ws.workspaceId}]`)
			console.info(`  account:   ${name}`)
		} catch (error) {
			handleError(error)
		}
	}
})
