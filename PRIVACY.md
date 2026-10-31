# Privacy policy

Last updated: 31-10-2026.

_En español: puedes hacer cualquier pregunta sobre privacidad en español en un issue._

**OverLap does not connect to the internet.** It has no accounts, no ads, no usage telemetry and no
automatic crash reports, and it sends no data anywhere: not to the author, not to GitHub, not to
third parties.

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
- Electron/Chromium's own caches and storage (no personal data).

You can delete it all by deleting that folder. **Export everything…** only writes the file you
choose.

**What you choose to share.** **Copy diagnostics** copies a text (versions, status and displays, no
names) to the clipboard for you to paste wherever you like. The buttons in **About and help** (User
guide, Report a problem, Source code, Licence, Third-party notices) open your browser on GitHub
only when you click them; GitHub's privacy policy applies from there.

**In the future: the updater.** A coming version will add an automatic updater. When it does:

- it will only check OverLap's published releases on GitHub Releases, to find out whether there is
  a new one and download it (GitHub sees your IP address, as with any download);
- it will be **on by default and can be turned off** in the settings;
- this document, the README and the release notes will describe it **before** that version is
  released.

Until then, OverLap makes no network connections at all.

**Contact.** Open an issue at <https://github.com/jesus-molano/OverLap/issues> or, if it is
private, a private report at <https://github.com/jesus-molano/OverLap/security/advisories/new>.
