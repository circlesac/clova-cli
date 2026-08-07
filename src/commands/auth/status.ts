import { ClovaClient } from "../../api/client.ts"
import { commonArgs } from "../../lib/args.ts"
import { defineLeafCommand } from "../../lib/command.ts"
import { getAccount } from "../../lib/credentials.ts"
import { handleError } from "../../lib/errors.ts"
import { getOutputFormat, printOutput } from "../../lib/output.ts"

export const statusCommand = defineLeafCommand({
	meta: {
		name: "status",
		description: "Show the logged-in account and verify the session"
	},
	args: {
		...commonArgs,
		account: { type: "string", description: "Account name (when multiple are configured)" }
	},
	async run({ args }) {
		try {
			const creds = await getAccount(args.account)
			const user = await new ClovaClient(creds).getUser()
			const format = getOutputFormat(args)
			if (format === "json") {
				printOutput(user, format)
				return
			}
			printOutput(
				{
					account: creds.name,
					userName: user.userName,
					email: user.email,
					workspace: creds.workspaceId,
					workspaces: user.workspaces.map((w) => `${w.name} [${w.workspaceId}]`).join(", ")
				},
				format
			)
		} catch (error) {
			handleError(error)
		}
	}
})
