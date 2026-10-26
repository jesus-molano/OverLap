/**
 * Texts shared by every process: widget names, connection status, the
 * visibility rules' captions, the tray menu, window titles and key names.
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
    delta: 'Delta',
    conditions: 'Condiciones',
    fuel: 'Combustible'
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
    garage: 'Oculto en el garaje',
    'ui-hidden': 'Oculto: interfaz de iRacing oculta',
    replay: 'Oculto en repeticiones',
    /** A replay plays and the widget only has your own car's live data (pedals, delta...). */
    'replay-player': 'Oculto en repeticiones: solo en directo',
    /** Without a known reason. */
    any: 'Oculto'
  },
  /** The tray icon's menu and tooltip. */
  tray: {
    settings: 'Ajustes…',
    radarRange: 'Radar: alcance',
    rangeMeters: (m: number) => `${m} m`,
    editMode: 'Modo edición',
    hideOverlay: 'Ocultar overlay',
    openSettingsFolder: 'Abrir carpeta de ajustes',
    quit: 'Salir',
    /** A widget a rule hides right now: 'Batalla (oculto en práctica)'. */
    widgetHidden: (title: string, hiddenNote: string) => `${title} (${hiddenNote})`,
    tooltip: (status: string) => `OverLap · ${status}`,
    /** While the user has the overlay hidden. */
    tooltipHidden: (status: string) => `OverLap · Overlay oculto · ${status}`
  },
  windowTitles: {
    /** The settings window's title bar. */
    settings: 'OverLap — Ajustes',
    /** The settings page's document.title. */
    settingsPage: 'Ajustes · OverLap',
    /** An overlay window (one per display): 'Pantalla 1 · OverLap'. */
    overlay: (display: number) => `Pantalla ${display} · OverLap`
  },
  /** Edit-mode chrome drawn over every widget (overlay/EditFrame.vue). */
  editFrame: {
    locked: 'Bloqueado',
    /** Height of an auto-height widget in the size readout: '460 × auto'. */
    autoHeight: 'auto',
    /** With the edit-mode shortcut (`keys`: acceleratorText); the NoKey ones when it has none. */
    hintLong: (keys: string) => `Rueda: tamaño · Alt: sin imán · ${keys} salir`,
    hintLongNoKey: 'Rueda: tamaño · Alt: sin imán',
    hintShort: (keys: string) => `Rueda: tamaño · ${keys} salir`,
    hintShortNoKey: 'Rueda: tamaño',
    /** A dragged widget whose pointer left this display: releasing moves it there. */
    dropOnOtherDisplay: 'Suelta para moverlo a la otra pantalla'
  },
  /**
   * Keys as a Spanish keyboard prints them (keycaps, acceleratorText). Ctrl, Alt, Shift, the
   * letters, digits, F-keys, Esc and the arrows read the same in every language.
   */
  keys: {
    space: 'Espacio',
    insert: 'Insert',
    delete: 'Supr',
    home: 'Inicio',
    end: 'Fin',
    pageUp: 'Re Pág',
    pageDown: 'Av Pág',
    /** A key of the numeric keypad: 'Num 5', 'Num +'. */
    numpad: (key: string) => `Num ${key}`
  },
  /** A window that could not start (renderer main.ts). */
  boot: {
    settingsFailed: 'No se pudo cargar la ventana de ajustes.',
    unknownView: (view: string) => `Vista desconocida: "${view}".`,
    missingParam: 'Falta el parámetro ?view= en la URL.'
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
    delta: 'Delta',
    conditions: 'Conditions',
    fuel: 'Fuel'
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
    garage: 'Hidden in the garage',
    'ui-hidden': 'Hidden: iRacing UI hidden',
    replay: 'Hidden in replays',
    'replay-player': 'Hidden in replays: live only',
    any: 'Hidden'
  },
  tray: {
    settings: 'Settings…',
    radarRange: 'Radar range',
    rangeMeters: (m) => `${m} m`,
    editMode: 'Edit mode',
    hideOverlay: 'Hide overlay',
    openSettingsFolder: 'Open settings folder',
    quit: 'Quit',
    widgetHidden: (title, hiddenNote) => `${title} (${hiddenNote})`,
    tooltip: (status) => `OverLap · ${status}`,
    tooltipHidden: (status) => `OverLap · Overlay hidden · ${status}`
  },
  windowTitles: {
    settings: 'OverLap — Settings',
    settingsPage: 'Settings · OverLap',
    overlay: (display) => `Display ${display} · OverLap`
  },
  editFrame: {
    locked: 'Locked',
    autoHeight: 'auto',
    hintLong: (keys) => `Scroll: size · Alt: no snap · ${keys} exit`,
    hintLongNoKey: 'Scroll: size · Alt: no snap',
    hintShort: (keys) => `Scroll: size · ${keys} exit`,
    hintShortNoKey: 'Scroll: size',
    dropOnOtherDisplay: 'Release to move it to the other display'
  },
  keys: {
    space: 'Space',
    insert: 'Ins',
    delete: 'Delete',
    home: 'Home',
    end: 'End',
    pageUp: 'PgUp',
    pageDown: 'PgDn',
    numpad: (key) => `Num ${key}`
  },
  boot: {
    settingsFailed: 'Could not load the settings window.',
    unknownView: (view) => `Unknown view: "${view}".`,
    missingParam: 'The URL is missing the ?view= parameter.'
  }
}
