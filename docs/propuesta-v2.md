# iRacing overlay v2 proposal (24-10-2026)

> **Status as of 31-10-2026 (OverLap 2.4.1).** This plan is kept as history; what follows has not
> been rewritten.
>
> - **Done:** the RaceModel (in memory; it resumes after a short reconnection), Standings+ (the
>   Standings widget), Battle, projected iRating and SR (with the neutral position), Faster class
>   and Hazard ahead (the Traffic widget), Delta+ (saved personal best and class references), Fuel,
>   Flags and warnings (the Alerts and Warning lights widgets), Inputs and auto-hide (Visibility
>   and each widget's rules).
> - **Pending, not built:** "If I pit now", the local memory (driver tags and notes, race diary),
>   saving the RaceModel to disk by `SubSessionID`, and a trend column in Standings (only Battle has
>   one).
> - **Dropped or out of scope:** the map with real positions, live tyre temperatures and VR (see
>   "Out of scope" in the [development notes](README.dev.md)).

## 1. Starting point

**What we have (v1)**

- **Relative** (10 Hz): shows ±3 cars with class position, number, name, licence, iRating and gap (taken from `CarIdxEstTime`). It marks lapped cars and cars lapping you, and dims the ones in the pits.
- **Radar** (60 Hz): the side comes from `CarLeftRight` and the longitudinal distance from `LapDistPct` × track length. It draws the cars to scale and, while hidden, sends nothing (`SKIP_EMIT`).
- **Technical base**: telemetry runs in a separate process, each widget is a transparent window, and the pure logic lives in `src/shared` with tests.

**What RaceLab (free and Pro), stock iRacing and other free tools offer**

The iRacing data comes from its release notes from 2025 S4 to 2026 S4; I have not checked it in the sim. RaceLab does not publish which overlays are free and which are Pro, and its own sources contradict each other. "?" means unverified.

| Feature                        | Stock iRacing                                                                                            | RaceLab free                                | RaceLab Pro                                            | Other free tools                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Relative                       | Yes (widget since S1)                                                                                    | Yes                                         | Yes, plus column reordering                            | irDashies, iOverlay, KSR                           |
| Standings                      | Yes, with a class filter (S4). A June 2026 complaint says it does not centre on you (not verified in S4) | Yes, "basic". One user calls it "very poor" | Column reordering and Race Briefing                    | irDashies; iOverlay (21 columns)                   |
| Projected iRating Δ            | No                                                                                                       | "iRating gain" column (tier ?)              | Yes                                                    | irDashies, iOverlay                                |
| Projected SR / incident budget | Only the incident counter (S3)                                                                           | No                                          | No                                                     | Only Nishizumi-SR, which is a separate app         |
| Battle / trend                 | No                                                                                                       | Head to Head ? (the guides say it is Pro)   | H2H. Overtake prediction is "In Progress"              | irDashies Battle (gap change only)                 |
| Faster-class warning           | Visual spotter, sides only                                                                               | Overtake Alert ?                            | Overtake Alert                                         | irDashies (fixed 3 s window); iOverlay only in Pro |
| Slow or stopped car ahead      | No                                                                                                       | Not found                                   | Not found                                              | irDashies                                          |
| Fuel                           | Yes: 5 modes, pit window, GWC margin, AutoFuel (S3)                                                      | ? (the tooltip says Pro)                    | Several strategies and sharing with the team           | irDashies, iOverlay, Edge                          |
| Delta                          | Yes, in Lap Timing (resets every session)                                                                | Delta bar ?                                 | Delta Trace ?                                          | irDashies, benofficial2                            |
| Pits: where you rejoin         | Pit Summary, with no rejoin position (S4)                                                                | ?                                           | Prediction on the map (the map is Pro per the tooltip) | StintView                                          |
| Map                            | Yes, 4 modes (S3)                                                                                        | ? (the tooltip says Pro)                    | Yes                                                    | irDashies, Edge                                    |
| Inputs                         | Throttle and brake timeline (S2)                                                                         | ? (the sources contradict each other)       | Yes, with comparisons                                  | irDashies, Track Titan, PaceGhost                  |
| Memory across races (tags, PB) | No                                                                                                       | 5 tagged drivers                            | Unlimited                                              | irDashies, KSR "My races"                          |
| Performance                    | Native; works in VR and full screen                                                                      | Complaints of stutters and FPS drops        | Same, though it lets you cap FPS per overlay           | irDashies has FPS complaints                       |

**Conclusion:** stock iRacing already covers fuel, map, incidents, damage and tyre compound. What both are missing falls in four areas:

- **What changes over time**: gap trends and laps left to catch someone.
- **Predictions**: iRating and SR, "if I pit now" and when the faster class catches you.
- **Memory across sessions**: tags, best laps, history.
- **Low resource use**: the main complaint about RaceLab and irDashies.

How to settle RaceLab's "?": you have version 8.4.4 installed. Open it and see which overlays carry the "pro overlay" label.

## 2. v2 proposal

**Prerequisite: a timing engine (effort M).**

- **The problem today:** each provider only gets the frame and its `prev`, at its widget's rate. That is not enough to keep the race history.
- **The new piece:** a stateful `RaceModel`, fed at 60 Hz in the telemetry process before the providers.
- **How it times:**
  - It uses 100 virtual lines plus the sectors from the YAML (`SplitTimeInfo`).
  - It interpolates each car's crossing time at each line, with about 10 ms resolution. That is how real timing works, and it is more faithful than `CarIdxEstTime`, which is based on a fixed estimated lap.
  - The gap between two cars is the difference between their crossing times at the last line both have passed.
- **What it stores:** gap history, stops, pit exits and the starting grid.
- **Cost:** O(64) per tick, under 1 ms.
- **Persistence:** it is saved by `SubSessionID`, so the history is not lost if you restart the app mid-race.
- **Number of cars:** better not to hard-code 64, because `irsdkLogAllCars=1` (2026 S3 P1) allows more.
- **Who uses it:** standings, battle, the faster-class warning and pits all read from here.

| #   | Feature                | What it shows                                                                                                                                                                                                                                                        | Versus RaceLab free and stock iRacing                                                                                                                                                                                                                                 | Data                                                                                                                                                | Accuracy                                                                                                                                                                                                                                                                                      | Eff.            | Cost                                               |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| 1   | **Standings+**         | See 2.1                                                                                                                                                                                                                                                              | Stock does not centre on you and has no iR, positions gained or stops. RaceLab free has it, but column reordering is Pro. On iR and positions gained we only match irDashies and iOverlay. We win on timing-line intervals, trend, and the iR and SR neutral position | `CarIdx` Lap, LapDistPct, OnPitRoad, TrackSurface, LastLap/BestLapTime, TireCompound, SessionFlags, F2Time. YAML: `Drivers[]`, `QualifyResultsInfo` | See 2.1                                                                                                                                                                                                                                                                                       | L               | 4 Hz, fixed rows                                   |
| 2   | **Battle**             | Gap to the car ahead and the car behind in your class and the s/lap you gain or lose. It tells you "you catch him on L12 of 15" or "you need −0.18 s/lap", in which sector you gain or lose, and the last 3 laps side by side. It only shows with a car within 1.5 s | Stock has nothing like it. In RaceLab, H2H's tier is unverified and "prediction overtake" is still "In Progress" on its roadmap (165 votes). Comparing laps to catch with laps remaining does not appear in any tool reviewed                                         | RaceModel, `SessionLapsRemainEx`                                                                                                                    | Exclude laps with pit stops or yellows. The slope is noisy with fewer than 2 laps                                                                                                                                                                                                             | S*              | 2–4 Hz, hidden most of the time                    |
| 3   | **iRating + SR**       | Projected iR Δ, "±10 iR/pos", the neutral position (where Δ≈0) and how much iR is at stake for P−1 or P+1. Also the projected SR and the **incident budget** (how many you can pick up without losing SR)                                                            | iR: we only match. The neutral position does not appear in any tool. Projected SR: no overlay does it                                                                                                                                                                 | YAML: IRating, CarClassID, LicLevel/SubLevel, TrackNumTurns. `PlayerCarMyIncidentCount`                                                             | Community formula (2019 spreadsheet → irating-rs → irDashies), with no public validation. Computed per class (Sporting Code §13.2.3). Unverified: non-starters and rookies. SR with Nishizumi-SR (MIT); its 0.033 mean error is claimed only by its author. It will be shown as an "estimate" | S (iR) + M (SR) | iR only when the order changes (<1 ms); SR at 1 Hz |
| 4   | **Faster class**       | For example "GTP 6 s back · catches you in T3", with its number and iR. Multiclass races only                                                                                                                                                                        | Stock only has the side spotter. RaceLab's Overtake Alert has an unverified tier and there is no record of it giving an ETA. irDashies uses a fixed 3 s window with no closing rate                                                                                   | `CarIdxLapDistPct`, `CarIdxClass`, pace from `CarIdxLastLapTime`                                                                                    | The simple ETA can be off by ±20 % (the report's estimate, not measured)                                                                                                                                                                                                                      | M               | 4–10 Hz, only emits on change                      |
| 5   | **Hazard ahead**       | Stopped, slow or off-track car between 1 and 8 s ahead                                                                                                                                                                                                               | Not found in stock or in RaceLab. We match irDashies                                                                                                                                                                                                                  | `CarIdxTrackSurface`, `LapDistPct`, `TrackLength`                                                                                                   | It is a heuristic: the SDK has no crash signal and off track is not always an incident. Tow jumps must be filtered out                                                                                                                                                                        | S               | Samples at 60 Hz, emits at about 10 Hz             |
| 6   | **Delta+**             | Delta bar with a gaining or losing arrow. References: your all-time best lap per car and track, and the session best of the fastest in your class. Loss per sector                                                                                                   | The bar itself only matches. We win with the persistent PB (stock resets every session) and with the rival reference                                                                                                                                                  | `LapDeltaToBestLap/_OK/_DD` and our own recorded profile                                                                                            | The exact reference of `LapDeltaToSessionBest` is undocumented                                                                                                                                                                                                                                | M               | ~30 Hz, `transform` only                           |
| 7   | **Fuel**               | A single status line: "OK +1.2 L", "SAVE 0.06 L/lap" or "BOX in 3 · +18 L". In timed races it works out the laps left from the overall leader's pace. It warns if the pit menu does not add up                                                                       | Stock is already good. We only win in multiclass timed races, in the history from practice and in the menu warning. **Low value in MX-5 sprints**                                                                                                                     | `FuelLevel`, `FuelUsePerHour`, `DriverCarFuelMaxLtr`, `SessionTimeRemain` (32767 = timed race), `PitSvFuel`                                         | The finish rule (the leader takes the flag after reaching 0) is what drivers say and is not in the Sporting Code. Exclude pit laps, yellows and lap 1                                                                                                                                         | M               | 1 Hz and per lap                                   |
| 8   | **"If I pit now"**     | Between which cars you rejoin and in what class position                                                                                                                                                                                                             | Stock does not predict it. In RaceLab it is on the map, which is Pro per the tooltip                                                                                                                                                                                  | `CarIdxOnPitRoad` of any car, `PitstopActive`                                                                                                       | ±1–2 s. It does not foresee cars stopping at the same time. Pit times per car have to be learnt (they changed in S4)                                                                                                                                                                          | M               | 2 Hz, on demand                                    |
| 9   | **Flags and warnings** | Big flag, pit limiter not engaged on pit road, rivals' meatball                                                                                                                                                                                                      | Matches stock iRacing on flags; the rest adds little                                                                                                                                                                                                                  | `SessionFlags`, `CarIdxSessionFlags`, `EngineWarnings & 0x10`                                                                                       | Bits from irsdk_defines: 0x4000 = caution and 0x10000 = black. irDashies labels them wrong                                                                                                                                                                                                    | S               | Per event                                          |
| 10  | **Inputs**             | Pedals and wheel, with a longer trace without enlarging the widget                                                                                                                                                                                                   | Stock already has a timeline; the value is low (the MX-5 has no ABS)                                                                                                                                                                                                  | `Throttle`, `Brake`, `SteeringWheelAngle`                                                                                                           | —                                                                                                                                                                                                                                                                                             | S               | 60 Hz; the most expensive thing to draw            |

