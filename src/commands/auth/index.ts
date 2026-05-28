import { defineCommand } from "citty"
import { loginCommand } from "./login.ts"
import { logoutCommand } from "./logout.ts"
import { statusCommand } from "./status.ts"

export const authCommand = defineCommand({
	meta: {
		name: "auth",
		description: "Manage NAVER authentication"
	},
	subCommands: {
		login: loginCommand,
		status: statusCommand,
		logout: logoutCommand
	}
})
