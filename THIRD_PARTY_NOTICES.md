# Third-party notices

OverLap is free software: Copyright (C) 2026 Jesús Molano, licensed under the GNU General Public
License as published by the Free Software Foundation, either version 3 of the License or (at your
option) any later version (`GPL-3.0-or-later`, see `LICENSE`). It comes WITHOUT ANY WARRANTY.

It includes, ports or draws the third-party material listed below, each under its own licence. The
full texts of the MIT and BSD licences follow the list. npm packages also keep their own licence
files inside the packaged app (`resources/app.asar`), including the transitive MIT, ISC,
BSD-2-Clause, Apache-2.0, BlueOak-1.0.0 and Python-2.0 packages that come with them (most of them
node-gyp's). `LICENSE.txt` (the GPL), this file, and Electron's and Chromium's notices
(`LICENSE.electron.txt`, `LICENSES.chromium.html`) are packed inside the portable `OverLap.exe`,
which unpacks them next to the app in its temp folder while it runs; each GitHub release also
attaches or links `LICENSE` and this file.

**The colour car logos are not covered by the GPL.** They are third-party trademarks and artwork;
see [Brand logos](#brand-logos).

## Code that runs in the app

| Component                                                                                                            | Use in OverLap                                                                | Licence      | Copyright                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [irsdk-node](https://github.com/bengsfort/irsdk-node) (`irsdk-node`, `@irsdk-node/native`, `@irsdk-node/types`)      | Reads the iRacing SDK shared memory                                           | MIT          | Copyright (c) 2026 Matthew Bengston (`@irsdk-node/types`: Copyright (c) 2021 Matthew Bengston)                                     |
| iRacing SDK headers (inside `@irsdk-node/native`)                                                                    | Telemetry layout used by irsdk-node                                           | BSD-3-Clause | Copyright (c) 2013, iRacing.com Motorsport Simulations, LLC                                                                        |
| [koffi](https://koffi.dev) (`koffi`, `@koromix/koffi-win32-x64`)                                                     | Reads the session info block                                                  | MIT          | Copyright (C) 2026 Niels Martignène                                                                                                |
| [js-yaml](https://github.com/nodeca/js-yaml)                                                                         | Parses the session info YAML                                                  | MIT          | Copyright (C) 2011-2015 by Vitaly Puzrin                                                                                           |
| [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) 1.6.20                                    | Driver flags in Relative, Standings, Battle and Traffic (3x2 SVG, unchanged)  | MIT          | Copyright (c) 2020 @catamphetamine                                                                                                 |
| [Vue](https://vuejs.org) 3.5 (`@vue/runtime-dom`, `@vue/runtime-core`, `@vue/reactivity`, `@vue/shared`)             | Draws the settings window and the widgets (bundled into the renderer)         | MIT          | Copyright (c) 2018-present, Yuxi (Evan) You                                                                                        |
| [Vite](https://vite.dev) and [@vitejs/plugin-vue](https://github.com/vitejs/vite-plugin-vue) (small runtime helpers) | Module preload helper and component export helper (bundled into the renderer) | MIT          | Copyright (c) 2019-present, VoidZero Inc. and Vite contributors; Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors |
| [Electron](https://www.electronjs.org) 44                                                                            | The app runtime (its own and Chromium's notices are packed inside the exe)    | MIT          | Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc.                                                           |

## Ported algorithms

| Component                                                           | Use in OverLap                                                                | Licence                                                              | Copyright                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [irDashies](https://github.com/tariknz/irdashies)                   | Projected iRating (`src/shared/ratings/irating.ts`), relative sign convention | MIT                                                                  | Copyright (c) 2024 Tarik Alani                                                             |
| [irating-rs](https://github.com/Turbo87/irating-rs) (via irDashies) | Origin of the iRating formula, after Kenny Powell's 2019 spreadsheet          | MIT OR Apache-2.0 (its README and `Cargo.toml`; used here under MIT) | Tobias Bieniek (the repository has no licence file or copyright line; every commit is his) |
| [Nishizumi SR](https://github.com/nishizumi-maho/Nishizumi-SR)      | Projected safety rating (`src/shared/ratings/safetyRating.ts`)                | MIT                                                                  | Copyright (c) 2026 Maho Nishizumi                                                          |

## Brand logos

OverLap draws car make logos in two sets, chosen in **Appearance › Rows and drivers › Logo
colour**:

- **Monochrome logos** (`src/renderer/src/ui/brandLogos.ts`, «Monochrome») are paths from
  [Simple Icons](https://simpleicons.org) 16.36.0, released under
  [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Simple Icons has 18 of
  the makes: Acura, Aston Martin, Audi, BMW, Cadillac, Chevrolet, Ferrari, Ford, Honda, Hyundai,
  Lamborghini, Mazda, Nissan, Porsche, Renault, Subaru, Toyota and Volkswagen. In «Monochrome» the
  other makes are still drawn from the colour set below, in greys.
- **Colour logos** (`src/renderer/src/ui/brandLogosColor.ts`, «Colour», the default) are **NOT
  covered by OverLap's licence**. They are third-party trademarks and artwork, drawn from the files
  listed at the top of that file and simplified for the overlay. Their owners keep all their rights:
  OverLap claims none and grants none, and the GPL-3.0-or-later does not apply to them. By source:
  - Wikimedia Commons, 19 makes, each file page tagged public domain with a trademark warning
    (checked on 2026-10-31): 17 as `PD-textlogo` (Acura, Audi, Chevrolet, Ford, Honda, Hyundai, Kia,
    Ligier, McLaren, Mercedes-Benz, Nissan, Pontiac, Renault, Skip Barber, Subaru, Toyota and
    Volkswagen), Dodge as `PD-shape` and Ruf as `PD-self` (released by its uploader). Those tags are
    the Commons uploaders' and editors' assessment, not a legal opinion, and several of these are
    emblems rather than plain text (the Mercedes star, the McLaren Speedmark, the Pontiac dart, the
    Chevrolet bowtie), so they are listed here as third-party marks all the same.
  - English Wikipedia, 2 makes: Lotus (public domain in the United States only) and Mazda (non-free,
    used on Wikipedia under fair use).
  - worldvectorlogo.com, 10 makes, third-party redraws whose terms could not be checked: Aston
    Martin, BMW, Buick, Cadillac, Ferrari, Holden, Lamborghini, Porsche, Radical and Williams.
  - The makers' own websites, 2 makes: Dallara and Tatuus.

  If you redistribute OverLap and cannot take on that artwork, remove the colour set's data; the
  makes without a Simple Icons path then show their text badge.

All car make logos and names are trademarks of their respective owners. They are shown only to
tell which make a car is. OverLap is not affiliated with, sponsored or endorsed by any car maker,
nor by iRacing.com Motorsport Simulations, LLC. iRacing is a trademark of iRacing.com Motorsport
Simulations, LLC.

## OverLap's own name and icon

The OverLap name and the «OL» icon are not licensed as trademarks: as GPL section 7(e) allows, no
rights under trademark law are granted for them. The GPL gives you the code, not the right to use
that name or icon, so a modified version you distribute needs a different name and icon, and then
nobody takes it for OverLap.

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
