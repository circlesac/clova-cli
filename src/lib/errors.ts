export class ClovaCliError extends Error {
	constructor(
		message: string,
		public code: string
	) {
		super(message)
		this.name = "ClovaCliError"
	}
}

export class AuthError extends ClovaCliError {
	constructor(message: string) {
		super(message, "AUTH_ERROR")
		this.name = "AuthError"
	}
}

export class ApiError extends ClovaCliError {
	constructor(
		message: string,
		public status?: number,
		public apiCode?: number
	) {
		super(message, "API_ERROR")
		this.name = "ApiError"
	}
}

export function handleError(error: unknown): never {
	if (error instanceof ClovaCliError) {
		console.error(`\x1b[31m✗\x1b[0m ${error.message}`)
	} else if (error instanceof Error) {
		console.error(`\x1b[31m✗\x1b[0m ${error.message}`)
	} else {
		console.error(`\x1b[31m✗\x1b[0m An unknown error occurred`)
	}
	process.exit(1)
}