\*With the RaceModel already built.

### 2.1 Standings+ in detail

**Modes**

- **Compact** (default, 12–15 rows): from your class, the top 3 and ±3 around you, always centred on you. Below, one row with the leader of each other class.
- **Full** (with a shortcut): every class, with a header per class.

**Columns**

| Column                         | Content                                                                                                                         | Compact       | Full |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---- |
| Pos                            | Class position, in a yellow pill if off track                                                                                   | ✓             | ✓    |
| ▲▼                             | Positions gained since the start. Grid from `QualifyResultsInfo` (starts at 0, add 1) or a snapshot when `SessionState` turns 4 | ✓             | ✓    |
| No.                            | Strip with the class colour and the number                                                                                      | ✓             | ✓    |
| Driver                         | Short name                                                                                                                      | ✓             | ✓    |
| iR · Lic                       | For example "1.8k · B3.4"                                                                                                       | ✓             | ✓    |
| Interval                       | To the car ahead in the class, or gap to the leader (alternating); "+1L" if a lap apart                                         | ✓             | Both |
| Last                           | 3 decimals. Purple = fastest in the class, green = the driver's best lap                                                        | ✓             | ✓    |
| Pits                           | PIT, OUT or "2 · L12" (number of stops and lap of the last one)                                                                 | ✓             | ✓    |
| Best lap, compound, stint laps | —                                                                                                                               | –             | ✓    |
| iR Δ per driver                | —                                                                                                                               | Your row only | ✓    |
| Trend                          | s/lap versus the car ahead                                                                                                      | –             | ✓    |
| Status                         | Meatball, black flag, disconnected (in grey), fast repairs                                                                      | Icon          | ✓    |

