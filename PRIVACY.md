# Privacy policy

Last updated: 02-11-2026.

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
  `settings.json.v6.bak`, `personal-bests.json.bak`) and, if you use the simulated data mode, its
  own `mock/` subfolder;
- `session-info.json`: only if you use **Copy diagnostics**, the session info iRacing gave for the
  session you are in, for diagnosing problems. It includes the names and iRating of the drivers in
  that session. It stays on your computer unless you send it, and the next time replaces it;
- `overlap.log` (and `overlap.old.log`): the app's log, for diagnosing problems. It can contain
  paths on your computer (your user folder is written as `%USERPROFILE%`, without your Windows user
  name) and driver names from your sessions. It never leaves your computer unless you copy it;
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

**Streaming mode (from 2.7).** Off by default. When you turn it on in **Settings › Streaming**,
OverLap opens a small web server **on your own computer only**, so OBS, Streamlabs, vMix or XSplit
can show your widgets as a browser source:

- **where**: it listens only on `127.0.0.1` (this computer), on the port you choose (`39217` by
  default), unless you also turn on the option below. Nothing on your network or the internet can
  connect to it, and it connects to nothing:
  it is not an internet connection. Turned off, no port is open;
- **what it serves**: the stream page and the widgets' live data (the same the overlay shows: the
  drivers in your session, positions, gaps, your inputs…), only to programs on your computer that
  open its addresses, and only the settings those widgets draw with (never your controllers' names,
  shortcuts or layouts). It is read only: nothing they send can change OverLap. It refuses requests
  that come from other web sites. Importing a backup never turns it on. If you give the setup
  curtain an image, it also serves OverLap's copy of that image, and no other file of yours;
- **what it keeps**: nothing new, except the copy of the curtain's image if you choose one (in
  OverLap's folder, `stream/`; **Remove image** deletes it); the server writes only a line in
  `overlap.log` when it starts or stops;
- **from another PC on your network** (off by default, **From another PC on my network**): only
  when you turn it on, it also listens on this computer's private network addresses, for a separate
  streaming PC at home. It answers only computers on the same home network (never the internet, nor
  carrier-grade NAT, nor another private network such as a VPN's), and only requests that carry this
  computer's code: a random code made on this computer, kept in its settings (an import and **Reset
  everything** keep it, a backup file never carries it; the Settings page shows it only when you
  press **Show**), sent in the address, and for the stream page's own files in a cookie (it holds
  only the code, is named after the port and is sent only to `/assets/` paths). Wrong
  codes make that address wait. The code is never written to `overlap.log`; the log notes only the
  network addresses it listens on and an address that tried wrong codes. **Change the code** makes a
  new one. Windows Firewall asks you when you turn it on: allow private networks only. Turned off,
  it stops listening on your network at once;
- what your streaming program then broadcasts is up to you and that program.

Apart from this, OverLap makes no network connections at all.

**Contact.** Open an issue at <https://github.com/jesus-molano/OverLap/issues> or, if it is
private, a private report at <https://github.com/jesus-molano/OverLap/security/advisories/new>.
