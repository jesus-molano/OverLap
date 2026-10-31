# OverLap: development notes

Technical documentation for OverLap: how it is built, how it is put together inside, and the detail
of how each widget computes what it shows. The user guide is in the [README](../README.md).

Stack: Electron 44, electron-vite 6, Vue 3.5 (`<script setup lang="ts">`), strict TypeScript and
Vitest 5.

## Development requirements

| Requirement  | Detail                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| System       | Windows 10/11 x64 (with `dev:mock` you can also develop on Linux/macOS) |
| Node.js      | 22 (>= 22.13) or 24 (the one used by CI and for development) and npm    |
| Not required | Visual Studio, Python or `electron-rebuild`                             |

## Native addon and `postinstall`

`@irsdk-node/native` ships prebuilt N-API binaries (`prebuildify --napi --electron-compat`), so they
work as they are with Node and with Electron without recompiling anything. So does `koffi` (the FFI
used to read the session text): its binary comes in `@koromix/koffi-win32-x64`, which packaging
keeps outside the asar, and only that one is shipped.

- `postinstall` only runs `install-electron`: Electron 44 no longer downloads its binary during
  `npm install`.
- `electron-builder install-app-deps` was removed from `postinstall` because it tried to build the
  addon from source with node-gyp, which requires MSVC. For the same reason, `electron-builder.yml`
  has `npmRebuild: false`.

## Installation and scripts

```bash
npm ci
npm run dev:mock   # without iRacing: simulated race
npm run dev        # with iRacing running
```

| Script                 | What it does                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Electron + Vite with renderer HMR and main reload (`-w`). Real iRacing source on Windows                                      |
| `npm run dev:mock`     | The same, with `OVERLAY_SOURCE=mock`: simulated race, ~20 cars in 2 classes, cars coming alongside, lapped cars and pit stops |
| `npm run typecheck`    | Type check of shared + node (main, preload, telemetry) + web (renderer, `vue-tsc`)                                            |
| `npm test`             | Tests with Vitest (`src/**/*.test.ts`); `npm run test:watch` in watch mode                                                    |
| `npm run build`        | `typecheck` + `electron-vite build` to `out/`                                                                                 |
| `npm run build:win`    | `build` + portable `.exe` in `dist/` with electron-builder                                                                    |
| `npm run build:unpack` | `build` + `dist/win-unpacked` folder (not installed), useful to test the packaging                                            |

There are also `npm start` (`electron-vite preview`, runs whatever is in `out/`), `npm run lint` and
`npm run format`.

The first `build:win` downloads, once, the NSIS tools that electron-builder uses. The result is
`dist/OverLap-<version>-portable.exe` (unsigned). The portable build unpacks itself into a temporary
folder on every start; `dist/win-unpacked/OverLap.exe` starts faster.

When you publish a release on GitHub, attach `LICENSE` and `THIRD_PARTY_NOTICES.md` next to the
`.exe` (or link them in the notes): they are inside the portable build, but someone who only
downloads the `.exe` does not see them until they open it, and the GPL asks for the licence text to
go with the binary.

## Data source

| Way                                   | Values                                       |
| ------------------------------------- | -------------------------------------------- |
| `OVERLAY_SOURCE` environment variable | `iracing` or `mock`                          |
| Default                               | `iracing` on Windows, `mock` outside Windows |
| Flag of the packaged `.exe`           | `--mock` or `--source=mock`                  |
| Open Settings at startup              | `--settings`                                 |

Outside Windows you can develop with `npm run dev:mock` (Linux/macOS).

```bash
./dist/OverLap-2.4.1-portable.exe --mock
```

If iRacing is not running, Relative and Standings show **"Waiting for iRacing…"** for about 8 s and
then hide, so they do not stay over the desktop when you close the sim (in edit mode they stay so
you can place them; `visibility.showWhileWaiting` keeps them; a telemetry error stays in view). The
radar stays hidden, just as when nobody is near, and the connection is retried every ~2 s. If the
connection drops, the widgets stop drawing the last data instead of staying frozen. If the telemetry
process fails, main restarts it with a growing delay.

## Settings file (`settings.json`)

Settings are saved in `%APPDATA%\iracing-overlay\settings.json` (the same folder in development and
in the portable build; `app.setPath('userData', ...)` in `src/main/index.ts` sets it). Next to it is
`personal-bests.json` with the Delta's records (mock mode uses its own `mock/` subfolder).

- Normally you change them from the Settings window; if you edit the file by hand, do it **with the
  app closed**.
- The file carries `version` (now 6, `SETTINGS_VERSION` in `src/shared/settings/defaults.ts`); files
  from earlier versions are migrated automatically (`src/shared/settings/migrate.ts`), and before
  the first save they are copied once to `settings.json.v5.bak`, so you can go back to that version.
  The defaults and limits of each option are in `src/shared/settingsSchema.ts`, and normalization in
  `src/shared/settings/normalize.ts`.
- Sections: `appearance`, `visibility`, `widgets` (position, size, scale, visibility, lock, opacity
  and rules of each widget), one per widget with its options (`relative`, `radar`, `standings`,
  `battle`, `inputs`, `traffic`, `alerts`, `delta`, `fuel`, `lights`, `spotter`), `shortcuts`,
  `shortcutsMore` (the second and third shortcut of each action), `buttonDeviceNames` (the last name
  seen for each controller), `settingsWindow`, `layouts` (`autoSwitch` and `sort`) and
  `savedLayouts` (the layouts: list, the active one, the links to cars, the recent cars and the
  shared options of the position-only ones; 30 at most). Since settings version 6 each layout also
  saves the widgets' options (`SavedLayout.mode` / `options`).
- Coordinates are DIPs of the primary display. If a file is damaged, a `.bak` copy is kept and the
  defaults are used. `personal-bests.json` has its own `.bak`.

## Widgets

| Widget         | Id          | Rate  | Minimum size |
| -------------- | ----------- | ----- | ------------ |
| Relative       | `relative`  | 10 Hz | 300 x 150    |
| Radar          | `radar`     | 60 Hz | 120 x 140    |
| Standings      | `standings` | 4 Hz  | 240 x 60     |
| Battle         | `battle`    | 4 Hz  | 220 x 60     |
| Inputs         | `inputs`    | 60 Hz | 120 x 70     |
| Traffic        | `traffic`   | 4 Hz  | 220 x 60     |
| Alerts         | `alerts`    | 10 Hz | 200 x 50     |
| Warning lights | `lights`    | 10 Hz | 40 x 24      |
| Delta          | `delta`     | 30 Hz | 200 x 48     |
| Fuel           | `fuel`      | 2 Hz  | 180 x 40     |
| Spotter        | `spotter`   | 60 Hz | 60 x 60      |

The definitions are in `WIDGET_DEFS` (`src/shared/widgets.ts`).

## When the overlay shows (detail)

In **Settings › Visibility** (the `visibility` section of `settings.json`; **When to show the
overlay** is also in the tray, in the **When to show** submenu):

