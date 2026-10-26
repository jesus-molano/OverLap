/**
 * Sidebar icons of the settings pages: 16 x 16, drawn with a 1.5 unit stroke in currentColor
 * (`fill` paths are filled instead). Static data; rendered by NavIcon.vue.
 */
import type { SettingsPage } from '../nav'

export interface NavIconShape {
  readonly d: string
  readonly fill?: true
}

export const NAV_ICONS: Readonly<Record<SettingsPage, readonly NavIconShape[]>> = {
  // Palette.
  appearance: [
    {
      d: 'M8 1.75a6.25 6.25 0 1 0 0 12.5c.85 0 1.35-.55 1.35-1.25 0-.85-.75-1.15-.75-1.9 0-.7.55-1.15 1.25-1.15h1.5A2.9 2.9 0 0 0 14.25 7 6.1 6.1 0 0 0 8 1.75z'
    },
    { d: 'M4.6 7.4a1 1 0 1 0 0-.01zM6.6 4.6a1 1 0 1 0 0-.01zM9.9 4.6a1 1 0 1 0 0-.01z', fill: true }
  ],
  // Keyboard: a row of keys over the space bar.
  shortcuts: [
    {
      d: 'M2.25 4.25h11.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H2.25a1 1 0 0 1-1-1v-5.5a1 1 0 0 1 1-1z'
    },
    { d: 'M4 6.75h.01M6.67 6.75h.01M9.33 6.75h.01M12 6.75h.01M5.5 9.25h5' }
  ],
  // Rows around a highlighted one.
  relative: [{ d: 'M3 3.5h10M3 12.5h10' }, { d: 'M2.5 6.25h11v3.5h-11z', fill: true }],
  // Car between two side alerts.
  radar: [{ d: 'M6.25 4.5h3.5v7h-3.5z' }, { d: 'M2.75 3.5v9M13.25 3.5v9' }],
  // Podium.
  standings: [{ d: 'M2 13.5h12M3 13.5v-4h3v4M6.5 13.5V5.5h3v8M10 13.5v-6h3v6' }],
  // Chasing chevrons.
  battle: [{ d: 'M3 4.5 6.5 8 3 11.5M8.5 4.5 12 8l-3.5 3.5' }],
  // Two pedals.
  inputs: [{ d: 'M3.5 4.5h3.25v8.5H3.5zM9.25 7.5h3.25V13H9.25z' }],
  // Traffic closing in on a car ahead.
  traffic: [{ d: 'M4 10 8 6.5l4 3.5M4 14l4-3.5 4 3.5' }, { d: 'M6.5 1.5h3v3.25h-3z', fill: true }],
  // Flag on a pole.
  alerts: [{ d: 'M3.75 14.25V2' }, { d: 'M3.75 2.75h8.75L10.5 5.9l2 3.1H3.75' }],
  // Stopwatch.
  delta: [{ d: 'M3 9.25a5 5 0 1 0 10 0 5 5 0 1 0-10 0M6.5 1.75h3M8 1.75v2.5M8 9.25l2-2' }],
  // Thermometer beside two gusts of wind.
  conditions: [
    { d: 'M4.25 9.4V3.5a1.5 1.5 0 0 1 3 0v5.9a2.6 2.6 0 1 1-3 0z' },
    { d: 'M9.75 5h2.5a1.4 1.4 0 1 0-1.4-1.4M9.75 8.5h3.5a1.4 1.4 0 1 1-1.4 1.4' }
  ],
  // Fuel pump with its hose.
  fuel: [
    { d: 'M3.5 13.75V3.25a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10.5M2.5 13.75h8' },
    { d: 'M5 4.25h3v2.5H5z', fill: true },
    { d: 'M9.5 7.25h1.25a.75.75 0 0 1 .75.75v3.25a1 1 0 0 0 2 0V5.5l-1.75-1.75' }
  ]
}
