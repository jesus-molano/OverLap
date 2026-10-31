# Changelog

All notable changes to OverLap are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Documentation in English**: README, changelog, development notes and project files are now in
  English; the Spanish guide is in [README.es.md](README.es.md).

## [2.4.1] - 2026-10-31

### Added

- **About and help › Licence**: a new block at the end of the page with the copyright, the fact
  that OverLap is free software under the GNU GPL version 3 or later, and that it comes with no
  warranty at all. Its buttons open the source code, the licence and the third-party notices in
  the browser. It also says that the colour make logos belong to their owners and are not under
  the GPL, and that the monochrome style uses Simple Icons (CC0) for 18 makes and draws the rest in
  greys from the colour ones; you pick it in Appearance › Rows and drivers › Logo colour.
- **Open project documentation**: the README starts with a summary in English and adds
  “Compilar desde el código”, “Code signing policy” (the `.exe` files are not signed yet) and
  “Apoyar OverLap”. New [PRIVACY.md](PRIVACY.md) (OverLap does not use the network; the future
  updater can be turned off), [CONTRIBUTING.md](CONTRIBUTING.md) (with DCO, no CLA) and
  [SECURITY.md](SECURITY.md), issue and pull request templates, and a CI with the five checks on
  Windows.

### Changed

- **Delta: with two references or more, an equal row for each one**: when you show more than one
  reference (the **Rows per reference**, formerly “Bars per reference”, plus the one the delta
  uses), the delta no longer shows one big number with small bars under it. Each reference has
  the same row: its name, its delta with ▼/▲, its trend (now one per reference) and its bar, all
  on the same scale (green on the left: faster) and in the order of your list, whichever one the
  delta uses. The line at the top names the reference the delta uses, with its time and the
  predicted lap; the sectors go with it. If the top line is not showing, the sectors start with
  that reference's short name, and in a narrow window the line names it just like its row
  (“Opt.”). An invalid lap, the out lap or the tow are always said on that line, even if you have
  hidden its parts. With a single reference (the default) the delta is the usual one, same as in
  2.4, also when you hover over the preview in Settings. When you turn rows on from the Delta page
  the window grows just enough not to shrink the text (also if a session uses a reference that is
  not in the list, or if you show a part of the top line again); in a shorter window the last
  rows go first (never the one for the reference in use, and the page says “No room”), then the
  top line, and with a single row the usual delta comes back. If, mid-session, the shortcut or the
  fallback reference brings one that is not in the list, its row takes the place of the last one
  instead of adding another, so the text does not change size. Your settings load as before; if
  you already had the bars on, you will see rows instead of thin bars.
- **OverLap becomes free software** under the GPL-3.0-or-later: `LICENSE` is now the text of the
  GPL, and `package.json`, the `.exe` properties, the README and the development notes say so.
- **Third-party notices**: Vue is added (it shipped inside the app and was missing), irating-rs
  now has its licence (MIT or Apache-2.0) and the logos section explains where each one comes from
  and that the colour ones are not under the GPL. The trademark note for the OverLap name and the
  “OL” icon is added (GPL §7(e)).

## [2.4.0] - 2026-10-31

### Added

- **Spotter, a new widget (the eleventh)**: two bars, one on each side, like iOverlay's, separate
  from the radar (each with its own page and visibility: you can have one, the other or both).
  **Bar style** picks what they tell. **Closeness** (the default): the radar in two bars; each
  one fills from the bottom the closer the car on that side is (full when alongside you, empty at
  about 12 m ahead or behind), from amber to red, and when full it is also marked with the red
  border. **Where it covers you**: each bar is your car, from nose (top) to tail (bottom), and it
  fills with how much of you the car on that side covers, from the end it is on, from grey to
  red, with a faint cap for the car that was just alongside you and is right ahead or behind. In
  both, a “2” with two cars on one side. The side comes from the iRacing spotter (only once the
  car is level with you) and the how much from the distance along the track (also across the
  finish line), with the same calculation as the radar, which keeps working with the radar
  hidden. iRacing does not give the lateral distance: full does not mean contact. The window
  width is the gap between the bars; in Content, **Bar style**, **Only with a car alongside**
  (the default) and **Bar thickness**; in Customise, its two marks. Hidden
  by default, also when updating (in a free spot near its place); it has its shortcut in “More
  actions”, its check box in the tray and its place in Visibility and in the search.
- **Delta: one bar per reference**: a new line, **Bars per reference** (off by default), draws a
  bar for each reference you pick, with its short name and its difference: your personal best,
  your session best, your optimal lap, your class fastest lap and your class optimal. It unfolds
  into its list, with an eye for each one and in the order you like (by default, your three).
  They all use the scale of the main bar and its colours (green on the left, faster; red on the
  right, slower), the one the delta uses is marked “Δ”, and each one compares with its own lap
  for the whole lap, with no “fall back to the next one”: one that has no lap yet shows “—” with
  the bar empty, without moving anything. Only the ones on show are computed. When you turn the
  line or a bar on from the Delta page, the window grows just enough (as with “Complete”) for all
  of them to fit without shrinking the text; in a shorter window the ones that fit are drawn,
  always including the reference in use, and the page says “No room in 400 by 80 px” on the rest.
- **Battle: the gap as in Relative, and each sentence of the prediction your way**: in Content,
  **Gap** picks between **Unsigned** (the measured gap, “0.6 s”, as always and the default) and
  **As Relative** (the same time as Relative, just as its column draws it: with its sign,
  positive ahead and negative behind, and no unit; while Relative has no time for that car, the
  measured gap with the sign of its lane). The **Catch prediction** line unfolds into its
  parts, each with its eye: “Catching in…”, “Catches you in…”, “Need… s/lap” and “Out of reach ·
  Safe to the flag”;
  a hidden sentence leaves the line blank, without moving anything. All visible by default.
- **Sim time in the header and footer**: a new item, **Sim time**, in the catalogue of the
  Relative, Standings, Fuel, Traffic and Battle bars: the time of day in the sim (which runs with
  the session), in the same format as the local time (24 h, “14:32”) and with a sun in front to
  tell them apart (a moon from 20:00 to 06:00). Off by default: add it with **+ Add a data
  item**.
- **More cars from the other classes in Standings**: in compact mode, **Cars of other classes**
  (from 0 to 10, with the same picker as “Top positions” and “Around you”) replaces the “Leaders
  of other classes” switch. With 1 (the usual) each other class is its leader's line; with more,
  its first cars under its class name; with 0, none. When updating, the switch turned on becomes
  1 and turned off 0, also in saved layouts.
- **Each class's SoF next to its name**: the line of another class's leader in compact mode now
  carries its class's SoF at the end (the class lines already carried it in every class). It
  follows the “SoF” eye of the class line: hide it there and it goes from both.
