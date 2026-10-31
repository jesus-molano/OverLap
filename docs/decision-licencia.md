# Decision: if OverLap is ever sold, how (R32, 30-10-2026)

> **Dropped on 31-10-2026.** OverLap is free software under the GPL-3.0-or-later (see
> [LICENSE](../LICENSE)) and there will be no paid edition, no licence keys and no reserved
> features: all the code is available to everyone under the same licence. The project will be
> sustained by voluntary donations, which unlock nothing (the donation link will come later). This
> note is kept only as history; nothing it proposes still applies.

Decision note from the UX study (R32). **It changes nothing in the app**: OverLap still has no
account, no network connection and no locked features. This note sets what to do _if_ it is ever
sold, so that decision does not spoil what is today an advantage over the other overlays.

## Why

- iOverlay moved to a monthly subscription and drew many complaints on r/iRacing (2024–2025, seen
  only in search snippets); its PRO licence is lost when you reinstall Windows.
- RaceLab makes you sign in, even for the free part.
- OverLap today asks for no account, connects to nothing (it only reads the iRacing SDK memory on
  your own computer) and has no tiers: users notice the difference.

## Decision

If it is sold:

1. **One-off payment**, not a subscription. Updates within the major version you bought are
   included.
2. **A licence that works offline**: a signed key the app checks locally, without calling any
   server at startup or during the race.
3. **Not tied to the computer**: the same key works after reinstalling Windows or on another PC of
   the same driver; no hardware fingerprints.
4. **No account**: the key arrives by email when you buy; the app never asks you to sign in.
5. **Nothing that already exists gets locked**: what the app does today keeps working the same for
   everyone. If there were a paid edition, it would be for new features, never by taking away the
   current ones.
6. **Layouts can still be exported and imported freely** (and "Export everything" in _About and
   help_), so drivers can share them whatever edition they have.
7. **No usage telemetry and no ads**; diagnostics remain something the user copies by hand.

## What is not done now

None of this is built in this phase: no licence screens, no checks, no limits. If selling is ever
decided, this note is the starting point, and any change that limits the app would have to
contradict it explicitly.
