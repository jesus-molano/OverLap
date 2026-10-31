# Security policy

_En español: puedes enviar el aviso en español._

## Supported versions

Only the latest version published in [Releases](https://github.com/jesus-molano/OverLap/releases)
receives security fixes.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting: in the repository's **Security** tab, **Report
a vulnerability** (<https://github.com/jesus-molano/OverLap/security/advisories/new>). Only the
maintainer can see it. If you cannot use it, open an
[issue](https://github.com/jesus-molano/OverLap/issues) that only says you have a security report
and how to reach you, without the details, and the maintainer will contact you.

Please include, if you can:

- the OverLap and Windows versions;
- what happens and how to reproduce it;
- what an attacker could do with it.

If you attach the log (`overlap.log`), review it first and remove any personal data (paths with
your Windows user name, driver names).

## What to expect

OverLap is maintained by one person in their spare time. The aim is to answer within a week and, if
the issue is confirmed, to ship the fix in a new release as soon as possible, crediting whoever
found it if they wish.

## Scope

Of most interest:

- the messages between the settings window and the main process (IPC);
- reading files the user imports (backups, layouts);
- the native addons (`@irsdk-node/native`, `koffi`);
- the updater (unsigned updates from this repository's GitHub Releases, checked against the sha512
  in `latest.yml`).

OverLap is not open source, so reports are based on how the app behaves; you do not need its code
to report something.

OverLap only reads the iRacing SDK's shared memory, and its only network connection is the update
check against this repository's GitHub Releases (which can be turned off); it never touches the game
process.
