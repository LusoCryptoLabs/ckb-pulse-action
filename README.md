# CKB Pulse lessons

A GitHub Action for CKB projects. On each pull request it reads the lines that changed, asks
[CKB Pulse](https://pulse.lusocryptolabs.com/learned) which lessons from real fixes in other CKB projects apply to
them, and keeps one comment on the pull request with those lessons.

The lessons come from public commits of CKB projects. Each one is checked against the commit it came from and the
project's code today, and links to that commit. A comment is a list of hints to read, not proof: nothing is run.

## Use it

Copy [examples/ckb-lessons.yml](examples/ckb-lessons.yml) to `.github/workflows/ckb-lessons.yml`:

```yaml
name: CKB lessons
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  lessons:
    runs-on: ubuntu-latest
    steps:
      - uses: LusoCryptoLabs/ckb-pulse-action@v1
```

No key, no account and no checkout are needed.

## What the comment says

- Changed lines that repeat a pattern a lesson says to avoid come first, with the file and line, the lesson, why it
  matters, and what to prefer.
- Then the lessons about the functions, RPC methods and constants the changed lines use.
- With nothing to say, the action stays quiet. A comment it wrote before is updated to say no lesson applies.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `fail-on-avoid` | `false` | Fail the check when a changed line repeats a pattern a lesson says to avoid. |
| `max-lessons` | `10` | At most this many lessons in the comment (up to 20). |
| `pulse-url` | `https://pulse.lusocryptolabs.com` | The CKB Pulse server. |
| `github-token` | `github.token` | Token to read the pull request and write the comment. |

## What leaves your repository

Only the added lines of code files in the pull request (with their file names and line numbers) go to the CKB Pulse
server, which reads them, answers and drops them: they are not stored or logged. Lockfiles, builds and vendored code
are left out. On a private repository, decide whether that is fine before you add the action.

## Pull requests from forks

GitHub gives a run started by a fork no right to comment. The lessons then go to the run summary instead. The
action does not use `pull_request_target`, which would run with write rights on code from a stranger.

## When CKB Pulse is down

The action prints a warning and passes. Its own errors never fail your build; only `fail-on-avoid` does.

## Also for AI agents

The same check is the `check_code` tool of the CKB Pulse MCP server. See
[pulse.lusocryptolabs.com/use](https://pulse.lusocryptolabs.com/use#rule) for a rule to paste into `AGENTS.md` or
`CLAUDE.md`.

## License

MIT
