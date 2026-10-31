# OverLap: what we can add with real iRacing data

> **Status as of 31-10-2026 (OverLap 2.4.1).** This report is kept as history: sentences such as
> "today OverLap shows nothing about damage" describe the app at the time.
>
> - **Done:** from the top 10, number 1 (incidents and the "+Nx" warning), 2 (the missing
>   warnings), 3 (best lap, stint, last stop, tyre and flags in Standings and Relative), 4 (engine
>   health: the Warning lights widget), 5 (hiding with the sim's UI, in the garage and in replays:
>   Visibility) and 6 (track conditions, as info bar items); number 8, in part (repair times in
>   Warning lights, "DAMAGE" in Alerts, fast repairs in Fuel). From the candidates: shift lights,
>   tyre sets left, precise fuel and a visual spotter (the Spotter widget).
> - **Pending, not built:** number 7 (track strip), 9 (rejoin helper), the pit helper, "If I pit
>   now", iRacing's official delta, iRacing's clean-lap average, kerb use, detecting stutters from
>   memory paging (the "Stutter" of the two extras), the rolling-start helper, "Repair or race
>   on?", "Where I beat him" (only Battle's sector row exists), incidents per corner, "Who's fading,
>   who's coming", smart hiding by the moment of the race (today there are only rules per session
>   type and in the pits) and the flag counter.
> - **Dropped or out of scope:** section 4, which is unchanged; and the map, both number 10
>   (learnt 2D map) and the exact map from your `.ibt` in section 1, out of scope for now (see
>   "Notes and limitations" in the [development notes](README.dev.md)).

Date: 25-10-2026. What this report is based on:

