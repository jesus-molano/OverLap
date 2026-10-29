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
  /**
   * The decimal separator of a value in the settings ('1,5 s' in Spanish, '1.5 s' in English).
   * The widgets keep the sim's dot, like lap times ('1:01.234', '+1.2').
   */
  decimal: ',',
  widgetTitles: {
    relative: 'Relativo',
    radar: 'Radar',
    standings: 'Posiciones',
    battle: 'Batalla',
    inputs: 'Pedales',
    traffic: 'Tráfico',
    alerts: 'Avisos',
    lights: 'Testigos',
    delta: 'Delta',
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
    /** The overlay only shows in races (Apariencia > Visibilidad) and this session is not one. */
    'not-race': 'Oculto: solo en carrera',
    garage: 'Oculto en el garaje',
    'ui-hidden': 'Oculto: interfaz de iRacing oculta',
    /** The overlay only shows while you are in the car (Apariencia > Visibilidad). */
    'out-of-car': 'Oculto: fuera del coche',
    'session-screen': 'Oculto en la pantalla de sesión',
    replay: 'Oculto en repeticiones',
    /** A replay of the tape plays and the widget only shows live data (pedals, relative...). */
    'replay-player': 'Oculto en repeticiones: solo en directo',
    /** The camera follows another car live and the widget only has your own car's data. */
    'camera-other': 'Oculto: cámara en otro coche',
    /** Without a known reason. */
    any: 'Oculto'
  },
  /** When the overlay is shown (visibility.showWhen): the tray's choices and the settings'. */
  showWhen: {
    car: 'Solo cuando estás en el coche',
    race: 'Solo en carrera',
    always: 'Siempre'
  },
  /** The tray icon's menu and tooltip. */
  tray: {
    settings: 'Ajustes…',
    radarRange: 'Alcance del radar',
    rangeMeters: (m: number) => `${m} m`,
    /** The submenu with the showWhen choices. */
    showWhen: 'Cuándo mostrar',
    /** The submenu with the saved layouts (the one in use checked). */
    layouts: 'Disposición',
    /** Its last item: the settings window's layouts page. */
    manageLayouts: 'Gestionar disposiciones…',
    /** After the few it lists when there are many: the same page, with all of them. */
    moreLayouts: 'Más…',
    /** A layout linked to the car you are in (automatic mode): 'Mazda · coche actual'. */
    layoutForCar: (name: string) => `${name} · coche actual`,
    editMode: 'Modo edición',
    /** Checked while the overlay is shown (the user's own hide, as the shortcut). */
    showOverlay: 'Mostrar el overlay',
    openSettingsFolder: 'Abrir carpeta de ajustes',
    quit: 'Salir',
    /** A widget a rule hides right now: 'Batalla (oculto en práctica)'. */
    widgetHidden: (title: string, hiddenNote: string) => `${title} (${hiddenNote})`,
    tooltip: (status: string) => `OverLap · ${status}`,
    /** While the user has the overlay hidden. */
    tooltipHidden: (status: string) => `OverLap · Overlay oculto · ${status}`,
    /**
     * While one rule hides every enabled widget (`hiddenNote`: its caption, 'Oculto: fuera del
     * coche').
     */
    tooltipAutoHidden: (status: string, hiddenNote: string) => `OverLap · ${hiddenNote} · ${status}`
  },
  /** Main's words about the saved layouts (file dialogs, an imported file without a name). */
  layoutFiles: {
    filter: 'Disposición de OverLap',
    importedName: 'Importada'
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
    dropOnOtherDisplay: 'Suelta para moverlo a la otra pantalla',
    /** A disabled widget, drawn in edit mode as a ghost at its place. */
    hidden: 'Oculto',
    /** The chip's eye and padlock (tooltips): `widget` is its name. */
    show: (widget: string) => `Mostrar ${widget}`,
    hide: (widget: string) => `Ocultar ${widget}`,
    lock: (widget: string) => `Bloquear ${widget}`,
    unlock: (widget: string) => `Desbloquear ${widget}`,
    /** The radar is painted above every panel: on it, the panels it covers ('Avisos, Delta'). */
    coversPanels: (names: string) => `Tapa: ${names}`,
    /** On a panel under the radar. */
    underRadar: 'El radar lo tapa',
    /** Edit mode while the game hides the mouse cursor (you are in the car). */
    cursorHidden: {
      title: 'iRacing oculta el cursor',
      body: 'Para mover los widgets, abre los Ajustes de OverLap desde la bandeja o pulsa Alt+Tab para ir al escritorio: así recuperas el cursor.'
    }
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
    numpad: (key: string) => `Num ${key}`,
    /** A controller's button bound to a shortcut: 'Botón 7' (its number on the controller). */
    button: (n: number) => `Botón ${n}`
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
  decimal: '.',
  widgetTitles: {
    relative: 'Relative',
    radar: 'Radar',
    standings: 'Standings',
    battle: 'Battle',
    inputs: 'Inputs',
    traffic: 'Traffic',
    alerts: 'Alerts',
    lights: 'Warning lights',
    delta: 'Delta',
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
    'not-race': 'Hidden: races only',
    garage: 'Hidden in the garage',
    'ui-hidden': 'Hidden: iRacing UI hidden',
    'out-of-car': 'Hidden: out of the car',
    'session-screen': 'Hidden on the session screen',
    replay: 'Hidden in replays',
    'replay-player': 'Hidden in replays: live only',
    'camera-other': 'Hidden: camera on another car',
    any: 'Hidden'
  },
  showWhen: {
    car: 'Only when you are in the car',
    race: 'Races only',
    always: 'Always'
  },
  tray: {
    settings: 'Settings…',
    radarRange: 'Radar range',
    rangeMeters: (m) => `${m} m`,
    showWhen: 'When to show',
    layouts: 'Layout',
    manageLayouts: 'Manage layouts…',
    moreLayouts: 'More…',
    layoutForCar: (name) => `${name} · current car`,
    editMode: 'Edit mode',
    showOverlay: 'Show the overlay',
    openSettingsFolder: 'Open settings folder',
    quit: 'Quit',
    widgetHidden: (title, hiddenNote) => `${title} (${hiddenNote})`,
    tooltip: (status) => `OverLap · ${status}`,
    tooltipHidden: (status) => `OverLap · Overlay hidden · ${status}`,
    tooltipAutoHidden: (status, hiddenNote) => `OverLap · ${hiddenNote} · ${status}`
  },
  layoutFiles: {
    filter: 'OverLap layout',
    importedName: 'Imported'
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
    dropOnOtherDisplay: 'Release to move it to the other display',
    hidden: 'Hidden',
    show: (widget) => `Show ${widget}`,
    hide: (widget) => `Hide ${widget}`,
    lock: (widget) => `Lock ${widget}`,
    unlock: (widget) => `Unlock ${widget}`,
    coversPanels: (names) => `Covers: ${names}`,
    underRadar: 'The radar covers it',
    cursorHidden: {
      title: 'iRacing is hiding the cursor',
      body: 'To move the widgets, open OverLap’s settings from the tray or press Alt+Tab to go to the desktop: that frees the cursor.'
    }
  },
  keys: {
    space: 'Space',
    insert: 'Ins',
    delete: 'Delete',
    home: 'Home',
    end: 'End',
    pageUp: 'PgUp',
    pageDown: 'PgDn',
    numpad: (key) => `Num ${key}`,
    button: (n) => `Button ${n}`
  },
  boot: {
    settingsFailed: 'Could not load the settings window.',
    unknownView: (view) => `Unknown view: "${view}".`,
    missingParam: 'The URL is missing the ?view= parameter.'
  }
}
