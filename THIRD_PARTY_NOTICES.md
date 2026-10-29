# Third-party notices

OverLap is © 2026 Jesús Molano, all rights reserved (see `LICENSE`). It includes, ports or draws
the third-party material listed below, each under its own licence. The full texts of the MIT and
BSD licences follow the list. npm packages also keep their own licence files inside the packaged
app (`resources/app.asar`).

## Code that runs in the app

| Component                                                                                                       | Use in OverLap                                                      | Licence      | Copyright                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| [irsdk-node](https://github.com/bengsfort/irsdk-node) (`irsdk-node`, `@irsdk-node/native`, `@irsdk-node/types`) | Reads the iRacing SDK shared memory                                 | MIT          | Copyright (c) 2026 Matthew Bengston                         |
| iRacing SDK headers (inside `@irsdk-node/native`)                                                               | Telemetry layout used by irsdk-node                                 | BSD-3-Clause | Copyright (c) 2013, iRacing.com Motorsport Simulations, LLC |
| [koffi](https://koffi.dev) (`koffi`, `@koromix/koffi-win32-x64`)                                                | Reads the session info block                                        | MIT          | Copyright (C) 2026 Niels Martignène                         |
| [js-yaml](https://github.com/nodeca/js-yaml)                                                                    | Parses the session info YAML                                        | MIT          | Copyright (C) 2011-2015 by Vitaly Puzrin                    |
| [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons) 1.6.20                               | Driver flags in Relative, Standings and Battle (3x2 SVG, unchanged) | MIT          | Copyright (c) 2020 @catamphetamine                          |

## Ported algorithms

| Component                                                           | Use in OverLap                                                                | Licence | Copyright                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- | --------------------------------- |
| [irDashies](https://github.com/tariknz/irdashies)                   | Projected iRating (`src/shared/ratings/irating.ts`), relative sign convention | MIT     | Copyright (c) 2024 Tarik Alani    |
| [irating-rs](https://github.com/Turbo87/irating-rs) (via irDashies) | Origin of the iRating formula, after Kenny Powell's 2019 spreadsheet          | —       | Credited as the source            |
| [Nishizumi SR](https://github.com/nishizumi-maho/Nishizumi-SR)      | Projected safety rating (`src/shared/ratings/safetyRating.ts`)                | MIT     | Copyright (c) 2026 Maho Nishizumi |

## Brand logos

- **Monochrome logos** (`src/renderer/src/ui/brandLogos.ts`) are paths from
  [Simple Icons](https://simpleicons.org) 16.36.0, released under
  [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).
- **Colour logos** (`src/renderer/src/ui/brandLogosColor.ts`) are drawn from the public files
  listed at the top of that file (Wikimedia Commons and worldvectorlogo.com), simplified for the
  overlay.

All car make logos and names are trademarks of their respective owners. They are shown only to
tell which make a car is. OverLap is not affiliated with, sponsored or endorsed by any car maker,
nor by iRacing.com Motorsport Simulations, LLC. iRacing is a trademark of iRacing.com Motorsport
Simulations, LLC.

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