**Header of each class:** class, SoF, number of cars and laps or time remaining. Below, "your iR Δ +23 · ±10/pos · neutral P9" and "5x/17 · SR 3.12→3.05".

**Practice and qualifying:** the interval becomes the best lap and the gap to the best. iR is hidden unless you turn on a "what if" mode.

**Calculation rules**

- **Live order:** by `Lap + LapDistPct` within the class. An order change has to hold for 0.5 s to apply; that way rows do not flicker at the line. It is often said that `CarIdxPosition` only updates at the timing lines, but I have not verified it.
- **Intervals:** they come from the RaceModel; if there is no data yet, from `F2Time`. They are smoothed with an exponential moving average and rounded to 0.1 s, so `SKIP_EMIT` drops repeated sends.
- **Stops:**
  - Every time a car enters pit road (`OnPitRoad`) during the race counts as a stop.
  - Starting from the pit lane does not count.
  - The tow is not detected this way, because it takes you to the box without going through pit road.
- **Exclusions:** pace car, spectators and drivers with an iR of 0 or less.
- **Tyres and fast repairs:** the compound name is only reliable for your car model. `CarIdxFastRepairsUsed` is only filled in sessions with a repair limit.

**Drawing**

- Fixed indexed rows: no DOM reordering and no animations.
- Numbers with `tabular-nums`, so they do not jump around.
- Colour always comes with a shape (▲▼, icons), for colour-blind drivers.
- Background at 0.65 to 0.75 opacity only behind the text.
- Window fitted to the content.

