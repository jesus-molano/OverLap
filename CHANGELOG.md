# Changelog

All notable changes to OverLap are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/).

## [2.13.5] - 2026-11-03

### Added

- Headers and footers have five new items, hidden by default: **Humidity**, **Fog**, **Air pressure**,
  **Air density** and **Sun height**, with the value iRacing gives. Each one can show its name or an
  icon. Pressure follows your units, and the sun goes negative at night.

### Changed

- The list that opens when you click an empty slot now comes in sections, with its items in
  alphabetical order inside each.

## [2.13.4] - 2026-11-03

### Changed

- The preview's **Scene** is now a switch between a moon and a sun, and **Open in a window** is now an
  icon button that explains itself when you point at it. Both take less room under the preview.

## [2.13.3] - 2026-11-03

### Added

- **Pedals:** the clutch can be drawn as a thin line glued to the brake. It only shows while you press
  it, and the other bars never move. Choose it on the **Clutch** row of **Bars**; the normal bar stays
  the default.
- **Pedals:** the trace can show your gear as a stepped line with its number. In quick downshifts only
  the last number shows. Turn it on in the **Trace** options; it starts off.

## [2.13.2] - 2026-11-03

### Added

- Each item of a header or footer has a **Highlight** option on its row in **Elements**. It draws that
  item in the accent colour of **Appearance** and about 9% larger, so a title can stand out from the
  rest of the bar. It is off by default. The bar keeps its height, and the item's real width counts
  when the bar decides what fits. Anything that signals something keeps its own colour, such as an
  incident limit that is close or a rating going up or down.

### Changed

- A header, second line or footer with nothing to show no longer draws over the game or on the stream
  pages. For example, a line of race figures goes away in practice and the widget takes up less height.
  The line returns as soon as one of its items has data and leaves a few seconds after the last one
  goes, or at once in a new session. It stays in the preview of the settings and in edit mode, with its
  empty slots, so you can still edit it, and an item that always draws, such as the title, keeps its line on.
- The track temperature icon of the bars is now the track seen from the front, with its two edges and
  its centre line, in place of the thermometer on the road.
- The text of a widget now follows its background colour. On a light colour it turns black, with its
  greys, row lines and status colours darkened to match, in the overlay, the stream pages and the
  mirror. Dark backgrounds look exactly as before, and below 35% opacity the text stays as it was
  with its outline, because the game shows through. The note under the colour now only appears on a
  mid tone where neither light nor dark text reads well. On a saturated colour, such as a strong blue
  or red, the licences, the class names, the warning lights' words and the status colours turn paler
  until they read, and the letters under the pedals in Inputs follow the background too. On a light
  colour, the car logos use their printed colours instead of the pale ones made for a dark background.
- The class line in Standings can show its car count with the helmet too. It follows the same
  **Icon and value** choice as the car count in the bars, and that choice is also under **Class line**.
- The abbreviated iRating and SoF now cut the figure instead of rounding it, so 2599 shows as 2.5k and
  not 2.6k. The whole number and values under 1000 stay as they were.
- The clocks of the bars can show their name. **Sim time** chooses **Icon and value** or **Name and
  value**, which reads "TRACK 14:32", and **Local time** chooses **Time only** or **Name and time**,
  which reads "LOCAL 14:32". Both start as they looked until now.

### Fixed

- Alerts no longer shows "LIMITER OFF" in red while your car stands in its stall. It appears as soon as
  the car rolls out of the stall without the limiter, and being over the limit in the stall still shows.
- On tracks whose line is in the pit lane, the stint laps no longer go up to 1 or 2 for a moment when
  you leave the pits. A stint that follows a stop goes to 0 at the line, and a lap ended on pit road
  before stopping still counts until the pit exit.
- On those same tracks, Delta no longer says "invalid" for the lap that starts between the line and
  the pit exit. It says "out lap" from the line.

## [2.13.1] - 2026-11-03

### Changed

- The tyre and helmet icons of the info bars are redrawn. The rubber item shows a tyre with bits of
  rubber thrown up, and the car count a racing helmet from the side.

### Removed

- The icon choice of the SoF item. It always shows as "SoF 2.2k", because three bars read as phone
  signal rather than the strength of the field.

## [2.13.0] - 2026-11-03

### Added

- The size of a widget can be changed from its preview, by dragging a thin strip on its edges as in
  edit mode: only the width while its height follows the content, and nothing while it is locked. The
  edge follows the pointer at whatever scale the sample is drawn. It changes the real widget when you
  let go, with **Undo**, and the sample keeps its scale until the pointer leaves the preview, so
  nothing moves under it. It also works in the preview's own window.
- Standings has **With a single class too** under **Class line**. It is off by default. When it is on,
  a session with one class also draws its class line, such as "MX-5 SoF 2.2k 11 cars", and the SoF and
  the car count no longer go to the bars as well.
- More info bar items can show an icon instead of their name, with **Icon and value** on their row:
  rubber (a tyre with a glint), wind when it has no dial, SoF, car count (a helmet), incidents, laps of
  fuel, position after a stop and stint. Text stays the default. An item is never drawn with its value
  alone. The iRating, the safety rating, the fastest lap and the laps and time gone or left stay as
  text, because an icon would not say more at that size or could not be told apart from another.
- When the options have the room, the rows of a card go to two columns. A row keeps its column when a
  choice brings in another one. A tab with a single list keeps a readable width instead.
- The preview has a divider under it to choose its height with **Whole**, which takes a third of the
  window at most until you do. Each widget keeps its own, a double click returns to the original size,
  and the divider never makes the sample too small to read or the preview larger than its sample needs.
- A preview can go to a window of its own with **Open in a window**. That window stays on top, can be
  moved and resized, also to another screen. The first time it opens right beside Settings when that
  screen has room, and after that where you left it while that screen is connected. It follows the page you are on and every change you make. It is the same sample with
  example data, not the real widget, and it says so. A page with no preview says that in a short
  sentence.
- While that window is open, the options take all the room in Settings, and a line there says where
  the preview is, keeps the scene and brings it back. It closes with Settings and never takes the
  focus from Settings or the sim until you click in it. It stays out of a capture and follows **No
  flashing** like the other windows.
- You edit the preview in that window as you do in Settings. A click hides an element, a drag moves it
  or changes its slot, also to another info bar, and an empty slot opens the list of what it can take.
  **Undo** shows there too. Settings still makes and saves every change, and the keyboard route stays
  in Settings. The Appearance preview can only be looked at, there as in Settings. The window draws the
  same example as Settings, also after a change that needs a different one, such as a single class.
- That window stays above the widgets on screen as well, without flickering.

### Changed

