import { homedir } from "node:os"
import { join } from "node:path"

const CONFIG_DIR = join(homedir(), ".config", "clova")

export function getConfigDir(): string {
	return CONFIG_DIR
}
