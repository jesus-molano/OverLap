# Security policy

_En español: puedes enviar el aviso en español._

## Supported versions

Only the latest version published in [Releases](https://github.com/jesus-molano/OverLap/releases)
receives security fixes.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private vulnerability reporting: in the
repository's **Security** tab, **Report a vulnerability**
(<https://github.com/jesus-molano/OverLap/security/advisories/new>). Only the maintainer can see
it.

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
- in the future, the updater.

OverLap only reads the iRacing SDK's shared memory and does not connect to the internet; it never
touches the game process.