- The sample in a preview is no longer drawn larger than its real size in a wide window.
- On screens of 2200 px or more, the sidebar now stays at the window's left edge on every page, and
  the page is centred in the rest.

- Headers, second lines and footers are now a row of 0 to 9 **slots**, in each widget's **Elements**
  tab. The slots share the width equally. The first aligns its item to the left, the last to the right
  and those between to the centre, so items in slots 1, 3 and 5 of 5 sit at the left end, the true
  centre and the right end. An empty slot is simply space.
- With 0 slots a bar does not show and its items stay saved. The size is now **Small**, **Normal** or
  **Large**.
- An item with nothing to say, such as the water on a dry track, keeps its slot empty, and nothing else
  moves.
- An item too long for its slot takes room from the empty slots and then from others with room to spare.
  If it still does not fit, the least important item goes, whole, and its slot stays empty. It comes
  back only when there is clearly room.
- In the preview, a click on an empty slot lists what can go there, and a click on an item removes it
  from the bar. You can drag an item to any slot of the header, the second line or the footer of that
  widget. If the slot already holds an item, the two swap places. While the **Elements** tab is open,
  each empty slot shows as a faint outline that changes nothing in the widget. A slot whose item has
  nothing to say now shows that item's name, faint, so you can tell it from a free one.
- A bar with slots always keeps its height, even when none of its items has anything to say, so the
  widget never jumps when the data comes and goes. Only 0 slots hide a bar.
- Editing a bar in the Standings no longer changes which classes the preview draws. With several
  classes, the SoF and the car count stay on the class lines, and their slots show their names.
- The **Elements** tab offers the same with the keyboard: a row per slot, arrows to move an item one
  slot, and a menu to send it to any slot of any bar or to choose what goes in an empty one.
- Reducing the slots of a bar never loses an item. The items move into the free slots, and a sentence
  says so. If they would not fit, the bar keeps its slots and a sentence says why.
- The same item can stay in two bars of a widget, such as the clock in the header and in the footer. The
  list that an empty slot opens says when another bar already has it.
- Your saved bars, layouts, per-car profiles, layout files and backups change to slots once, on their
  own, with everything shown in the same order. The right side's marker and each separator become
  empty slots.

### Fixed

- A sample no longer changes height under the pointer while you touch an option, and a small
  difference no longer shifts the options after the pointer has left them.
- Standings at its default 540 px keeps the country flag, because the driver name gives way a little.
- A page that fits in the window no longer has a scrollbar. The line that says changes are saved now
  sits right under the options instead of being pushed to the bottom. A short tab opened from far down
  a long one shows no scrollbar either, and it returns to the top once the pointer leaves the options.

### Removed

- Bars no longer have the **Left** and **Right** boxes, the **Separator** or the sharing of room by
  blocks. Slots replace them.
- Bars no longer draw grey hidden items in the preview.
- The preview no longer draws what is hidden, in any widget. There are no more translucent columns,
  rows or sections, and no translucent unlit lights with **Lit only**. It shows only what the widget
  really shows, so opening the **Elements** tab adds nothing to it but the faint outlines of the bars'
  empty slots. A click on an element still hides it, with **Undo**, and what is hidden comes back with
  the eye on its row in the **Elements** list.

### Fixed

- Pointing at the preview no longer moves anything, and neither does opening the **Elements** tab.
- Hiding an element from the preview on top no longer moves the options while the pointer is on the
  preview. The preview keeps its height until you leave it, and a small difference stays until you come
  back to the page.

## [2.12.1] - 2026-11-02

### Fixed

- The first items of the Settings side menu no longer stretch and sit far apart on tall screens.

## [2.12.0] - 2026-11-02

### Added

- Track map has a **Legend** tab. It shows your car, each class, a car off track or crawling, a car a
  lap up or down, the pits row, the cars without data and the pace car, each as the widget draws it.
  It also says that a dot only tells where that car is along the lap, because iRacing gives no
  sideways position.
- Delta stays visible while you drive with no reference at all yet. It shows iRacing’s current lap
  time, empty sectors and a sentence saying that you need a clean lap to see the delta. It never
  shows an invented delta or a predicted lap. On a dirty lap, the lap is also marked invalid. In a
  narrow window the sentence is shorter, and the widget keeps its height.
- Delta has a **Show without a reference** switch, on by default. Off, the widget stays hidden until
  there is a reference, as it did before. It only shows while you are on track, never in the garage
  or out of the car.
- Headers and footers have a **Separator**: a thin line you add from **Add a separator**, on the left
  or on the right, and drag between items like any other. Each one has its own size and can be
  removed. A bar can have as many as you want, and they are saved with the layout. It shows only
  between two items. When room is short, separators shrink and then go, before any item is removed.
- **Water on track** has a **Format** on its row: **Graph and text**, **Text only** or **Graph only**.
  **Rain**, **Air temperature** and **Track temperature** have one too: **Name and value** or **Icon
  and value**. The track's trend arrow stays in both. Each widget keeps its own, and today's look is
  the default.
- Appearance has a **Background colour** next to the widgets’ background, with a colour picker and
  four dark swatches. Each widget can follow it or have its own on its page, and the opacity applies
  on top of it. It reaches every widget, the stream pages and the screen mirrors, and it is saved
  with the layouts. A note appears under the picker when the text would be hard to read on that
  colour, and the colour can still be chosen. The default is today’s.
- Appearance has **Your row’s highlight**: **Line**, today’s look and the default, or **Gradient**,
  where your accent colour crosses the whole row from left to right and fades towards its end. It
  applies in Standings and Relative.
- Appearance has **Lines between rows**, on by default. It decides whether a thin line is drawn
  between rows while **Alternating rows** is off. With both off, nothing is drawn between the rows,
  neither the lines between groups in Traffic nor the dotted line where Standings skips rows.
- Pedals has a **Show** choice: **What you press**, the default, or **What the car applies**. When
  stopped, iRacing applies the brake and the clutch by itself, so with the second choice both show
  at full without you touching them.

### Changed

- Alerts no longer shows `DAMAGE · pit for mandatory repairs`. iRacing can turn that warning on for
  a few seconds with no flag and turn it off alone, so the band now leaves it to iRacing's real
  meatball flag. The mandatory repairs warning light stays, and its legend says only what iRacing
  reports.
- **Saving to**, at the top of a widget's page, is now one small line with no box and no help text.
  **Copy these options to all layouts** moved to the **⋯** menu on that line, with its second click
  to confirm and the sentence saying how it went. The line still does not show with one layout.
- **Search settings** now finds **Small** of **When scrolling**, the preview's third fold choice, by
  its own word and by “strip”. It also finds **Scene** and **When scrolling** themselves.
