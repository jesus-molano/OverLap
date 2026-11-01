# Third-party notices

OverLap is Copyright (C) 2026 Jesús Molano. It is free to use but not open source: its own licence
is in `LICENSE`. It comes WITHOUT ANY WARRANTY.

It includes, ports or draws the third-party material listed below, each under its own licence,
which OverLap's licence does not change. The full texts of the MIT and BSD licences follow the
list. npm packages also keep their own licence files inside the packaged app
(`resources/app.asar`), including the transitive MIT, ISC, BSD-2-Clause, Apache-2.0,
BlueOak-1.0.0 and Python-2.0 packages that come with them (most of them node-gyp's).
`LICENSE.txt` (OverLap's licence), this file, and Electron's and Chromium's notices
(`LICENSE.electron.txt`, `LICENSES.chromium.html`) are installed next to `OverLap.exe` by the
installer and packed inside the portable `OverLap.exe`, which unpacks them next to the app in its
temp folder while it runs; each GitHub release also attaches or links `LICENSE` and this file.

**The colour car logos are not covered by OverLap's licence.** They are third-party trademarks and
artwork; see [Brand logos](#brand-logos).

## Code that runs in the app

| Component                                                                                                                                                                                                           | Use in OverLap                                                                 | Licence      | Copyright                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [irsdk-node](https://github.com/bengsfort/irsdk-node) (`irsdk-node`, `@irsdk-node/native`, `@irsdk-node/types`)                                                                                                     | Reads the iRacing SDK shared memory                                            | MIT          | Copyright (c) 2026 Matthew Bengston (`@irsdk-node/types`: Copyright (c) 2021 Matthew Bengston)                                               |
| iRacing SDK headers (inside `@irsdk-node/native`)                                                                                                                                                                   | Telemetry layout used by irsdk-node                                            | BSD-3-Clause | Copyright (c) 2013, iRacing.com Motorsport Simulations, LLC                                                                                  |
| [koffi](https://koffi.dev) (`koffi`, `@koromix/koffi-win32-x64`)                                                                                                                                                    | Reads the session info block                                                   | MIT          | Copyright (C) 2026 Niels Martignène                                                                                                          |
| [js-yaml](https://github.com/nodeca/js-yaml)                                                                                                                                                                        | Parses the session info YAML                                                   | MIT          | Copyright (C) 2011-2015 by Vitaly Puzrin                                                                                                     |
| [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) 1.6.20                                                                                                                                   | Driver flags in Relative, Standings, Battle and Traffic (3x2 SVG, unchanged)   | MIT          | Copyright (c) 2020 @catamphetamine                                                                                                           |
| [Vue](https://vuejs.org) 3.5 (`@vue/runtime-dom`, `@vue/runtime-core`, `@vue/reactivity`, `@vue/shared`)                                                                                                            | Draws the settings window and the widgets (bundled into the renderer)          | MIT          | Copyright (c) 2018-present, Yuxi (Evan) You                                                                                                  |
| [Vite](https://vite.dev) and [@vitejs/plugin-vue](https://github.com/vitejs/vite-plugin-vue) (small runtime helpers)                                                                                                | Module preload helper and component export helper (bundled into the renderer)  | MIT          | Copyright (c) 2019-present, VoidZero Inc. and Vite contributors; Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors           |
| [Electron](https://www.electronjs.org) 44                                                                                                                                                                           | The app runtime (its own and Chromium's notices are packed inside the exe)     | MIT          | Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc.                                                                     |
| [electron-updater](https://github.com/electron-userland/electron-builder) 6.8 (with `builder-util-runtime`, `lazy-val`, `tiny-typed-emitter`, `lodash.isequal`, `lodash.escaperegexp`, `fs-extra`, `semver`, `sax`) | Looks for a new version on GitHub and installs it (the installed version only) | MIT          | Copyright (c) 2015 Loopline Systems (`semver`: ISC, `sax`: BlueOak-1.0.0, their own files inside the app)                                    |
| [ws](https://github.com/websockets/ws) 8.22                                                                                                                                                                         | The streaming mode’s local WebSocket server (main process; off by default)     | MIT          | Copyright (c) 2011 Einar Otto Stangvik; Copyright (c) 2013 Arnout Kazemier and contributors; Copyright (c) 2016 Luigi Pinca and contributors |

## Ported algorithms

| Component                                                           | Use in OverLap                                                       | Licence                                                              | Copyright                                                                                  |
| ------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [irDashies](https://github.com/tariknz/irdashies)                   | Projected iRating, relative sign convention                          | MIT                                                                  | Copyright (c) 2024 Tarik Alani                                                             |
| [irating-rs](https://github.com/Turbo87/irating-rs) (via irDashies) | Origin of the iRating formula, after Kenny Powell's 2019 spreadsheet | MIT OR Apache-2.0 (its README and `Cargo.toml`; used here under MIT) | Tobias Bieniek (the repository has no licence file or copyright line; every commit is his) |
| [Nishizumi SR](https://github.com/nishizumi-maho/Nishizumi-SR)      | Projected safety rating                                              | MIT                                                                  | Copyright (c) 2026 Maho Nishizumi                                                          |

## Brand logos

The Discord mark in Settings is the shape from [Bootstrap Icons](https://icons.getbootstrap.com)
(MIT). Discord and its logo are trademarks of Discord Inc.

OverLap draws car make logos in two sets, chosen in **Appearance › Rows and drivers › Logo
colour**:

- **Monochrome logos** («Monochrome») are paths from
  [Simple Icons](https://simpleicons.org) 16.36.0, released under
  [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Simple Icons has 18 of
  the makes: Acura, Aston Martin, Audi, BMW, Cadillac, Chevrolet, Ferrari, Ford, Honda, Hyundai,
  Lamborghini, Mazda, Nissan, Porsche, Renault, Subaru, Toyota and Volkswagen. In «Monochrome» the
  other makes are still drawn from the colour set below, in greys.
- **Colour logos** («Colour», the default) are **NOT
  covered by OverLap's licence**. They are third-party trademarks and artwork, drawn from the sources
  listed below and simplified for the overlay. Their owners keep all their rights:
  OverLap claims none and grants none, and OverLap's licence does not apply to them. By source:
  - Wikimedia Commons, 18 makes, each file page tagged public domain with a trademark warning
    (checked on 2026-10-31): 16 as `PD-textlogo` (Acura, Audi, Chevrolet, Ford, Honda, Hyundai, Kia,
    McLaren, Mercedes-Benz, Nissan, Pontiac, Renault, Skip Barber, Subaru, Toyota and Volkswagen),
    Dodge as `PD-shape` and Ruf as `PD-self` (released by its uploader). Those tags are
    the Commons uploaders' and editors' assessment, not a legal opinion, and several of these are
    emblems rather than plain text (the Mercedes star, the McLaren Speedmark, the Pontiac dart, the
    Chevrolet bowtie), so they are listed here as third-party marks all the same.
  - English Wikipedia, 2 makes: Lotus (public domain in the United States only) and Mazda (non-free,
    used on Wikipedia under fair use).
  - worldvectorlogo.com, 8 makes, third-party redraws whose terms could not be checked: Aston
    Martin, BMW, Buick, Cadillac, Ferrari, Holden, Lamborghini and Porsche.
  - Redrawn compact marks, 7 makes: simplified renditions of each maker's own emblem, redrawn for
    OverLap because the full logo or wordmark did not read at row height. They are still the makers'
    trademarks and stay outside OverLap's licence like the rest of the colour set. Williams (the W
    on a navy tile, after https://www.williamsf1.com), Dallara (the «d» of the wordmark, after
    https://www.dallara.it), Radical (the R of the wordmark, after https://www.radical-cars.com),
    Ligier (the two diamond flags, after https://commons.wikimedia.org/wiki/File:Logo_Ligier.svg),
    Tatuus (the T in its navy disc, after https://www.tatuus.it/tatuus-logo-korus-group.svg),
    Cadillac (the 2014-2020 crest without its wreath, as 2x2 quarters, after the worldvectorlogo.com
    file above) and Porsche (the crest with its fine detail simplified, after the
    worldvectorlogo.com file above). Lamborghini keeps the worldvectorlogo.com crest's own outline
    and bull silhouette, in gold on its black shield.
  - Ray and Riley show their text badge: they publish no vector logo.

All car make logos and names are trademarks of their respective owners. They are shown only to
tell which make a car is. OverLap is not affiliated with, sponsored or endorsed by any car maker,
nor by iRacing.com Motorsport Simulations, LLC. iRacing is a trademark of iRacing.com Motorsport
Simulations, LLC.

## OverLap's own name and icon

The OverLap name and the «OL» icon belong to Jesús Molano. They are not third-party material, and
OverLap's licence (`LICENSE`) grants no rights to use them other than to refer to OverLap itself.

## Fonts

| Component                                                         | Use in OverLap                                                                                                                   | Licence                   | Copyright                                                                         |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| [Inter](https://rsms.me/inter/) 3.19 (variable, roman; unchanged) | The stream pages’ font where Segoe UI is missing (served by OverLap’s own local server, `Inter-roman.var`), never on your screen | SIL Open Font License 1.1 | Copyright (c) 2016-2020 The Inter Project Authors (https://github.com/rsms/inter) |

Inter is bundled unchanged and is not sold on its own. Its licence follows.

## MIT License

Applies to the components above marked MIT, with their copyright lines.

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## BSD 3-Clause License (iRacing SDK)

```
Copyright (c) 2013, iRacing.com Motorsport Simulations, LLC.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of iRacing.com Motorsport Simulations nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## SIL Open Font License 1.1 (Inter)

```
Copyright (c) 2016-2020 The Inter Project Authors (https://github.com/rsms/inter)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) and the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