## 3. Out of scope or hard

- **Map with real positions:**
  - The SDK gives no live car positions: `Lat`, `Lon` and `Alt` are only recorded in the .ibt file.
  - The SVGs irDashies uses are iRacing's property.
  - The Data API has stopped creating new OAuth clients since March 2026.
  - The layout could be recorded from your own lap, but it is not worth it: stock iRacing already has a map with 4 modes.
- **Radar with real lateral distance:** the SDK only gives `CarLeftRight`.
- **Tyre temperature and wear:** they only update with the car stopped in the box, according to the community.
- **Rivals' inputs and telemetry:** iRacing does not send them.
- **Other drivers' incidents live:** I have not confirmed they are available.
- **VR and exclusive full screen:** transparent windows do not show there. The stock widgets do work.
- **Damage:** the S4 Car Damage widget already exists, and it includes the MX-5.
- **Weather forecast:** the SDK has no forecast field.
- **Official SR:** the formula is not public, so we can only estimate it.

## 4. Recommended order

- **v2.0 "Race":** RaceModel, Standings+, Battle and iRating/SR.
- **v2.1 "Traffic":**
  - Hazard ahead, faster class, and flags and limiter.
  - **Auto-hide depending on the moment of the race:** battle only with a car within 1.5 s and pits only on pit road. A hidden window is not repainted, so it saves GPU.
