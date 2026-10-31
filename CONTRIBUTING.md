# Contributing

_En español: los issues y los pull requests también son bienvenidos en español._

Thanks for wanting to improve OverLap. Bug reports, ideas and pull requests are welcome, in English
or Spanish.

## Before you start

- **A bug**: open an issue with the "Report a problem" template. If you attach the log
  (`overlap.log`), read it first: see [the template](.github/ISSUE_TEMPLATE/bug_report.yml).
- **An idea or a big change**: open an issue first to talk it over, so nobody works on something
  that does not fit later.
- **A security issue**: do not open a public issue; follow [SECURITY.md](SECURITY.md).

## Setting up

You need Node.js 22 (22.13 or later) or 24 (the one CI uses). Testing with iRacing and building the
`.exe` need 64-bit Windows 10 or 11; `npm run dev:mock` (a simulated race) also works on Linux and
macOS. You do not need Visual Studio or Python: the native addons come prebuilt.

```bash
npm ci
npm run dev:mock   # without iRacing: a simulated race
npm run dev        # with iRacing running
```

The [development notes](docs/README.dev.md) explain how it is built inside and how to add a widget.

## The five checks

A pull request has to pass all five, just like CI:

```bash
npm run typecheck
npx vitest run
npx eslint . --max-warnings 0
npx prettier --check .
npx electron-vite build
```

- If you change something visible, add or adjust its tests and its texts in **both languages**
  (`src/shared/i18n/messages/`).
- If people using OverLap will notice the change, note it in [CHANGELOG.md](CHANGELOG.md), under
  "[Unreleased]".
- One pull request, one change: easier to review.

## Signing off commits (DCO)

OverLap uses the [Developer Certificate of Origin](https://developercertificate.org/) (DCO), not a
CLA. With it you state that you have the right to submit your code under the project's licence. Just
sign off each commit:

```bash
git commit -s -m "What changes"
```

That adds a line like this at the end of the message, with your name and email:

```
Signed-off-by: Your Name <you@example.com>
```

If you forget, `git commit --amend -s` signs off the last one, and `git rebase --signoff main` all
the ones on your branch.

## Licence of your contributions

OverLap is free software under the [GPL-3.0-or-later](LICENSE). What you contribute is released
under that same licence: you do not have to assign any rights or sign anything beyond the DCO.

Do not add code, images or logos you cannot release under the GPL (or under a compatible licence,
listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). In particular, new colour brand logos
are not accepted: the existing ones are not under the GPL, as that file explains.

## Review

The maintainer reviews every pull request before merging it, and may ask you for changes or, if
something does not fit the project, explain why it is not merged.
