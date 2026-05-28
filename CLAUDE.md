# AI Coding Agent Rules

## Release

Releases go through GitHub Actions. Do NOT manually bump versions or publish.

```bash
# 1. Run tests
bun run test

# 2. Push changes to main
git push origin main

# 3. Trigger release workflow
gh workflow run release.yml

# 4. Monitor until completion — do NOT return to user until done
RUN_ID=$(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN_ID" --exit-status

# 5. If failed, check logs, fix, and re-release
gh run view "$RUN_ID" --log-failed

# 6. After success, update local binary
brew update && brew upgrade circlesac/tap/clova
```

The workflow bumps CalVer via `@circlesac/oneup`, builds multi-platform binaries (darwin/linux, x64+arm64), creates a GitHub release, publishes to npm, and updates the Homebrew tap.

## Project

- **Runtime**: Bun
- **CLI framework**: citty (defineCommand)
- **Linting**: `bun run lint` (oxlint + eslint + prettier + biome + tsc)
- **Testing**: vitest
- **Versioning**: CalVer via `@circlesac/oneup`

## Conventions

- Tabs for indentation, no semicolons, double quotes
- Leaf commands use `defineLeafCommand` + `commonArgs` + `handleError` + `getOutputFormat`/`printOutput`
- Primary note reference uses `type: "positional"`
- Credentials stored at `~/.config/clova/credentials/`
- Output formats: table (default), `--json`, `--plain`

## CLOVA Note API (reverse-engineered)

- Host: `https://api-v2.clovanote.naver.com`, all responses are `{ code, message, contents }` (code 0 = success).
- Auth: NAVER login cookies (`NID_AUT`, `NID_SES`) sent as `Cookie`, plus required headers:
  `note-client-type: WEB`, `note-client-version`, `note-device-id` (client UUID),
  `note-session-id` (from `POST /v2/w/{ws}/sessions`), and `Origin: https://clovanote.naver.com`.
- A device session is created per stable `deviceId`; `force: true` replaces the previous session
  for that device. Session-error codes `4011000` / `4011006` mean "recreate the session and retry".
- Key endpoints (all workspace-scoped under `/v2/w/{ws}`):
  - `GET /notes/{noteId}` — full note: `noteInfo` (incl. `attendeeList` = speakers),
    `script.blockList` (transcript blocks with `start`/`end`/`sttLabel`/`text`/`alignment`),
    `annotation` (memos + AI summary fields).
  - `GET /notes/{noteId}/shared-notes` — share link, password, access type.
  - `GET /notes/{noteId}/shared-notes/{shareKey}/users/history` — viewers.
  - `GET /notes/{noteId}/merged-audio` — audio (audio/mp4, returns 200/206).
  - `GET /folders`, `GET /sessions`, `GET /user`.
  - `GET /shared-notes/{shareKey}/authorization` (against *your* workspace) — trades a share
    key for `{ noteId, workspaceId, nonce }` and authorizes your session to read that note.
    Read the note afterwards through *your own* workspace, not the owner's.
- Share URLs (`/s/{key}`) resolve via the authorization endpoint above, so the CLI reads them
  directly (including notes shared with you).
