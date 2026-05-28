import { randomUUID } from "node:crypto"
import { ClovaClient } from "../../api/client.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { storeCredentials } from "../../lib/credentials.ts"
import { AuthError, handleError } from "../../lib/errors.ts"
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

export const loginCommand = defineLeafCommand({
	meta: {
		name: "login",
		description: "Log in with your NAVER session cookies"
	},
	args: {
		cookie: { type: "string", description: 'Full cookie string, e.g. "NID_AUT=...; NID_SES=..."' },
		aut: { type: "string", description: "NID_AUT cookie value" },
		ses: { type: "string", description: "NID_SES cookie value" },
		workspace: { type: "string", description: "Workspace ID to use (defaults to your personal workspace)", alias: "w" },
		stdin: { type: "boolean", description: "Read the cookie string from stdin" }
	},
	async run({ args }) {
		try {
			let cookie = ""
			if (args.cookie) cookie = normalizeCookie(args.cookie)
			else if (args.aut || args.ses) {
				const parts: string[] = []
				if (args.aut) parts.push(`NID_AUT=${args.aut}`)
				if (args.ses) parts.push(`NID_SES=${args.ses}`)
				cookie = parts.join("; ")
			} else if (args.stdin) cookie = normalizeCookie(await readStdin())
			else if (process.env["CLOVA_COOKIE"]) cookie = normalizeCookie(process.env["CLOVA_COOKIE"]!)

			if (!cookie) {
				throw new AuthError(
					"No cookie provided. Get NID_AUT and NID_SES from your browser (devtools → Application → Cookies → naver.com) and run:\n" +
						'  clova auth login --cookie "NID_AUT=...; NID_SES=..."\n' +
						"or: clova auth login --aut <NID_AUT> --ses <NID_SES>"
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
