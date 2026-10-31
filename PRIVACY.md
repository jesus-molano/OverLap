# Privacy policy

Last updated: 31-10-2026.

_En español: puedes hacer cualquier pregunta sobre privacidad en español en un issue._

**OverLap sends none of your data anywhere.** It has no accounts, no ads, no usage telemetry and no
automatic crash reports: nothing about iRacing, your settings or your records leaves your computer,
not to the author, not to GitHub, not to third parties. Its only connection is the update check
(below), which can be turned off.

**What it reads.** Only the official iRacing SDK shared memory, read-only and on your own computer,
to draw the widgets: lap times, positions, the names of the drivers in the session, and so on. It
also reads your wheel's buttons (through Windows Raw Input) if you bind a shortcut to them.

**What it stores, and where.** Everything stays on your computer, in `%APPDATA%\iracing-overlay\`:

- `settings.json`: your settings and layouts;
- `personal-bests.json`: your lap records (for the delta);
- backup copies of those two files (`settings.json.bak`, `settings.json.v5.bak`,
  `personal-bests.json.bak`) and, if you use the simulated data mode, its own `mock/` subfolder;
- `overlap.log` (and `overlap.old.log`): the app's log, for diagnosing problems. It can contain
  paths on your computer (with your Windows user name) and driver names from your sessions. It
  never leaves your computer unless you copy it;
- `update-state.json` and `.updaterId`: the updater's state and a random id it creates (see the
  updater, below);
- Electron/Chromium's own caches and storage (no personal data).

The installed version also keeps the update it downloaded in `%LOCALAPPDATA%\overlap-updater\`.
You can delete it all by deleting those folders. **Export everything…** only writes the file you
choose.

**What you choose to share.** **Copy diagnostics** copies a text (versions, status and displays, no
names) to the clipboard for you to paste wherever you like. The buttons in **About and help** (User
guide, Report a problem, Licence, Third-party notices, Download) open your browser on
GitHub only when you click them; GitHub's privacy policy applies from there.

**The updater (from 2.5).** OverLap looks for new versions in its repository's public GitHub
Releases (`github.com/jesus-molano/OverLap`):

- **when**: a minute after it starts, then every 5 hours, and when you press **Check now**;
- **what connects**: your computer asks GitHub for the list of published versions and the small
  `latest.yml` of the newest one (the portable too, to compare versions) and, only if there is a new
  one and you use the installer, downloads the installer (never during an iRacing session). It is a
  normal HTTPS request: GitHub sees your IP address (as with any download) and its privacy policy
  applies. **Nothing** about iRacing, your settings, your records or your computer is sent, and
  there is no identifier of yours: the identifier header the updater (electron-updater) sends with
  each check carries one fixed value for everyone;
- **what it keeps**: the downloaded installer, in `%LOCALAPPDATA%\overlap-updater\` (replaced by
  each update); an `.updaterId` file with a random id that the updater creates in
  `%APPDATA%\iracing-overlay\` and that never leaves your computer; `update-state.json` in that same
  folder (the versions it already told you about, the version downloaded and the last install
  attempt, to tell you whether it worked); and one line per check in `overlap.log`;
- **unsigned**: updates are not code-signed. After downloading, OverLap checks the file against the
  sha512 published with the release: that protects against a damaged download, but whoever controls
  this repository's releases controls the updates;
- **it can be turned off** in **Settings › About and help › Updates › Check for updates
  automatically** (on by default); off, OverLap only connects when you press **Check now**. The
  portable only checks and tells you: it never downloads or installs a version.

Apart from this, OverLap makes no network connections at all.

**Contact.** Open an issue at <https://github.com/jesus-molano/OverLap/issues> or, if it is
private, a private report at <https://github.com/jesus-molano/OverLap/security/advisories/new>.