- **v2.2 "Pace and strategy":**
  - Delta+, timed-race fuel and "if I pit now".
  - **Local memory:** unlimited driver tags and notes, and a race diary with iR and SR before and after, consistency and % of clean laps.
  - Inputs, if you miss them.

**The first three I would build:**

1. RaceModel with Standings+. It is the base for almost everything else.
2. Battle. It is the biggest differentiator and what matters most in the MX-5.
3. iRating with SR and the incident budget. The effort is low and nobody has SR.

**Before starting, it is worth measuring in a real session:**

- How often `CarIdxPosition` updates.
- The granularity of `F2Time`.
- The finish rule of timed races.
- What `PlayerIncidents` and `LapDeltaToSession*` mean exactly.

**Performance budget:**

- Tables at 2–4 Hz, warnings at about 10 Hz, delta at 30 Hz and radar at 60 Hz.
- No blur, `backdrop-filter` or large shadows in anything that repaints.
- Reuse buffers when reading the telemetry: irDashies measured reads about 9 times faster that way (issue #803).

## Sources

- **RaceLab:**
  - Plans and tooltips: https://racelab.app/ and https://racelab.app/locales/en/home.json
  - iRacing page: https://racelab.app/iracing
  - Roadmap: https://roadmap.racelab.app/feedback
  - Performance guide: https://garage.racelab.app/docs/faq/performance_guide
  - 2025 user guide: https://note.com/gordon042/n/nf3bcdfca7c56
  - Texts of the installed app: the English translation files that come with the installed app (RaceLab 8.4.4)
- **iRacing:**
  - 2025 S4: https://boxthislap.org/iracing-2025-season-4-release-notes/
  - 2026 S1: https://boxthislap.org/iracing-2026-season-1-release-notes/
  - 2026 S2: https://boxthislap.org/iracing-2026-season-2-release-notes/
  - 2026 S3: https://boxthislap.org/iracing-2026-season-3-release-notes/
  - 2026 S3 Patch 1: https://support.iracing.com/support/solutions/articles/31000179039-2026-season-3-patch-1-release-notes-2026-06-12-02-
  - 2026 S4: https://support.iracing.com/support/solutions/articles/31000179517-2026-season-4-initial-release-notes-2026-09-09-01-
  - Safety Rating: https://support.iracing.com/support/solutions/articles/31000156960
  - Sporting Code: https://ir-core-sites.iracing.com/members/pdfs/20260310-official_sporting_code_dated_Mar_10_2026.pdf
- **SDK:**
  - Variable documentation: https://sajax.github.io/irsdkdocs/telemetry/
  - Flag constants: https://github.com/kutu/pyirsdk/blob/master/irsdk.py
  - Per-car variables: https://github.com/mpapenbr/goirsdk/blob/v0.6.0/variables.md
- **Formulas:**
  - Original iRating spreadsheet: https://github.com/SIMRacingApps/SIMRacingApps/issues/209
  - irating-rs: https://github.com/Turbo87/irating-rs
  - Nishizumi-SR: https://github.com/nishizumi-maho/Nishizumi-SR
- **Other tools:**
  - irDashies: https://github.com/tariknz/irdashies (and its issues #803 and #804)
  - iOverlay: https://ioverlay.app/
  - benofficial2's Blind Spot / spotter: https://github.com/fixfactory/bo2-official-overlays
- **User opinions:**
  - Free standings "very poor": https://www.reddit.com/r/iRacing/comments/1x279xl/
  - Paywalls and stutters: https://www.reddit.com/r/iRacing/comments/1rc8hd3/
  - Stock standings not centred: https://www.reddit.com/r/iRacing/comments/1u6cub0/
  - Reddit was read through the Arctic Shift archive.