- Section notes now wrap more evenly, and the note on the warning lights page is written in full
  sentences.
- The meatball flag on a driver’s row now looks like the real one: a black square with a large orange
  disc, with no pole, as big as the other two flags and with a fine light edge so that the black
  does not vanish on the dark panel.

- A header or footer with items only on the left keeps them together from the left. With items on
  both sides, each side takes room in proportion to what it holds and shares its free room between
  its items, so no large hole is left in the middle. A lone item on the right sits at the end of the
  bar.
- An item now leaves a header or footer only when the line really does not fit, by what the items
  take as drawn, and not because of a fixed width kept for each one. An item that left comes back
  only when there is clearly room to spare, so a value that grows from 9:59 to 10:00 does not make
  items come and go. The least important item still goes first, and a bar's height never changes.

- Three tabs of every widget page have new names, in the same place and with the same settings:
  **Content** is now **Options**, **Customise** is now **Elements**, and **Window and visibility**
  is now **Size and visibility**. In Track map, the **Elements** list is now **Map parts**.
- Settings is easier to read at a glance. Section titles are larger and no longer in capitals, there
  is more space before each section than between two rows, and a tab no longer repeats its own name
  as a title above its rows. A tab's reset button is now at the end of the tab bar.
- Under its name, each widget's page now says what the widget is for. Its size moved to the first
  line of **Size and visibility**, and the note that a widget is hidden is now a line under that
  sentence.
- The preview's tip is one line, it shows only in **Options** and **Elements**, and it goes away
  with **Got it** or your first change in the preview. The rest of the tip is behind its info icon.
- Many help lines are shorter, and the technical detail moved behind the info icon. **Size and
  visibility**, **Streaming & VR**, Delta, Fuel, Alerts and Warning lights were rewritten in full
  sentences, and each note now sits next to the setting it explains.
- Some names now say one thing each. **Compact mode** in Standings is now **Short table**, the
  preview's **Scrolling** is now **When scrolling**, with the choices **Folds**, **Whole** and
  **Small**, and the boxes in the Alerts and Warning lights lists are **Also in Warning lights** and
  **Also in Alerts**. Help texts no longer name a colour that the colour-blind palette changes.
- **Edit mode** is always in view at the foot of the sidebar. The list of shortcut keys under it
  shows only when the window is at least 1000 px high, and every shortcut is still on the
  **Shortcuts** page.
- On a very wide window, the cards of one-column tabs and long notes stop growing, so a control
  stays close to its label.
- In **Elements**, the two columns start level, the right one stays in view while the main list
  scrolls, and its bars are in the order the widget draws them.
- In the **Drivers** tab every row now reads the same way, with the choices under the label and its
  help. A line over the rows says what **Global** means, with a button to Appearance.
- **Appearance** has one **Language and units** card in place of **Language** and **Other**.
  Resetting it still does not change the language. **Country flag**, **Penalty flags** and **iRating
  in the licence colour** are switches now, and the styles are described in one short sentence each.
- **Visibility** shows the table of widgets first. **Bring every widget to this screen** moved under
  it, in a section called **If a widget is stuck on another screen**, and **A widget does not show?**
  in the help takes you straight there. The boxes of a widget that is off are dimmed, and they still
  work.
- **Shortcuts** explains how to use a cell above the table. Its columns are **Main shortcut** and
  two **Alternative**, the action's column is wider when there is room, and a cell where nothing can
  be assigned yet is blank.
- **Layouts**, with a single layout, starts with **More options** open so the examples are in view,
  and that layout's name no longer leaves room for a drag handle. With links and the switch off, it
  now says that the links do not apply until you turn layout switching on.
- **About and help** is now **Help and about**, and it starts with **Quick help**. In **Licence**, the
  licence text and the logos' text are folded under their titles, and the buttons stay in view.
- In a narrow window, a widget page's three buttons stay together on one line, the styles go two by
  two, and the widget's name stays in view when the **Visibility** table scrolls sideways.
- The welcome keeps the same height on every step, so its button no longer moves. In step 2, pointing
  at a widget says what it is for, and step 3 adds **Ctrl+K** to search any setting.
- On the widgets, some texts read better over the game: Fuel writes **Measured on lap 12.** and
  **Measured when you stop in the pits.**, the clock of a timed session says **19:13 left** or **5:47
  done**, and Battle writes an estimate with **≈**, as in **≈1 lap and 11 left**. Track map says **3
  without data**. What each widget computes has not changed.

## [2.11.3] - 2026-11-02

### Added

- A new item for the info bars, **Rain**, shows iRacing's precipitation percentage, 0% too. It is
  on by default wherever the conditions are.
- A new item for the info bars, **Track name**, shows the circuit's name as iRacing writes it, and
  its short form when the line is tight. A new install has it as the first item of the Standings
  footer. If you already have OverLap it starts hidden, and you can turn it on in **Customise**.

### Changed

- Each header and footer is one line with its data together, with no empty hole in the middle. This
  applies once to the bars you already have, in your layouts too and in the layout files you import
  from an older version, and everything you had shown stays shown and in its order. If you want
  something at the far end, you can still drag it to the **Right** box, and it stays there.
- **Water on track** no longer includes the rain, which is now its own item. Your bars get it right
  after the water, shown if the water was shown. It is the first item to go when a line is tight, so
  your bars keep drawing what they drew.
- The class line in Standings has its SoF and its car count right after the class name instead of at
  the far right. A narrow panel shortens the class name, never them.
- The black flag and the black-and-white warning flag on a driver's row are larger and have no pole.
  They still differ by their shape: one is swallow-tailed, the other a square split along its
  diagonal.

## [2.11.2] - 2026-11-02

### Changed

- Traffic's slow warning is back to how it was before 2.11.1. The 2.11.1 rule warned later at slow
  corners, so a car is slow again when it is well under its own pace, and Traffic warns earlier at
  those corners and also warns of cars in them. The guard for holes in the data stays, so a short
  hole does not read as a slowdown.
- The blue flag is no longer shown while the green flag is out, as in iRacing's own graphic. It
  lasts exactly as long as iRacing gives it, whatever **Keep visible** says.
- The blue flag now describes rather than orders: it says there is a faster car behind instead of
  telling you to let it pass.
- Traffic's rule of 2.11.1 for the blue flag is undone. Under a blue flag it again lists any car
  behind that can be passing you, with the same reading of the flag as Alerts.

## [2.11.1] - 2026-11-02

### Fixed

- Traffic no longer calls a car slow when it is not. A car is now slow when it is well under what
  the slower cars do at that point of the lap, learned from the clean laps of the event's sessions,
  so a car in a slow corner is no hazard and a short hole in the data does not read as a slowdown.
  What qualifying learned warns on the first lap of the race. Until a point of the lap has enough
  clean laps, nothing is called slow there. A stopped or off-track car still warns at once.
