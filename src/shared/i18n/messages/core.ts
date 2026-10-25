/**
 * Texts shared by every process: widget names, connection status, the
 * visibility rules' captions, the tray menu and window titles.
 */
import type { Dict } from '../dict'

export const coreEs = {
  appName: 'OverLap',
  /**
   * A percentage in each language's typography: '110 %' (no-break space) in Spanish, '110%' in
   * English. Scale, text size and opacity readouts (edit-mode chip, settings sliders).
   */
  percent: (n: number) => `${n}\u00a0%`,
  widgetTitles: {
    relative: 'Relativo',
    radar: 'Radar',
    standings: 'Clasificación',
    battle: 'Batalla',
    inputs: 'Pedales',
    traffic: 'Tráfico',
    alerts: 'Avisos',
    delta: 'Delta'
  },
  status: {
    starting: 'Iniciando telemetría…',
    startingMock: 'Iniciando telemetría simulada…',
    waiting: 'Esperando a iRacing…',
    waitingMock: 'Iniciando modo simulado…',
    connected: 'Conectado a iRacing',
    mock: 'Modo simulado (mock)',
    restarting: 'Telemetría reiniciándose…',
    nativeMissing: 'No se pudo cargar el módulo nativo del SDK de iRacing',
    error: 'Error en la telemetría',
    errorWithDetail: (detail: string) => `Error en la telemetría: ${detail}`,
    /** Before the window knows any status (StatusMessage). */
    unknown: 'Iniciando…'
  },
  /** Short connection label of the settings window's header chip (statusText is its tooltip). */
  statusChip: {
    starting: 'Iniciando',
    waiting: 'Esperando a iRacing',
    connected: 'Conectado a iRacing',
    mock: 'Simulación',
    error: 'Error de telemetría'
  },
  /** Why a visibility rule hides a widget (edit-mode caption). */
  hidden: {
    practice: 'Oculto en práctica',
    qualify: 'Oculto en clasificación',
    race: 'Oculto en carrera',
    pits: 'Oculto en boxes',
    /** Without a known reason. */
    any: 'Oculto'
  },
  /** The tray icon's menu and tooltip. */
  tray: {
    settings: 'Ajustes…',
    radarRange: 'Radar: alcance',
    rangeMeters: (m: number) => `${m} m`,
    editMode: 'Modo edición',
    openSettingsFolder: 'Abrir carpeta de ajustes',
    quit: 'Salir',
    /** A widget a rule hides right now: 'Batalla (oculto en práctica)'. */
    widgetHidden: (title: string, hiddenNote: string) => `${title} (${hiddenNote})`,
    tooltip: (status: string) => `OverLap · ${status}`
  },
  windowTitles: {
    /** The settings window's title bar. */
    settings: 'OverLap — Ajustes',
    /** The settings page's document.title. */
    settingsPage: 'Ajustes · OverLap',
    widget: (title: string) => `${title} · OverLap`
  },
  /** Edit-mode chrome drawn over every widget (WidgetFrame). */
  editFrame: {
    locked: 'Bloqueado',
    /** Height of an auto-height widget in the size readout: '460 × auto'. */
    autoHeight: 'auto',
    hintLong: 'Rueda: tamaño · Alt: sin imán · Ctrl+Shift+E salir',
    hintShort: 'Rueda: tamaño · Ctrl+Shift+E salir'
  },
  /** A window that could not start (renderer main.ts). */
  boot: {
    settingsFailed: 'No se pudo cargar la ventana de ajustes.',
    unknownView: (view: string) => `Vista desconocida: "${view}".`,
    missingParam: 'Falta el parámetro ?widget= o ?view= en la URL.',
    unknownWidget: (id: string) => `Widget desconocido: "${id}".`
  }
} as const

export const coreEn: Dict<typeof coreEs> = {
  appName: 'OverLap',
  percent: (n) => `${n}%`,
  widgetTitles: {
    relative: 'Relative',
    radar: 'Radar',
    standings: 'Standings',
    battle: 'Battle',
    inputs: 'Inputs',
    traffic: 'Traffic',
    alerts: 'Alerts',
    delta: 'Delta'
  },
  status: {
    starting: 'Starting telemetry…',
    startingMock: 'Starting simulated telemetry…',
    waiting: 'Waiting for iRacing…',
    waitingMock: 'Starting simulated mode…',
    connected: 'Connected to iRacing',
    mock: 'Simulated mode (mock)',
    restarting: 'Telemetry restarting…',
    nativeMissing: 'Could not load the iRacing SDK native module',
    error: 'Telemetry error',
    errorWithDetail: (detail) => `Telemetry error: ${detail}`,
    unknown: 'Starting…'
  },
  statusChip: {
    starting: 'Starting',
    waiting: 'Waiting for iRacing',
    connected: 'Connected to iRacing',
    mock: 'Simulated data',
    error: 'Telemetry error'
  },
  hidden: {
    practice: 'Hidden in practice',
    qualify: 'Hidden in qualifying',
    race: 'Hidden in races',
    pits: 'Hidden in the pits',
    any: 'Hidden'
  },
  tray: {
    settings: 'Settings…',
    radarRange: 'Radar range',
    rangeMeters: (m) => `${m} m`,
    editMode: 'Edit mode',
    openSettingsFolder: 'Open settings folder',
    quit: 'Quit',
    widgetHidden: (title, hiddenNote) => `${title} (${hiddenNote})`,
    tooltip: (status) => `OverLap · ${status}`
  },
  windowTitles: {
    settings: 'OverLap — Settings',
    settingsPage: 'Settings · OverLap',
    widget: (title) => `${title} · OverLap`
  },
  editFrame: {
    locked: 'Locked',
    autoHeight: 'auto',
    hintLong: 'Scroll: size · Alt: no snap · Ctrl+Shift+E exit',
    hintShort: 'Scroll: size · Ctrl+Shift+E exit'
  },
  boot: {
    settingsFailed: 'Could not load the settings window.',
    unknownView: (view) => `Unknown view: "${view}".`,
    missingParam: 'The URL is missing the ?widget= or ?view= parameter.',
    unknownWidget: (id) => `Unknown widget: "${id}".`
  }
}
