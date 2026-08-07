# clova

CLOVA Note CLI — pull transcripts, summaries, speakers, and audio from [CLOVA Note](https://clovanote.naver.com) right in your terminal.

## Install

```bash
# Homebrew
brew install circlesac/tap/clova

# npm
npm install -g @circlesac/clova

# or standalone
curl -fsSL https://github.com/circlesac/clova-cli/releases/latest/download/install.sh | sh
```

## Authenticate

CLOVA Note runs on a NAVER login session. Two ways to get one:

**A. Automated (NAVER ID + password).** Drives a headless browser to log in for you. Requires
[Playwright](https://playwright.dev) and Google Chrome installed (`npm i -g playwright`):

```bash
clova auth login --id <NAVER_ID>          # prompts for password securely
clova auth login --id <NAVER_ID> --headed # show the browser to clear a CAPTCHA / 2FA
# password can also come from --pw or the CLOVA_NAVER_PW env var
```

NAVER may show a CAPTCHA on automated logins; re-run with `--headed` to solve it once in the
browser. (NID login is bot-protected, so a real browser is needed just for this step.)

**B. Paste cookies (no browser needed).** Grab `NID_AUT` and `NID_SES` from your browser
(devtools → **Application → Cookies → `https://naver.com`**):

```bash
clova auth login --aut "<NID_AUT>" --ses "<NID_SES>"
clova auth login --cookie "NID_AUT=...; NID_SES=..."   # whole cookie string
CLOVA_COOKIE="NID_AUT=...; NID_SES=..." clova auth login # via env
pbpaste | clova auth login --stdin                      # via stdin
```

`clova` stores credentials under `~/.config/clova/credentials/` and creates its own device
session (separate from your browser). Check it with `clova auth status`. NID cookies are
long-lived, so you rarely need to log in again — only `auth login` touches a browser; every
other command is plain HTTP.

## Usage

All `note` commands accept a **note ID**, a **note-detail URL**
(`https://clovanote.naver.com/w/<ws>/note-detail/<id>`), or a **share URL**
(`https://clovanote.naver.com/s/<key>`):

```bash
# Metadata: title, status, duration, speakers, segment count
clova note get <note>

# Full transcript ([mm:ss] speaker: text)
clova note transcript <note>
clova note transcript <note> --srt           # SRT subtitles
clova note transcript <note> --no-timestamps  # plain text
clova note transcript <note> --json           # raw transcript blocks

# AI summary (brief / agenda / tasks / by-speaker)
clova note summary <note>

# Speakers / attendees
clova note speakers <note>

# Download the merged audio recording
clova note audio <note> -o meeting.m4a

# Share settings (link, password, access type)
clova note share <note>

# Who has opened the shared note
clova note history <note>

# Rename a note (change its title)
clova note rename <note> "New title"
```

Read commands support `--json` and `--plain` output.

### Share links

Share URLs (`https://clovanote.naver.com/s/<key>`) work directly — pass one anywhere a note
reference is accepted. The CLI trades the share key for the note via the shared-notes
authorization endpoint, so it reads notes shared with you as well as your own.

## Development

```bash
bun install
bun run dev note get <note>   # run from source
bun run test                  # vitest
bun run build                 # compile a standalone binary to dist/clova
```

Releases are automated via GitHub Actions (`gh workflow run release.yml`) — see `CLAUDE.md`.