- Cars in their stall at the green no longer lead their class. A car that has not started racing
  stays behind the running cars, in grid order, in the standings, the relative, the places gained
  and the battle, until it is out on track. A real pit-lane start then takes its place as usual.
- No last lap for a lap that never happened. A lap broken by a tow, a reset, a teleport or leaving
  the world has no time any more in the delta, relative and standings. A short hole in the data does
  not lose a real lap, and iRacing's time of a lap stays when the car leaves the world.
- The first lap of a race has one time. It now always reads as iRacing times it, in every widget,
  team races included. OverLap shows no time of its own for it, so it stays empty until iRacing
  publishes it, and the delta shows no time at the line that ends it.
- Traffic under a blue flag lists a car as passing you only when it is really gaining on you, not
  a slower class you have just passed.
- A car no longer loses a lap for a moment when iRacing's lap counter goes back for a second after
  a hole in the data, which showed it a lap down on the track map and the relative and left its stint laps one short.
  A counter that stays lower is still believed, about three seconds later.

## [2.11.0] - 2026-11-01

### Added

- **Track map**, a new widget in its first form: every car along one line, at its fraction of the
  lap, with the start/finish and the sectors marked. Classes differ by colour and by shape, your car
  is larger and ringed, a car a lap up or down on you has its own outline, and the pace car is grey
  and labelled PC. It never places a car it has no data for: one on pit road goes to a row of its
  own with no place along it, one off track or stopped keeps its place in another style, and in a
  race a registered car with no data is named in a line at the foot. It is off until you turn it on, it
  works in a team race with a teammate driving, and it works as a stream source and in OpenKneeboard.

## [2.10.0] - 2026-11-01

### Added

- **Laps and time as separate items** for the headers and footers: laps done and total (`8/15`,
  `8/≈16` when the total is an estimate), laps done, laps left, time gone and total (`24:12/45m`),
  time gone and time left. Show any of them, in any bar, in the order you like.
- **Stint laps** as an item: the laps since your last stop.
- **Position after a stop** as an item: an estimate in races of where you would rejoin if you
  stopped now. OverLap measures what a stop costs from the stops of the session, so it appears once
  someone has stopped.
- **The iRating at stake in parts**: the figure of your place, one place up or down, and the
  break-even place can each be shown on their own. The whole item is still there.

### Fixed

- In a narrow settings window, two columns that stack no longer touch: Appearance's sections keep
  their usual gap.
- After the flag of a practice or qualifying session by time, the laps left no longer showed a count
  made up from a clock that measures something else.

## [2.9.0] - 2026-11-01

### Changed

- **The delta in team races compares with your own laps.** The session best and the optimal lap
  used to count every driver in your car, so the slower driver always chased a teammate's times.
  Now they only count the laps you drive, and so does the lap times row. Until you have a clean lap
  the delta uses the team's, with a **team** tag next to the reference. To go back, set **In team
  races, compare with** to the whole team in **Settings › Delta**.

### Fixed

- A class fastest lap that a teammate set in your car was named as yours (**You**). It now carries
  the **team** tag.

## [2.8.1] - 2026-11-01

### Added