- I checked every idea against the SDK OverLap uses (irsdk-node 4.4.0 and iRacing's official headers).
- I used your real recording: MX-5 Cup at Okayama, an offline race against the AI.
- I went through about 20 competing tools and the 2026 r/iRacing threads.
- I did not connect to iRacing, did not start the app and did not touch the project.

**The first thing to know.** The rival is no longer RaceLab, it is **2026 native iRacing**. Since S3/S4 the sim comes with:

- a track map with 4 modes;
- a fuel calculator;
- an Incident Tracker;
- the Car Damage widget, which draws the damaged parts;
- the Pit Summary and a visual spotter.

So an overlay only earns its place if it **shows what the sim does not, or does it better**. And what people value most is what we already aim for: light, readable, free and with no account.

Effort:

- **S**: goes inside an existing widget and uses few new variables.
- **M**: a new widget, or a derived model on top of the RaceModel.
- **L**: a new subsystem (recording plus persistence, or a file reader).

---

## 1. Direct answers

### Damage: what we can really know

- **We cannot know which part is damaged** (wing, suspension, steering…). The SDK does not export it: only the native Car Damage widget has it.
- **There is real data for all of this:**

  | What                                      | Data                                                                                                                               |
  | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
  | Seconds of mandatory and optional repairs | `PitRepairLeft`, `PitOptRepairLeft`                                                                                                |
  | "Mandatory / optional repairs pending"    | Bits 0x80 / 0x100 of `EngineWarnings`. We already read that variable, but only use the limiter bit                                 |
  | Meatball flag                             | We already show it in Alerts                                                                                                       |
  | Fast repairs available and used           | `FastRepairAvailable` (255 = unlimited) and `FastRepairUsed`. Your session allows 1                                                |
  | Tow: seconds left                         | `PlayerCarTowTime`                                                                                                                 |
  | "Pits: cannot repair"                     | `PlayerCarPitSvStatus` = 105                                                                                                       |
  | Engine warnings                           | Water, oil pressure and fuel pressure, oil temperature and stall, plus the real temperatures (`WaterTemp`, `OilTemp`, `OilPress`…) |

- **Still to check in a session** (it is decisive): do the repair seconds show up **on track** right after the hit, or only in the box? If they only show up in the box, the box would say "mandatory repairs pending" with no seconds.
- **Today OverLap shows nothing about damage,** except the meatball.

### Warnings we are missing

| Warning                                      | Real data                                                      | Watch out                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Speeding with the limiter OFF**            | `OnPitRoad` + `Speed` + the limit from the YAML ("60.00 kph")  | Today it only says "OFF", even if you are doing 80                                                                                                                                                   |
| **Limiter before pit entry**                 | `PlayerTrackSurface` = 2 (pit zone)                            | In your recording that zone also covers the exit (you were doing 65–85 km/h with it active). Only warn when going from track to pit zone, and go quiet as soon as you have been through the pit lane |
| **Furled black flag** (warning, bit 0x80000) | `SessionFlags` / `CarIdxSessionFlags`                          | Already defined in the code but not shown. Neutral text: "WARNING"                                                                                                                                   |
| **10 / 5 laps to go**                        | `SessionLapsRemainEx`                                          | We have to work it out ourselves: iRacing probably never sets its own 10/5 bits                                                                                                                      |
| **Tow with countdown**                       | `PlayerCarTowTime`                                             | —                                                                                                                                                                                                    |
| **Engine stalled, water, oil, pressure**     | Bits 0x8, 0x1, 0x2, 0x4 and 0x40 of `EngineWarnings`           | Stall only with `IsOnTrack`. The MX-5 has anti-stall, so it will be rare                                                                                                                             |
| **Wrong way**                                | Derived from `LapDistPct`                                      | Ignore it when reversing and in the pit lane                                                                                                                                                         |
| **"+2x" incident**                           | See "Incidents"                                                | —                                                                                                                                                                                                    |
| Pits closed                                  | `PitsOpen`                                                     | Offline at Okayama (local cautions) it never fires                                                                                                                                                   |
| Wet track                                    | `WeatherDeclaredWet`, `TrackWetness`, `Precipitation`          | With your "classic" weather it never rains. Useful with realistic weather                                                                                                                            |
| Start lights and reaction time               | Start bits of `SessionFlags`                                   | Standing starts only. Yours are rolling (`StandingStart: 0`)                                                                                                                                         |
| Unstable connection                          | `ChanQuality`, `ChanLatency`                                   | Online only                                                                                                                                                                                          |
| Mandatory compound change pending            | YAML `SessionEnforceTireCompoundChange` + `PlayerTireCompound` | Only if the session requires it                                                                                                                                                                      |

The first five are cheap (S) and useful in all your races.

### A map like iRacing's: is it possible?

**Yes, but not with live coordinates, because they do not exist.** There is no X/Y for any car. `Lat`/`Lon` are only recorded in the `.ibt` file on disk, and only for your car.

There are three ways, from least to most effort:

1. **Track strip (from the very first second).** A line with each car placed by its lap %, plus the sectors and your box.
2. **2D map learnt from your own clean lap.**
   - Speed and heading (`Speed`, `YawNorth`) are integrated at 60 Hz.
   - The circuit is closed and the map is saved per track.
   - Each car is placed by its lap %.
   - This is what Slipstream, SimHub and Pitwall do.
3. **Exact map from your `.ibt`**, with the real latitude and longitude.
   - You have to record with Alt+L: in your `app.ini` automatic recording is turned off.
   - We would have to write a small reader of our own.

Limits:

- **You will never see two cars side by side**, because there is no lateral position.
- The orientation has to be validated once: with the sign flipped, the map comes out mirrored but closes perfectly.
- **We will not use iRacing's SVGs.** They are theirs, and the data API has not given new access since March 2026.

Note: the native one already has a map. Ours is only worth it if it draws what we already compute and the native one does not:

- hazards on track;
- your battle rival;
- where the faster class catches you;
- where you would rejoin if you pit now.

### Incidents: do we have them already?

**Halfway.** We read your counter (`PlayerCarMyIncidentCount`), but it only shows in the SR line of the Standings header, and only in **official ranked** races. That is why, in your AI race at Okayama, you reached **11x and OverLap showed nothing**.

What can be added right away (S):

- an always-visible counter;
- a "+Nx" warning with the incident **type**, read from `PlayerIncidents`, and on which lap and sector it happened:

  | Type            | Points |
  | --------------- | ------ |
  | Loss of control | 2x     |
  | Off track       | 1x     |
  | Wall contact    | 2x     |
  | Car contact     | 4x     |
  | Light contact   | 0x     |

- the **margin to the penalty or the DQ**, when the session has a limit. Your session was "unlimited", so there it would only say "11x".

**Rivals' incidents do not exist in the data.** All the AI showed 0, and the results table showed 0 even for you with 11x. The honest thing is to count their **off-tracks** as we measure them, labelled "off-tracks" and not "incidents".

### Number of infringements and penalties

- **iRacing gives no infringement counter, nor the penalty type** (drive-through, stop & go, seconds), nor the reason. It only gives **flag bits**, yours and each car's:

  | Flag                     | Bit      | Note                          |
  | ------------------------ | -------- | ----------------------------- |
  | Black                    | 0x10000  |                               |
  | DQ                       | 0x20000  |                               |
  | Furled black (warning)   | 0x80000  |                               |
  | Meatball                 | 0x100000 |                               |
  | "DQ for invalid scoring" | 0x200000 | Not yet defined in `flags.ts` |

- **Today:**
  - Your black, DQ and meatball flags show in Alerts.
  - Each car has a black or meatball badge in Standings.
- **Missing:**
  - the furled black flag warning;
  - the badges in the Relative too;
  - **counting them**.
- **What we can do:**
  - count ourselves how many times each flag fires in the session: "Warnings 2 · Blacks 1 · Meatball 1";
  - warn of the "penalty at Nx" from the incident limit. The exact format has to be confirmed in an official race.
- **To check online:** whether other drivers' flags are visible without being admin. Offline you are admin, so it is no proof there.

---

## 2. Recommended top 10 (from best value to least)

### 1. Always-visible incidents + "+Nx" warning (effort S)

- **What you see:**
  - a fixed `3x` chip;
  - when an incident is added, `+2x Loss of control · L5 · S3 · gravel`;
  - with a limit, `11x · penalty at 17x`.
- **Data:**
  - `PlayerCarMyIncidentCount`, and `PlayerCarTeamIncidentCount` in team races;
  - `PlayerIncidents` (type and points);
  - `PlayerTrackSurfaceMaterial` (grass, gravel, kerb);
  - from the YAML, `IncidentLimit`, `IncidentWarningInitialLimit` and `IncidentWarningSubsequentLimit`. They are text ("unlimited" or a number), and the last two are not typed.
- **Limits:**
  - iRacing can "upgrade" an incident (from 2x to 4x), so they have to be grouped over about 2 s.
  - Still to check whether `PlayerIncidents` is a pulse or stays set. If that fails, only "+Nx" is shown.
  - The limit is hidden if unlimited, and the counter resets when the session changes.
- **Who else has it:** the native Incident Tracker, Track Impulse and benofficial2.
- **How we would do it better:**
  - type + where + surface, in any session type;
  - it feeds the per-corner incident memory (section 3).

### 2. Pack of missing warnings (effort S)

- **What you see:** `SPEEDING 68/60 · LIMITER OFF`, `LIMITER` as you approach the entry, `WARNING (furled black)`, `5 TO GO`, `TOW 0:42`, `STALLED` and `WRONG WAY`.
- **Data:** `OnPitRoad`, `Speed`, `TrackPitSpeedLimit`, `PlayerTrackSurface`, `SessionFlags`/`CarIdxSessionFlags`, `SessionLapsRemainEx`, `PlayerCarTowTime`, `EngineWarnings`, `LapDistPct` and `Gear`.
- **Limits:**
  - The limiter warning only fires when going from track to pit zone, because that zone also covers the exit.
  - Still to confirm what the furled flag means exactly.
  - The 10/5 laps have to be worked out.
- **Who else has it:** RaceLab Digiflag, Fulcrum DigiFlags, Track Impulse Pro (with voice) and irDashies.
- **How we would do it better:** we already have the alerts strip with priorities, minimum time on screen and colour-blind mode. We only need to add cases.

### 3. Standings and Relative with what the native ones do not give (effort S)

- **What you see:**
  - the best lap in races too (today only the last one shows);
  - `stint 7 L` and `last stop L12`;
  - the compound `H` / `W`;
  - the black and meatball badges in the Relative too.
- **Data:**
  - `CarIdxBestLapTime`;
  - `stintLaps` and `lastPitLap` from the RaceModel, which **are already computed but not drawn**;
  - `CarIdxTireCompound` + YAML `DriverTires` (0 = Hard, 1 = Wet);
  - `CarIdxSessionFlags`.
- **Limits:**
  - The compound name is only known for your car model.
  - The number of stops is already shown.
- **Who else has it:** it is the **no. 1 request against the native one** on Reddit. iOverlay shows penalties and the last stop; benofficial2, the stint in the Relative; Garage 61, a stint panel (but on a second screen).
- **How we would do it better:** it comes almost for free because the RaceModel already computes it, and it is inside the overlay itself.

### 4. Engine health (effort S)

- **What you see:** `WATER` / `OIL` / `PRESSURE` icons, and `Water 98 °C ↑ +6 vs your average (slipstream?)`.
- **Data:** bits 0x1, 0x2, 0x4 and 0x40 of `EngineWarnings`, plus `WaterTemp`, `OilTemp`, `OilPress`, `FuelPress` and `Voltage`.
- **Limits:**
  - They are per-car variables: we have to check they exist on the MX-5.
  - The reference comes from your clean laps. Running in the slipstream raises the temperature without any damage.
- **Who else has it:** irDashies (Car Systems), Fulcrum (Systems), benofficial2's dash and the native Car Damage icons.
- **How we would do it better:** the trend is measured against your own reference, not only against the sim's red threshold.

### 5. Hide OverLap when you hide the sim's UI, open the garage or watch a replay (effort S)

- **What you see:** if you hide iRacing's UI or open the garage, the widgets disappear too. In a replay they follow the car you are watching.
- **Data:** `CamCameraState & 0x8` (UI hidden), `IsGarageVisible`, `IsReplayPlaying` and `CamCarIdx`.
- **Limits:** in a replay time goes backwards. The models have to ignore it and must not record incidents from the replay.
- **Who else has it:** the native one has a minimal UI mode, but it is manual. irDashies only switches by session type.
- **How we would do it better:** it is cheap and tackles the "too much on screen" complaint.

### 6. Track conditions (effort S)

- **What you see:**
  - `Track 34 °C ↑ · Air 22 °C · Wind 10 km/h headwind on the straight · Moderate rubber`;
  - with rain, `Wet 3/7 · Rain 40 % · DECLARED WET`.
- **Data:**
  - `TrackTempCrew`, `AirTemp`, `WindVel`;
  - `WindDir` (minus `YawNorth` so it is relative to your car);
  - `TrackWetness`, `Precipitation`, `WeatherDeclaredWet` and `Skies`;
  - YAML `SessionTrackRubberState`.
- **Limits:**
  - **There is no forecast.**
  - Still to check whether the wind gives where it comes from or where it is going.
  - With classic weather it never rains.
  - If `TrackWetness` = 0 means "unknown", we have to show "—" and not "dry".
- **Who else has it:** the native weather widget (which only turns on with Alt+K inside the car), Edge, benofficial2 (with the rubber state), irDashies and Fulcrum Wind.
- **How we would do it better:** the wind relative to your car and the track temperature trend, inside the overlay.

### 7. Track strip (effort S–M)

- **What you see:** a line with every car by its lap %, the sectors and your box. On top: the hazards (stopped or off-track car), your battle rival highlighted and the faster class closing in.
- **Data:**
  - `CarIdxLapDistPct` (-1 = out of the world);
  - `SplitTimeInfo` (at Okayama: 0 / 0.26 / 0.51 / 0.69);
  - `DriverPitTrkPct` (your box is at 0.977);
  - `CarIdxTrackSurface` and the RaceModel.
- **Limits:**
  - The safety car (CarIdx 64, parked in the pit lane) has to be excluded except under caution.
  - At Okayama the pit lane crosses the finish line, so the % has to wrap around 0.
- **Who else has it:** Track Impulse.
- **How we would do it better:** it works from the very first second and it is the base of the 2D map.

### 8. Repair box (effort M)

- **What you see:**
  - `REPAIR mand. 14 s · opt. 38 s · FR 1/1`;
  - in the box, the countdown;
  - on leaving, `leaving with 20 s of optional unrepaired`;
  - `Pits: cannot repair`.
- **Data:**
  - `PitRepairLeft`, `PitOptRepairLeft` and bits 0x80/0x100 of `EngineWarnings`;
  - `FastRepairAvailable` and `FastRepairUsed`;
  - `PitstopActive`, `PlayerCarInPitStall`, `PlayerCarPitSvStatus` (105) and `PlayerCarTowTime`;
  - YAML `FastRepairsLimit`.
- **Limits:**
  - **We have to check whether the seconds show up on track.**
  - If they come out as 0 with the bit set, the box says "Mandatory repairs pending" with no seconds. It must never show "0 s".
  - With FR = 255 (unlimited) it shows "FR ∞" or nothing.
  - It does not say which part is damaged.
- **Who else has it:**
  - The native one shows where the damage is (Car Damage) and the stop summary (Pit Summary).
  - The native spotter reads out the repair times when you tow.
  - **No third-party tool has a clear repair box.**
- **How we would do it better:** it is the hottest topic of 2026 (threads of 195, 210 and 100 points about not understanding repairs). It is also the base of "Repair or race on?".

### 9. Rejoin helper (effort M)

- **What you see:** if you are off track or stopped, `WAIT · car 2.1 s away` or `CLEAR 6 s`, with the cars coming from behind.
- **Data:** `PlayerTrackSurface` / `CarIdxTrackSurface` (3 = on track), `CarIdxLapDistPct`, `CarIdxOnPitRoad`, the RaceModel pace and `Speed`.
- **Limits:**
  - There is no lateral position: the warning says "from behind", never "clear on the left".
  - `CarLeftRight` is no use here: in your recording it said "clear" in all 956 samples.
  - The safety car has to be excluded.
- **Who else has it:**
  - benofficial2 (Rejoin Helper), irDashies (Rejoin Indicator) and Fulcrum (Rejoin Assistant);
  - the native spotter, but only by voice and with the spotter's talkativeness at maximum.
- **How we would do it better:** it reuses the "from behind" logic of the Traffic widget. Dangerous rejoins are among the most upvoted complaints of the year.

### 10. 2D map learnt from your lap (effort L)

- **What you see:**
  - the circuit drawing with every car;
  - while recording, `recording map · 63 %`;
  - if the lap does not close, `lap discarded, keep driving`;
  - on top, what the native one does not draw: hazards, rival and where you would rejoin if you pit.
- **Data:**
  - `Speed`, `YawNorth`/`Yaw`, `LapDistPct` and `SessionTime`, on **every** 60 Hz tick;
  - from the YAML, `TrackID`, `TrackConfigName`, `TrackLength` (3.6547 km) and `TrackNorthOffset`;
  - as an exact alternative, the `.ibt`.
- **Limits:**
  - The orientation has to be validated once.
  - Only clean laps count, with no tow or jumps.
  - Two cars side by side show as a single dot.
- **Who else has it:**
  - the native one, with 4 modes;
  - RaceLab Pro, with the predicted pit exit;
  - iOverlay, with corner names (PRO);
  - irDashies, with iRacing's SVGs;
  - Slipstream, SimHub and Pitwall, with a learnt map.
- **How we would do it better:** with no iRacing material, and as a layer of what we already compute (traffic, battle, repairs, pit exit).

### Next candidates (outside the top 10)

| Idea                               | Effort             | Data / note                                                                                                            |
| ---------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Pit helper                         | M                  | Distance to your box, placement in the box (`PlayerCarPitSvStatus` 100–104) and traffic at the exit                    |
| "If I pit now"                     | M–L                | Position you would rejoin in. Only StintView, Crew Chief (by voice) and RaceLab Pro do it well                         |
| iRacing's official delta           | S                  | Against the session best or the optimal lap (`LapDeltaToSessionBestLap`, `…OptimalLap`). In qualifying, live "vs pole" |
| iRacing's clean-lap average        | S                  | `LapLastNLapTime`. Offline it seems inactive                                                                           |
| Shift lights                       | S                  | `PlayerCarSL*RPM` + `RPM`. On the MX-5, shift at 7200                                                                  |
| Tyre sets left                     | S                  | Only in series with a limit                                                                                            |
| Kerb use per corner                | S–M, to be checked | `Tire*_RumblePitch`                                                                                                    |
| Detect stutters from memory paging | S                  | `MemPageFaultSec` + `FrameRate`                                                                                        |
| Rolling-start and restart helper   | S–M                | `PaceMode`, `CarIdxPaceLine/Row`                                                                                       |
| Precise fuel                       | S–M                | Of little use in MX-5 sprints                                                                                          |

### Before building: a test session of yours (about 20 min offline)

1. **Hit the wall in practice with damage on.** Do `PitRepairLeft`/`PitOptRepairLeft` show up on track? Do bits 0x80/0x100 get set? Is `PlayerIncidents` a pulse or does it stay set? Does any incident get upgraded (2x → 4x)?
2. **Enter and leave the pits at Okayama.** Where does the pit zone start and end compared with the pit lane? Does it trigger if you drive past the entry without going in?
3. **Spin and tow.** The `PlayerCarTowTime` countdown.
4. **A straight and a tight corner.** Signs of the wheel and the heading, so the map does not come out mirrored.
5. **Online, in an official race.** The format of the incident limits, whether other drivers' flags are visible, and the rivals' `CarIdxFastRepairsUsed`.

### Technical traps found (for whoever implements it)

- **Check variables with `index >= 0`, never `!== null`.** A variable that does not exist returns -1, and reading it brings the process down. Also, irsdk-node crashes too if you ask by name for a variable the car does not have.
- **Bits arrive as signed Int32.** The start bit (0x80000000) makes `SessionFlags` negative. Normalise with `>>> 0` before comparing.
- **The YAML comes in Latin-1** (`Encoding: ISO_8859_1`). If it is decoded as UTF-8, names with ñ or accents come out broken online.
- **The safety car (CarIdx 64) is in the arrays,** parked in the pit lane. It has to be excluded from traffic, rejoins and pit times.
- **Do not use `CarClassEstLapTime` as a fallback pace.** It said 99.6 s and the real average was 112.7 s, a 13 % error. Better to show "measuring…".
- **Some variables are not needed:** `PitRepairNeeded`/`PitOptRepairNeeded` are not in the types, and the `EngineWarnings` bits already say the same.
- **Do not show iR/SR deltas when `Official` = 0.** And offline `SubSessionID` = 0: to store histories, use `SessionUniqueID` plus the start time.

---

## 3. What nobody does well (differentiating ideas)

### "Repair or race on?" (effort M–L; needs the repair box)

- **What you see:** `Damage: −0.9 s/lap (S3 +0.6) · top speed −4 km/h · wheel off-centre 3.5° → 9 laps left, you lose ~8 s · stopping costs 38 s → RACE ON`.
- **How it is worked out:**
  - pace per sector before and after the hit;
  - top speed on the longest straight, without a slipstream;
  - **wheel off-centre on the straight**, measured with `SteeringWheelAngle` when `YawRate` and `LatAccel` are close to zero, comparing the same stretches of track;
  - against the cost of stopping: repair seconds plus the time lost in the pit lane.
- **Why nobody has it:** the native one says where the damage is, but nobody says **how much it costs you** or whether the stop pays off. It would be shown with a confidence band.

### "Where I beat him" (effort M)

- **What you see:** `You beat him by 0.21 s in T5–T7 · he beats you by 0.15 s on the back straight`. And the same with the car behind: `beats you braking into T1`.
- **How it is worked out:** the RaceModel already times **every** car at 100 points per lap (about 36 m at Okayama). They are grouped into zones using the last 3 clean laps of both.
- **Why nobody has it:** in a one-make series like the MX-5 it decides where to set up the pass. Overtake prediction is the most voted item on RaceLab's roadmap, and it is unfinished.

### Per-corner incident memory across sessions (effort M)

- **What you see:** `Okayama T1 on L1: 3 of your last 5 incidents`, `T7: 2 off-tracks today in practice`.
- **Why nobody has it:** the native tracker forgets everything when the session ends, and Garage 61 stores laps, not incidents.

### "Who's fading, who's coming" (effort S–M)

- **What you see:** in Standings, a trend arrow per rival: `▲ −0.4 s/lap` or `▼ +0.3 s/lap`. If they also have a meatball or have used the fast repair, that explains the drop.
- **How it is worked out:** with the slope of their last 3 to 5 clean laps. In 12-lap sprints, it is hidden if there are fewer than 3.

### Smart hiding by the moment of the race (effort M)

- **What you see:** each widget shows only when it matters:
  - Standings, on a straight or under caution;
  - the pit helper, in the pit lane;
  - the repair box, only if there is damage.
- **It also saves CPU and GPU,** because in OverLap a hidden widget is not computed, and performance is the no. 1 complaint against overlays.
- **Why nobody has it:** the native one is manual, and irDashies only switches by session type.

### Two small extras

- **Flag counter per session:** "Warnings 2 · Blacks 1". It is the closest thing to a "number of infringements" the real data allows.
- **"Stutter: memory paging":** to tell whether the stutter comes from OverLap or from your PC.

---

## 4. Dropped and why

| Idea                                                     | Why not                                                                                         | What to do instead                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Car drawing with damage per part                         | The SDK does not export it                                                                      | Repair box and "Repair or race on?". To see where the damage is, the native widget                    |
| A "real" side radar, or two cars side by side on the map | There is no lateral position for the others. Only `CarLeftRight` (left/right, and only for you) | The current radar: side bars + longitudinal distance                                                  |
| Live tyre temperatures, wear and pressures               | They only update in the box. Hot pressures and surface temperature only exist on disk           | At most, a card after the stop with the YAML data (`LastHotPressure`, `LastTemps*`, `TreadRemaining`) |
| Rivals' incident points                                  | They are not in the data: AI at 0 and results at 0. Online, unverified                          | Count their off-tracks, labelled "off-tracks"                                                         |
| Penalty type, seconds or reason                          | There are only flag bits                                                                        | Per-car badges + furled black warning + flag counter                                                  |
| Weather forecast                                         | It does not exist in the SDK                                                                    | Temperature and wetness trends                                                                        |
| Map with live coordinates                                | `Lat`/`Lon` only in the `.ibt` on disk, and only for your car                                   | Map learnt from your lap, or read from the `.ibt`                                                     |
| Using iRacing's SVG maps                                 | They are iRacing's property and the API gives no new access                                     | Our own map                                                                                           |
| Setting fuel or repairs automatically                    | The SDK allows it, but OverLap is read-only by design                                           | Say it as text: "add 14 L", "tick FR"                                                                 |
| Rivals' pedals, fuel or tyres                            | There is only their gear, their RPM and their wheel                                             | Not needed                                                                                            |
| Voice spotter                                            | Crew Chief already does it well and for free                                                    | Visual warnings, maybe an optional beep                                                               |
| iR/SR in offline races                                   | `Official` = 0 and your offline iRating is 1                                                    | Show only in official races (as now)                                                                  |

---

## 5. Sources

**iRacing (native and release notes)**

- https://support.iracing.com/support/solutions/articles/31000179517-2026-season-4-initial-release-notes-2026-09-09-01-
- https://boxthislap.org/iracing-2026-season-3-release-notes/
- https://boxthislap.org/iracing-2026-season-2-release-notes/
- https://boxthislap.org/iracing-2025-season-4-release-notes/
- https://boxthislap.org/iracing-do-we-need-detailed-pit-repair-information/
- https://support.iracing.com/support/solutions/articles/31000170136-competition-spotter-and-crew-chief-messages
- https://www.explosion.com/game-guides/iracing-patch-notes/ (secondary source)

**Overlays**

- RaceLab:
  - https://racelab.app/
  - https://racelab.app/iracing
  - https://garage.racelab.app/news/2026/03/18/2026/trackmap-rewrite
  - https://roadmap.racelab.app/feedback
- iOverlay: https://ioverlay.app, https://ioverlay.app/help
- Kapps: https://kapps.kutu.ru/
- irDashies:
  - https://github.com/tariknz/irdashies
  - https://github.com/tariknz/irdashies/releases
  - https://raw.githubusercontent.com/tariknz/irdashies/main/src/app/services/incidentDetector.ts
- Edge Overlays: https://edgeoverlays.com
- Track Impulse: https://track-impulse.com/overlays
- KSR Overlays: https://kimbosimracing.com/en
- Slipstream: https://github.com/antonholovko-cloud/Slipstream
- Fulcrum Suite: https://github.com/fulcrumttv/Fulcrum-Suite
- StintView: https://www.reddit.com/r/iRacing/comments/1x5smsf/
- Pitwall: https://www.reddit.com/r/iRacing/comments/1t06sfs/
- GO Setups: https://support.gosetups.gg/hc/en-gb/articles/23224288679570-Free-vs-Paid-What-Is-Included-Without-a-Subscription

**SimHub**

- https://www.simhubdash.com/get-a-license/
- https://github.com/fixfactory/bo2-official-overlays (benofficial2)
- https://www.simhubdash.com/community-2/dashboard-templates/romainrobs-collection/
- https://danielnewmanracing.com/products/overlays

**Telemetry, spotter and live timing**

- Garage 61:
  - https://iracerhub.com/garage-61-now-has-live-timing-what-it-does-and-why-endurance-racers-should-know/
  - https://www.reddit.com/r/iRacing/comments/1szadi1/
- Crew Chief: https://mr_belowski.gitlab.io/CrewChiefV4/index.html
- Simulator Controller: https://github.com/SeriousOldMan/Simulator-Controller
- SDK Gaming: https://www.sdk-gaming.co.uk/article-categories/overlay-components/
- Track Titan: https://www.tracktitan.io/rto
- Trophi: https://www.trophi.ai/pricing
- Comparisons:
  - https://iracerhub.com/best-iracing-overlays-2026-2/
  - https://coachdaveacademy.com/tutorials/10-must-have-free-apps-for-iracing/

**r/iRacing threads** (read through the Arctic Shift archive)

- What the native one lacks:
  - https://www.reddit.com/r/iRacing/comments/1u3do88/
  - https://www.reddit.com/r/iRacing/comments/1xax78h/
  - https://www.reddit.com/r/iRacing/comments/1vjmj17/
- Damage and repairs:
  - https://www.reddit.com/r/iRacing/comments/1w14xqn/
  - https://www.reddit.com/r/iRacing/comments/1s7e9kw/
  - https://www.reddit.com/r/iRacing/comments/1shfz2z/
  - https://www.reddit.com/r/iRacing/comments/1uudru4/
- Rejoins:
  - https://www.reddit.com/r/iRacing/comments/1x6i2mh/
  - https://www.reddit.com/r/iRacing/comments/1swtbd4/
  - https://www.reddit.com/r/iRacing/comments/1u1412y/
- Radar without lateral data: https://www.reddit.com/r/iRacing/comments/1trfc53/
- Tyres (no live temperatures): https://www.reddit.com/r/iRacing/comments/1sroxqn/
- Penalties: https://www.reddit.com/r/iRacing/comments/1tbnri2/, https://www.reddit.com/r/iRacing/comments/1u2x4gp/
- Overlays and performance:
  - https://www.reddit.com/r/iRacing/comments/1x279xl/
  - https://www.reddit.com/r/iRacing/comments/1rltdrl/
  - https://www.reddit.com/r/iRacing/comments/1sixsq7/
  - https://www.reddit.com/r/iRacing/comments/1wt0rvr/