- **The start of the row, as columns: each thing where you want it**: in Relative and Standings,
  the position, the number, the make logo, the country flag and the name stop being a fixed block
  and become columns in the same list as the rest, together with **Flags** (the penalty ones,
  which used to go always after the name). So **Positions gained**, **Flags** or any other column
  can go between the position and the number, between the number and the logo or after the name.
  Relative now also has **Positions gained**, the same column as the Standings one (same name,
  title “±”, width, triangle and colours; race only, counted the same way: its starting position
  in the class against the current one), hidden by default after the flags.
  Whatever stays next to the name goes with it, in its cell: in front, aligned from row to row;
  behind, at the end of its cell, also aligned. Separated by another column, it goes in a column
  of its own (the number's title is “#”). **Name** always shows (its help says its column title
  is “DRIVER”). One rule, the same in the four widgets with the “Driver” block: **the list says
  where; the “Driver” block, whether they show and how**. The logo, the country flag and the
  flags have no eye in the list but a link that takes you to their row in “Driver” and points it
  out (their row says how they are: “Shown or hidden in “Driver”: Global (Yes)”); in the preview
  they can be dragged and, when you click them, the note says the same and takes you to that row.
  The position and the number, which are not in the block, have their eye (in Standings, the
  position's replaces its old switch). In Traffic, the flags follow the same rule in its list of
  parts; Battle, with no columns, carries them after the name. If the window narrows, the logo
  and the country flag go before the usual columns, and flags placed elsewhere go back after the
  name. “Match Standings” and “Match Relative” carry everything, “Positions gained” too, and in
  the preview they are dragged like the other columns,
  flags after the name included. When updating, everything looks as before: the start of the row
  in front in the usual order (the position, shown or hidden as it was), the flags after the name
  (at the end of its cell, aligned, also if you had their column on). A saved column list that is
  empty or unreadable goes back to the default one, as before.
- **Relative: each driver's last lap**: a new column, **Last lap**, the same as the Standings one:
  the same name, the same format (“1:47.312”), the same help and the same colours (its class's
  fastest lap on the purple plate, its own session best in green) and, outside races, its best
  lap. Hidden by default (also when updating, after the gap) and sorted like the rest; “Match
  Standings” (and “Match Relative”) carries it with the other columns they share.
- **Standings: the class order**: in Content, **Class order** picks which block goes on top with
  several classes: **Your class first** (as always and the default: then the fastest ones),
  **Fastest first** (like iRacing, yours in its place) or **By hand**, with a list of the classes
  by their short name that you sort by dragging or with ↑ ↓, like the columns. The list is
  remembered between sessions (an LMP2 is the LMP2 in any race); it always brings the classes of
  the current session, and the ones not in it go after, fastest first. Your class keeps its rows
  around you wherever its block goes. In the preview, which on this page has a third class (GTP),
  a class can also be moved by dragging its line (or its leader's tag on a line) above or below
  another, with the same drop line as the columns: if the order was not “By hand”, it becomes so,
  the note says it and “Undo” brings both back. The list only keeps what you sort: the preview
  classes left at the end are not saved, and with more than 32 classes remembered the ones at the
  bottom that are not in the current session are forgotten first (never the ones in the session
  or the one you just moved). A class is the same written in upper or lower case, also when
  dragging it.
- **The iRating, in the licence colour and in full if you like**: two new rows in Appearance ›
  Rows and drivers, with their “Global (…)” in the “Driver” block of Relative, Standings, Battle
  and Traffic, and in the search. **iRating format**: **2.5k** (as always and the default) or the
  whole number, **2,520** (with the language's thousands separator: “2.520” in Spanish; its help
  makes clear that 2.520 is 2520, not a decimal). It applies to the iRating
  of each driver (the iR columns of Relative and Standings and Battle's) and to the SoF (each
  class's in Standings and the SoF item of the info bars, in every widget that has it: the four
  in the block use their own, Fuel the Appearance one). **iRating in the licence colour** (off by
  default): each driver's iRating in the colours and style of their licence (Outline, Soft, Solid
  or Letter only, the same as the pill), so you can hide the Licence column and still see their
  class. The SoF has no licence and stays as it was; in Traffic, which does not show the drivers'
  iRating, the row is there but disabled and says so. The iR column widens just enough for the
  whole number or the plate (and in Relative the window counts it like any other column). The
  styles and “Complete” do not touch them; when updating, everything looks as before.

### Changed

- **Your references, legal laps only**: besides going off track, touching the pit lane, the tow,
  stopping or a yellow, your lap is now also invalidated by an off-track that iRacing gives you
  (its 1x) even if no moment of the telemetry saw it. If it arrives within half a second after
  crossing the line, it belongs to the lap you just closed, not the new one. A contact (0x, 4x)
  or a spin (2x) do not invalidate it: iRacing counts it too. That lap is never your session best
  nor part of your optimal lap or your class's, nor is it saved as a personal best; if it already
  was for an instant, the previous one comes back before the delta uses it. The delta's “invalid
  lap” note follows this same rule, also the just-finished lap shown when crossing the line, and
  the “Best lap” column in Standings shows your best legal lap for you even if iRacing counts one
  of those as your best.

## [2.3.1] - 2026-10-30

### Fixed

- **A one-row option in Customise goes under its name**: “iRating at stake for all” in
  Standings took up the row and left the name in a column of loose words. Now a one-row option
  (also “Measured” in Gap) goes on its own line, at any width.
- **The sidebar shortcuts do not break**: with “Shift” the key is longer, and the explanation
  moves whole to the line below instead of breaking into loose words.

## [2.3.0] - 2026-10-30

### Added

- **Edit mode knows which widget the arrows go to, and undoes**: the label of the widget the
  arrows apply to has its border in the edit colour; `Tab` and `Shift+Tab` move to the next or
  previous widget (top to bottom, skipping hidden and locked ones), also with the cursor hidden by
  the game, with a short note “Arrows: Relative”. `Ctrl+Z` undoes the last edit mode change (drag,
  size, wheel, arrows, eye or padlock on the label) and then the one before, and the tray offers
  **Undo: move Relative** (or “resize Relative”, “hide Battle”: whatever you did); holding an
  arrow or turning the
  wheel counts as a single change, and everything is forgotten when you leave edit mode. These
  keys are only taken while you edit; with Settings in front, they work as long as you are not in
  a field, a slider or a list (see **Changed**).
- **Accessibility, in one place**: at the end of **Appearance**, an **Accessibility** section
  gathers what used to be scattered or did not exist, each option off by default (nothing changes
  unless you pick it, and **Search settings** finds each one by its words):
  - **Colour-blind palette** (moved here from “Colour”): it now also reaches **Inputs**: the
    pedals with their default colours become blue (throttle) and orange (brake), the clutch grey,
    the ABS white, and the brake trace is thicker than the throttle one, to tell them apart by
    shape; a colour you picked stays.
  - **10 px minimum text**: the smallest labels of the ten widgets (column titles, footers,
    headers, chips) go from 9 to 10 px. No widget gets wider: where it does not fit, an item or a
    column goes first, as when narrowing them.
  - **No flashing**: the Inputs shift lights stay steady in blue instead of flashing about five
    times a second when you hit the rev limiter, and neither the **Edit position** border nor the
    “Waiting for iRacing” dot flash. The help of **Shift lights** in Inputs says where it is.
  - **Size of this window**: makes the Settings window larger or smaller between 80 and 150%
    (also with `Ctrl` and `+` or `-`, `Ctrl+0` to go back to 100%, or `Ctrl` and the wheel), and
    it is remembered. It only changes this window: the widgets keep **Text size**.

  Its ↺ and its line in **Reset…** turn them off again; **Style** does not touch them.

- **More precise edit mode**: the **arrows** move by 1 px the last widget you dragged, scaled,
  touched on its label or pointed out with **Edit position** (with `Shift`, 10 px), and with
  `Ctrl` they change its width and height (not the height, if it fits its content); it is saved
  when you release the key. Only while you edit: with the Settings window in front, a field, a
  slider or a list that has the focus keeps the arrows, and a combination you already use in
  Shortcuts is still yours. If you have not
  touched any yet, a note over the game says so. When dragging, a **snap line** marks the edge of
  another widget or of the screen it snaps to, and the widget also snaps to the **centre of the
  screen**. The label's eye and padlock measure 24 × 24 px (before 20 × 17) and the edges for
  resizing, 11 px (before 8); the widgets do not change size. The edit mode key line in Settings
  and the help over each widget name the arrows.

- **Welcome on first start**: a new install opens Settings with a three-step welcome (language
  and units; which widgets to use; where everything is: the tray, the three shortcuts and **Try
  with sample data**, which shows the widgets on your screen in edit mode), and Windows notes once
  that OverLap is in the tray. **On a new install**, everything comes up in the Windows language
  (Spanish if it is yours; otherwise, English) and the welcome starts with six widgets ticked
  (Relative, Standings, Delta, Fuel, Alerts and Inputs) instead of the ten; “Next” waits until
  there is at least one and “Skip” leaves the ten. If you already had settings, you do not see
  it.
- **Search settings**: a search box at the top of the sidebar (and of the bar of a narrow window)
  finds any setting on any page by its words, ignoring case and accents: controls, sections,
  accordions and each item in the lists (“laps fuel” gives “Laps of fuel” in the Standings
  footer, in the Relative header…), with its page and section under it. With the arrows and
  `Enter` or a click, it takes you to the page, opens the accordion or the list where it is,
  centres it and highlights it for a moment. It reads the pages as they look, in the window's
  language, and reads them again if you change a setting; it also finds what another setting now
  hides (“Top positions” with Standings in “Full”), marked “with another setting”: when you pick
  it, it takes you to its section and says why it is not showing.
- **“Visibility” page**: next to Appearance, with **When the overlay shows** (which was in
  Appearance; its “Reset” goes with it and Appearance's no longer touches it) and a **Where each
  widget shows** table: one row per widget, grouped, and the columns Visible (the same eye as
  the sidebar), Practice, Qualifying, Race, Hide in the pits, Session screen and Locked, ticked
  with the same meaning as on the widget's page. Each check box changes the same setting as its
  page and the widget's name takes you there; a check box that cannot be changed says why. With
  “Races only”, the table warns that practice and qualifying do not show.
- **Bring every widget to this screen**: in the tray (to the screen the mouse is on) and in
  **Layouts › Screens** (to the one with the Settings window). Widgets on another screen, or on
  one that is no longer connected, come to the same relative spot and with their size, without
  going off it; the ones already there do not move. The page says how many it brought and to which
  screen (the mouse's, if it was from the tray), and from the tray a note on that screen says it
  too. For one minute it can be undone from the page or with **Undo: …** in the tray.
- **“Edit position” on each widget, and ⚙ on its label**: next to “Visible”, a button enters
  edit mode and points that widget out over the game with a border that flashes three times (with
  reduced motion, steady for that time) and goes away; if you are already editing, it points it
  out again. In edit mode, each widget's label has, after the eye and the
  padlock, a **⚙** that opens its settings page. The edit mode note in Settings is a key line
  (`Drag` move · `Edges` width · `Wheel` scale · `Alt` no snap · `Esc` exit) with an **Exit**
  button, instead of two lines of text.
- **Knowing whether a shortcut works**: when you use a shortcut, a short note at the top of the
  screen, over the game, says what it did (“Overlay hidden”, “Edit mode”, “Layout: GT3”) or why
  nothing shows (“Overlay visible · Hidden: out of the car”, “There is only one layout”, “Delta:
  no session”, “Delta hidden”), on the screen your widgets are on; also when leaving edit mode
  with `Esc`. It takes neither the focus nor the clicks, and it is turned off in **Settings ›
  Shortcuts › Confirm over the game** (on by default, also if you already had settings: it is
  new). On that page, the row of each action (and the `Esc` one) says “Pressed 3 s ago” when you
  use it and flashes with each press, to test a shortcut from the game. If a shortcut cannot be
  registered, the tray says so under the status (“1 shortcut is not
  working…”, which opens Shortcuts) and in its tooltip.
- **The status, outside the tray**: the Settings status chip says underneath what is hidden now
  and why (“Hidden: out of the car”, “2 widgets hidden now”, “Overlay hidden”) or what is failing
  (“1 shortcut not working”). One click opens a panel with the full status line and what to do,
  which widgets a rule hides and why, the shortcuts that are not working (with “Open Shortcuts”)
  and the **Copy diagnostics** buttons (versions, status, screens and shortcuts, without names or
  your user, not even inside the text of an error) and **Open log** (`overlap.log`). If you hid
  the overlay yourself, the panel says “All of them: you hid the overlay.”, and the sidebar eyes
  and the note on each widget page say “overlay hidden”. If the native iRacing SDK module cannot
  be loaded, a note on every page says so, with the same buttons; the note that settings are not
  saving also opens the log instead of explaining where it is.
- **Steering wheel centre mark with “Global (accent)”**: in Inputs, the colour of the centre mark
  has **Global (accent)** as its first option, which follows the accent colour of Appearance
  (like “Global (…)” in the name format). It is the default on a new install; if you already had
  settings, the mark keeps its colour (the former yellow) until you pick it.
- **Alerts and Warning lights, linked**: engine stalled, oil pressure, pit limiter and damage
  (the mandatory repair: “Damage” in Alerts, “Mandatory repairs” in Warning lights) are in both
  widgets. In **Customise › Alerts**, each one's row has a **Warning light** check box that turns
  its light in Warning lights on or off, and in the Warning lights list the **Alert** check box
  does the same with its alert; under each list, a line explains it with a **Go to Warning
  lights** / **Go to Alerts** button. The Alerts note about temperatures and repairs goes on that
  same line.
- **Imperial units in Fuel and the radar too**: with **Appearance › Units › Imperial**, Fuel
  shows (US) gallons: what is left, the use per lap (`gal/lap`), what to add, the pit menu and
  the saving; the plan and the laps do not change. The radar range (on its marks, on its page and
  in the tray) reads in feet; the setting is still saved in metres. The “FUEL · 1.6 LAPS” alert
  stays in laps. A visible change if you already used imperial units: Fuel goes from litres to
  gallons and the radar, from metres to feet.
- **“Light” and “Complete” example layouts**: in **Layouts › Examples**, **Add** puts at the end
  of the list a layout with your widgets where they are and their options, without applying it:
  “Light” shows Relative (with 2 cars ahead and 2 behind, or fewer if you already had fewer),
  Radar, Delta, Fuel and Alerts; “Complete”, the ten widgets. When it is added, the page names it
  as it ended up (“Light (2)” if there was one already) and reminds you that you switch with the
  **Next layout** shortcut (with its keys) or from the tray; if there is no room left, it says so.
- **Styles in Appearance**: at the top, four named styles, each one different at a glance:
  **OverLap** (everything by default: the look, background at 80%, comfortable rows, logos and
  flags, and also what each widget of the layout in use shows: each column, element, bar and
  option that **Complete** turns on goes back to its default value and order, the automatic
  height to its own, and Relative and Delta to their default size, from the same corner, or just
  a bit more if you show more cars or roomier rows, so the text does not shrink), **Clean** (no
  background: just the text over the game, always with its outline; no alternating rows, logos or
  flags, number as a stripe and licence letter only), **Compact** (small but readable: compact
  rows, text at 85% without going below the minimum text, surnames, number as a stripe and licence
  letter only, no logos or country flags) and **Complete** (everything on show in the ten widgets
  of the layout in use: each column and element, the info bars with their items, the column
  titles, the full conditions, each alert and warning light, logos always and background at 90%;
  the widgets that can grow do so in height, and Relative and Delta enlarge their window just
  enough so the text does not shrink). Clean and
  Compact only change the look: when you leave **Complete** for one of them, the confirmation
  window says that what Complete added to the widgets stays and offers, unticked, **Also take
  away what Complete added** (each widget back to what it showed before; it is remembered in this
  window when applying Complete); with OverLap it always goes, because everything goes back to
  default, and its window lists it. The one matching what you have is ticked (OverLap, only if the
  look and what each widget shows are at their defaults); if you tune something by hand, here or
  on a widget's page, it says “Custom”. Below, the usual controls as **Fine tuning of the
  style**. If a style is going to change something you set (a look tuned by hand, or what each
  widget shows with **Complete** and **OverLap**), or leaves Complete, it asks first: an “Apply
  the … style?” window says what changes, from before to after (“Widget background: 80% → 90%”,
  “Standings: 5 more columns shown”; with OverLap, “Standings: 5 columns hidden”, “Relative: the
  window back to its default size”), folded if it is long, and where it is saved; **Apply** or
  **Cancel** (or `Esc`).
  If not, it applies at once. Everything is undone with **Undo**, windows included (and, after
  undoing OverLap or the check box, the offer to take away what Complete added comes back); they
  do not touch the accent, Accessibility, the SIM tag, the language, the units, the positions or
  which widgets show. Anyone who had the “Like iRacing” look (no longer there) keeps it as it is,
  as “Custom”.
- **Shortcuts to show or hide each widget**: in **Shortcuts**, under the usual actions, a folded
  **More actions** group has one row per widget (“Show or hide Relative”…), with the same three
  boxes, wheel buttons included. They do the same as the sidebar eye or the tray check box (which
  shows the shortcut next to the widget), and the note over the game says “Relative hidden” or
  “Relative shown” and, if it still does not show, why. None has a shortcut by default; the group
  says how many have one and opens by itself if any does.
- **“About and help” page**, at the foot of the sidebar: the version, **User guide** and
  **Report a problem** (in the browser), a quick help with a button on each question (the page
  that answers it, **Edit mode** or **Search settings**), **Export everything…** (all the
  settings, with every layout and its options, and your personal bests, even the one from a
  second ago, in one file) and **Import everything…** (puts those settings in at once, with
  **Undo** here and in the tray as long as you change nothing else, and adds the file's personal
  bests to yours: the fastest lap wins, none of yours is deleted and, if the list is full, it says
  how many do not fit; a file from a newer version or that is not a backup is rejected, saying
  why), **Open
  folder**, **Open log**, **Copy diagnostics**, **Show the welcome** and **Reset
  everything** (as newly installed, in your language, with the widgets centred on an ultrawide
  screen as on first start; your personal bests stay; it asks for confirmation and can be
  undone). The settings folder button leaves the foot of the sidebar and the narrow window's; it
  is still in the tray.
- **“No room at 540 px”: the preview says what the width leaves out**: when the widget's width
  leaves no room for something you have visible, its row says so with the same icon and the same
  words in every list: Standings columns, header items, second lines and footers of the six
  widgets with bars, and the logo and flag of the Standings “Driver” block (and **Gap: Both**,
  when the gap-to-leader column does not fit). On hover it explains what to do (widen the widget
  or hide another item). In
  Battle, **Side by side** in a narrow window says it is drawn stacked, and in Relative the
  **Density** says “No visible change at 460 × 252 px” when the width sets the text size (so,
  with both densities it looks the same). Before, the eye or the option seemed to do nothing.
  There are no new settings.
- **A list inside a hidden block says so, and showing something shows the block**: in Inputs,
  with the “Revs, bias, TC and FFB” block (or the readouts one) hidden in **Blocks**, the **Car**
  (or **Readouts**) list says underneath that it is not showing and why, and showing one of its
  elements also shows the block, as the Delta lap times already did, which now say it in the same
  words. Hiding or sorting never touches the block.
- **“Does not change the preview” on the options that act during the session**: when a widget
  shows (**Show in**, **Hide in the pits**, **Show on the session screen**), **Locked**,
  **Grows**, the threshold and **Keep visible** of Battle and Alerts, **Multiclass only** of
  Traffic, **Fall back to the next one** of Delta and **Margin** and **Laps to average** of Fuel
  carry the same note, with the same icon, instead of seeming to do nothing.
- **The preview shows what you just changed**, as Delta already did with each session's
  reference (and says so under the option): in **Standings**, changing **Top positions** or
  **Around you** puts you in P10, so the two blocks show apart and every number changes
  something; when you show or hide the SoF or the cars in a header, second line or footer, the
  preview shows only your class (with several classes they go on the class line), and when you
  touch the class line or the leaders of other classes they all come back. In **Traffic**, the
  preview applies **Look behind**, **Look ahead** and **Hazards up to** as in a race, with cars
  further away that show when you lengthen them, and changing **Entries per group** puts five
  cars close in each group. In **Warning lights**, with **Lit only** the preview draws the unlit
  ones translucent, so their eye and their order show. In **Inputs**, the sample trace runs in
  real time: with more seconds you see the previous curve, with fewer only the end of this one
  (before it was the same curve stretched). Over the game, edit mode still shows the usual sample.

### Changed

- **Laps spelt out where they fit, and never “L” in English**: the big **Fuel** number and its
  “To go” say “17.6 laps” and “18.7 laps” as long as they fit on the line, and the **Standings**
  header (and any header with the time left) says “≈19 laps” or “12 laps to go” when it has room
  to spare; if not, “v” as always. No widget gets wider or loses an item because of it. In
  English, laps are no longer written “L”, which is the litres unit: “Catching in ~4 laps”,
  “< 1 lap”, and the stint column “7 lp”.
- **Exiting edit mode has the same name everywhere**: the sidebar button, the one on the
  Settings note, the Shortcuts row and the sidebar legend say “Salir del modo edición” in Spanish
  (before also “Salir de edición”, “salir de edición” and “Salir”); over each widget it still says
  “Esc: salir”, which is the same word. In English, “Exit edit mode” (before also “Leave edit
  mode” and “leave editing”). The edit mode undo says what you did: “resize Relative” if you
  changed its size (before “move”), “hide Battle” or “show Battle” (before “show or hide”),
  “unlock” and “change the scale of”.
- **The first arrows note fits whole**: “Drag or touch a widget first, or press Tab to pick it”
  (before a longer sentence that was cut at the sides), and the same with “No widget can move:
  they are hidden or locked” and “Overlay hidden: show it with its shortcut or the tray”. If a
  long name does not fit, the note goes onto two lines instead of being cut. A test measures that
  each note fits on one line in both languages.
- **The edit mode keys also work with Settings in front**: right after **Edit position**, the
  arrows move the widget, `Tab` and `Shift+Tab` pick another one and `Ctrl+Z` undoes, as the
  Settings note says, without having to go to the game first. The arrows and `Ctrl+Z` keep
  working as long as the focus is not in a field, a slider or a list (which keep their keys), and
  `Ctrl+Z` belongs to the Settings “Undo” while it shows. `Tab` goes back to moving through the
  page as soon as you click or something on the page takes the focus, or with `Esc`.
- **“Mayús” across the app** (Spanish): the Shortcuts table, the sidebar footer, the welcome, the
  hidden cursor note and the **Edit mode** help write `Ctrl+Mayús+E` and `Ctrl+Mayús+H`, as the
  edit mode notes already did (“Mayús+Tab”) and as **Supr** or **Re Pág** are written; while you
  record a combination, the key pressed has the same name. In English it is still “Shift”. What
  is saved does not change.
- **A ↺ with nothing to do turns off, like the lists' “Reset”**: the ↺ of each section (Content,
  Driver, Customise, Window and visibility, the Appearance and Visibility ones) and its line in
  **Reset…** come out dimmed when that part is as it comes by default, and say “Nothing to reset:
  it is as it comes”. “Position and size” and “All” stay active: the factory position depends on
  the screen.
- **The same option, the same control and the same name**: in **Appearance › Rows and drivers**,
  “Country flag” and “Penalty flags” are a “Yes / No” picker, as on each widget (before they were
  switches). The Driver line of **Reset…** says “Name format, logo, country flag and penalty flags
  go back to “Global”” (before “sanctions”, a word no control used). In **Warning lights ›
  Customise**, “Captions” is a switch, like “Temperatures” and “Repair time” below; as a column,
  “Text side” comes out below as long as there is a text to place (before “Captions” was “No /
  Right / Left”). What is saved does not change.
- **Inputs without “Content”**: the steering wheel style, its size and the centre mark colour
  move to the **Steering** row in Customise › Readouts, which unfolds like the Trace one and says
  on its button what it is like (“Realistic · Medium”, “Bar”), next to **Steering angle**. So
  everything about the wheel is in its row, and its ↺ is the Customise one.
- **The columns Relative and Standings share, in the same order**: in Relative, the gap goes
  before Pit, Stint laps and Tyre, as in Standings (before Tyre went before Stint laps and the gap
  last). All three are hidden by default, so nothing visible changes; a list you had already
  touched stays as it was, and an old setting with the tyre on show still sees it in its place.
  The Stint laps help is the same in both.
- **Search settings also finds buttons and options**: “export” takes you to **Export
  everything…** (About) and to **Export…** (Layouts), “edit position” and “move” to each widget's
  button, “reset” to **Reset…**; and each option of a picker comes up by its name (“Imperial”
  from Units, “Surname” from Name format, “English” from Language), with the picker it belongs to
  underneath, also by what its help says (“gallons”, “feet”). It understands more everyday words:
  “rpm” and “gear change” take you to **Shift lights**, “key”, “keyboard”, “wheel button” or
  “button box” to **Shortcuts**, “sanctions” to **Penalty flags**, “copy” or “backup” to **Export
  everything…**, “big letters” or “bigger” to **Text size** (and then to the 10 px minimum text),
  and “per car” to **By car**.
  Words that tell nothing apart (“por”, “de”, “el”, “the”, “by”) no longer make a search
  fail.
- **The same words over the game and in Settings**: the help over each widget says “Wheel: scale
  · Arrows: move · Alt: no snap · Esc: exit” (shorter on narrow ones), and the Settings edit mode
  note uses the same pairs (“Edges: size”, “Arrows: move (Ctrl: size)”, “Tab: next widget”,
  “Ctrl+Z: undo”), the same in English (“Wheel: scale”, “Arrows: move”).
- **“iRacing hides the cursor” names the key**: the note says “Press Ctrl+Shift+O to open the
  settings, which free the cursor, or Alt+Tab” (with your **Open settings** shortcut) and that,
  without a cursor, `Tab` picks a widget and the arrows move it.
- **A narrow widget's label shows its whole size**: below 300 px it drops the scale first and
  writes the size together (“220×220”), instead of cutting it (“220 …”).
- **Secondary text reads over a bright sky**: with the text outline on (in “Auto”, with the
  background below 65%), the grey of the secondary labels and figures (P11, iRating, “TRACK”,
  “SoF”, “LEADER”) moves towards the white of the main text. With the default background (80%)
  there is no outline and nothing changes; no widget grows.
- **The incidents header, with full words if they fit**: in Relative and Standings, “team 7x”
  and “penalty at 17x” instead of “tm. 7x” and “pen. at 17x” when the header has room for them
  (it is measured, as in the Alerts chips); if not, the usual abbreviations. No widget gets wider.
- **Appearance, in two groups with no empty columns**: under the styles, **Fine tuning of the
  style** (Colour and Text on the left, Rows and drivers on the right) and below it **General**
  (Language and Other on the left, Accessibility on the right), each section always in its
  column. Layouts does the same: on the left the list and “Save the current one”, on the right
  Automatic switch, Examples, Screens and Files, whatever layouts you have.
- **Customise with the header of the other sections**: the small-caps title with its ↺ on the
  same line; the explanation and “Expand all” go below.
- **Size of this window with the usual buttons**: 80/100/125/150%, like Text size and Scale; the
  slider goes in steps of 5 and `Ctrl` and `+` or `-` still go in steps of 10.
- **Accessibility leads to Text**: at the foot, “To read the widgets better, in Text:” with two
  buttons, **Text size** and **Text outline**, which take you to each one and highlight it.
- **Search settings understands everyday words**: “zoom”, “enlarge” or “magnifier” find **Size of
  this window**; “lock” or “pin”, **Locked**; “flicker” or “flash”, **No flashing**;
  “colour blindness”, the colour-blind palette (and the same in Spanish); and each style can be
  found by its name (“Clean”, “Compact”).
- **Styles and layouts, each to its own**: the “Complete” example layout is renamed **All ten**
  (“Los diez”), so it is not confused with the **Complete** style; Style says that which widgets
  show is the layouts' choice (with “Go to Layouts”) and Examples says that the look is picked in
  Style (with “Go to Appearance”).
- **The same words for the rev limiter**: in English, “No flashing” says “on the rev limiter”
  (not “at the limiter”, which in the app is the pit limiter), like Warning lights; in Spanish,
  “en el corte”, like Warning lights.
- **Inputs, with the same rule as the other widgets**: what turns a part of the widget on or off
  goes in **Customise**, and only the wheel modes (style, size and colour) remain in Content.
  **Shift lights** is a row with its eye above **Blocks** (the strip at the top of the widget);
  the **Trace** options (seconds, thickness, clutch) unfold in their own row, with their summary
  on the button (“5 s · 2 px”); **Steering angle** goes in the **Steering** row of Readouts, and
  the pedal colours, under the Blocks list. **Search settings** opens the folded row where what
  you are looking for is. The values do not change.
- **One help line per row**: in Fuel (Use, Add and to finish, Pit window, Saving, Tyres, Fast
  repairs, Pit menu) and in Warning lights (Mark as crew time, Real countdown), each row's help
  fits on one line and the rest goes behind its ⓘ, as in the rest of Settings.
- **The two tables, one rule for Position and Driver**: in **Relative** and in **Standings**,
  **Position** and **Driver** go in the same fixed block at the start of the column list, with
  the same hints (“always at the start of the row”, “always after the position”): Driver with its
  padlock and Position with its eye in both, so now the position can also be hidden in Standings
  (another class's leader then loses its class tag; its number stays in the class colour). The
  “x of n visible” count counts the same in both, only the columns that move, and **Match**
  also copies whether the position shows. **If in Relative you had moved Position or Driver to
  another place in the row, they now go back to the start, as in Standings**; the rest of your
  order stays.
- **Gap “Measured”, in its row**: in Standings, the “Interval / Leader / Both” picker leaves
  Content and goes inside the **Gap** row of Columns, like “iRating at stake for all” in its
  own; “Gap to leader” says “Shown with “Both” on the Gap row”. It is reset by the Customise ↺,
  together with its columns.
- **Window and visibility, the same rows on the ten widgets**: in **Alerts**, “Hide in the pits”
  no longer disappears: it comes out off and disabled with its reason (“Not available: it would
  hide the pit limiter and pit entry alerts”), like “Show on the session screen” where it does not
  apply. **Grows** is also always there: disabled with “Not available: only with “Height:
  Automatic”” or “Not available: this widget never changes height by itself”.
- **One name for each thing**: in Delta, “Bar scale” becomes **Bar range**, because “Scale” is
  the widget's size on all ten; in Battle, “Rival iRating” and “Rival licence” become **iRating**
  and **Licence**, like the Relative and Standings columns, with “the rival's” in their help.
- **Lapped or lapping you, also by shape**: the number of a car lapping you carries a notch at
  the top right and a lapped car's, at the bottom, besides the red or blue they already had (in
  Relative and Traffic, the same component). It goes inside the number: it takes no extra room.
- **Fewer figures by default, only on a new install**: Standings starts without its second header
  line (iRating and SR at stake, margin and class fastest lap) and without air or rubber in the
  footer (which keeps track, water, wind and cars); Fuel, without the tyre and limit lines (fast
  repairs and sets); the Relative footer, when you turn it on, does not bring air or rubber
  either. Everything is still in their Customise lists, one click away. **If you already had
  settings, nothing changes**: your widgets draw the same (also an old file without those lists,
  which gets what its version drew); only **Reset** leads to the new ones.
- **Full words where they fit**: the Alerts chips say “OIL PRESSURE”, “BOX THIS LAP” or “FUEL ·
  1.6 LAPS” when they all fit in their row, and the Fuel limits line, “Fast repairs” and “Tyre
  sets” when they fit in its width. If they do not fit, the usual abbreviations stay (“OIL
  PRESS.”, “BOX THIS L.”, “F. REPAIRS”): no widget gets wider or gains a row because of them.
- **Fuel, more graphic and with less text**: each line is a figure and its drawing. At the top,
  the **laps of fuel in large** (in the plan's colour), the litres and, after a chequered flag,
  “TO GO” and the laps left. The **tank** is marked in laps of fuel (a tick per lap, stronger
  every five), with a tick where what you need to the finish reaches and, if you do not make it,
  that stretch hatched in red. The **use** carries a line with your clean laps: the average
  dashed, the one that used most in orange and the last one in white (separate and joined with
  dashes if it was not clean, even if it used the same). **Add** shows the **pit menu as a bar**
  marked at what to add (green if it is enough, orange if not) and, at the end, “TO FINISH” and
  the litres to the finish. The **window** is the race as a line to the flag: what has been run,
  your position and the laps you can stop on (green if it is open, red if it closes on this lap),
  and the stops said in words (“1 stop”, “no stop”). The **saving** is a bar ending at your
  average, with the cut hatched and its percentage (“−9%”). The **tyres** are the car seen from
  above: each tyre in three bands from one edge to the other (left, centre and right seen from
  above, as iRacing gives them), coloured from green (new) to yellow, orange and red (worn), or
  from blue to grey and orange with the colour-blind palette, with the % of its most worn band
  next to it and “last stop · L13”. In the list, “To finish and add” is renamed **“Add and to
  finish”** and “Repairs and sets”, **“Fast repairs”**: the tyre sets left now go with the car,
  and that line only says them while the tyres line is not drawn. The lines, their order, what you
  had hidden, editing in the preview and the ghosts stay the same; there are no new settings.
- **The Fuel tyres line shows before the first stop** (a visible change if you already used the
  widget): before, it did not appear until a stop measured the tyres; now, with the **automatic
  height** (the default), the car shows dimmed from the start (“no reading · measured in the
  pits”, or “no reading” if the widget is narrow), so the widget does not change height when the
  reading comes, although in races without a stop it is about three lines taller. If you hide it
  in Customise › Lines, it disappears as before. With a **fixed height** it stays as before: the
  line waits for the reading, so as not to push the others out of a window made to their size.
- **“+ Add a data item” in the bars**: in headers, second lines and footers, the “Hidden (n)” list
  becomes **+ Add a data item (n)**: each hidden item has **← Left** and **Right →**, to put it at
  the end of the side you pick (the side where it was, highlighted).
- **More room for the settings**: when you scroll down through the options, the preview folds
  into a strip of about 120 px (with “Show whole”) and comes back when you scroll up; at the foot
  of the preview, **Scrolling: Folds / Fixed / Strip** changes it and is remembered. The Settings
  window opens taller (880 × 900 on a 1080p screen; on 1440p, 1152 × 1200) and the options go to
  two columns from 1100 px wide (before 1380). On widget pages with two columns, “Customise” goes
  on the right and the left stacks “Content”, the reference sections and “Window and visibility”,
  each column with its own height: there is no longer an empty gap under Content. With one
  column, the order is the same: Content › Customise › references › Window and visibility.
- **Linking a car turns on “By car”**: when you link a car to a layout (in Layouts or from the
  tray), the automatic switch turns on if it was off; the page says so with “Undo” (also in the
  tray, and from it a note over the game), which turns it off and goes back to the layout you had
  if it applied another; removing a link does not touch it. If you are in a car with no layout
  and you have two or more, the page and the tray's **Layout** submenu offer **Link to “…”** (the
  one in use), and **Save the current one** offers “Link to <your car>”, ticked only if “By car”
  is already on: saving never turns it on unless you tick it. The linked
  cars show as tags on each layout, and the list of cars that can be linked includes the ones in
  your personal bests, without having to get in them again.
- **The eye is the visibility symbol**: in the sidebar, each widget has an eye (as on the edit
  mode label) instead of a dot: open if it is on, crossed out if not, and faint with a dashed
  circle if it is on but a rule hides it now; on hover it says why (“on, but not showing now
  (hidden in practice)”). The widget's page says it too under its title.

- **Grouped widgets**: the Settings sidebar, its picker in a narrow window and the tray sort the
  ten widgets into three groups: **Track and rivals** (Relative, Standings, Battle, Traffic,
  Radar), **Your lap** (Delta, Fuel, Inputs) and **Car status** (Alerts, Warning lights). In the
  tray, each group carries its name and a line separates it from the next.

- **Shortcuts as a table, one column per shortcut**: each action is a row and each shortcut has
  its column (**Shortcut 1 · main**, **Shortcut 2**, **Shortcut 3**), as on a game's controls
  screen, so the shortcuts line up between rows. The box is the control: click to change, **×**
  or `Delete` to remove, **+ Assign** in the first free one. The notes are in their box
  (“Disconnected”, “Used by another app”; in a narrow window, just its icon) and the sentence
  explaining it comes out under that column; “Saved” and “Removed” no longer push the page (screen
  readers still hear them). Reset is a ↺ icon in its own column (with “Undo”), `Esc` is one more
  row, with the same padlock as the fixed items in the lists, the note that
  keys are exclusive goes above the table and “How they work” stays folded below. Shorter help
  for each action.
- **Content for behaviour, Customise for what shows**: Alerts picks its alerts with a single list
  with eyes, with subtitles per group (Flags, Pit, During the race, Engine, Fuel), a single
  “Reset” and a single help, like Warning lights and Radar, instead of 15 check boxes in Content;
  a click on an alert in the preview hides it, like its eye; the blue and meatball flags depend
  on the flags, and the speeding on the limiter. In Warning lights, captions, temperatures and
  repair times move next to the list of lights, with “Rising temperature”. In Standings, “iRating
  at stake for all” is in its column's row. What is saved does not change.
- **Header and footer with a single rule**: on a new install, the header carries the title (and
  the session) on the left and the incidents and the clock on the right; the footer, the
  conditions on the left and the cars and the fuel on the right. The session items (session, time
  left, SoF, incidents) show by default only in Standings, which now also has a title and carries
  the car count in the footer; Relative stops repeating the incidents. Each header and footer has
  **“Copy to”** to pass it, with its size, to another widget (with “Undo”), and Fuel no longer
  offers “Laps of fuel” in its bars, because it shows them in large (if you had it, it is
  removed). If you already had settings, your bars do not change (a file without a version counts
  as earlier). In Standings, the SoF and the cars of the header and footer say that, with several
  classes, they go on the class line.
- **Delta in a single list**: Customise has only “Lines”; the top line and the lap times unfold
  in their own row to show their parts (“3 of 3 parts”), instead of three accordions that
  depended on each other. The references are called by their full name (“Personal best”,
  “Session best”, “Optimal lap”…), with what each one is, and the preview draws the one for the
  session you just changed and says so underneath (“The preview uses the Race one: Optimal lap”).
  The “If missing: …” chain and the parts of the lap times use those same names.
- **What is hidden looks the same in every preview**: with the mouse over the preview, whatever
  you have hidden in any list (columns, layers, warning lights, alerts, lines…) is drawn
  translucent where it would go, and a click shows it again; before this only happened with the
  data bars and a few lists, and in the rest you had to look for it below. The help above the
  preview only promises what the page allows: “Drag… to reorder” where a list can be sorted, and
  in Alerts it says that a hidden alert comes back from its list.
- **The Relative and Standings columns are named and edited the same way**: “Position” (in your
  class) and “Driver”, with the car number, in both (Standings said “Name” and had a separate
  “Number” row; Relative said “Class position”), the same padlock, in the place of the eye, for
  what always shows (Standings showed “Fixed”), “Gap” can be hidden in both, iRating before the
  licence in both and a “Pit” column in Relative too (hidden, the PIT tag stays after the name,
  as in Standings without its own). Each table has **“Match Standings / Relative”**, which copies
  the order and the eye of the columns they share, with “Undo”. **On a new install**, and if you
  had never touched the Relative columns, iRating goes before the licence; a list you changed is
  not touched.
- **A “Driver” block that is the same in Relative, Standings, Battle and Traffic**: right after
  Content, the same four rows in the same order (name format, make logo, country flag, penalty
  flags), each with “Global (…)”, which is whatever Appearance › Rows and drivers says, where
  their global values now are (the name format moves there from Text). Removing everyone's flags
  is a change in Appearance. Battle gains the rival's penalty flags and Traffic each car's logo,
  flag and penalty.
  “Logotipo de la marca” is now called “Logo de la marca” in Spanish (Make logo) and, in
  Appearance, “Brand logos” becomes “Logo colour”. **On a new install** the four follow the
  global (Battle now shows the country flag, off before, and Traffic the logos and the flags);
  **if you already had settings**, each widget draws the same as before (what it never drew stays
  off) and Appearance offers “Use Global on all” (with “Undo”). If you go back to an earlier
  version, whatever is on “Global” takes that version's default value.
- **The same “Window and visibility” block on the ten widgets**: Relative, Radar and Delta now
  have “Scale”, with the same 80/100/125/150% buttons: it is the size of their window relative to
  the factory one (the same as the wheel does in edit mode, which now means “scale” on all of
  them), and the edit mode chip shows that same percentage; resetting “Window and visibility”
  takes it back to 100%. The “Height” row shows on all, disabled with
  its reason where it does not apply, so the rows are in the same place on every page.
- **Undo big changes too**: resetting (a list, a section of a widget, its position, a section of
  Appearance or all of it, all the shortcuts or an action's), “Use Global on all”, hiding a widget
  and deleting a layout
  are done with one click and show the same note as hiding an element, with **Undo** (or
  `Ctrl+Z`). They no longer ask “Press again”; only deleting personal bests still asks for it,
  because it cannot be undone.
- **Reset says what and where**: on each page, a **Reset…** menu at the top with what each option
  brings back, and a ↺ icon in each section header that resets only that section: on a widget,
  Content, Driver, Customise and Window and visibility (plus Position and size, or the whole
  widget, in the menu); in Appearance, Colour, Text, Rows and drivers, Visibility and Other (or
  the whole page, which now includes Visibility; the language does not change); in Shortcuts, all
  of them (each row has its ↺). Before they were buttons at the end of the page, and “Reset
  options” also touched the scale, the background and the rules. With two layouts or more, the
  note names the layout (“Reset: Window and visibility of Relative · in “Main””), and the notes
  read well with any widget (“Hidden: Standings”, “Standings (all)”).
- **A single number format in Settings**: no extra “.0” (“1 s”, not “1.0 s” in Battle and
  Alerts) and with a decimal comma in Spanish (“1,5 s”, “0,5 v”, “1,5 px”); the widgets keep the
  sim's dot, like the lap times. **A single ladder of quick buttons** for sizes: “Text size”
  (Appearance) uses 80/100/125/150%, like “Scale”. The Inputs trace seconds have quick buttons,
  like the other time sliders.

- **“Clasificación” is renamed “Posiciones”** in Spanish (sidebar, tray, widget title and
  settings), so it is not confused with the qualifying session, which keeps its name. In English
  it is still “Standings”. Saved settings do not change.
- **Relative follows the density**, as Appearance already said, and has on its page the same
  “Global / Comfortable / Compact” picker as Standings. “Comfortable” (the usual one) draws it the
  same as before; “Compact” brings the rows closer and enlarges the text in the same window. If
  you already had the global density on “Compact”, Relative stays on “Comfortable” to look as
  before.
- **Customise in the same order on every widget**: first the main list (Columns, Rivals, Groups,
  Lines…), which is the one that opens on a new install, then the other content lists and at the
  end Header, Second line and Footer. Battle, Traffic and Fuel no longer open on a header that is
  off. The Battle and Delta “Rows” are called “Lines”, as in Fuel. The sections you had open stay
  open.
- **The widget's own things first** on each page: Content, Customise and, at the end, “Window and
  visibility” (size, background, when it shows and locking, in that order) before the reset
  buttons. Before, the window took up to ten rows above what the widget does. The Delta reference
  per session, the Fuel calculation and the Inputs colours are now in their Content.
- **One background for all widgets**: in Appearance, “Widget background” (80% by default) with
  quick buttons for 25, 50, 80 and 100%. On each widget's page, “Background” follows the global
  one (“Global (80%)”) or uses its own opacity, with the same buttons. On a new install all of
  them use the global one; if you already had settings, each widget keeps its opacity (there were
  75, 78, 80 and 85% for no reason), and Appearance says so with a button, “Use Global on all”,
  which moves them to “Global” at once. The Appearance preview uses the global background. The
  help no longer talks about “cars” on widgets without cars. If you go back to an earlier version,
  the widgets on “Global” take the opacity they had by default in it.
- **Session screen, in one place**: each widget page has the same “Show on the session screen”
  switch; in Radar, Inputs, Warning lights, Delta and Fuel it comes out disabled with the reason.
  Appearance no longer repeats the Standings one and only offers “Hide on the session screen” when
  it changes something (with “Always” or following the replays).
- **One name for each thing**: “Class fastest lap” (before also “Class best” in Delta), “iRating
  at stake” (before also “Δ iRating” and “Projected iRating”), “Orientation” in Battle and
  Warning lights (no confusion with the layouts), “Class optimal” in Delta, “Column titles” (no
  confusion with the header), “Race flags” in Alerts and its group “During the race”. In English,
  the Warning lights text side is “Text side” (before, two controls were called “Captions”).
- **Fewer repeated notes**: “Saving to” only appears with two layouts or more (or with a
  “Position only” one in use); the “No header or footer” note no longer shows; how to drag and the
  eye are explained once per page, in Customise, and not in each list; and the help lines that
  repeated what the option already says are removed (the name format example on each widget, the
  one for the Standings mode and the one for “Alternating rows”).
- **One control where there were two**: each header, second line and footer has a single “No /
  Small / Normal / Large” picker instead of a switch and a size (with “No” it is still hidden, and
  its items do not show greyed out: they come back as they were when you pick a size).
  In Warning lights, “Captions: No / Right / Left” (as a row, “No / Yes”). And what does not
  apply is hidden instead of staying grey: the Standings compact mode in full mode, the wheel
  size and colour with the Bar style, “Grows” with a fixed height, the options of a hidden group
  in Traffic, etc. What is saved does not change.
- **Alerts no longer hides in the pits**: its page does not offer “Hide in the pits”, because it
  also hid the limiter, speeding and pit entry alerts. If you had it on, it is ignored (the value
  is kept).
- **A clearer tray**: the “Hide overlay” check box becomes “Show the overlay”, ticked when it
  shows, like the widget ones; the submenu for when it shows is called “When to show” and the
  radar one “Radar range”. In Appearance, the control with those options is called “When to show
  the overlay”.
- **One-line help** in Appearance, Shortcuts and Layouts: each help fits on one line (about
  90 characters) and the rest is behind its ⓘ, which unfolds it below. The Shortcuts and Layouts
  subtitles and the “How they work” notes go from paragraphs to one line.
- **Fuel in practice too** on a new install: it shows in practice (where the use per lap is
  measured) and in races; in qualifying it stays hidden. If you already had settings, Fuel stays
  where you had it.
- **A single way to explain replays**: each widget's “Window” note is built from the same facts
  (whose data it is, where it hides, whether it keeps the live race when rewinding and whether
  Visibility decides it), so two widgets that behave the same say the same and the text only
  changes when the behaviour does: “Follows the car you are watching: hides when rewinding a
  replay”, “Only your car's data: hides in replays, on the session screen and if you watch another
  car”…
- **Narrow window with an icon bar**: below 640 px, the sidebar becomes a column of icons instead
  of a drop-down: each page one click away, each widget's eye next to its icon (you can still see
  and change what is hidden), a line between groups and the name on hover (and for screen
  readers). The search box, the status chip and **Edit mode** go in the top bar.
- **Tidier-looking settings**: six font sizes instead of fourteen (footers and labels, help,
  controls, text, section and page titles), the spacing on a 4 px scale (4, 8, 12, 16, 24 and 32)
  and all the symbols as icons from the same set: the sorting arrows, the drag handle, the help
  ⓘ, the − and + of the counters, the × of the undo note and the mark of the Shortcuts notes,
  with the same weight and colour as the other icons. Settings is still dark theme only.
- **Controls that stand out from the background**: text fields, counters, pickers, switches,
  buttons and the Shortcuts boxes carry the same light border as the check boxes (3.3:1 on the
  card, before 1.4:1); the faint border is left only for separators and cards.
- **A single button to open or close all the lists** in Customise: it says “Expand all” while
  any is closed and “Collapse all” when they are all open, instead of two buttons of which one
  always looked disabled. A disabled button says why on hover: “Reset” on a list that is as it
  comes by default (“Nothing to reset…”) and **Save**, **Duplicate**, **Add** and **Import…** in
  Layouts when no more fit.
- **Names for screen readers**: the “Visible” switch on each page is announced as “Show
  Relative”, “Show Radar”…; the preview tip adds “With the keyboard, from the Customise lists.”,
  and the preview is described (which widget it is and that it is edited with the keyboard in
  those lists).
- **A readable preview in a narrow window**: where the preview would have to be drawn at less
  than 75% (Standings in a 760 px window, or a tall widget in a short window), it is drawn at its
  real size and cropped: the first rows, with a fade at the bottom, and if it does not fit in
  width, the rest with the scrollbar or the wheel with Shift. Before, it shrank so much that the
  smallest text was at 6–7 px and hard to click. Folded into a strip it stays whole.

### Fixed

- **The reason for a disabled row reads well**: on a row that cannot be changed right now
  (“Hide in the pits” in Alerts, “Grows” without automatic height), only its name and its control
  are dimmed; the help that says why keeps the usual grey, with its full contrast (before it was
  dimmed too and ended up at about 2.8:1).
- **A single dot of the picked colour**: with a preset colour picked, the free colour picker
  looks like a colour wheel (to pick another) and not like a second dot of the same colour; it is
  painted with the colour as soon as it is one of your own. In the two **Style** dialogs, “Saving
  to” is stacked (the title and where below it), as on the widget pages.
- **Layouts, tidier**: when editing a layout, **Save** and **Cancel** go together at the end of
  the line and it is the name field that narrows (before “Cancel” dropped alone onto another
  line). With a single layout the arrows to sort it, which did nothing, no longer show; with
  several they measure 24 × 24 px, like the rest of the icon buttons (before 22 × 18). The
  **Files** help says where you export: with **Export…** on each layout's row.
- **Delta › Lines: the “Lap times” row on a single line**: the handle, the eye, the name with
  its help, “3 of 4 parts” and the arrows no longer spread over three lines (at any width and in
  both languages); the long help wraps within its place, as in the other rows.
- **Readable text on bright backgrounds**: with “Text outline” on “Auto”, the outline comes on
  below 65% opacity (before, 35%), so a panel at 50% over a white sky is now readable. The faint
  grey (units, column titles) is a little lighter. With the preview on “Day” and the background
  below 60%, the background control warns that it will be hard to read.
- **“Text size” changes the ten widgets** (Appearance): it multiplies each one's “Scale”.
  Relative, Radar and Delta, which fill their window with the text and did not change, now grow or
  shrink their window in the same proportion (from its centre), in the layout in use and in the
  others; their “Scale” still says the same (100% is their factory size times the text size), and
  “Position and size” takes them back to that size. To read better on 4K it is enough to raise
  the text size, without then touching the scale on three pages. Before, the help said those
  three did not change; now it says “Changes the ten widgets” and, behind its ⓘ, how their window
  grows.
- **Options you turn back on no longer leave a frozen line**, neither in the preview nor over the
  game. When hiding and showing again a part of Delta (lap times, reference, state), of Alerts
  (the flag band, the other alerts as chips), of Fuel (any line) or the Relative column titles,
  that part could keep the old data, not let other alerts come back (Damage, Oil pressure) or
  break the preview until the settings window was closed.
- **Header and footer at the chosen size**: when going from “Large” to “Small” (or changing the
  scale), the bar kept working out the room with the previous font and dropped items that did fit
  (for example the class fastest lap or “SIM”).
- **Hiding with the eye shows at once**: in the Header, Footer, Fuel Lines and Battle Lines
  lists, the item you hide disappears from the preview even if you keep the pointer on the list.
  Before, it stayed drawn in grey until you left the row and it looked as if nothing had
  happened; it shows in grey again (where it would go) if you go over its row again.

## [2.2.0] - 2026-10-29

### Added

- **Shortcuts on wheel buttons**: any shortcut can go on a button of the wheel or its rim, a
  button box, the pedals, the shifter or the handbrake, instead of a key combination. In
  **Settings > Shortcuts** (formerly “Keyboard shortcuts”), **+ Add** waits for a combination or
  a button; it shows as “Button 12 · G29 Driving Force Racing Wheel”, with more than 32 buttons
  too.
- The buttons are only read (Windows Raw Input, like SimHub or Crew Chief): they are shared with
  iRacing, which also gets the press, and nothing is blocked. Holding one down counts once.
- An unplugged device keeps its shortcut and the page says “Disconnected”; when you plug it back
  in it works again by itself. With no shortcut on a button, OverLap does not read the
  controllers.
- D-pads and hats cannot be assigned. Going back to 2.1.1 returns the shortcuts that were on a
  button to their factory combination.
- **Editing in the preview**: on each widget's page, hover over an element of the preview to see
  its name, drag it to move it (in headers and footers, also from one side to the other) and
  click to show or hide it. While you edit, the hidden ones are drawn translucent where they fit,
  so you can get them back: a click shows them in their place and dragging them shows them where
  you drop them. The list and the preview point each other out, and touching something in the
  preview opens its section.
- **Undo when hiding or moving**: when you hide an element (with a click in the preview or with
  its eye in the list) or drag it to another place in the preview, a “SoF” hidden note with
  **Undo** appears at the bottom for a few seconds, in case it was a mistake. With the mouse over
  it or the focus inside it does not go away; **Ctrl+Z** also undoes while it shows. It only
  undoes the last change, and never what you touched afterwards.
- **Header and footer on every panel**: Fuel, Traffic and Battle now have the same header and the
  same footer as Relative and Standings, with the same catalogue of items (time left, SoF, laps
  of fuel, track temperature…), switch, size and Left/Right boxes, and they are also edited in the
  preview. The new ones come off, so nothing changes until you turn them on. Delta, Inputs, Radar,
  Warning lights and Alerts still have none, and their page explains it.
- **Several shortcuts per action**: up to three at once, mixing key combinations and buttons (for
  example `Ctrl+Shift+H` and “Button 24 · G29”, or one button on each wheel); any of them runs
  it. In **Settings > Shortcuts** each action shows them side by side, each with its **×** to
  remove it, and **+ Add** records another; pressing one changes it. Removing the first one moves
  the next one up. A shortcut that another action (or the same one) already has is rejected and
  the page says who has it; one that does not work (disconnected, or in use by another
  application) is marked on its own.
  Where a sentence names an action's shortcuts (the hidden overlay note, the delta, edit mode)
  they appear as “Ctrl+Shift+H or Button 24”.
- Earlier settings load as before. 2.1.1 keeps working with the first shortcut of each action;
  the others are lost if it saves the settings.

### Changed

- **Traffic**: its title is now the shared header (it looks the same and takes more items); the
  group captions become a switch in “Groups”. An earlier settings file keeps how you had them, and
  the “Header” section open or closed as it was.
- In the header, second line and footer lists, hidden items no longer fill the “Right” box: they
  go in a folded “Hidden” group below; when you show one, it goes to the end of its side.
- **Make logos of the same size**: in Relative, Standings and Battle the wide logos (McLaren,
  Hyundai, Subaru, Ford...) no longer look much bigger than the round ones (BMW) or the shields
  (Ferrari, Porsche): each one is drawn at a scale measured from its own outline, in colour and in
  monochrome, centred in the same slot so the column stays aligned.

- **Settings > Customise in accordions**: each section (columns, header, footer…) opens and
  closes separately, with a summary when closed and “Expand all / Collapse all”; it remembers
  which ones you left open. Each header, second line and footer has a “Show” switch with its size
  next to it, and its elements are split between the “Left” and “Right” boxes.
- The drivers' flags are a little smaller (82% of the row height).

### Fixed

- **Standings with cars in the pits**: a car in the pit lane or in its pit box (also towed) no
  longer jumps ahead of you when crossing the line only to drop back behind when passing its box;
  it keeps its position as in iRacing and drops if passed. Also, a car crossing the line in the
  pit lane after the chequered flag could come out first. It affects Relative and Battle the
  same way.
- In the preview, the outline of hidden elements no longer comes out cut inside the headers and
  footers.

## [2.1.1] - 2026-10-29

### Fixed

- **Settings that were not saved**: in some sessions the changes showed in Settings but did not
  reach the file, and were lost on closing. Now a failed save retries by itself every few seconds,
  Settings warns while the changes are only in memory, and the errors go to `overlap.log`, next to
  the settings (“Open settings folder”).
- **Delta**: turning on a time in “Lap times” did not show if the line was hidden in “Rows”; now
  the list warns about it and, when you turn on a time, the line shows.
- “Widget name” is renamed “Widget title”, with an explanation of what it is.

### Added

- Shortcut to open Settings (`Ctrl+Shift+O` by default, the O for options): it opens them or
  brings them to the front, also with iRacing in front. It is changed or turned off in **Settings >
  Keyboard shortcuts**.

## [2.1.0] - 2026-10-29

### Layouts

- With many layouts (up to 30): a search by name or car (ignoring case and accents) from 9
  onwards, the list with its own scroll and the one in use pinned at the top, and a custom sort
  order, by name or by recent use. The automatic switch cars show by name.
- The tray shows the one in use, the one for the current car and the most recent ones (5 at
  most) and “More…”, which opens Settings straight in Layouts (also “Manage layouts…”).
- Layouts also save each widget's options (columns and their order, elements, info bars, delta
  references, wheel style, opacity, sessions it shows in…), and when you apply one they come back
  together with the positions, all at once. The appearance, the visibility and the shortcuts stay
  the same for all of them.
- Each one is “Position and options” or “Position only” (it uses the shared options); you pick it
  when saving or importing it and change it with “Edit”.
- Each widget page says where its changes are saved (“Saving to: …” or “Shared options”) and
  offers “Copy these options to all layouts”.
- Exported files (version 2) carry the options; version 1 files can still be imported. Your
  layouts become “Position and options” with the current options: nothing changes.
- The settings move to version 6. 2.0.0 opens them, but without each layout's options; that is
  why, the first time this version saves the settings of an earlier one, it leaves a copy in
  `settings.json.v5.bak` so you can go back.

### Widgets

- Delta and Battle without the status colour border: the number, the arrows and the text say it.
  The layout in use no longer carries a side stripe either, only the “IN USE” tag.
- Number, logo, flag and name aligned on every row of Relative, Standings and Battle, also on the
  row of another class's leader (“LMP2” reads in full).
- A globe in the flag slot for anyone who does not race for any country (“-none-” or a flag that
  is not a country's); the safety car, spectators and the AI still have no flag.

### Quality

- Memory test of more than 20 minutes with car changes every 3 s, Settings opening and closing,
  edit mode and layout changes: no leaks in OverLap's code, CPU below 0.3%. The automatic switch
  per car, tested over thousands of cycles: only once per real change, never in edit mode and
  without loops.

## [2.0.0] - 2026-10-29

First published version. OverLap is an overlay for iRacing on Windows: it reads the official SDK
telemetry, read-only and without injecting anything into the game, and draws ten widgets on top of
the sim. 1.x, with relative and radar, was for personal use and was never published; its settings
migrate by themselves.

### Widgets

- **Relative**: the cars ahead of and behind you on track (3 and 3 by default, up to 10), with
  class position, number, name, licence, iRating and gap. Class colour on each row, in red anyone
  about to lap you, in blue lapped cars and dimmed the ones in the pits. Optional: tyre and stint
  laps columns, penalty flags after the name and your incidents in the header (“3x · DQ at 17x”).
- **Radar**: top-down view with the cars to scale around yours, going from neutral to red as they
  get closer. Range from 5 to 100 m (20 m by default). A car pulling alongside slides into its
  lane instead of jumping and keeps its side for up to 3 s after iRacing stops giving it.
- **Standings**: compact mode (the front, the cars around you and the leaders of other classes)
  or full. Columns that are sorted by dragging and hide by themselves if the window narrows:
  positions gained, iRating, licence, Δ iRating, gap to the car ahead and to the leader, last and
  best lap, pit, last stop, stint and tyre. Header with your projected iRating and SR, SoF, car
  count and incidents.
- **Battle** (by default races only): your class rival ahead and the one behind while they are
  within the gap you pick, with the gap trend, the catch prediction (“Catching in ~4 laps of
  19”), the difference per sector or per lap and the iRating at stake.
- **Inputs**: throttle, brake and clutch trace, bars, steering wheel,
  gear, speed and ABS, in three layouts (the smallest, bars only). The trace moves its exact
  distance on each sample, without one-pixel jumps.
- **Traffic**: the faster class catching you from behind (how soon and where), the slow traffic
  you are catching and the hazards ahead (stopped, very slow or off-track cars). Anyone lapping
  you, or passing you under blue flag, always shows, in amber or red as they get closer.
- **Alerts**: a band with what affects you, the most important in large. Flags (the meatball
  too), limiter and speeding in the pit lane, “LIMITER OFF” before going in, 10 and 5 laps to go,
  tow with countdown, engine stalled, wrong way, oil pressure, damage with mandatory repair, “BOX
  THIS LAP”, low fuel and each incident as it is added (“+2x Loss of control · L5 · S3 ·
  gravel”). Each case has its option.
- **Delta**: a 30 Hz bar against the reference you pick: your personal best with that car on that
  layout, the session best, your optimal lap by sectors, your class best or your class optimal.
  With trend, predicted lap and sectors. The reference only changes when a lap starts and, while
  it does not exist, the next one is used. Personal bests are stored on your computer and are not
  lost when the session changes.
- **Fuel** (by default races only): litres and the laps they give you, laps left, tank with the
  mark of what you need, use (average, last and maximum), what is missing to the finish and what
  to add next to what is in the pit menu, pit window (“L24–L28”), stops, the saving per lap that
  takes away a stop, the last tyre reading and the fast repairs and tyre sets left if the session
  limits them. It only measures clean laps, and the plan does not jump around within the lap.
- **Warning lights**: the engine warning lights as on a dashboard, as a row or a column: oil and
  fuel pressure, engine stalled, mandatory and optional repair (with the time left), water and oil
  temperature and, if you turn them on, pit limiter and rev limiter. Each severity has its colour
  and its shape, so it reads without the colour. It warns in yellow when the water or the oil rise
  well above your average, before the car's warning light comes on.
- **Conditions footer** under Relative and Standings (on in Standings): track temperature with
  its trend, water and rain when there is some (“DECLARED WET”), average wind with a dial pointing
  at your car from where it blows, air and rubber.

### Overlay and performance

- A single transparent window per screen with all its widgets, instead of one per widget.
  Windows shares the refresh between the windows that update, and the pedal trace and the radar
  stuck at 22–39 fps; now all the panels run at ~58 fps. The overlay memory drops from ~705 MB to
  ~203 MB.
- The windows never take the focus and let clicks through to the game; they only take the mouse
  in edit mode, over an unlocked widget.
- If the window fails or hangs, the GPU is lost, the computer sleeps or a screen's scaling
  changes, the overlay hides and comes back by itself when it recovers.
- A hidden widget is neither drawn nor computed, and each widget is computed at its own rate.
- For OBS, the window capture is “Display N · OverLap”, with all the widgets on that screen.
- “Night Cluster” design: panels with the top edge lit, your row marked with a bracket of light
  in the accent colour and licences as coloured text with their SR.
- Its own icon (OL monogram) for the app and the tray, which follows the light or dark theme of
  the taskbar.

### Edit mode

- Drag a widget to move it, use its edges and corners to resize it or the mouse wheel to scale
  it. It snaps to the edges of the other widgets and of the screen (not with `Alt` or `Shift`
  held down).
- Dragged off its screen, the widget moves to the other one.
- Each label has an eye (show or hide) and a padlock (lock). The labels are drawn on top of
  everything, and a hidden widget shows as a dashed gap so you can get it back.
- The radar is drawn on top of all the widgets, and edit mode marks in orange whatever covers it.
- With iRacing in front, the sim hides the cursor: the overlay warns about it and says how to get
  it back (Settings from the tray or `Alt+Tab`).
- Leaving edit mode in the middle of a drag cancels it.

### Keyboard shortcuts

- Global, they work with iRacing in the foreground: `Ctrl+Shift+H` shows or hides the whole
  overlay at once (the telemetry keeps going, so it comes back with up-to-date data) and
  `Ctrl+Shift+E` enters or leaves edit mode. `Esc` leaves edit mode.
- They are changed in **Settings > Keyboard shortcuts**: press the new combination, or turn off
  or reset each shortcut. It warns if another application already uses it or if `Ctrl+Alt` (the
  `AltGr` of a Spanish keyboard) may stop you typing `@`, `#` or `€`, and it rejects the Windows
  ones, the editing ones and those with neither `Ctrl` nor `Alt` (except `F13`–`F24`, which many
  button boxes send).
- They use Windows `RegisterHotKey`: there are no keyboard hooks and nothing reaches the game.

### Settings

- Settings window from the tray, by opening the app again or with `--settings`. Everything
  applies live and saves by itself; a sample of the widget stays fixed at the top and only the
  options scroll.
- Per widget: visible, locked, background opacity (the text stays sharp and carries an outline
  with low opacity), scale, automatic or fixed height and which way it grows, which sessions it
  shows in (practice, qualifying, race), hide in the pits and reset options or position.
- Appearance: accent colour (six), colour-blind palette (blue and orange instead of green and
  red), text size and outline, density and alternating rows, licence and number style, name
  format and metric or imperial units.
- Personal bests: the list by car and layout, with deleting one, the current one or all of them.
- Tray: Settings, show or hide each widget, radar range, when the overlay shows, hiding it, edit
  mode and the settings folder.
- A damaged settings file is saved as `.bak` and the default values are used. New widgets arrive
  in a free spot, without covering what you had already placed.

### Customisation

- **Elements of each widget**: a common editor in Settings to show, hide and sort what each
  widget draws (Relative and Standings columns, parts of Battle, Traffic, Delta, Inputs, Radar,
  Alerts, Fuel and Warning lights), with a live sample. The usual look is the default value and
  earlier settings migrate without losing anything.
- **Info bars** in headers and footers: you pick, sort and size the items (time or laps left,
  session, SoF, cars, incidents, projected iRating and SR, fastest lap, temperatures with trend,
  wind, rubber, rain, laps of fuel, local time). Always readable: if they do not fit, they wrap
  or are trimmed by priority, never shrunk.
- Optional **column titles** (SR, iR, Leader, Interval…), in both languages.
- **Make logos** in colour (or monochrome) in Relative, Standings and Battle, and each driver's
  country **flags**.
- **Fastest lap** more visible in Standings, with a mark on the row and an item for the info bar.
- **Licences** in outline style, the new default.
- **Delta**: reference per session type (personal best in practice, optimal lap in qualifying
  and in races), an optional line with the last, the best and the optimal at once with the
  reference in use marked, and a shortcut to change the reference for the current session only.
- **Inputs**: shift lights with the car's points, car block (RPM, brake bias, TC level and force
  feedback with a clipping warning) and four steering wheel styles (bar, minimalist, realistic
  and formula) in three sizes, with centre mark colour and degrees. The panel fits its content.
- **Warning lights** as a column with the texts on the left or the right. The repair time is
  marked “(crew)”, the time the crew takes according to iRacing, with an optional real-time
  estimate.
- **Settings window**: light or dark sample background, more columns and a larger sample when
  maximised, and a better fit on ultrawide screens.
- Panels without a side stripe: the status lights the top edge.

### Layouts

- Saves by name where each widget is, its size, scale, whether it shows and whether it is locked
  (one for the MX-5, another for the GT3). Duplicate, rename, delete, export and import as .json.
- They are switched from Settings, the tray or a shortcut, and optionally by themselves when you
  get in a linked car. The layout in use updates when you move the widgets. Earlier settings go
  into a “Main” layout.

### Fixes

- Edit mode stopped responding (neither moving nor hiding) after hours with the app open.

### Languages

- Spanish (by default) and English, in **Settings > Appearance**. It changes the widgets, the
  Settings window, the window titles and the tray menu at once.

### iRacing

- Read-only: it reads the shared memory of the official SDK and draws its own windows. It injects
  nothing into the game process (iRacing uses EasyAntiCheat) and does not turn on `.ibt`
  telemetry recording.
- **Names with accents**: iRacing writes the session data in Windows-1252 and every accent arrived
  broken (`�`); now they read correctly. The names iRacing already sends as `?` (Cyrillic,
  Chinese…) are shown with the team name or as “Driver #7”. Personal bests saved with a track
  whose name was broken are recovered by themselves.
- **Only in the car**: by default the overlay shows while you drive; there are also “Races only”
  and “Always”. Out of the car only Standings stays, on the session screen, with the results. A
  moment out (a reset, the start of a tow) does not make it flicker. It also hides with the
  iRacing UI hidden and in the garage.
- **Replays**: hidden by default. With “Follow the car on camera”, the widgets follow the car you
  are watching and, when rewinding, Standings stays with the live race. The live session screen
  (“Playback: Live”) does not count as a replay, and the tape never adds laps, personal bests or
  incidents.
- Live with the camera on another car, Relative, Standings, Battle and Traffic centre on it; the
  widgets that only have data from your car hide.
- Without iRacing, “Waiting for iRacing…” hides after 8 s. The connection retries every ~2 s, and
  the telemetry process restarts by itself if it fails.
- Simulated mode (`--mock`): a race of ~20 cars in two classes to try it without iRacing.

### Fixes after the real race

What came up when using OverLap in a real online race, when replaying the recording of that race
and in an offline race against the AI:

- **Timing**: lap 1 of a standing start counts from when the lights go green, with the same time
  as iRacing (it came out a second shorter). A towed or reset car is timed from where it appears,
  without false “+0.0”, and the cool-down lap is not timed.
- **Before the green**: clock, laps and SR margin with the scheduled duration, not with the grid
  countdown. Standings lists the whole grid and Relative, the starting position.
- **Positions and gaps**: Relative uses the same positions as Standings; the interval no longer
  repeats the gap to the leader; a retired car stays at the laps it is down; outside races, with
  no time there is no position or “LEADER”. In practice and qualifying the laps left do not go up
  when you get out of the car, and with both a lap and a time limit the clock shows too.
- **End of the race**: the header says “Last lap” and then “Finished” when you cross the line
  (or when the session ends, if you stay in the pit box).
- **Tow and pits**: “TOW” only while the tow lasts and then “PIT”. The tow does not count as a
  stop, and the lap iRacing credits you in the pit box does not add to the stint.
- **Alerts and warning lights**: no false “LIMITER OFF” when appearing in your pit box after the
  tow nor “STALLED” while the tow lifts the car; the engine pressures and temperatures stay quiet
  during the tow, in your pit box and when getting in the car. The chequered flag counts from when
  it comes out, there are no flags out of the car and the meatball does not show to anyone who has
  already finished. Each incident is named after the most serious thing that happened, not after
  the penalty byte.
- **Delta**: it no longer says “invalid lap” without a lap in progress; the out lap and the tow
  say so.
- **Radar and traffic**: a car alongside you whose side iRacing does not give is drawn dimmed at
  its real distance, never on top of your car or stuck to your bumper. In solo sessions the radar
  only uses the iRacing side warnings and Traffic lists nobody.
- **AI drivers and offline sessions**: no filler iRatings or licences (“R 0.0”, “SoF 1”).
- **Tyre**: no compound column when everyone is on the dry one.

### Pending / known

- An fps test with iRacing running is still needed to confirm the overlay's ~58 fps.
- The overlay still has to be tested on screens with Windows scaling at 125% and 150%.
- Conditions footer: it is still to be confirmed what the rubber state means (the one iRacing
  gives at the start of the session) and the wind, whose direction has only been checked in one
  race; the rain scale is not confirmed either.
- Tyre wear: iRacing only measures it with the car stopped in your pit box, so Fuel shows the
  reading from the last stop, not live wear.
- The incident limits (penalty and DQ) are read from the session data; they still have to be
  confirmed in an official race.
- In exclusive full screen the overlay does not show (use borderless window), nor in VR without a
  tool like OpenKneeboard.
- The portable `.exe` is not signed: Windows SmartScreen may warn when opening it.

[Unreleased]: https://github.com/jesus-molano/OverLap/compare/v2.4.1...HEAD
[2.4.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.1
[2.4.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.0
[2.3.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.1
[2.3.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.0
[2.2.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.2.0
[2.1.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.1
[2.1.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.0
[2.0.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.0.0