- **A way to OverLap's website**: **About and help** has a button that opens
  [overlapsim.com](https://overlapsim.com), and the READMEs link to it.

## [2.8.0] - 2026-11-01

### Added

- **OverLap in VR through OpenKneeboard**, a free program that shows web pages inside the headset.
  Add a **Web Dashboard** tab there and paste a widget's URL. The page tells OpenKneeboard its name
  and size, so each tab is named after its widget and the widget fills its panel with a transparent
  background. It is tested with a Quest 3S and Meta Horizon Link. The **VR guide** button at the top
  of **Settings › Streaming & VR**, which is the page's new name, and the README's VR section give
  every step: iRacing in OpenXR, placing the panel and what to do if it does not show.
- **A Discord for OverLap**: suggest ideas, report faults and share your layouts. It is linked beside
  the **Settings** title and in **About and help**.

### Changed

- **The Spanish interface now says «layout»** instead of «disposición». Searching the settings for
  «disposición» or «diseño» still finds the page.
- **`overlap.log` no longer shows your Windows user name**, so it is safer to attach to a bug report.
  Your user folder is written as `%USERPROFILE%` in every line, and the lines earlier versions left
  in `overlap.log` and `overlap.old.log` are cleaned the next time OverLap starts. The log can still
  contain driver names from your sessions.

## [2.7.2] - 2026-11-01

### Changed

- **Every text reads as a person would say it.** Settings, the tray, the confirmations over the game
  and the stream pages use natural, complete sentences instead of fragments glued with semicolons
  and colons, in Spanish and in English, at the same length or shorter. The labels on the widgets
  themselves do not change.
- **Descriptions sit under their title everywhere**, never beside it: the info bars’ sides, the
  hidden items of a list, a layout’s mode, **How they work** on Shortcuts, the edit-mode banner and
  **Overlay hidden**, as well as the preview’s tip.

### Added

- **A reminder after changing the streaming port**: your sources still use the old one, so drag them
  to OBS again or copy their URLs again. It goes away when you close it or when a source connects on
  the new port.

## [2.7.1] - 2026-11-01

### Added

- **Tell your screens apart** (**Streaming › Screen mirror**): each display draws its monitor small,
  with the stream widgets on it where they are, and says how many it shows (“5 stream widgets”, “No
  stream widgets”). **Identify** shows each display’s number in big over its monitor for three
  seconds, so you know which one to drag; it never shows in a capture.
- **Ctrl+K** (or **Ctrl+F**) anywhere in Settings puts the cursor in **Search settings**, which
  shows the key while it is empty.

### Changed

- **The setup curtain’s text is optional**, with an image or without one: **Show text** (on by
  default) off leaves a plain opaque panel, or your image alone.
- **About and help** sits with the pages at the top of the sidebar, instead of at its foot under
  the shortcut keys.
- The accent colour shows in a few details of Settings: the current page’s rail and icon, a switch
  that is on and a slider’s filled part. Everything else stays neutral.
- The sidebar’s shortcut keys take one line each (Shift drawn as ⇧; the full keys on hover).
- **Example layouts** say what they are (layouts made by OverLap to start from, added without
  touching yours) before the chosen one’s description, and **More options** says what it holds
  under its name.
- The welcome’s **Where everything is** says that the tray icon opens a menu, and that widgets
  showing when you get in the car is the default, which you can change in **Visibility**.
- Section notes in Settings sit under their title, never beside it, so a narrow window no longer
  breaks the title into a word per line.
- The Streaming page explains itself better: what a screen mirror is for (one source with all of a
  monitor’s stream widgets, instead of the single widgets, not with them), why a new source is empty
  without iRacing on track and how to place it before (`?preview=1`), when **Hide the overlay from
  capture** is needed (only if your streaming program captures the whole screen), and that the
  setup curtain may cover the whole canvas or just a part. The texts speak of any streaming program,
  with OBS as the example; the size each widget’s row gives is now “Source size”.

### Fixed

- **From another PC on my network**: turning it on for the first time could leave the page without
  the address to type on the other PC and without this PC’s code until Settings was reopened. The
  code is now made in the same change as the switch.

## [2.7.0] - 2026-11-01

### Added

- **Streaming mode** (**Settings › Streaming**, off by default): your widgets in **OBS, Streamlabs,
  vMix or XSplit** as a **browser source**, transparent, placed and sized in your streaming program.
  OverLap opens a small local server only while it is on: it listens on `127.0.0.1` only (nothing on
  your network or the internet can reach it), refuses requests from other web sites (Host and Origin
  checks) and is read only (a page can only receive the widgets' data; nothing it sends is read).
  Off, no port is open. It serves the stream page's own files only (by their exact names, from the
  build's manifest), takes at most 16 pages, and sends a page only the settings its widgets draw
  with (never controller names, shortcuts or layouts). Your streaming program must run on the same
  PC.
- **One URL per widget** (`http://127.0.0.1:39217/w/relative`…), drawn by the same widgets as the
  overlay, scaled to the source's size, and one **screen mirror** per screen
  (`…/screen/1`): the stream's widgets where they are over the game, a replacement for capturing the
  overlay window.
- **Widgets in the stream**, chosen apart from what you see on screen: a widget can be in the stream
  while it is hidden on your screen (OverLap then computes it for the stream only). By default:
  Standings, Relative, Inputs, Delta and Battle; Fuel (strategy) and the driver aids (Radar,
  Spotter, Traffic, Warning lights, Alerts) stay out until you tick them. Each row has **Copy URL**
  and the size to give the source (the width, and room in height, for a widget that grows with the
  session). Off, the page says the URLs do not answer yet; a mistyped address draws nothing on the
  stream. The pedals' trace is drawn at the source's size, as sharp as the text.
- **Setup curtain** (`…/curtain`): while iRacing shows the garage (IsGarageVisible), an opaque panel
  with your text (“Adjusting the car…” by default) covers the stream; transparent the rest of the
  time, and never on your own screen. Once up, it stays up if the connection drops (OverLap
  restarting, streaming turned off) until OverLap is back and you leave the garage.
- **An image on the setup curtain** (**Setup curtain › Image**, «Imagen»): your logo or a
  background, PNG, JPG, WebP or GIF (animated too) up to 20 MB, checked by its first bytes and not
  its name. OverLap keeps a copy in its folder (`stream/`), so it keeps working if you move the
  file; the settings only say there is one, never where it came from. **Sizing: Fill** (default)
  **or Fit**, **Show the text on top** (on by default: low, on a soft plate with a shadow), and
  **Remove image** (deletes the copy). The stream changes at once, without reloading the source.
  The server serves that copy only, at `/curtain/image` (with the same Host and Origin checks;
  404 without one), and no other file of yours. **Import everything** never brings an image
  (this PC's stays); **Reset everything** takes it off the curtain and keeps the copy until
  OverLap next starts, so its **Undo** brings it back. **Search settings** finds it by
  imagen/image, logo, foto/picture and fondo de la cortina.
- **Drag to OBS**, next to every **Copy URL** (widgets, screen mirrors, curtain): a link you drag
  from the Streaming page onto OBS's scene, and OBS makes the Browser source itself (it asks each
  time, “Add Source via URL”: say Yes), named “OverLap · Relative” and at the widget's size on your
  screen (a list that grows with the session, such as Standings, gets its width and room to grow,
  600 to 1440 px; another auto-height widget, such as Inputs, twice its height; a mirror and the
  curtain get the canvas size). It uses the `layer-name`, `layer-width` and `layer-height`
  parameters OBS reads from a dropped URL and takes out of the URL it saves (OBS 28 to 32); the
  server ignores them. A click on it opens nothing and says, for a moment, to drag it. **Copy URL**
  stays for Streamlabs, vMix and XSplit.
- **From another PC on my network** (**Settings › Streaming › Separate streaming PC**, off by
  default): for a separate streaming PC at home. On, the server also listens on this PC's private
  IPv4 addresses (followed as they change; the likely one listed first) and answers only computers
  on that address's own network (its subnet: never a public address, carrier-grade NAT or another
  private network such as a VPN's). Everything from them must carry this PC's code: 20 random
  characters made on this PC the first time, shown in groups of four without I, L, O or U, typed in
  any case and with or without dashes; in the address (`?t=`), or for the stream page's own files
  in an HttpOnly, SameSite cookie named after the port and sent only to `/assets/`; compared in
  constant time, never written to the log. The right code always passes; an address that tries
  wrong codes waits, from 1 s doubling up to 5 min, and the code before **Change the code** (an OBS
  source still retrying with it) or a wrong cookie alone is refused without counting, so the
  streaming PC is never locked out. The Host must be one of this PC's network addresses or its
  name, and the Origin checks stay. This PC needs no code, as before. Turned off, the network
  listener closes and the other PC's sources are dropped at once. The code belongs to this PC:
  **Import everything** and **Reset everything** keep it (a reset turns the switch off), a backup
  file never carries it. The page explains it in numbered steps in plain words (turn it on; type this
  address exactly into the browser's bar on the streaming PC, “Try this first” when there are two
  and “If the first one doesn't open, try this”, with **Copy address**; enter this PC's code, hidden
  until **Show** since the Settings window is often on stream; drag each widget into its OBS; if
  Windows asks, tick only “Private networks”), a line on how the other PC is doing (“Waiting for the
  other PC”, “Connected: 1 source from another PC”, “You changed the code: update the other PC's
  sources” until one is back, “Off: the other PC gets nothing”), a short **If it doesn't work** list
  (same home network, address bar, the other address, network set to Private, the firewall's
  Private tick, the installed version, a changed code), and **Change the code** on its own quieter
  line with a second click that says what to redo on the other PC.
- **Links page** (`…/links`): every address of the stream on one plain page, to open in a browser on the
  streaming PC and drag each source into its OBS (each one with a grip and “Drag to OBS”), or
  **Copy URL** (its one script, allowed by its hash, copies over plain http or selects the address
  for Ctrl+C); from another PC every address on it carries the code, and without the code
  the page is a small form to type it (it says when the code was wrong, changed, or tried too often, from the try that makes it wait); the
  warning that the addresses carry the code shows once, small, at the end.
- **Brand logos in the stream**: As on screen (default), Monochrome, Text or None.
- **Hide the overlay from capture** (off by default): Windows leaves OverLap's windows out of screen
  captures, also out of your own recordings and Discord; Windows does not guarantee every program
  honours it.
- A fixed, editable **port** (39217 by default, away from SimHub's 8888 and obs-websocket's 4455);
  when another program has it, the page says so and offers a free one, but OverLap never changes it
  by itself, so OBS sources never break silently. The page shows how many sources are connected.
- The stream pages **reconnect by themselves** when OBS reloads them or OverLap restarts, **reload
  themselves** after an OverLap update, stay **empty and transparent while iRacing is not running**,
  and take `?preview=1` to show sample content while you place them. They are built for the
  Chromium 127 of OBS 31/32's browser source and bring their own font (Inter, SIL OFL 1.1) for a PC
  without Segoe UI Variable.
- A short guide on the page for OBS, Streamlabs, vMix and XSplit, and a **Streaming** section in the
  user guide. **Search settings** finds it by streaming, OBS, Twitch, URL, curtain/cortina, setup
  and capture/captura.
- Measured with the mock race and two stream pages connected (`/w/inputs` at 60 Hz and a screen
  mirror): about 115 messages and 85 KB per second on the loopback, and some 2 % of one core more in
  OverLap's main process (0.2 to 5 % over three rounds); with no page connected the server does no
  work at all.
- **Traffic: the gap as in the Relative.** Battle's **Gap** option, in Traffic's Content with the
  same choices: **Unsigned** (by default, as always: “catches you in 6 s”, “you catch it in
  5 s”) or **As Relative**, where each car line shows its time exactly as the Relative does,
  positive ahead and negative behind, without the words before it. A hazard keeps “at 3.2 s”:
  how far it is, not a rival.

### Changed

- **Layouts page, easier to read** (same features and settings): each row is its name, its cars,
  **Apply** (or **In use**) and a **⋯** menu with the rest; drag a row by its handle (or use the
  arrow keys on it) to reorder. Three blocks: the list, **New layout** (what it restores, the
  examples and the import folded under **More options**) and **Per car**, with every car link in
  one list, whose switch is now **Switch by itself when you get in a car** (it was **By car**).
  **Bring every widget to this screen** moved to **Visibility › Screens**, above the widget table.
- **New examples** (**Layouts › More options › New from an example**): **Balanced** (the essentials
  for a race in comfortable places, factory options) and **Race engineer** (every widget, small and
  dense along the edges, each in its other look) replace Light and All widgets. Each comes with its
  own places for the screen your widgets are on (drawn for 1920 x 1080, kept to their edges on any
  16:9 size) and its own options; your settings and your Appearance are untouched.
- **Widget page tabs: no change dot.** A dot on a tab read as something pending; each section's ↺
  and the **Reset…** menu say what differs from the defaults.
- The renderer is built for Chromium 127 (OBS's browser source); Electron's newer Chromium runs it
  the same.
- The README's and PRIVACY.md's network wording: the update check is still the only connection to
  the internet; streaming mode only listens on this PC, or also on your home network, with a code,
  when you turn that on.
- **Reset everything** and **Import everything** keep this computer's stream port (your OBS sources
  have it); an import also keeps whether streaming mode is on here, so it never opens a port.

### Fixed

- **Column titles** in the standings and the relative are never cut off any more, in Spanish or
  English, at any size or density: the narrow columns use the timing screens' short words (STN for
  the stint, PAR. / STOP for the lap of the last stop, LIC for the licence letter, GAP for the gap
  to the leader in English), the tyre column gets its title (NEU / TYR), the relative's position
  and tyre columns are a little wider for theirs, and a test checks every title against its column.

### Pending / known

- OBS 31/32 (Chromium 127) and 33: every URL, the Inputs trace at 60 Hz, transparency, the curtain
  in the garage; Streamlabs, vMix and XSplit.
- That Windows Firewall does not ask on a clean Windows 11 (the server is on 127.0.0.1 only).
- Which programs honour **Hide the overlay from capture**.

## [2.6.0] - 2026-11-01

### Added

- **Tabs on every widget page.** Under the preview, each widget's page now has a tab bar with the
  same names in the same order everywhere: **Content**, **Customise**, the widget's own tab where
  it has one (**Drivers** on Relative, Standings, Battle and Traffic, **Personal bests** on Delta,
  **Legend** on Lights) and **Window and visibility**. One tab shows at a time, and the bar stays
  under the folded preview while you scroll. Each tab has an icon and says what it holds in its
  tooltip; `Ctrl+PgUp` / `Ctrl+PgDn` change tab from anywhere in the page, and the arrow keys,
  `Home` and `End` while a tab has the focus.
- **A dot for what you changed**: a small, quiet dot on a tab whose settings differ from the
  defaults (its tooltip says how many), the same thing as that section's ↺.
- **The tab you chose is kept** as you go from widget to widget while the window is open; a page
  without it opens on its first tab, and the next page that has it opens on it again.
- **Lines that take you to the right tab**: on Alerts and Lights, “Which alerts/lights show · Go
  to Customise”; on Battle, and on Spotter and Lights while “Only with a car alongside” or “Lit
  only” is on, Window and visibility names the row of Content that also decides when the widget
  shows, and goes to it; Personal bests says where the delta's reference is chosen; under the
  iRating format in Drivers, the iRating column's row in Customise; under the columns of Relative
  and Standings, “Row height: Density, in Content”; and under the height, “The width is changed
  with Edit position” (“The size…” where the height is the window's too).
- **Names of › Team · driver**: a third choice beside Driver and Team, in Appearance and in the
  Drivers tab of Relative, Standings, Battle and Traffic. One line, the team's name as always and
  then, after a dot, the driver's in the name format, smaller and grey: “Vela Rossa Corse ·
  M. Echeverría”; the row keeps its height. The team comes first: short of room, the driver's part
  is cut before the team's. A car without a team of its own shows its driver alone, and the Delta's
  class best names the team. The shortcut (now **Names: driver, team or both**) goes Driver, Team,
  Team · driver and back, and the tray's **Team names** box is now a **Names** submenu with the
  three.

### Changed

- **Search, “Show in list” and the preview with tabs**: a search result and the undo toast’s
  “Show in list” open the tab that holds the setting, then point it out. An edit in the preview
  (an eye, a drag) never changes the tab; a click on an element that is always shown, or that
  Drivers shows or hides, opens its tab, brings its row into view and points it out.
- **Search** lists a setting of its own before one that every widget page has: “opacity” finds
  Appearance's “Widget background” first, then each widget's Background.
- **Delta's references** are now called “Reference in practice”, “in qualifying” and “in race”,
  so searching “reference” finds them.
- **“Driver” is now “Drivers”** everywhere: the tab, its section, the reset items and the hints in
  the column lists. The **Reset…** menu lists the sections in the tabs' order.
- **Background** in Window and visibility and **Widget background** in Appearance say “opacity”
  and “transparency” in their help, so the search finds them by either word.
- **Wide window**: Customise puts its main list on the left and the other lists on the right (a
  page with a single list keeps it full width), and Drivers and Window and visibility lay their
  rows out in two columns.
- **Narrow window**: the tab bar stays one row; first the icons go, then “Window and visibility”
  says “Window” (and “Personal bests” “Bests”; the full name stays in its tooltip), and only then
  the bar scrolls sideways. The lines that go to another tab keep their button beside the text.
- The user guide's screenshots are in English (README.md) and Spanish (README.es.md), from 2.6;
  Installation starts with a note on the Windows SmartScreen warning and what to do.

### Fixed

- The standings' class list, which a multiclass session fills by itself, no longer counts as a
  change of yours (its ↺ and “Reset…” item stayed on at the factory settings).

## [2.5.3] - 2026-10-31

### Changed

- **OverLap is now free to use but closed source** (freeware), from the next version on. It stays
  free of charge, with no account, no ads and no paid features, for personal and commercial use
  (streaming included), and you can share the official installer or portable as they are; it may
  not be sold, modified or redistributed modified. The new licence is in `LICENSE`, with a
  summary in Spanish. The source code has moved to a private repository; the public one,
  github.com/jesus-molano/OverLap, keeps the downloads (and the updates the app looks for), the
  user guide, the licence, the notices and the issues.
- **About and help › Licence** says it in both languages (“Free to use, not open source”), and the
  **Source code** button is gone; **Licence** and **Third-party notices** stay. The version line
  reads “Free iRacing overlay, no account needed”.
- **The app's code is obfuscated.** Now that OverLap is closed source, the shipped bundles are
  obfuscated so the code cannot be read straight out of the installed files. Behaviour and
  performance are unchanged.
- Versions 2.4.2 to 2.5.2 were published under the GPL-3.0-or-later, and copies of those versions
  keep that licence and its rights.

## [2.5.2] - 2026-10-31

### Added

- **Support OverLap**: OverLap stays free; if you want to help, **About and help** has a **Support
  OverLap** row with **Buy me a coffee** (Ko-fi, in your browser), and the sidebar a small
  **Coffee** beside **Settings**. Never a prompt, a badge or anything over the game.

## [2.5.1] - 2026-10-31

### Added

- **Driver or team names**: a new **Names of** row (**Driver** or **Team**) in the **Driver** block, in
  Appearance and on the pages of Relative, Standings, Battle and Traffic (each with “Global (…)” or
  its own). With **Team**, team races name each car by its team, as iRacing sends it, and so does
  the Delta's class best; a car without a team of its own (every other race) keeps its driver's
  name. **Driver** is the default, so nothing changes until you choose it. The previews are a team
  event, so the choice shows live. **Name format** leaves team names as they are.
- **Names: driver or team shortcut**: a new action in Settings › Shortcuts (unassigned; up to three
  shortcuts, wheel buttons included) that puts every widget on the teams' names or every one on the
  drivers', with “Names: Team” / “Names: Driver” over the game (and, outside a team session, that
  the drivers' names stay). Appearance's value and every widget's own value take it, in every saved
  layout too, so all widgets agree; a mixed setup it replaced comes back with the tray's **Undo**.
  The tray has it too (**Team names**, ticked while every widget shows teams). The settings search
  finds both (“team”, “driver”, “name”, “names”).
- **Wind in Inputs**: a new **Wind** readout (Customise › Readouts, off by default) shows where the
  air hits your car from and how hard, in km/h or mph, turning with the car through every corner.
  **Wind style** draws it **On its own** (a small dial, as the info bars' wind) or **On the wheel**
  (an arrow running round the steering wheel's rim; with the bar style, on its own). **Wind colour**
  paints the arrow (the global accent by default, or a colour of your own). Calm air dims the
  arrow. **Search settings** finds it as wind, air, viento or aire.

### Changed

- **The info bars' wind dial** matches it: the arrow in the accent colour, the car in grey.

### Fixed

- **Inputs**: the pedal bars reach the bottom of the panel, as the trace does, when the readouts
  column is taller than them (a large wheel, the steering angle, the wind). They used to stop short
  and leave a gap under them.
- **Highlights in a folded preview**: pointing at an element in its list, or in the preview
  itself, outlines it where it is drawn in **Strip** and in a preview folding as you scroll, and
  the outlines, the tip and a drag's drop line follow the preview as it pans, folds or resizes.
  Nothing is outlined outside the preview any more: what does not show in the strip is not
  outlined at all.
- **Dragging in Strip**: the strip stays on the row you grabbed instead of jumping to the
  first one, and a drop happens only where its line shows.

## [2.5.0] - 2026-10-31

### Added

- **An installer that updates itself**: every release now ships `OverLap-<version>-setup.exe`
  next to the portable. It installs for your user only, without asking for administrator rights,
  with shortcuts in the Start menu and on the desktop (they open the Settings), and uninstalling it
  keeps your settings. It uses the same settings as the portable, so moving from one to the other
  loses nothing. If you open the installed version while the portable is running, the portable
  asks you to close it.
- **Updates** (Settings › About and help): the installed version looks for a new one in the GitHub
  releases a minute after it starts and every 5 hours, downloads it in the background and installs
  it **when OverLap closes**, or right away with **Restart and update**. **Never during an iRacing
  session**: nothing downloads (a half-finished download stops and resumes afterwards), nothing
  installs, OverLap does not restart and no notice shows over the game (a line in the tray and in
  the Settings; the Windows notification, which takes no focus, waits for the session to end). The
  session ends once iRacing has been closed for half a minute, so a telemetry restart mid-race does
  not count as the end. If you close OverLap with iRacing open, or Windows shuts down, it installs
  another time. The block says where it stands (up to date, checking, downloading with its bar,
  ready, and what went wrong: offline, a download that did not finish or does not match the
  published one), shows the version's release notes and has **Check now**, **Skip this version**
  and **Check for updates automatically** (on by default; off, it only looks when you press
  **Check now**; **Import everything** and **Reset everything** do not change it). A failure never
  discards a version already downloaded. It tells you once per version, and after updating it says
  “OverLap X installed” (or, if it could not, the Settings say so).
- **The portable tells you about new versions**: it does not update itself; it says there is a new
  one (in the Settings, in the tray and with a notification, once per version) and **Download**
  opens its release.

### Changed

- **The network, told as it is**: OverLap is no longer “offline”. Its only connection is the update
  check on GitHub, which can be turned off and sends nothing about iRacing, your settings or your
  computer (the identifier the updater sends with each check is the same for everyone). The README,
  [PRIVACY.md](PRIVACY.md) and “About and help” explain it.
- **Unsigned, said plainly**: the `.exe` files (installer, portable and updates) are not signed;
  when it downloads an update, OverLap checks that it matches its release's sha512 fingerprint
  (that protects against a damaged download, not against whoever controls the releases). The README
  explains the SmartScreen and Smart App Control warnings.
- **About and help**: the version line now reads “Free software iRacing overlay, no account
  needed”.

### Pending / known

- Installing `OverLap-<version>-setup.exe` on a clean Windows: SmartScreen, Smart App Control, the
  shortcuts, the “ready to install” notification and uninstalling while keeping the settings.
- Installing with the portable open (the two cannot run at once; without PowerShell, the installer
  may close the portable, which is also called `OverLap.exe`).
- A real update from one published version to the next: the download, “When OverLap closes”
  (quitting from the tray installs without reopening; the next start says it is installed),
  “Restart and update” (it reopens on About and help), and that nothing downloads or happens during
  a session.
- Shutting Windows down with an update ready (it does not install; the next start has it ready
  within a few seconds).
- The notifications with Focus Assist on and with iRacing in fullscreen.

## [2.4.2] - 2026-10-31

### Added

- **Standings: the class list fills itself**: in Content › **Class order** › **By hand**, OverLap
  now remembers every class of a multiclass session on its own, while you race, even with the
  settings window closed and without you ever touching the list. New classes go at the end of the
  list, your order is never changed, each class is kept once whatever its case, and the list keeps
  its limit of 32 (when full, the lowest classes not in the current session make room). It is
  remembered in every saved layout, so a layout the car switches to knows them too. Each
  remembered class has a × button before its arrows that forgets it in every layout, with Undo
  (which puts it back where it was). A class of the current session moves to the end of the list,
  marked “In this session”, and is not remembered again until it comes back in another session
  (its button's tooltip says so). Rows that are not saved (“In this session”, the preview's “In
  the preview”) have no button. There is no field to type a class: the list fills from the
  sessions you join, and from the rows you move.

### Changed

- **“Folds” folds with the scroll, and stays readable**: the preview used to snap into a
  120 px strip after one wheel notch, shrinking Posiciones to 4 px text and throwing the options
  up the page. Now the header scrolls away and the preview shrinks exactly as far as you scroll,
  with the options glued under it, down to a 150 px strip at no less than 80 % size, centred on
  your row (or on what you are editing). The foot controls fade out and “Show whole” fades in.
  With reduced motion the strip's size changes at once. “Strip” uses the same legible strip.
- **Documentation in English**: README, changelog, development notes and project files are now in
  English; the Spanish guide is in [README.es.md](README.es.md).

### Fixed

- **Info bars, live as after reopening the page**: after a change made in steps (Scale, a
  section reset, showing another item), a header or footer could lose an item (“Incidents”,
  “Time remaining”) or keep “≈19 laps” where a fresh bar draws “≈19 L”. The bar now fits
  again from the start whenever its items, room, size or font change, and the long words give
  way before any item. The same applies over the game.
- **Lights › Lit only** now shows in the preview at once (the unlit lights turn
  translucent and back), and a language change redraws the Delta's reference rows. A test now
  checks that every memoized part of a widget lists everything it draws from.
- **Standings › Flags go where you drag them**: at the default 540 px they stayed after the
  name, in the preview and in the list. Set apart they now take the room they take after the
  name, the country's flag and the preview's ghost columns give way first, and a flags column can
  be grabbed from any row. Where they still cannot fit, the “Moved” toast says why.
- **The preview follows a drag in a list as you drag**: moving a row in Columns, the header or
  any other list now moves the element in the preview at the same time, not only on release, and
  every list edit shows in the preview at once instead of waiting for the settings to be saved.
- **Editing in the preview no longer scrolls the page**: moving, showing or hiding an element in
  the preview used to jump the options to its row in the list (and open its section), pulling you
  away from the preview. Now its row only lights up if it is already in view, and the “Undo”
  toast offers “Show in list” when you want to go there.
- **Colour logos that read at row height**: every colour logo was checked in Relative,
  Standings, Battle and Traffic, at the default and Compact sizes, by night and by day. Porsche
  is now its gold shield with bold red bars, without the fine black detail that ran into a blob;
  Holden is white on a red disc; Mercedes is one clean silver star; Cadillac's crest is its
  coloured quarters; Lamborghini's dark shield is lifted off the dark glass; Ford, Dodge, Honda,
  Toyota and Skip Barber get brighter inks, and the thin ones are drawn thicker.
- **Compact emblems instead of text badges**: Williams (its W), Dallara (its «d»), Radical (its R),
  Ligier (its two flags) and Tatuus (its T in the navy disc) now show their own compact emblem in
  the rows instead of «WIL», «DAL», «RAD», «LIG» or «TAT»; Cadillac and Porsche get a simplified
  crest that keeps its quarters and bars at row height, and Lamborghini a gold rim with its gold
  bull on the black shield, readable on dark and light rows alike.

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
  updater can be turned off), `CONTRIBUTING.md` (with DCO, no CLA) and
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

[2.13.5]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.5
[2.13.4]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.4
[2.13.3]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.3
[2.13.2]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.2
[2.13.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.1
[2.13.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.13.0
[2.12.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.12.1
[2.12.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.12.0
[2.11.3]: https://github.com/jesus-molano/OverLap/releases/tag/v2.11.3
[2.11.2]: https://github.com/jesus-molano/OverLap/releases/tag/v2.11.2
[2.11.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.11.1
[2.11.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.11.0
[2.10.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.10.0
[2.9.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.9.0
[2.8.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.8.1
[2.8.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.8.0
[2.7.2]: https://github.com/jesus-molano/OverLap/releases/tag/v2.7.2
[2.7.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.7.1
[2.7.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.7.0
[2.6.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.6.0
[2.5.3]: https://github.com/jesus-molano/OverLap/releases/tag/v2.5.3
[2.5.2]: https://github.com/jesus-molano/OverLap/releases/tag/v2.5.2
[2.5.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.5.1
[2.5.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.5.0
[2.4.2]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.2
[2.4.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.1
[2.4.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.0
[2.3.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.1
[2.3.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.0
[2.2.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.2.0
[2.1.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.1
[2.1.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.0
[2.0.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.0.0
