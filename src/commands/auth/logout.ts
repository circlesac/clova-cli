import { defineLeafCommand } from "../../lib/command.ts"
import { getAccount, removeAccount } from "../../lib/credentials.ts"
import { handleError } from "../../lib/errors.ts"

export const logoutCommand = defineLeafCommand({
	meta: {
		name: "logout",
		description: "Remove stored credentials"
	},
	args: {
		account: { type: "string", description: "Account name (when multiple are configured)" }
	},
	async run({ args }) {
		try {
			const creds = await getAccount(args.account)
			const ok = await removeAccount(creds.name)
			if (ok) console.info(`\x1b[32m✓\x1b[0m Logged out ${creds.name}`)
			else console.info(`Nothing to remove for ${creds.name}`)
		} catch (error) {
			handleError(error)
		}
	}
})