| Option                                             | Default                              | What it does                                                                   |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------ |
| When to show the overlay (`showWhen`)              | Only when you are in the car (`car`) | `car`: while you drive; `race`: also, in races only; `always`: always          |
| In replays (`replays`)                             | Hide (`hide`)                        | `follow`: they follow the car on camera; when rewinding only Standings remains |
| Hide on the session screen (`hideOnSessionScreen`) | Yes                                  | Except the widgets with “Show on the session screen”                           |
| Hide with the iRacing UI (`hideWithSimUi`)         | Yes                                  | If you hide the sim's UI, the widgets hide                                     |
| Hide in the garage (`hideInGarage`)                | Yes                                  | While the garage screen is open                                                |
| Keep “Waiting for iRacing” (`showWhileWaiting`)    | No                                   | Without iRacing, Relative and Standings keep showing the notice                |

- **In the car** is `IsOnTrack` (you inside, with the physics running). Out of the car (garage,
  session screen, watching the race, a teammate's stint in a team race) nothing shows, except
  Standings on the session screen. A brief moment out (≤ 1 s: a reset, the start of a tow) does not
  make the overlay flicker; when you get in the car it comes back at once.
- **Races only** also hides practice and qualifying entirely, inside the car.
- **Replays**: by default no widget shows. With “Follow the car on camera” (`follow`), out of the
  car the widgets follow the car you are watching while the replay system is active (live or
  rewinding). In team races this is the option to watch your teammate's stint.
- Above everything: **edit mode** always shows every widget (with the reason: _Hidden: out of the
  car_, _Hidden: races only_...) and `Ctrl+Shift+H` still hides them by hand. Each widget's rules
  (“Show in”, “Hide in the pits”) apply on top of these.
- A settings file from before this option switches replays to “Hide” (its `follow` was the default
  back then).
- **Session screen** (`CamCameraState` 0x1): so as not to cover the results, the chat or iRacing's
  buttons. Each widget has its exception in the **Window and visibility** section of its page
  (`showOnSessionScreen`); by default only Standings stays, with the results. Radar, Spotter,
  Inputs, Warning lights and Delta have it off, with the reason: out of the car they have no data;
  Fuel too: it shows nothing while the replay system is active, and it is on the session screen.
  With “Only when you are in the car” (or “Races only”) and replays hidden, the session screen is
  already hidden for being out of the car: Visibility does not offer “Hide on the session screen”,
  and only each widget's exceptions count. With “Follow the car on camera” it does count: the
  session screen is the live point of the replays, where the widgets follow the car.
- iRacing also sets `IsReplayPlaying` on the session screen **live** (“Playback: Live”): there
  everything stays live and is timed as always. It is only a real replay if the tape is not at the
  live point (`ReplayFrameNumEnd` > 0; without that variable, if `SessionTime` goes back or jumps).
- Live with the camera on another car, Relative, Standings, Battle and Traffic centre on it; Radar,
  Spotter, Inputs, Alerts, Warning lights, Delta and Fuel only have data for your car and hide.
- When rewinding, the race is not rebuilt from the tape: the widgets with live data hide and
  Standings (with `follow`) keeps the live race as it was. Timing does not count laps, records or
  incidents from the tape, and on returning to live everything carries on (the lap the replay split
  is not timed). The SR line and the incident counter only show with your car.
- As with "Show in", a hidden widget is not computed, and in edit mode it shows with the reason
  (_Hidden on the session screen_, _Hidden: camera on another car_...).
- In simulated mode (`dev:mock`) each session shows it once: UI hidden at 2:00, garage at 2:20,
  session screen at 2:30 and at 2:50 a 14 s replay: 7 s live with the camera on the car ahead and
  7 s rewound (hidden entirely by default). The simulated driver does not get out of the car.

## Widget details

How each widget computes what it shows, with the SDK variables it uses and what is still to be
confirmed in a real session.

### Relative

- 3 cars ahead and 3 behind by default (`relative.carsAhead` / `carsBehind`); if cars are missing it
  fills in with empty rows so your row stays centred.
- Each row includes class position, number, logo, country flag, name, iRating, licence and gap.
- **Customise** (Settings › Relative, each zone with its editor: drag or ↑ ↓ to reorder, the eye to
  show or hide, “Reset”):
  - **Columns** (`relative.columns`, `RELATIVE_COLUMN_IDS`): position, number, make logo, country
    flag, name, flags, positions gained, iRating, licence, gap, last lap, pits, stint laps and tyre,
    in the order you want (the ones before the name sit to its left). Hidden by default: positions
    gained, last lap, pits, tyre and stint. Only the name always shows (`TABLE_REQUIRED`: name,
    logo, country flag and flags have no eye): position and gap can be hidden. The logo, the country
    flag and the penalty flags are placed in the list, and whether they show is set by the “Driver”
    block (`brandMarks`, `countryFlags`, `showFlags`: by default `inherit`, “Global”, the Appearance
    setting; the logo on Auto only shows if there is more than one make in the session, and the
    flag, nothing if the driver did not pick one). Below: **column titles** (`columnHeads`, “POS”,
    “DRIVER”, “SR”…, off).
  - **Header** (`headerBar` + `headerBarSize`) and **footer** (`footerBar` + `footerBarSize`): data
    bars with the same catalog (name, session, time or laps left, local time, sim time, SoF, cars,
    incidents, iRating at stake, projected SR, class fastest lap, fuel, track, water, wind, air,
    rubber); “On the right” separates what aligns to the other end. Size No / Small / Normal /
    Large. By default, the header with only the title and the footer hidden. If it does not fit,
    the least important items go first; the text never goes below the minimum.
  - The bars and the column titles count in the height: with them the row text shrinks a little;
    logos and flags count in the width.
- **Position**: the same as in Standings (the race model's, not `CarIdxClassPosition`, which
  iRacing only updates at the line). The grid one only in a race before the green; outside a race,
  no time means no position.
- **Gap**: from `CarIdxEstTime`, normalized to the player's class and corrected at the start/finish
  crossing with your class's `CarClassEstLapTime`.
- **Sign** as in irDashies: positive = ahead on track, negative = behind.
- Class colour on each row (stripe and number background).
- **Red**: a car with extra lap(s) that is going to lap you. **Blue**: a lapped car. Only in races.
- Cars in the pits (pit road or stall) are dimmed.
- Excludes the pace car, spectators and cars out of the world.

### Standings: grid, gaps and what is left

- **Before the green**: the whole grid (`QualifyResultsInfo`), also the cars still loading; no
  positions gained, iRating at stake with everyone starting, and “N cars” = entries. Clock, laps and
  SR margin with the scheduled length, not with the grid countdown.
- **Pace** before the first clean lap: your best lap, then qualifying times (yours or the best in
  your class); `CarClassEstLapTime` only as a last resort.
- **Tow or reset**: the gap is measured from where the car ends up (never a fake “+0.0”); **TOW**
  shows in the pits while the countdown lasts (yours, `PlayerCarTowTime`; the others' is not
  published: one minute) and then **PIT**, the same in Standings and Relative; it does not count as
  a stop, and the lap iRacing credits it in the stall does not add to the stint. Laps run while
  OverLap does not see the race (a replay, a reconnection) do add. If the interval is unknown and
  the gap-to-leader column already says it, “—” (not “+1L” twice).
- **Lap 1** of a standing start: timed from when the lights go green, as iRacing does (one second
  before the session switches to race).
- **At the end**: a retired car is (winner's laps − its own) behind; the header says “Last lap”
  until you cross the line and then “Finished” (also if you stay in the stall: when the session
  ends).
- **Qualifying and practice**: no time means no position and no “LEADER”, and your window stays
  anchored on you. Laps left do not go up when you get out of the car; with both a lap and a time
  limit, the clock shows too.

### Standings: customising

In Settings › Standings, one editor per zone (drag ⠿ or ↑ ↓ to reorder, the eye shows or hides,
“Reset” goes back to factory); the sample next to it changes instantly:

- **Columns** (`standings.columns`): order and visibility; only the name is fixed (position and
  number have their eye; logo, country flag and flags, their row in “Driver”). If the window gets
  narrower, the added columns go first (iRating at stake, stint, tyre…), then the country flag and
  the logo, then the usual ones and, last, the number becomes a stripe: an extra never removes a
  column that was already there. “Gap to leader” stays tied to “Gap: Both” and “iRating at stake”
  to “iRating at stake for everyone”.
- **Column titles** (`columnHeads`, off): a row with “POS”, “DRIVER”, “iR”, “INT”… in the order of
  the columns; the gap one says “LEADER” or “GAP” depending on the mode and the session.
- **Make logo** (`brandMarks`: Auto, Always, Never; Auto only with several makes) and **country
  flag** (`countryFlags`), from the “Driver” block: by default “Global” (`inherit`, the Appearance
  setting: Auto and on).
- **Header, second line and footer** are data bars (`headerBar`, `subheaderBar`, `footerBar`, each
  with its size or “No”): title, session, what is left, local time, sim time, SoF, cars, incidents,
  iRating at stake, projected SR, class fastest lap, fuel and the conditions. By default, the header
  with the title, the session and the SoF on the left and your incidents and what is left on the
  right; the second line (your iRating at stake, the class fastest lap and your SR) off in a new
  install (`subheaderBarSize: 'off'`); the conditions footer (track, water and wind; air and rubber,
  hidden in the list) and the cars. With several classes the SoF and the cars go on each class line,
  not at the top.
- **Class line** (`classLine`): SoF and car count, in the order you choose.
- **Fastest lap**: each class's best lap sits on a purple plate that fills its cell, and its row
  carries the “FL” tag next to the name.

### Standings and relative: best lap, stint, tyre and flags

What the native overlay does not give, each as its own option:

- **Best lap** in races too (`CarIdxBestLapTime`): the standings' `best` column, on by default;
  purple if it is the best in the class. Outside a race “Last lap” already shows it.
- **Last stop** (`pitLap`, “L12”) and **stint laps** (`stint`, “7 lp”): the race model computes them
  from the last pit exit or from the start. If OverLap starts with the race already under way, it
  counts from the start (it does not know about earlier stops). On the session screen and in
  replays they are the live race's.
- **Tyre** (`tyre`): the compound letter (`CarIdxTireCompound` + `DriverTires` from the YAML, H =
  hard, W = wet). iRacing only names the compounds of your car model: the rest show “—”. The column
  only appears when someone is not on the usual compound (0): an “H” on every row says nothing.
- All three are hidden by default, at the end of the column list, and are the first to hide if the
  window gets narrower (then the best lap).
- **Flags** after the name: black, repair (meatball) and warning (furled black, drawn as the black
  and white warning flag). Relative, Standings, Battle and Traffic show them, and all four can turn
  them off (`showFlags` in the “Driver” block: by default “Global”, `appearance.penaltyFlags`, on).
  The furled black flag iRacing gives a car that has already finished is not shown.
- In the relative: the `tyre` and `stint` columns of `relative.columns` (hidden) and
  `relative.showFlags` (Global). With more columns the text shrinks a little if the window is
  narrow; the rows do not change height.
- In mock mode you see stops, stints, hards and a car on wets, and a warning to the car ahead
  between 2:30 and 3:15 of each session.

### Radar

- Top-down SVG view around your car.
- iRacing does not give X/Y coordinates for the other cars:
  - **lateral**: `CarLeftRight` (only valid with the player on track, `IsOnTrack`);
  - **longitudinal**: `CarIdxLapDistPct` difference × track length (`WeekendInfo.TrackLength`).
- Configurable range (`radar.rangeM`), 20 m by default.
- Color from green to red by closeness.
- Cars are drawn to scale: an icon is as long as a car (4.6 m), so the gap you see is the real one
  at any range.
- Cars overlapping you keep their side while the overlap lasts (iRacing does not say which is which,
  only how many are on each side) and keep it for up to 3 s (or 12 m) after, when the SDK no longer
  gives lateral information: a car that has just passed you on the left still shows on the left
  instead of "in your lane".
- A car in your lane less than a car length away with no side from iRacing (the standing start, a
  car rejoining) is beside you without knowing on which side: it is drawn dimmed and with a dashed
  outline at its real distance, on top of your car, never stuck to your bumper or on top of another.
- In solo sessions (“Lone Qualify” qualifying) the other cars are not on track with you: the radar
  only uses `CarLeftRight` and Traffic lists nobody.
- Layers (`radar.parts`): distance guides, side alerts and distances on the guides (these, only with
  the guides). The cars and yours are always drawn.

### Spotter

- `src/shared/spotter.ts`: its own `computeRadar` pass (12 m range, the side memory's), with its own
  memory, so it works with the radar hidden or at another range. A null `prev` from the loop (new
  session, reconnection, a rule that hid it) resets it.
- Each side carries what both styles need (`spotter.barStyle`, drawing-only). **Closeness**
  (default, `closeness`): the radar's proximity over its range, 1 with someone alongside
  (`CarLeftRight`), and for a car the radar keeps on its side `1 - (|d| - L) / (12 - L)`, quantized
  to 1/50. It is drawn as a full-height block scaled from the bottom (`closeTransform`), with the
  amber→red ramp (`color-mix` of `--ov-warn` and `--ov-alert`, so it follows the colour-blind
  palette). A car approaching without having been alongside has no side: it fills nothing.
- **Where it covers you**: each bar is your car (4.6 m), from nose (0) to tail (1). A car alongside
  at `d` m (positive, ahead) covers `[max(0, -d/L), min(1, 1 - d/L)]`, stuck to the end it is on; at
  least `SPOTTER.minCover` (8 %) if iRacing counts it a little more than a car away. Two cars on one
  side: their two spans, joined if they touch, and the count (2). A side that `CarLeftRight` reports
  but with no car to match it (a radar ghost, or no track length) is `unknown`: full dashed bar.
- Approach cap: a car the radar keeps on its side (it was alongside less than 3 s ago) and is less
  than 12 m away: `nearFront` / `nearRear`, from 0 to 1 (one car length away).
- Quantized to 1/50 of a car (caps to 1/10) and `SKIP_EMIT` with `spotterEqual`: it is only sent
  when a bar changes, far fewer messages than its ticks at 60 Hz (the mock test checks it).
- Options (`spotter.*`, all drawing-only): `barStyle` (`closeness` | `cover`), `onlyAlongside`,
  `barWidth` (px) and `parts` (`nearCap`, only with “Where it covers you”, and `twoMark`). Hidden by
  default (`defaultVisible: false`) and in `HIDDEN_WHEN_ADDED`.
- A side with nobody is a shared, frozen object, like the out-of-car payload: a quiet pass allocates
  no memory.
- Drawing: two HTML pillars at the ends of the window (`display: flex; justify-content:
space-between`); each span is a full-height block scaled from the top (`transform`, one string per
  quantized span), the caps only change `opacity`. Colour with the radar's `--ov-prox-N` ramp
  (colour-blind palette included).

### Traffic

- Faster cars catching you from behind, slower ones you are catching and hazards ahead.
- A car in your class with at least one lap in hand coming from behind always shows as “Lapping”,
  even if the race is single-class (`traffic.onlyMulticlass`) or it is at your pace; and with the
  blue flag, any car behind that may be overtaking you. If it is less than 3 s away or would take
  more than 30 s to reach you, it says how far it is (“at 0.3 s”) instead of when it arrives; with
  the blue flag it turns amber under 2 s and red under 1 s.
- With a single class in the session there is no class column.
- It fades out when nobody is near or alongside, with hysteresis so it does not flicker at the edge
  of the range.
- If the track length is missing or looks wrong, only the side alerts show.
- **Customise** (Settings › Traffic): groups (`traffic.groups`: order and which ones; a hidden one
  is not searched), columns of each line (`traffic.parts`: icon, class, driver, flags, words before
  the time, time and sector; driver, time and flags with no eye), data bars (`traffic.headerBar`,
  the title, visible; `traffic.footerBar`, off) and group captions (`traffic.captions`, on; the old
  `traffic.header` is migrated to these two). Without captions, a line separates the groups; without
  the “catches you in” words, a hazard keeps its label (“Stopped”).

### Battle: customising

In Settings › Battle, one editor per zone (drag, ↑ ↓, eye):

- **Rivals** (`battle.lanes`): the car ahead and the car behind, in the order you choose (the first
  on top or on the left); a hidden one is not searched and with neither the widget does not show.
- **Rows** (`battle.rows`): prediction, sectors and laps, in order; laps are hidden by default. The
  rival's line and the gap line are fixed.
- **Details** (`battle.parts`): the rival's iRating and licence, trend text and iRating at stake.
  The iRating does not show side by side.
- **Catch prediction** (`battle.prediction`): its four phrases (“Catching in…”, “Catches you in…”,
  “Need… s/lap”, “Out of reach · Safe to the flag”), each with its eye, in a fixed order.
- **Gap** (`battle.gapStyle`): `plain` (“Unsigned”, the measured one, default) or `relative` (“As
  Relative”, positive ahead and negative behind). Layout (`battle.layout`): `stacked` or `side`.
  Header and footer (`battle.headerBar`, `battle.footerBar`): data bars, off by default.
- **Make logo** (`battle.brandMarks`, Auto: only with several makes in the session) and **country
  flag** (`battle.countryFlags`), from the “Driver” block, by default “Global” (Appearance): before
  the name; below ~20 em of width they hide to leave room for the name.

### Delta

- Delta bar at 30 Hz: seconds up or down against a reference at your point of the lap, trend
  (gaining / losing), predicted lap and each sector against the reference (the one you are driving,
  live).
- Reference **per session type** (`delta.referencePractice`, `referenceQualify`, `referenceRace`):
  by default personal best in practice and your optimal in qualifying and race. A `settings.json`
  with the old `delta.reference` set to `pb` (the former default) moves to these; any other is
  copied to all three.
- References:
  - **Personal best** (`pb`): your all-time best clean lap with that car on that layout. It is saved
    in `personal-bests.json`, next to `settings.json` (mock mode uses its own `mock/` subfolder),
    and it is not lost when the session changes, unlike iRacing's delta.
  - **Session best** (`session`): your best clean lap of this session.
  - **Optimal lap** (`optimal`): your best times in each sector of the circuit across your clean
    laps of this session, joined into one lap. With no sectors in the session it is your best lap.
  - **Class fastest lap** (`class`): the fastest clean lap in your class in the session, whoever set
    it.
  - **Class optimal** (`classOptimal`): the best times in each sector across the clean laps of your
    class in this session, whoever set them (you included), joined into one lap.
- With `delta.fallback` the next one is used while the chosen one does not exist: pb → session →
  class, session → class, optimal → pb → classOptimal and classOptimal → pb (`class` has none).
- The reference only changes when a lap starts, so the delta never jumps mid-lap (a better sector
  set mid-lap counts from the next one). It also changes when you pick another in Settings or with
  the “Next delta reference” shortcut (no keys by default: it moves to the next one in the current
  session): the widget says “Optimal lap from the next lap” for a few seconds and then its name.
- Customisable (`delta.rows`, `delta.top`, `delta.refBars`, `delta.laps`): the order of the rows
  (top line, bar, **rows per reference**, sectors and **lap times**; rows per reference and lap
  times, hidden by default), which references get a row (`delta.refBars`: personal best, session
  best and optimal visible; the two class ones, hidden; since 2.4.1 each one is an equal row, with
  its name, its delta, its trend and its bar on the same scale), what shows on the top line (trend,
  predicted lap, reference) and, in the times row (hidden by default), your last, your best, your
  optimal and your personal best in the order you want. The time the delta compares with is
  underlined and marked “Δ” (also with the fallback reference); the class ones are not a lap of
  yours and mark none.
- Only clean laps driven by you count (no pits, off-tracks, stops or yellows). The lap in progress
  is marked invalid as soon as it stops counting; the out lap says `out lap` and the tow `tow`. With
  no lap in progress (grid, before crossing the line) it says nothing.
- After your checkered flag the last lap stays. Outside a race too: the lap started with the flag
  out or with no laps left (the cool-down lap) is not timed.
- The record is written a few seconds after crossing the line, when the official time arrives,
  atomically and without slowing the loop. If the file is damaged, a `.bak` copy is kept.

### Alerts

- A band with what affects you: the most important in large and the rest below, in small, each
  alert with its words and its mark (it also reads with the colour-blind palette). A brief alert
  stays on screen at least `alerts.holdS` seconds.
- Extras (`alerts.parts`): “what to do” after each alert and the other alerts as chips.
- Each case is turned on or off in Settings › Alerts; all come on:
  - **Flags**, yours and the session's, including the **furled black**
    (`WARNING · from race control`, with no reason: it does not come in the data). Only inside the
    car. The green and the checkered count from when they come out (3 and 10 s, or “Keep visible” if
    longer): iRacing leaves the checkered up until the session changes. The furled black after your
    flag does not show.
  - **Limiter** on pit road: on, `LIMITER OFF` and over the YAML limit (`TrackPitSpeedLimit`) with
    or without it: `SPEEDING 68 / 60 · LIMITER OFF`. It is not read during the tow nor for the 2 s
    after appearing in your stall (the limiter arrives a moment later).
  - **Before the pit entry**: `LIMITER OFF` when moving from the track to the pit area
    (`PlayerTrackSurface`) without the limiter. That area also covers pit road and the exit, so it
    goes quiet as soon as you reach pit road and does not come back on the way out.
  - **10 and 5 laps** to the end of the race (`5 TO GO`), for a few seconds and only once each:
    with `SessionLapsRemainEx` (your laps, one fewer if you have been lapped) and, in timed races,
    with the same estimate as the standings.
  - **Tow** with a countdown until you can leave your stall (`PlayerCarTowTime`), first of all; the
    repair (meatball) goes beside it and, in your stall, without “pit for repairs”. **Engine
    stalled** (only inside the car) and **wrong way**: your `LapDistPct` goes backwards while you
    move forward in gear; reverse gear, pit road and the start/finish crossing do not count.
  - **Incidents**: `+2x Loss of control · L5 · S3 · gravel` when points are added (see Incidents).
  - **Engine**, only the critical (each with its option): **engine stalled**, **oil pressure**
    (`OIL PRESSURE · low`) and **damage**: `DAMAGE · pit for mandatory repairs` while it is pending,
    until the repair flag comes out. Temperatures, their trend, fuel and optional repairs are in
    **Warning lights**, with the same rules.
  - **Fuel** (see Fuel): `BOX THIS LAP` goes right after oil pressure and does not wait for a flag;
    `FUEL · 1.6 LAPS`, after the yellow and blue flags, which do not drop to a chip because of it.
    Neither during the tow nor on pit road.
- In a `settings.json` from before Warning lights, “Engine warning lights” becomes “Oil pressure”,
  and what Alerts had off stays off in Warning lights: “Engine warning lights” (oil and fuel
  pressures, water and oil), “Damage” (both repairs), “Engine stalled” and “Rising temperature”.
- In mock mode each case shows at least once: between minutes 15 and 22 of the session; the
  limiter, at your stop, and the 10 and 5 laps, when they are due.

### Inputs

- Trace, bars and data (gear, speed, steering) in the order you want, each with its eye
  (`inputs.sections`, `inputs.bars`, `inputs.info`); brake and throttle always.
- Automatic height by default (Window and visibility → Height): the panel is as tall as its content,
  with no empty space, and the text follows the widget's scale, not the window. A `settings.json`
  from before switches to automatic height once.
- Shift lights (`inputs.shiftLights`): a strip of 10 LEDs at the top, green → yellow → red from
  `DriverCarSLFirstRPM` to `DriverCarSLLastRPM` in the YAML; from `SLShiftRPM` they all light red
  and from `SLBlinkRPM` they flash. A car with no lights in the YAML takes them from its
  `DriverCarRedLine`.
- “Car” block (`inputs.sections` → `car`, rows in `inputs.car`): RPM, brake bias (`BB`,
  `dcBrakeBias`), TC (the `dcTractionControl` level: the SDK does not say when it acts) and FFB (the
  % of `SteeringWheelPctTorque`; red for a moment when it reaches 100 %, the clipping). A row with
  no data in that car (no bias or no TC) does not show.
- Steering (`inputs.steeringStyle`): bar, minimal (thin rim), realistic (GT with spokes) or formula
  (rectangular with grips), drawn in SVG and turning with `SteeringWheelAngle` by the real degrees,
  up to the car's lock (`SteeringWheelAngleMax`). Small, medium or large size (`inputs.wheelSize`),
  mark color (`inputs.wheelColor`: the Appearance accent, `accent`, or a custom one) and optional
  degrees below (`inputs.steeringDegrees`). A large wheel makes the panel a little taller.
- A `settings.json` from before looks the same: the previous wheel becomes “realistic” and the
  lights and the “Car” block arrive off. In a new install they are on.
- Mock: revs per gear (the lights fill in each gear and flash just before shifting up), bias 54.5 →
  54.0 → 53.5, TC 4 → 3 and clipping in the fastest corners.

### Warning lights

- The engine warning lights as on a dashboard, in a row (if they do not fit, they continue below) or
  in a column: oil pressure, fuel pressure, engine stalled, mandatory repairs, optional repairs,
  water and oil temperature and, if you turn them on, pit limiter and rev limiter. Small by default,
  visible in every session, under the Delta.
- Grey when off; when lit, each severity with its colour and its shape (it reads without the
  colour): red filled (act now), orange with a border (the car's own light, minor damage), yellow
  underlined (water or oil well above your average, before its light: `+6°`) and blue with a bar
  (limiter).
- Options (`lights.*`): each light and its order (`lights.icons`), in a column the texts to the left
  or right of the icons (`lights.labelSide`), `Lit only` (it hides while none is lit), captions
  (`WATER`, `REPAIR`…), the temperature next to water and oil (`98°`) and the repair time:
  `REPAIR · 42 s` (`PitRepairLeft`), `OPT. · 38 s` (`PitOptRepairLeft`), only if it is greater than
  zero. Its Settings page has a legend: what each light is and what to do.
- Repair time: iRacing's figure is the **crew's** time, which in a real stop dropped ~1 s every
  several seconds (OverLap shows it in ≤ 100 ms). That is why it shows marked `42 s (crew)`
  (`42 s crew` in narrow windows; `lights.repairCrewTag`, on). With `lights.repairCrewTag` off it
  goes back to `42 s`; a settings file from before the mark leaves it off, so it reads the same
  after updating.
- `Real countdown (estimated)` (`lights.repairRealTime`, **off** by default): stopped in your stall
  with the service running (`PitstopActive`), it measures how much the figure drops over the last
  3 s (at least 2 s in a row dropping) and shows the real seconds left, figure / rate, often more
  than the crew's: `42 s (crew)` can be `≈ 95 s (real)`. A pause (1 s without dropping) freezes the
  estimate; it never rises nor goes below 0. Until it knows, towed, out of the stall or in a replay,
  the crew's shows. If the figure only drops in steps of more than 1 s, there is no estimate
  (`src/shared/notices/repairClock.ts`).
- Still to be confirmed with a real recording of a stop with damage: whether `PitRepairLeft` drops
  smoothly or in steps (and how often), whether `PitstopActive` is active during the whole repair,
  whether the rate is constant with fuel and tyres at the same time, what happens with the fast
  repair and whether the tow time already includes the repair. Alerts does not show the time (its
  `DAMAGE` shows outside the stall).
- The rules are the Alerts ones, in a single place (`src/shared/notices/engine.ts`): nothing during
  the tow, in your stall, with the car out of the world, for the 2 s after reappearing or the 3 s
  after getting in the car (there they flash with the car stopped); the pressures, only with the
  engine running (above 5 m/s or at 80 % of idle, `DriverCarIdleRPM`) and not stalled. The repairs
  stay lit in the stall and during the tow: that is where they are done. A light that flickers stays
  on for 1 s.
- The trend: water or oil 20 s above your average of clean laps in the session; only laps within
  1 °C of the previous one count, and the average starts from zero after a tow or a jump of more
  than 5 °C (a repair). With captions it says `slipstream?` if you were right behind another car.
  `WaterTemp` and `OilTemp` depend on the car: if it does not have them, there is no trend or
  temperature.
- In a `settings.json` from before this widget, Warning lights starts **visible** in a free spot
  near its place (hidden if there is none): it takes over what used to show in Alerts. It starts
  hidden if Alerts was hidden or had everything it took over turned off (“Engine warning lights”,
  “Damage” and “Rising temperature”): none of that showed on screen.
- In mock mode each light comes on at least once between minutes 15 and 22 (the repairs with 42 and
  38 s), and the limiter at your stop.

### Incidents

- **Counter**: the “Incidents” item of the data bars (Relative, Standings, Battle, Traffic and
  Fuel), by default only in the Standings header, in any session type: `3x`
  (`PlayerCarMyIncidentCount`), in team races also the team's (`3x · team 7x`), and the session's
  next limit if there is one (`11x · pen. at 17x`, `DQ at 25x`). It turns orange at 4x or less from
  the limit. The old `relative.showIncidents` and `standings.headerIncidents` are migrated to that
  item.
- **“+Nx” alert** in Alerts, at least 6 s (or “Keep visible” if longer):
  `+2x Loss of control · L5 · S3 · gravel`. The type comes from `PlayerIncidents`, the lap and the
  sector from the race model and the surface from `PlayerTrackSurfaceMaterial`. Increases less than
  2 s apart are a single incident (iRacing can go up 2x to 4x); with several reports the most severe
  wins (car contact, wall contact, loss of control, off track, light contact): the penalty byte is
  not the points. If `PlayerIncidents` says nothing, only `+2x` and where it was. Option
  `alerts.showIncidents`.
- Nothing is counted during a replay, on connecting or on a session change (iRacing starts each
  session from zero).
- YAML limits: `IncidentLimit` is read as the DQ and `IncidentWarningInitialLimit` /
  `IncidentWarningSubsequentLimit` as penalties; with “unlimited” no limit is shown. Still to be
  confirmed in an official race.
- Only yours: iRacing does not give the other drivers' incidents.

### Track conditions (info bars)

- No longer a separate widget or a fixed line: track, water, wind, air and rubber are items of the
  info bars, which go in the header or footer of the Relative, Standings, Battle, Traffic or Fuel
  (Settings › Customise; `*.headerBar`, `*.footerBar`). By default the footer is **visible in
  Standings**, which grows by one line, and **hidden in the Relative**, where it would take height
  from the rows; in a new install it shows track, water and wind (air and rubber, hidden in its
  list). The track arrow and the wind dial are turned on in their item's row, in any bar
  (`conditionsTrend`, `conditionsWindDirection`).
- The data (iRacing gives no forecast):
  - track temperature (`TrackTempCrew`, in whole degrees: it moves in 1 °F steps) with an arrow if
    it rises or falls over the last 5 min (not counting the first 10 s of each session);
  - water, only if there is some: **DECLARED WET** (`WeatherDeclaredWet`), the `TrackWetness` gauge
    from “Mostly dry” and the rain (`Precipitation`) from 1 %;
  - the mean wind of the last minute, with a dial pointing at your car from where it blows
    (`WindDir` − `YawNorth`, only at the wheel); with no direction (calm, out of the car) or with
    the dial off, with its caption: `WIND 14 km/h`;
  - the air (`AirTemp`) and the rubber at the start of the session (`SessionTrackRubberState`; a
    “carry over” shows the last real state: “Moderately high (carried over)”).
- In a narrow bar items are removed whole, the least important first (rubber), and the gauge swaps
  its word for a short caption (`WET`); a text is never cut. Degrees and speed according to
  `appearance.units`.
- It is computed once per second and only if some bar shows it; the tables carry it in their data
  and the footer is only redrawn when what it shows changes.
- Confirmed in a race: `WindDir` is where the wind comes from and `YawNorth` turns clockwise. Still
  to be confirmed: the scale of `Precipitation` (read as 0..1; `src/shared/conditions.ts`).
- A `settings.json` with the old Conditions widget loads without it: its position and options are
  dropped, and everything else stays the same.
- In mock mode the track warms up, holds steady and cools down, the wind shifts a little and at
  21 min a shower passes that wets it and declares it wet.

### Fuel

- For long races; by default in practice (where usage is measured) and in races. In large, the
  liters (`FuelLevel`) and the laps they give you (green if you reach the flag, red with fewer than
  2 and not reaching it) and, on the right, the laps left (the race model's: in timed races, at the
  leader's pace).
- Usage is measured at each line crossing, only on clean laps: no pit road, yellow, tow, reset or
  off-track, not the first lap of the race, nor the ones you do not drive. Average of the last
  `fuel.avgLaps` (5), the last one and the thirstiest; “measuring…” until the first. Between
  sessions with the same car and circuit (practice → race) the previous average is used until there
  is one of its own.
- Optional header and footer (`fuel.headerBar`, `fuel.footerBar`, hidden by default): data bars like
  those of the Relative and Standings (name, time, session…; without the laps of fuel, which the
  main line already says), in small, normal or large size.
- Lines, each with its eye and in the order you want (`fuel.lines`; the main one always): tank (bar
  with a mark at what you need), use, to finish and add (with `fuel.marginLaps` laps of margin, 0.5;
  `FULL` if one stop is not enough) next to what you have in the pit menu (`PitSvFuel`, orange if it
  is not enough), window `L24–L28` and stops, saving per lap to drop a stop (if it is 10 % or less),
  the last tyre reading and the fast repairs and sets left if the session limits them (these two,
  `tyres` and `limits`, hidden in a new install).
- The plan counts stops at the end of a lap (the last one, on the second-to-last lap) and stints of
  whole laps, and starts from the fuel the lap began with: it does not wobble within the lap. On the
  last lap there is no stop any more: it only says whether you make it (`SPARE`) or not (`SHORT`).
  From the grid or pit road, the stretch to the line is not a lap (as in the race model): the first
  possible stop is at the end of L1.
- Capacity: `DriverCarFuelMaxLtr` times the lower of `DriverCarMaxFuelPct` and `CarClassMaxFuelPct`
  (the BoP). Always liters.
- Tyres: iRacing only measures wear (`LFwearL`… `RRwearR`) with the car stopped in your stall, so on
  track there is no live wear; the reading from the last stop is shown (what is left of the most
  worn band of each wheel) and the lap.
- In Alerts, two more (on by default): `BOX THIS LAP` when, in a race, the window closes on this lap
  and `FUEL · 1.6 LAPS` with fewer than 2 laps of fuel, both only if at your average you do not
  reach the flag (a stop that only the margin asks for is not an alarm). They use the same usage;
  neither on pit road nor in a replay.
- In a `settings.json` from before this widget, Fuel starts **hidden** and in a free spot near its
  default place, so as not to cover what you had already placed.
- Not confirmed in a real session: the scale of the capacity and wear `%`, whether `FuelLevel`
  follows the car with a teammate at the wheel and exactly when wear is updated in the stall
  (`src/shared/fuel/`).
- In mock mode the car burns ~2.95 L per lap with an 85 L tank, just makes it to its stop (both
  alerts show before), adds 20 L, changes tyres and finishes with margin.

## Architecture

```
 iRacing SDK (shared memory, read-only)                controllers (Raw Input, read-only)
        |                                                      |
        v                                                      v
 +--------------------------------------+   +--------------------------------+
 | telemetry utilityProcess             |   | input utilityProcess           |
 |  TelemetrySource: IRacingSource      |   |  src/input (only while some    |
 |                   MockSource         |   |  shortcut is a button)         |
 |  ~60 Hz loop -> PROVIDERS (shared)   |   +--------------------------------+
 +--------------------------------------+            |  pressed buttons
        |  status / data / log      ^  config / shutdown
        v                           |                v
 +-------------------------------------------------------------+
 | main (Electron)                                    src/main |
 |  where each widget is, which window hosts it, mouse,        |
 |  state, tray, shortcuts, settings                           |
 +-------------------------------------------------------------+
        |  IPC: each payload only to the window hosting its widget
        +------------------------------+------------------------+
        v                              v                        v
 [ ?view=overlay  display 1 ]   [ ?view=overlay  display 2 ]   [ ?view=osd ]   src/renderer (Vue)
   relative, radar, ...           standings, ...                 notice of a     + src/preload
   (one panel per widget)                                        shortcut
```

A single window per display: Chromium presents roughly one window per refresh, so eleven windows
updating at the same time (one per widget) share the ~60 fps (about 5 fps each); in a single
document all the panels run at the refresh rate.

- **Telemetry** (`src/telemetry`, a `utilityProcess`): a ~60 Hz loop that yields the event loop with
  `setImmediate`. It reads only the variables in `TELEMETRY_VARS` (`src/shared/telemetry.ts`) with
  `getTelemetryVariable`, reparses the session YAML only when `getSessionVersionNum` changes and
  computes each payload with the providers in `src/shared/providers.ts`, each at its widget's rate.
  It only computes the active widgets main tells it about (`TelemetryConfig`).
- **Main** (`src/main`): decides where each widget is (screen coordinates in DIP, the ones in
  `settings.json`), which display it belongs to (the one containing its centre; if its monitor is
  not there, it falls on the primary one without saving that change) and which window hosts it
  (`overlayWindows.ts`, `overlayWindow.ts`, pure rules in `overlayLayout.ts`). Each window covers
  its display, is transparent, does not take focus (`focusable: false`, only `showInactive()`), is
  always on top and lets clicks through. Main forwards each payload only to the window hosting its
  widget, decides when a window takes the mouse (`mouseMode.ts`), saves what the renderer confirms
  and hides the window as soon as its surface may be wrong (renderer crash or hang, GPU loss,
  sleep, display change) until it recovers it.
- **Renderer** (`src/renderer`): the same Vue app with `?view=overlay` (the overlay windows),
  `?view=settings` (Settings) or `?view=osd` (the notice over the game when you use a shortcut,
  `src/main/osdWindow.ts`: transparent, no focus and no mouse; turned off with
  `settingsWindow.shortcutToasts`). In the overlay, `overlay/OverlayApp.vue` draws one absolutely
  positioned panel per widget (`WidgetSlot.vue`, `contain: strict`), fits the auto-height ones to
  their content and handles the edit mode interactions (`EditFrame.vue`, `dragSession.ts`); what
  they change goes back to main as `BoundsCommit`. Typed preload with `contextBridge`
  (`window.overlay`, type `OverlayApi`) and sandbox.
- **Pure logic** in `src/shared`: no Electron, Node or DOM, and with tests.

IPC channels (`src/shared/ipc.ts`):

| Channel                    | Direction        | Content                                                                        |
| -------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `overlay:init`             | renderer -> main | returns `InitialState` (invoke), with the `OverlayLayout`                      |
| `overlay:layout`           | main -> overlay  | `OverlayLayout`: which widgets the window hosts and where                      |
| `overlay:data`             | main -> overlay  | `WidgetDataMessage`, only for the widgets it hosts                             |
| `overlay:auto-hidden`      | main -> overlay  | `AutoHiddenMessage` (a rule hides or shows one)                                |
| `overlay:status`           | main -> renderer | `OverlayStatus`                                                                |
| `overlay:edit-mode`        | main -> renderer | `boolean`                                                                      |
| `overlay:settings`         | main -> renderer | `OverlaySettings` on change                                                    |
| `overlay:commit-bounds`    | overlay -> main  | `BoundsCommit` (drag, wheel, fitted height, drop on another display)           |
| `overlay:scale-step`       | overlay -> main  | `ScaleStepMessage` (wheel over an auto-height widget)                          |
| `overlay:drag-state`       | overlay -> main  | `DragStateMessage` (a drag is in progress)                                     |
| `overlay:widget-toggle`    | overlay -> main  | `WidgetToggleMessage`: the eye or the lock of an edit mode label               |
| `overlay:edit-chips`       | overlay -> main  | `EditChipsMessage`: where its labels are (edit mode)                           |
| `overlay:open-widget-page` | overlay -> main  | `OpenWidgetPageMessage`: the ⚙ of a label                                      |
| `overlay:cursor-hidden`    | main -> overlay  | `boolean`: the game hides the cursor while you edit                            |
| `overlay:edit-focus`       | main -> overlay  | `WidgetId`: edit mode was entered with “Edit position” from its page           |
| `overlay:update-settings`  | Settings -> main | validated `SettingsPatch` (invoke)                                             |
| `overlay:command`          | Settings -> main | `SettingsCommand` (`src/shared/ipc.ts`): edit mode, shortcuts, reset, …        |
| `overlay:personal-bests`   | main -> Settings | `PersonalBestList`                                                             |
| `overlay:overlay-hidden`   | main -> Settings | `boolean`: the overlay is hidden                                               |
| `overlay:shortcut-status`  | main -> Settings | `ShortcutStatusReport`: shortcut registered, disabled or in use by another app |
| `overlay:shortcut-used`    | main -> Settings | `UsedShortcut`: a shortcut was used (“Pressed 3 s ago”)                        |
| `overlay:controller-press` | main -> Settings | `ControllerPress`: a controller button while a shortcut is being recorded      |
| `overlay:current-car`      | main -> Settings | `CarRef \| null`: the car you are in (layout links)                            |
| `overlay:session-classes`  | main -> Settings | `string[]`: the classes of the multiclass session                              |
| `overlay:layout-notice`    | main -> Settings | `LayoutNotice`: how an export, an import or “Bring every widget…” went         |
| `overlay:settings-page`    | main -> Settings | `SettingsWindowPage`: open this page (the tray's “More…”)                      |
| `overlay:save-failing`     | main -> Settings | `boolean`: settings stopped being saved (or are being saved again)             |
| `overlay:osd`              | main -> notice   | `OsdMessage`: the notice over the game when you use a shortcut                 |

## Anti-cheat

The app never touches the game process: it only reads the iRacing SDK memory map (in the telemetry
`utilityProcess`; opened with `FILE_MAP_READ`, both by irsdk-node and by the session text reader)
and draws its own windows, transparent, which do not take focus and let clicks through, on top of
the game. **Only in edit mode**, Electron's mouse forwarding
(`setIgnoreMouseEvents(true, { forward: true })`, for the hover highlights) installs a low-level
mouse hook (`WH_MOUSE_LL`) in this process: it observes mouse movements, never injects input, and
is removed when you leave edit mode. `FORWARD_IN_EDIT = false` (`src/main/mouseMode.ts`) removes it
entirely, losing nothing but those highlights. The only normal window, which does take focus, is
Settings, and only when you open it. Keyboard shortcuts are Windows `RegisterHotKey` (through
Electron's `globalShortcut`): Windows tells the app when the combination is pressed; there are no
keyboard hooks and nothing reaches the game.

Shortcuts on a controller button (wheel, button box, pedals) are read in another `utilityProcess`
(`src/input`, started by `src/main/inputHost.ts` only while some shortcut is a button or the
shortcuts page is recording one) with **Raw Input**: a message-only window in that process registers
for the joystick, gamepad and multi-axis usages (`RIDEV_INPUTSINK | RIDEV_DEVNOTIFY`) and Windows
gives it its own copy of each HID report, which `hid.dll` (`HidP_GetUsages`) translates into pressed
buttons. It is passive, shared reading: nothing is acquired exclusively, there are no hooks, no
handle to another process, nothing is written to the device and there is no force feedback; the
device is only opened, with no access rights, to read its name (`HidD_GetProductString`). iRacing
(DirectInput) still receives everything. See `src/input/rawInput.ts`.

## How to add a new widget

1. **Registry**: add the entry to `WIDGET_DEFS` (`src/shared/widgets.ts`) with `id`, `hz`,
   `defaultBounds`, `minSize`, `defaultVisible`, `sizeModel` (`'auto-height'` or `'free'`) and
   `defaultShowIn`, and the flags that apply to it (`followsCamera`, `keepsLiveInReplay`,
   `defaultOnSessionScreen`, `inCarOnly`, `noSessionScreen`, `showsInPits`). Put it in one of the
   groups of `WIDGET_GROUPS` (the same file; `widgets.test.ts` checks that each widget is in one)
   and its name in `widgetTitles` for each language (`src/shared/i18n/messages/core.ts`);
   `WIDGET_DEFS` carries no text.
2. **Payload type**: add it to `WidgetPayloads` (`src/shared/types.ts`) with the same key as the
   `id`. `WidgetDataMessage` is derived automatically.
3. **Variables**: if you need new variables, add them to `TELEMETRY_VARS`
   (`src/shared/telemetry.ts`; the names are checked against irsdk-node's types, so a typo does not
   compile) and to the mock (`src/telemetry/mock/simulation.ts`) so you can develop it without
   iRacing (the tests' `makeFrame` start from `TELEMETRY_VAR_NAMES` and need no changes). Variables
   specific to each car (`dcBrakeBias`, `dcABS`…) do not exist in all of them: the real source only
   requests the ones present in the session and the rest arrive as an empty array, so the provider
   must treat them as "no data".
   - If you need new data from the session YAML, add it to `SessionMeta` (`src/shared/types.ts`),
     to `parseSessionMeta` and `EMPTY_SESSION` (`src/shared/session.ts`, with its test) and to the
     mock's `buildSessionInfo()` (`src/telemetry/mock/sessionInfo.ts`).
4. **Computation**: a pure function in `src/shared/<widget>.ts` with its tests (`<widget>.test.ts`
   next to it), registered in `PROVIDERS` (`src/shared/providers.ts`). It receives `{ frame,
session, config, race, bests }` (`ProviderContext`: `race` is the `RaceModel` view and `bests`,
   the personal bests) and the previous payload (`prev`) in case you need smoothing.
5. **View**: a component in `src/renderer/src/widgets/<widget>/<Name>Widget.vue` that uses
   `useWidgetData('<id>')`, registered in `src/renderer/src/widgets/index.ts`. No text goes in the
   code: all of it comes from `useI18n()`, from the dictionaries in `src/shared/i18n/messages/` (the
   Spanish one is the reference and the English one must have the same keys, or it does not
   compile). Payloads carry codes, never sentences.
6. **Options** (if it has any): declare them in `OPTION_SCHEMA` (`src/shared/settingsSchema.ts`),
   where the defaults and limits come from; add its section to `OverlaySettings` and
   `TelemetryConfig` (`types.ts`), to `createDefaultSettings` (`src/shared/settings/defaults.ts`)
   and to `src/shared/settings/config.ts` (what reaches the telemetry process), and a migration in
   `src/shared/settings/migrate.ts` if something changes for an older file. If you want to change
   them from the tray, to `src/main/tray.ts`.
7. **Settings**: its page in `WIDGET_OPTIONS` (`src/renderer/src/settings/options/index.ts`), its
   icon in `NAV_ICONS` (`src/renderer/src/settings/layout/navIcons.ts`; without it, it does not
   compile), a sample for the preview (`src/renderer/src/settings/samples/`) and its `toggle<Name>`
   shortcut (“More actions”: `shortcuts` in `settingsSchema.ts` and `WIDGET_SHORTCUT_ACTIONS` in
   `src/shared/shortcuts.ts`).

Main, the tray, the Settings sidebar and the telemetry process pick up the widget from
`WIDGET_DEFS` and `WIDGET_GROUPS` (windows, visibility, rules, menu); steps 6 and 7 are not
automatic.

Tips:

- `useWidgetData` returns a `shallowRef`: each message is a new object and is replaced whole.
  **Never mutate payloads**; the provider returns a new object on every frame.
- If the widget spends a long time with nothing to draw, add a rule to `SKIP_EMIT`
  (`src/shared/providers.ts`) so repeated payloads are not sent (the hidden radar sends nothing).
- No infinite animations, SVG/CSS filters or large shadows in what repaints at 60 Hz: the windows
  are transparent and every repaint costs GPU while you race.
- Use the CSS variables in `src/renderer/src/styles/theme.css` for colours and typography.

## Notes and limitations

- irsdk-node's `autoEnableTelemetry` is not turned on: that broadcast starts `.ibt` recording to
  disk and the live data does not need it.
- Out of scope for now: tyre temperatures, minimap and VR.
- **Names with accents**: iRacing writes the session YAML in Windows-1252 and `irsdk-node` reads it
  as UTF-8, so every accent arrived as `�`. The telemetry process reads that text itself from the
  SDK's shared memory, **read-only** like the SDK itself (`OpenFileMappingW` + `MapViewOfFile` with
  `FILE_MAP_READ`, through `koffi`; `src/telemetry/sessionString`), and decodes it correctly (if the
  text is valid UTF-8, as UTF-8). If `koffi` does not load or the read fails, it logs it once and
  falls back to the `irsdk-node` text.
- Characters that **do not exist in Windows-1252** (Cyrillic, Chinese, the Polish `ł`...) already
  arrive from iRacing as `?` and cannot be recovered: a name with no letter or digit shows as the
  team name, or if there is none either, as a dimmed “Driver #7”.
- If some driver's name breaks parsing of the session YAML, the app falls back to a tolerant parser.
- If a window shows a black background instead of a transparent one, it may be hardware
  acceleration (Electron issue #40515).
- **OBS**: there is no longer one window per widget. With window capture, pick "Display N · OverLap"
  ("Pantalla N · OverLap" in Spanish), which brings all the widgets on that display; or use display
  capture.
- With widgets on two or more displays there is one window per display, and those windows do share
  the refresh between them.

## Licence

OverLap is free software under the GNU GPL version 3 or later (`GPL-3.0-or-later`), © 2026 Jesús
Molano: see [LICENSE](../LICENSE) and “Licence and credits” in the
[README](../README.md#licence-and-credits). Dependencies and third-party material keep their
licences, which are collected in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

No licence headers are needed in each file. The existing attribution comments (`irating.ts`,
`safetyRating.ts`, `brandLogos.ts`, `flags.ts`) stay: the original MIT licences require them.
