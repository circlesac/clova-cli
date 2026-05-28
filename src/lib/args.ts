export const commonArgs = {
	workspace: {
		type: "string" as const,
		description: "Workspace ID (defaults to your personal workspace)",
		alias: "w"
	},
	json: { type: "boolean" as const, description: "Output as JSON" },
	plain: { type: "boolean" as const, description: "Output as plain text" }
}

export const noteArg = {
	note: {
		type: "positional" as const,
		description: "Note ID, note-detail URL, or share URL",
		required: true
	}
}
