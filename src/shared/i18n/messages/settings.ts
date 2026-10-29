/**
 * Texts of the settings window, grouped by page and component. Choice groups
 * are `{ value: { label, hint? } }` (see settings/controls/choice.ts); widget
 * names come from core.widgetTitles.
 */
import type { Dict } from '../dict'

/** No-break space between a number and its unit (shared/format.ts NBSP). */
const NB = '\u00a0'

export const settingsEs = {
  /** Window frame: top bar, banners, footer. */
  app: {
    pageSelect: 'Sección',
    /** Split around the <kbd>Alt</kbd> key. */
    editBanner: {
      before:
        'Modo edición: arrastra los widgets para moverlos y usa sus bordes para cambiar el ancho; la rueda del ratón los escala y',
      after:
        'desactiva el imán. Los bloqueados no se mueven; el ojo y el candado de cada widget lo ocultan o lo bloquean.'
    },
    updateError: 'No se pudo aplicar el cambio. Vuelve a intentarlo.',
    loading: 'Cargando ajustes…',
    footNote: 'Los cambios se aplican al momento y se guardan solos.',
    openFolder: 'Abrir carpeta de ajustes'
  },
  nav: {
    title: 'Ajustes',
    sections: 'Secciones de ajustes',
    appearance: 'Apariencia',
    shortcuts: 'Atajos de teclado',
    widgets: 'Widgets',
    /** What each shortcut at the foot of the sidebar does. */
    keys: {
      editMode: 'modo edición',
      overlay: 'mostrar u ocultar',
      exit: 'salir de edición'
    },
    /** The user hid the overlay (tray, shortcut): a line above every page. */
    hidden: {
      title: 'Overlay oculto',
      /** The show / hide shortcut: 'Ctrl+Shift+H lo muestra'. */
      press: (keys: string) => `${keys} lo muestra`,
      show: 'Mostrar'
    }
  },
  editMode: {
    /**
     * Also the way in while driving: iRacing hides the cursor in the car, and this window (it
     * takes the focus) frees it.
     */
    tooltip:
      'Mover y redimensionar los widgets. En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera',
    /** With the edit-mode shortcut: 'Mover y redimensionar los widgets (Ctrl+Shift+E). En…'. */
    tooltipKeys: (keys: string) =>
      `Mover y redimensionar los widgets (${keys}). En el coche iRacing oculta el cursor: entra desde aquí, esta ventana lo libera`,
    enter: 'Modo edición',
    exit: 'Salir de edición'
  },
  /** Sidebar dot that shows or hides a widget. */
  visibility: {
    label: (widget: string) => `${widget} visible`,
    hide: (widget: string) => `Ocultar ${widget}`,
    show: (widget: string) => `Mostrar ${widget}`
  },
  confirm: {
    /** Screen-reader text while a ConfirmButton is armed. */
    pressAgain: (description: string) => `Pulsa otra vez para confirmar: ${description}`,
    reset: '¿Restablecer? Pulsa otra vez'
  },
  sample: {
    caption: 'Vista previa con datos de ejemplo',
    /** settingsWindow.stageScene: the scene behind the previews. */
    scene: 'Fondo',
    sceneChoices: {
      dark: { label: 'Noche', hint: 'El widget sobre asfalto oscuro' },
      light: { label: 'Día', hint: 'El widget sobre una escena clara' }
    }
  },
  controls: {
    customColor: 'Color personalizado',
    customColorLabel: (label: string) => `${label}: color personalizado`,
    hexLabel: (label: string) => `${label}: código hexadecimal`,
    presetsLabel: (label: string) => `${label}: valores rápidos`,
    decrease: 'Reducir',
    increase: 'Aumentar'
  },
  /** Labels several pages share. */
  common: {
    content: 'Contenido',
    /** The widget page's element editors (settings/layout/CustomizeSection.vue). */
    customize: 'Personalizar',
    customizeNote: 'Orden y visibilidad de cada parte',
    show: 'Mostrar',
    layout: 'Disposición',
    keepVisible: 'Mantener visible',
    nameFormat: 'Formato de nombre',
    density: 'Densidad',
    license: 'Licencia',
    iRating: 'iRating',
    /** The per-car flag badges of the relative and the standings. */
    penaltyFlags: 'Banderas de penalización',
    penaltyFlagsHelp: 'Negra, reparación y aviso (negra enrollada), tras el nombre'
  },
  /** Option lists shared by several pages. */
  choices: {
    nameFormat: {
      full: 'Completo',
      abbr: 'Abreviado',
      surname: 'Apellido',
      tv: 'TV'
    },
    density: {
      comfortable: { label: 'Cómoda', hint: 'Filas más altas' },
      compact: { label: 'Compacta', hint: 'Más filas en el mismo alto' }
    },
    /** 'inherit', labelled with what it resolves to: 'Global (Apellido)'. */
    inherit: (current: string) => `Global (${current})`,
    nameInheritHint: 'El de Apariencia',
    densityInheritHint: 'La de Apariencia',
    example: (sample: string, formatted: string) => `Ejemplo: ${sample} → ${formatted}`
  },
  appearance: {
    sub: 'El aspecto común de todos los widgets. Cada widget puede usar su propio formato de nombre y densidad en su página.',
    language: {
      title: 'Idioma',
      label: 'Idioma',
      help: 'Idioma de los widgets, los ajustes y el menú de la bandeja'
    },
    color: {
      title: 'Color',
      accent: 'Color de acento',
      accentHelp: 'Te identifica a ti y nada más: tu fila, tu posición y tu barra',
      accentNames: {
        yellow: 'Amarillo',
        orange: 'Naranja',
        cyan: 'Cian',
        lime: 'Lima',
        pink: 'Rosa',
        white: 'Blanco'
      },
      colorBlind: 'Paleta para daltónicos',
      colorBlindHelp:
        'Azul y naranja en lugar de verde y rojo; las flechas y los iconos se mantienen'
    },
    text: {
      title: 'Texto',
      fontScale: 'Tamaño del texto',
      fontScaleHelp:
        'Multiplica la escala de Clasificación y Batalla; los demás ajustan el texto a su ventana',
      halo: 'Contorno del texto',
      haloHelp: 'Un borde oscuro fino para leer el texto sobre el juego',
      haloChoices: {
        auto: {
          label: 'Auto',
          hint: 'Solo con el fondo casi transparente (menos del 35 %)'
        },
        on: { label: 'Siempre' },
        off: { label: 'Nunca' }
      }
    },
    rows: {
      title: 'Filas y pilotos',
      densityHelp: 'Alto de las filas en clasificación y relativo',
      stripes: 'Filas alternas',
      stripesHelp: 'Sombrea una fila de cada dos',
      licenseChoices: {
        outline: { label: 'Contorno', hint: 'Borde fino del color de la licencia, sin fondo' },
        soft: { label: 'Suave', hint: 'Letra del color de la licencia, sin borde' },
        solid: { label: 'Sólida', hint: 'Como en iRacing' },
        letter: { label: 'Solo letra', hint: 'La letra en su color, sin chip' }
      },
      number: 'Número del coche',
      numberChoices: {
        chip: { label: 'Chip', hint: 'Número sobre el color de su clase' },
        stripe: { label: 'Franja', hint: 'Franja del color de la clase y número en texto' }
      }
    },
    other: {
      title: 'Otros',
      units: 'Unidades',
      unitsHelp: 'Velocidades y temperaturas de los widgets',
      unitChoices: {
        metric: { label: 'Métricas', hint: 'km/h, °C' },
        imperial: { label: 'Imperiales', hint: 'mph, °F' }
      },
      simPill: 'Etiqueta SIM',
      simPillHelp: 'Marca los widgets cuando los datos son simulados'
    },
    /** settings.visibility: when every widget hides with what iRacing shows. */
    screen: {
      title: 'Visibilidad',
      /** visibility.showWhen; its choices are core.showWhen. */
      showWhen: 'Mostrar el overlay',
      /** The help line under it, for the current choice. */
      showWhenHelp: {
        car: 'Mientras conduces; fuera del coche (garaje, pantalla de sesión, el turno de un compañero) se oculta',
        race: 'Mientras conduces en una sesión de carrera; en práctica y clasificación no se ve',
        always: 'También fuera del coche; solo lo ocultan las reglas de abajo y las de cada widget'
      },
      /** The choices' tooltips. */
      showWhenHints: {
        car: 'Lo normal: el overlay solo cuando estás dentro del coche',
        race: 'Como «Solo cuando estás en el coche», y solo en carreras',
        always:
          'También fuera del coche: pantalla de sesión, el turno de un compañero y mirando la carrera'
      },
      /** widgets.standings.showOnSessionScreen, also in the standings' Ventana section. */
      keepStandings: 'Clasificación en la pantalla de sesión',
      /** `widgets`: the others with this exception ('Relativo, Batalla, Tráfico y Avisos'). */
      keepStandingsHelp: (widgets: string) =>
        `Fuera del coche se queda con los resultados; ${widgets} también pueden quedarse (en su sección Ventana)`,
      /** Nothing hides on the session screen: hideOnSessionScreen off, and showWhen 'always' or replays followed. */
      keepStandingsOff: 'Se muestra: sin «Ocultar en la pantalla de sesión», ahí se ve todo',
      simUi: 'Ocultar con la interfaz de iRacing',
      simUiHelp: 'Si ocultas la interfaz del simulador, los widgets también se ocultan',
      garage: 'Ocultar en el garaje',
      garageHelp: 'Mientras tienes abierta la pantalla del garaje',
      sessionScreen: 'Ocultar en la pantalla de sesión',
      sessionScreenHelp: 'Fuera del coche no tapan los resultados ni el chat de iRacing',
      /**
       * The overlay only for the car and replays hidden: out of the car the session screen hides
       * already. `rule`: the showWhen choice ('Solo cuando estás en el coche').
       */
      sessionScreenAlready: (rule: string) =>
        `Ya se oculta con «${rule}» y las repeticiones ocultas: solo se quedan los widgets que dejes ahí`,
      replays: 'En repeticiones',
      /** The help line under it, for the current choice. */
      replaysHelp: {
        /** With showWhen 'car' or 'race'. */
        hide: 'Ningún widget mientras ves una repetición, ni al mirar a otros coches en directo desde fuera del coche',
        /** With showWhen 'always': the live point is live. */
        hideAlways: 'Al rebobinar no se ve ningún widget; en directo siguen al coche que miras',
        /** `widgets`: the names of the widgets with your car's data only ('Radar, Pedales y Delta'). */
        follow: (widgets: string) =>
          `Siguen al coche que miras y, al rebobinar, solo queda la clasificación en directo; ${widgets} solo tienen datos de tu coche y se ocultan si miras otro`
      },
      replayChoices: {
        hide: { label: 'Ocultar', hint: 'Ningún widget mientras ves una repetición' },
        follow: {
          label: 'Seguir al coche en cámara',
          hint: 'Los widgets siguen al coche que miras; al rebobinar queda la clasificación de la carrera en directo'
        }
      },
      waiting: 'Mantener «Esperando a iRacing»',
      waitingHelp:
        'Sin iRacing, Clasificación y Relativo se ocultan a los pocos segundos; activado, siguen con el aviso'
    },
    reset: {
      label: 'Restablecer apariencia',
      description:
        'Vuelve la apariencia a los valores por defecto; el idioma, la visibilidad y las opciones de cada widget no cambian'
    }
  },
  /** "Atajos de teclado" page. */
  shortcuts: {
    sub: 'Combinaciones de teclas que funcionan en todo Windows, también con iRacing en primer plano.',
    section: 'Atajos globales',
    actions: {
      toggleOverlay: {
        label: 'Mostrar u ocultar el overlay',
        help: 'Oculta todos los widgets de golpe; la telemetría sigue, así que vuelven al instante'
      },
      toggleEditMode: {
        label: 'Modo edición',
        help: 'Entra o sale del modo edición para mover y redimensionar los widgets'
      },
      cycleDeltaReference: {
        label: 'Cambiar la referencia del delta',
        help: 'Pasa a la siguiente en este tipo de sesión; se aplica al empezar la vuelta'
      }
    },
    /** The fixed Esc row. */
    escape: {
      label: 'Salir del modo edición',
      help: 'Solo mientras editas; no se puede cambiar',
      tag: 'Fijo'
    },
    status: {
      disabled: 'Desactivado',
      unavailable: 'En uso por otra aplicación'
    },
    unavailableHelp:
      'Otra aplicación ya usa esta combinación. Elige otra, o ciérrala y vuelve a asignarla aquí',
    change: 'Cambiar',
    cancel: 'Cancelar',
    disable: 'Desactivar',
    reset: 'Restablecer',
    /** Button names for screen readers: 'Cambiar: Modo edición'. */
    changeLabel: (action: string) => `Cambiar: ${action}`,
    cancelLabel: (action: string) => `Cancelar el cambio: ${action}`,
    disableLabel: (action: string) => `Desactivar: ${action}`,
    resetLabel: (action: string, keys: string) => `Restablecer ${action} a ${keys}`,
    capture: {
      prompt: 'Pulsa la combinación… (Esc cancela)',
      clearHint: 'Retroceso o Supr lo desactivan'
    },
    /** Why a combination was refused (accelerator.ts). */
    errors: {
      invalid: 'Esa combinación no es válida',
      unsupportedKey:
        'Esa tecla no sirve: usa letras, números, F1–F24, el teclado numérico, Espacio o las de navegación',
      meta: 'La tecla Windows no se puede usar',
      needsModifier: 'Añade Ctrl o Alt: sin ellas solo valen F13–F24',
      reserved: 'Windows o los programas ya usan esa combinación',
      duplicate: (action: string) => `Ya la usa «${action}»`
    },
    saved: (keys: string) => `Guardado: ${keys}`,
    disabled: 'Desactivado: esta acción ya no tiene atajo',
    warnings: {
      altgr:
        'En un teclado español, Ctrl+Alt es AltGr: puede impedir escribir @, # o € mientras OverLap esté abierto'
    },
    notes: {
      title: 'Cómo funcionan',
      focus: 'Funcionan aunque iRacing tenga el foco, sin salir del juego.',
      exclusive:
        'Una combinación asignada deja de llegar a los demás programas, iRacing incluido: no elijas una que uses en el simulador.',
      buttonBox:
        'Consejo: F13–F24 (las envían muchas button box y teclados de macros) funcionan sin Ctrl ni Alt.'
    },
    resetAll: {
      label: 'Restablecer atajos',
      description: 'Vuelve todos los atajos de teclado a los de fábrica'
    }
  },
  /** One widget's page: header, hidden note and resets. */
  widgetPage: {
    sizeFree: (size: string) => `Tamaño libre · ${size} px`,
    sizeAuto: (width: number, scale: string) => `Alto automático · ${width} px de ancho · ${scale}`,
    sizeFixed: (size: string, scale: string) => `Alto fijo · ${size} px · ${scale}`,
    visible: 'Visible',
    hiddenNote: 'Oculto: no se dibuja ni se calcula. Actívalo para verlo sobre el juego.',
    resetOptions: {
      label: 'Restablecer opciones',
      description:
        'Vuelve a los valores por defecto las opciones, la escala, la opacidad y las reglas de este widget; no cambia su posición'
    },
    resetBounds: {
      label: 'Restablecer posición y tamaño',
      confirm: '¿Moverlo? Pulsa otra vez',
      description: 'Lleva el widget a su posición y tamaño de fábrica'
    }
  },
  /** "Ventana" section of every widget page. */
  window: {
    title: 'Ventana',
    locked: 'Bloqueado',
    lockedHelp: 'No se mueve ni se redimensiona, ni siquiera en modo edición',
    opacity: 'Opacidad del fondo',
    opacityHelp:
      'Solo el panel: el texto y los coches siguen opacos. Por debajo del 35 % el texto lleva contorno (ver Apariencia)',
    scale: 'Escala',
    scaleHelp: 'Tamaño del texto de este widget; también con la rueda del ratón en modo edición',
    height: 'Alto',
    heightHelp: 'Automático: sin huecos vacíos; en modo edición solo eliges el ancho',
    heightChoices: {
      on: { label: 'Automático', hint: 'La ventana crece y encoge con el contenido' },
      off: { label: 'Fijo', hint: 'El alto que le des en modo edición' }
    },
    anchor: 'Crece hacia',
    anchorHelp: 'Arriba si lo tienes pegado al borde inferior de la pantalla',
    anchorOff: 'Solo con alto automático',
    // The anchor is the edge that stays put: anchored at the top, it grows downwards.
    anchorChoices: {
      top: { label: 'Abajo', hint: 'El borde de arriba se queda fijo' },
      bottom: { label: 'Arriba', hint: 'El borde de abajo se queda fijo' }
    },
    sizeNote:
      'Tamaño libre: el contenido se ajusta a la ventana. Cámbiala arrastrando sus bordes en modo edición, o con la rueda del ratón para escalarla entera.',
    showIn: 'Mostrar en',
    showInKinds: {
      practice: 'Práctica',
      qualify: 'Clasificación',
      race: 'Carrera'
    },
    showInNowhere: 'No se mostrará en ninguna sesión (en modo edición sí, para colocarlo)',
    showInHelp: 'En las demás sesiones se oculta y no consume nada; en modo edición siempre se ve',
    /** Apariencia > Visibilidad shows the overlay in races only (showWhen 'race'). */
    showInRaceOnly:
      'Apariencia > Visibilidad solo muestra el overlay en carrera: en práctica y clasificación no se ve',
    hideInPits: 'Ocultar en boxes',
    hideInPitsHelp: 'Mientras estás en el pit lane o parado en tu box',
    sessionScreen: 'Mostrar en la pantalla de sesión',
    sessionScreenHelp:
      'Fuera del coche, sobre los resultados y el chat de iRacing (aunque el overlay sea solo para el coche)',
    /** Apariencia > Visibilidad does not hide anything on the session screen. */
    sessionScreenOff:
      'Se muestra: Apariencia > Visibilidad no oculta nada en la pantalla de sesión',
    /** What the widget does in a replay (Apariencia > Visibilidad decides the rest). */
    replay: {
      /** The standings: they keep the live race. */
      keepsLive: 'En directo sigue al coche que miras; al rebobinar mantiene la carrera en directo',
      follows: 'En directo sigue al coche que miras; al rebobinar una repetición se oculta',
      liveOnly: 'Solo tiene datos de tu coche: se oculta en repeticiones y si miras otro coche',
      /** The radar, the pedals, the delta: no session-screen switch either. */
      inCarOnly:
        'Solo tiene datos de tu coche y desde dentro: se oculta fuera del coche (también en la pantalla de sesión), en repeticiones y si miras otro coche',
      /** The fuel: nothing while the replay system is on, so no session-screen switch either. */
      noSessionScreen:
        'Solo tiene datos de tu coche: se oculta en repeticiones, en la pantalla de sesión y si miras otro coche',
      hidden:
        'Al rebobinar se oculta (Apariencia > Visibilidad); en directo sigue al coche que miras',
      /** Replays hidden with the overlay only in the car: watching from out of it hides too. */
      hiddenOutOfCar:
        'Se oculta en repeticiones y al mirar otros coches desde fuera del coche (Apariencia > Visibilidad)'
    }
  },
  relative: {
    carsAhead: 'Coches delante',
    carsBehind: 'Coches detrás',
    columns: 'Columnas',
    classPosition: 'Posición en clase',
    stint: 'Vueltas del stint',
    stintHelp: 'Desde su última parada, o desde la salida',
    tyre: 'Neumático',
    tyreHelp:
      'Letra del compuesto (H duro, W lluvia) cuando no todos llevan el de seco; solo para tu modelo de coche',
    incidents: 'Incidentes en la cabecera',
    incidentsHelp: 'Los tuyos (y los del equipo) y el próximo límite de la sesión: «3x · DQ a 17x»'
  },
  radar: {
    range: 'Alcance',
    rangeHelp: 'Distancia por delante y por detrás que cubre el radar',
    labels: 'Mostrar distancias',
    labelsHelp: 'Etiquetas con la distancia en las guías del radar'
  },
  standings: {
    mode: 'Modo',
    modeChoices: {
      compact: { label: 'Compacto', hint: 'Primeros, tu entorno y líderes de otras clases' },
      full: { label: 'Completo', hint: 'Todos los coches de todas las clases' }
    },
    compact: 'Modo compacto',
    compactOff: '(no se usa en modo completo)',
    topRows: 'Primeros puestos',
    topRowsHelp: 'Filas de cabeza de tu clase',
    aroundRows: 'Alrededor de ti',
    aroundRowsHelp: 'Coches por delante y por detrás de ti',
    leaders: 'Líderes de otras clases',
    leadersHelp: 'Una línea con el líder de cada otra clase',
    gap: 'Hueco',
    gapHelp: 'Fuera de carrera, el hueco es a la mejor vuelta',
    gapChoices: {
      interval: { label: 'Al de delante' },
      leader: { label: 'Al líder' },
      both: { label: 'Ambos', hint: 'Al de delante y, en otra columna, al líder' }
    },
    deltaAll: 'Δ iRating de todos',
    deltaAllHelp:
      'El cambio de iRating proyectado en cada fila, no solo en la tuya (activa la columna)',
    header: 'Cabecera',
    headerHelp:
      'Tu iRating y SR proyectados, con el margen de incidentes (estimación, solo en carrera)',
    safetyRating: 'Safety rating',
    incidents: 'Incidentes',
    incidentsHelp: 'En cualquier sesión, con el próximo límite: «3x · DQ a 17x»',
    classLine: 'Línea de clase',
    sof: 'SoF',
    carCount: 'Número de coches'
  },
  /** Standings column editor. */
  columns: {
    title: 'Columnas',
    count: (visible: number, total: number) => `${visible} de ${total} visibles`,
    /** Split around the drag handle glyph. */
    intro: {
      before: 'Arrastra',
      after:
        'o usa ↑ ↓ para ordenarlas. Si la ventana se queda estrecha se ocultan primero las menos importantes; el nombre siempre cabe.'
    },
    fixedList: 'Columnas fijas',
    fixedTag: 'Fija',
    fixed: {
      pos: 'Posición',
      num: 'Número',
      name: 'Nombre'
    },
    list: 'Columnas de la derecha, en orden',
    labels: {
      gained: 'Puestos ganados',
      ir: 'iRating',
      lic: 'Licencia',
      delta: 'Δ iRating',
      gap: 'Hueco',
      gapLeader: 'Hueco al líder',
      last: 'Última vuelta',
      best: 'Mejor vuelta',
      pit: 'Boxes',
      pitLap: 'Última parada',
      stint: 'Vueltas del stint',
      tyre: 'Neumático'
    },
    /** Short help under a column label (only some columns have one). */
    hints: {
      gained: 'Solo en carrera: puestos ganados desde la salida',
      delta: 'Tu cambio de iRating proyectado (o el de todos, con la opción)',
      gap: 'Según «Hueco»: al de delante o al líder',
      gapLeader: 'Con «Hueco: Ambos»',
      last: 'Fuera de carrera, la mejor vuelta',
      best: 'Solo en carrera: fuera de carrera ya la muestra «Última vuelta»',
      pit: 'PIT / OUT / GRÚA y paradas (una grúa no cuenta)',
      pitLap: 'Solo en carrera: la vuelta de su última parada (V12)',
      stint: 'Desde su última parada, o desde la salida (7 v)',
      tyre: 'Letra del compuesto (H duro, W lluvia) cuando no todos llevan el de seco; solo para tu modelo de coche'
    },
    move: (column: string) => `Mover ${column}`,
    moveUp: (column: string) => `Subir ${column}`,
    moveDown: (column: string) => `Bajar ${column}`,
    defaultOrder: 'Orden por defecto',
    /** Screen-reader announcements. */
    moved: (column: string, position: number, total: number) =>
      `${column} movida a la posición ${position} de ${total}.`,
    shown: (column: string) => `${column} visible.`,
    hidden: (column: string) => `${column} oculta.`,
    reordered: 'Columnas en el orden por defecto.'
  },
  battle: {
    threshold: 'Mostrar cuando el hueco sea menor de',
    thresholdHelp: 'Aparece solo con un rival de tu clase a menos de este tiempo',
    holdHelp:
      'Sigue en pantalla este tiempo después de que el rival se aleje, para que no parpadee',
    rivals: 'Rivales',
    noRivals: 'Sin rivales el widget no se muestra',
    ahead: 'Coche de delante',
    behind: 'Coche de detrás',
    layoutChoices: {
      stacked: { label: 'Apilada', hint: 'Delante arriba, detrás abajo' },
      side: { label: 'Lado a lado', hint: 'Para ventanas anchas (520 px o más)' }
    },
    detail: 'Detalle',
    detailHelp: 'Diferencia por sector o por vuelta: + es a tu favor',
    detailChoices: {
      none: { label: 'Ninguno' },
      sectors: { label: 'Sectores', hint: 'S1 S2 S3 y la última vuelta' },
      laps: { label: 'Vueltas', hint: 'Las tres últimas vueltas' },
      both: { label: 'Ambos' }
    },
    prediction: 'Predicción de alcance',
    predictionHelp: '«Le alcanzas en ~4 v de 19»',
    atStake: 'iRating en juego',
    atStakeHelp: 'Cuánto iRating vale ese puesto'
  },
  inputs: {
    layoutChoices: {
      'trace-bars-info': { label: 'Traza · barras · datos' },
      'info-bars-trace': { label: 'Datos · barras · traza' },
      bars: { label: 'Solo barras', hint: 'Para un widget pequeño (~140 × 110)' }
    },
    traceSeconds: 'Segundos de traza',
    traceSecondsHelp: 'Historia de acelerador, freno y embrague que muestra la gráfica',
    traceWidth: 'Grosor de la traza',
    clutchInTrace: 'Embrague en la traza',
    clutchInTraceHelp: 'Desactívalo si cambias con levas',
    steering: 'Volante',
    gearSpeed: 'Marcha y velocidad',
    steeringStyle: 'Estilo del volante',
    steeringChoices: {
      bar: { label: 'Barra' },
      wheel: { label: 'Volante', hint: 'Un aro que gira con el volante' }
    },
    colors: 'Colores',
    colorsNote: 'Colores opacos: la traza los superpone',
    pedals: {
      throttle: 'Acelerador',
      brake: 'Freno',
      clutch: 'Embrague'
    }
  },
  traffic: {
    warnAbout: 'Avisar de',
    nothing: 'Sin nada que avisar el widget no se muestra',
    faster: 'Clase más rápida',
    fasterHelp: 'Te alcanza por detrás: en cuánto y dónde',
    slower: 'Tráfico lento',
    slowerHelp: 'Una clase más lenta a la que alcanzas',
    hazards: 'Peligros',
    hazardsHelp: 'Coches parados, muy lentos o fuera de pista delante',
    behind: 'Mirar atrás',
    behindHelp: 'Coches más rápidos hasta este tiempo por detrás de ti',
    ahead: 'Mirar delante',
    aheadHelp: 'Tráfico lento hasta este tiempo por delante de ti',
    hazardRange: 'Peligros hasta',
    hazardRangeHelp: 'Avisa de un coche parado o lento a menos de este tiempo por delante',
    entries: 'Entradas por grupo',
    entriesHelp: 'Los más cercanos primero',
    multiclass: 'Solo en multiclase',
    multiclassHelp:
      'Sin otras clases en pista solo avisa de quien te dobla (o con bandera azul) y de los peligros'
  },
  alerts: {
    nothing: 'Sin ningún aviso marcado el widget no se muestra',
    limiterHidden: 'Con «Ocultar en boxes» (Ventana) el limitador no llega a verse',
    /** Groups of toggles after the flags ('Mostrar'). */
    pitGroup: 'Boxes',
    raceGroup: 'Carrera',
    engineGroup: 'Motor',
    flags: 'Banderas',
    flagsHelp: 'Las que te afectan a ti: la más importante en grande, el resto al lado',
    blue: 'Bandera azul',
    blueHelp: '«Déjale pasar»: un coche más rápido te va a doblar',
    furled: 'Negra enrollada',
    furledHelp: '«ADVERTENCIA» de dirección de carrera; el motivo no llega en los datos',
    limiter: 'Limitador de boxes',
    limiterHelp: 'En el pit lane: puesto, sin poner o por encima del límite',
    overspeed: 'Exceso con el limitador OFF',
    overspeedHelp: 'Sin limitador también compara tu velocidad con el límite',
    pitEntry: 'Antes de la entrada',
    pitEntryHelp: 'Al tomar el carril de entrada a boxes sin el limitador puesto',
    lapsToGo: '10 y 5 vueltas',
    lapsToGoHelp: 'Unos segundos al quedar 10 y 5 vueltas para el final de la carrera',
    tow: 'Grúa',
    towHelp: 'Cuenta atrás de la grúa: tiempo hasta poder salir de tu box',
    wrongWay: 'Sentido contrario',
    wrongWayHelp: 'Avanzas hacia atrás en la vuelta; marcha atrás y pit lane no cuentan',
    incidents: 'Incidentes',
    /** `s`: the incident's own minimum time on screen. */
    incidentsHelp: (s: number) =>
      `Al sumar puntos, al menos ${s}${NB}s: «+2x Pérdida de control · V5 · S3 · grava»`,
    /** Under the engine group: where the other lights went. */
    engineNote:
      'Las temperaturas, la presión de gasolina y las reparaciones opcionales están en Testigos',
    stalled: 'Motor calado',
    stalledHelp: 'Con el coche en pista',
    oilPressure: 'Presión de aceite',
    oilPressureHelp: 'Baja, con el motor en marcha: «PRESIÓN ACEITE · baja»',
    damage: 'Daños',
    damageHelp:
      'Al dañarse el coche, antes de la bandera de reparación: «DAÑO · reparación obligatoria en boxes»',
    fuelGroup: 'Combustible',
    /** `laps`: FUEL_ALERT.lowLaps. */
    fuelLow: 'Combustible bajo',
    fuelLowHelp: (laps: number) =>
      `Con menos de ${laps}${NB}vueltas de gasolina y sin llegar a meta: «COMBUSTIBLE · 1.6 V»`,
    boxThisLap: 'Entra esta vuelta',
    boxThisLapHelp: 'La ventana de boxes se cierra en esta vuelta y con tu media no llegas a meta',
    holdHelp: 'Un aviso breve sigue en pantalla al menos este tiempo, para que dé tiempo a leerlo'
  },
  delta: {
    reference: 'Referencia',
    referenceNote: 'El récord personal se guarda por coche y trazado',
    /** delta.reference*: one per kind of session (practice also warmup and testing). */
    referenceBySession: 'Referencia por sesión',
    referenceBySessionNote: 'Un cambio se aplica al empezar la próxima vuelta',
    sessions: { practice: 'Práctica', qualify: 'Clasificación', race: 'Carrera' },
    /** Short names that fit the selector on one line ('Óptima de clase'). */
    referencesShort: {
      pb: 'Récord',
      session: 'Mejor',
      optimal: 'Óptima',
      class: 'Mejor de clase',
      classOptimal: 'Óptima de clase'
    },
    /** The cycle shortcut, under the selector: 'Ctrl+Alt+D pasa a la siguiente en la sesión'. */
    cycleKeys: (keys: string) => `${keys} pasa a la siguiente en la sesión actual`,
    cycleNoKeys: 'Con un atajo en «Atajos de teclado» la cambias sin salir del coche',
    /** The lap times line (delta.rows 'laps', its items delta.laps). */
    lapTimes: 'Tiempos de vuelta',
    lapTimesHelp: 'Tu última, tu mejor y tu óptima a la vez; la que usa el delta lleva «Δ»',
    compareWith: 'Comparar con',
    /** Delta references, in UI order. */
    references: {
      pb: {
        label: 'Récord personal',
        hint: 'Tu mejor vuelta de siempre con este coche en este trazado'
      },
      session: { label: 'Mejor vuelta de la sesión', hint: 'Tu mejor vuelta de esta sesión' },
      optimal: {
        label: 'Vuelta óptima',
        hint: 'Tus mejores sectores de esta sesión, unidos en una vuelta'
      },
      class: {
        label: 'Mejor de tu clase',
        hint: 'La vuelta más rápida de tu clase en esta sesión, sea de quien sea'
      },
      classOptimal: {
        label: 'Óptima de tu clase',
        hint: 'Los mejores sectores de tu clase en esta sesión, sean de quien sean'
      }
    },
    /** What each reference is, under the choice. */
    referenceHelp: {
      pb: 'Tu mejor vuelta limpia de siempre con este coche en este trazado. Se guarda en tu equipo y no se pierde al cambiar de sesión',
      session: 'Tu mejor vuelta limpia de esta sesión, como el delta de iRacing',
      optimal:
        'Tus mejores tiempos de cada sector del circuito en tus vueltas limpias de esta sesión, unidos en una sola vuelta: lo que harías juntando lo mejor de cada una',
      class:
        'La vuelta limpia más rápida de tu clase en esta sesión, sea de quien sea (tú incluido): el ritmo a batir',
      classOptimal:
        'Los mejores tiempos de cada sector en las vueltas limpias de tu clase en esta sesión, sean de quien sean (tú incluido), unidos en una sola vuelta: el límite teórico'
    },
    fallback: 'Usar la siguiente si no existe',
    /** Where the fallback goes from each reference (DELTA_FALLBACK in delta.ts). */
    fallbackHelp: {
      pb: 'Sin récord guardado aún, compara con tu mejor vuelta de la sesión y, si tampoco hay, con la mejor de tu clase',
      session: 'Mientras no tengas vuelta en esta sesión, compara con la mejor de tu clase',
      optimal:
        'Mientras no tengas vuelta en esta sesión, compara con tu récord y, si tampoco hay, con la óptima de tu clase',
      class: 'Es la última referencia: si nadie de tu clase ha marcado vuelta, no hay otra',
      classOptimal:
        'Mientras nadie de tu clase haya marcado vuelta en esta sesión, compara con tu récord'
    },
    fallbackOff: 'Desactivado, el delta se oculta hasta que exista la referencia elegida',
    range: 'Escala de la barra',
    rangeHelp:
      'Diferencia con la que la barra llega al final, a cada lado; más allá se marca el extremo',
    predicted: 'Vuelta prevista',
    predictedHelp: 'El tiempo que harás si mantienes el ritmo: referencia + delta',
    sectors: 'Sectores',
    sectorsHelp: 'Cada sector contra la referencia; el que estás corriendo, en vivo',
    trend: 'Tendencia',
    trendHelp: '«Ganando» o «perdiendo» según cómo cambia el delta ahora mismo'
  },
  /** The conditions footer section of the relative and standings pages. */
  conditionsFooter: {
    title: 'Pie de condiciones',
    note: 'iRacing no da pronóstico: todo es lo que hay ahora mismo',
    show: 'Mostrar el pie',
    relativeHelp:
      'Una línea bajo la tabla con la pista, el agua, el viento y la goma; las filas ceden su alto',
    standingsHelp:
      'Una línea bajo la tabla con la pista, el agua, el viento y la goma; la tabla crece una línea',
    readings: 'Datos',
    readingsHelp: 'En ese orden: si la tabla es estrecha, los últimos se quitan primero',
    nothing: 'Sin ningún dato marcado el pie no se muestra',
    trackTemp: 'Temperatura de la pista',
    trackTempHelp: 'La que mide el equipo alrededor del circuito',
    trend: 'Tendencia de la pista',
    trendHelp: 'Flecha si sube o baja en los últimos minutos',
    wet: 'Agua en la pista',
    wetHelp:
      'Solo cuando la hay: cuánta (de casi seco a encharcado), la lluvia y «Declarada mojada» si se permiten los neumáticos de lluvia',
    wind: 'Viento',
    windHelp: 'La media del último minuto, medida en meta',
    windDirection: 'Dirección respecto a tu coche',
    windDirectionHelp: 'La flecha apunta a tu coche desde donde sopla. Solo al volante',
    airTemp: 'Temperatura del aire',
    rubber: 'Goma',
    rubberHelp: 'La goma que había en la pista al empezar la sesión'
  },
  fuel: {
    note: 'Lo que gastas en cada vuelta limpia: sin boxes, amarilla, grúa ni la primera de la carrera',
    header: 'Cabecera',
    headerHelp: 'Una banda con el nombre del widget y la etiqueta SIM',
    /** The hero line is always drawn; these are the others. */
    lines: 'Líneas',
    gauge: 'Depósito',
    gaugeHelp: 'Barra del combustible frente a lo que cabe, con una marca en lo que necesitas',
    perLap: 'Consumo por vuelta',
    perLapHelp: 'La media de tus últimas vueltas limpias, la última y la que más gastó',
    finish: 'Para meta y repostar',
    finishHelp:
      'Lo que necesitas hasta la bandera con el margen y lo que echar en la próxima parada',
    box: 'Menú de boxes',
    boxHelp:
      'La gasolina puesta en el menú de boxes, junto a lo que hay que echar; en naranja si no llega',
    window: 'Ventana de boxes',
    windowHelp:
      'La primera y la última vuelta en que puedes parar y terminar, y las paradas que quedan',
    save: 'Ahorro',
    /** `pct`: FUEL_STRATEGY.saveReach as a whole percentage. */
    saveHelp: (pct: number) =>
      `Lo que gastar por vuelta para ahorrarte una parada, si está a tu alcance (hasta un ${pct}${NB}% menos)`,
    tyres: 'Neumáticos',
    tyresHelp:
      'El desgaste que midió el equipo en tu última parada: iRacing solo lo mide en el box',
    limits: 'Reparaciones y juegos',
    limitsHelp:
      'Las reparaciones rápidas y los juegos de neumáticos que te quedan, si la sesión los limita',
    calc: 'Cálculo',
    calcNote: 'Los avisos de combustible usan la misma media, sin el margen',
    avgLaps: 'Vueltas para la media',
    avgLapsHelp: 'Cuántas de tus últimas vueltas limpias se promedian',
    margin: 'Margen',
    marginHelp: 'Vueltas de combustible de sobra al cruzar la meta',
    /** The margin's readout ('0.5 v'). */
    marginValue: (laps: string) => `${laps}${NB}v`
  },
  lights: {
    note: 'Como los testigos del salpicadero: en gris apagados, encendidos con su color y su forma',
    nothing: 'Sin ningún testigo marcado el widget no se muestra',
    layout: 'Disposición',
    layoutChoices: {
      row: { label: 'En fila', hint: 'Si no caben en el ancho, siguen debajo' },
      column: { label: 'En columna' }
    },
    /** lights.labelSide: where the captions and values go in a column. */
    labelSide: 'Textos',
    labelSideChoices: {
      right: { label: 'A la derecha' },
      left: { label: 'A la izquierda' }
    },
    labelSideOff: 'Solo en columna',
    onlyWhenLit: 'Solo encendidos',
    onlyWhenLitHelp: 'Sin los apagados; el widget se oculta mientras no hay ninguno encendido',
    captions: 'Rótulos',
    captionsHelp: 'Una palabra tras cada icono: «AGUA», «REPARAR»',
    temps: 'Temperaturas',
    tempsHelp: 'La del agua y la del aceite junto a su testigo: «98°»',
    repairTime: 'Tiempo de reparación',
    repairTimeHelp: 'Lo que tardarán en boxes: «REPARAR · 42 s», «OPC. · 38 s»',
    /** The per-light toggles (labelled with the lights' names). */
    lightsGroup: 'Testigos',
    trend: 'Temperatura al alza',
    /** `s`: ENGINE_TREND.sustainS. */
    trendHelp: (s: number) =>
      `El agua o el aceite en amarillo tras ${s}${NB}s muy por encima de tu media: «+6°»`,
    /** Short help under each light's toggle. */
    help: {
      oilPressure: 'Solo con el motor en marcha',
      fuelPressure: 'Casi siempre, el depósito quedándose seco',
      stalled: 'Con el coche en pista',
      repair: 'Daños que hay que reparar para seguir',
      repairOptional: 'Daños leves, arreglables en la parada',
      water: 'El testigo del coche',
      oilTemp: 'El testigo del coche',
      pitLimiter: 'Puesto, en azul',
      revLimiter: 'En el corte, en azul'
    },
    legend: 'Leyenda',
    legendNote: 'Qué significa cada testigo y qué hacer',
    /** What each lit look says, without its colour. */
    looks: {
      alarm: 'Rojo y relleno: actúa ya',
      warn: 'Naranja con borde: atención',
      caution: 'Amarillo subrayado: por encima de tu media',
      info: 'Azul con raya: un estado'
    },
    /** The legend's rows: what the light means and what to do. */
    entries: {
      oilPressure: {
        meaning: 'Presión de aceite baja con el motor en marcha',
        action: 'Levanta y entra en boxes: el motor puede romperse'
      },
      fuelPressure: {
        meaning: 'Presión de gasolina baja; casi siempre, el depósito se queda seco',
        action: 'Entra a repostar; en las curvas el motor puede cortarse'
      },
      stalled: {
        meaning: 'El motor se ha calado con el coche en pista',
        action: 'Arráncalo con el botón de arranque y sigue'
      },
      repair: {
        meaning:
          'Daños que hay que reparar para seguir en carrera; llegará la bandera de reparación',
        action: 'Entra en boxes. «REPARAR · 42 s» es lo que tardarán'
      },
      repairOptional: {
        meaning: 'Daños leves: puedes seguir con ellos',
        action: 'Arréglalos en tu próxima parada si compensa: «OPC. · 38 s»'
      },
      water: {
        meaning: 'Agua demasiado caliente: el testigo del propio coche',
        action: 'Sal del rebufo y de la hierba; si no baja, entra en boxes'
      },
      oilTemp: {
        meaning: 'Aceite demasiado caliente: el testigo del propio coche',
        action: 'Sal del rebufo y de la hierba; si no baja, entra en boxes'
      },
      trend: {
        /** `s`: ENGINE_TREND.sustainS. */
        meaning: (s: number) =>
          `Agua o aceite muy por encima de tu media de esta sesión durante ${s}${NB}s, antes de su testigo`,
        action: 'Sal del rebufo un rato para que entre aire; si sigue subiendo, cuida el motor'
      },
      pitLimiter: {
        meaning: 'El limitador de boxes está puesto',
        action: 'Quítalo al salir del pit lane'
      },
      revLimiter: {
        meaning: 'El motor está en el corte de revoluciones',
        action: 'Cambia de marcha antes'
      }
    }
  },
  personalBests: {
    title: 'Récords personales',
    note: 'Uno por coche y trazado, guardados en tu equipo',
    mock: 'Telemetría simulada: estos récords son de prueba y se guardan aparte de los reales.',
    now: 'Ahora',
    record: (time: string) => `récord ${time}`,
    noRecord: 'sin récord todavía: tu próxima vuelta limpia lo será',
    deleteCurrent: {
      label: 'Borrar este récord',
      confirm: '¿Borrarlo? Pulsa otra vez',
      description:
        'Borra tu récord con este coche en este trazado; tu próxima vuelta limpia aquí será el nuevo'
    },
    loading: 'Cargando récords…',
    empty:
      'Aún no hay récords. Cada vuelta limpia que des se guarda sola si mejora la anterior con ese coche en ese trazado, y el delta la usa como referencia.',
    search: 'Buscar',
    searchPlaceholder: 'Coche o circuito',
    list: 'Récords guardados',
    deleteOne: {
      label: 'Borrar',
      confirm: '¿Seguro?',
      description: (car: string, place: string) => `Borra el récord de ${car} en ${place}`
    },
    noMatch: (query: string) => `Ningún récord coincide con «${query}».`,
    count: (n: number) => (n === 1 ? '1 récord guardado' : `${n} récords guardados`),
    deleteAll: {
      label: 'Borrar todos',
      confirm: (n: number) =>
        n === 1 ? '¿Borrarlo? Pulsa otra vez' : `¿Borrar los ${n}? Pulsa otra vez`,
      description:
        'Borra todos tus récords personales, de todos los coches y trazados; no se puede deshacer'
    },
    unnamedCar: 'Coche sin nombre',
    unnamedTrack: 'Circuito sin nombre'
  },
  /** The shared element editor (settings/elements/ElementEditor.vue): its chrome. */
  elements: {
    /** Split around the drag handle glyph. */
    intro: {
      before: 'Arrastra',
      after: 'o usa ↑ ↓ para ordenar; el ojo muestra u oculta cada elemento en el widget.'
    },
    introFixed: 'El ojo muestra u oculta cada elemento en el widget; su orden es fijo.',
    count: (visible: number, total: number) => `${visible} de ${total} visibles`,
    move: (item: string) => `Mover ${item}`,
    moveUp: (item: string) => `Subir ${item}`,
    moveDown: (item: string) => `Bajar ${item}`,
    show: (item: string) => `Mostrar ${item} en el widget`,
    hide: (item: string) => `Ocultar ${item} en el widget`,
    /** A required element: a lock instead of the eye. */
    required: 'Siempre visible',
    /** A fixed row of the widget, listed for context (not in the list). */
    fixedTag: 'Fijo',
    /** A child whose parent is hidden: 'Necesita «iRating»'. */
    needsParent: (parent: string) => `Necesita «${parent}»`,
    reset: 'Restablecer',
    resetLabel: (zone: string) => `Restablecer ${zone}`,
    /** Screen-reader announcements. */
    moved: (item: string, position: number, total: number) =>
      `${item}: posición ${position} de ${total}.`,
    shown: (item: string) => `${item} visible.`,
    hidden: (item: string) => `${item} oculto.`,
    resetDone: (zone: string) => `${zone}: por defecto.`,
    /** Under a zone with nothing shown that the widget draws without. */
    empty: 'Sin nada visible no se dibuja',
    /** Under a zone whose widget hides with nothing shown (the battle's rivals...). */
    emptyHides: 'Sin nada visible el widget no se muestra'
  },
  /** Each editable zone's name, per widget page (the editor's title). */
  zones: {
    relative: { columns: 'Columnas', headerBar: 'Cabecera', footerBar: 'Pie' },
    radar: { parts: 'Capas' },
    standings: {
      columns: 'Columnas',
      headerBar: 'Cabecera',
      subheaderBar: 'Segunda línea',
      footerBar: 'Pie',
      classLine: 'Línea de clase'
    },
    battle: { lanes: 'Rivales', rows: 'Filas', parts: 'Detalles' },
    inputs: { sections: 'Bloques', bars: 'Barras', info: 'Datos' },
    traffic: { groups: 'Grupos', parts: 'Columnas', header: 'Cabecera' },
    alerts: { parts: 'Extras' },
    delta: { rows: 'Filas', top: 'Línea superior', laps: 'Tiempos de vuelta' },
    fuel: { headerBar: 'Cabecera', lines: 'Líneas' },
    lights: { icons: 'Testigos' }
  },
  /**
   * Each element's name (and a hint where it helps), per widget and zone, for the zones no other
   * group names (the standings' columns are settings.columns, the lights widgets.lights.names, the
   * info bars' items settings.infoBar.items).
   */
  items: {
    relative: {
      columns: {
        pos: 'Posición en clase',
        driver: 'Piloto',
        lic: 'Licencia',
        ir: 'iRating',
        tyre: 'Neumático',
        stint: 'Vueltas del stint',
        gap: 'Hueco'
      }
    },
    radar: {
      parts: {
        guides: 'Guías de distancia',
        sideAlerts: 'Avisos laterales',
        rangeLabels: 'Distancias en las guías'
      }
    },
    standings: { classLine: { sof: 'SoF', carCount: 'Número de coches' } },
    battle: {
      lanes: { ahead: 'Coche de delante', behind: 'Coche de detrás' },
      rows: { prediction: 'Predicción de alcance', sectors: 'Sectores', laps: 'Vueltas' },
      parts: {
        rating: 'iRating del rival',
        license: 'Licencia del rival',
        trendNote: 'Texto de la tendencia',
        stake: 'iRating en juego'
      }
    },
    inputs: {
      sections: { trace: 'Traza', bars: 'Barras', info: 'Marcha, velocidad y volante' },
      bars: { clutch: 'Embrague', brake: 'Freno', throttle: 'Acelerador' },
      info: { gear: 'Marcha', speed: 'Velocidad', steering: 'Volante' }
    },
    traffic: {
      groups: { hazard: 'Peligros', slower: 'Tráfico lento', faster: 'Clase más rápida' },
      parts: {
        icon: 'Icono',
        cls: 'Clase',
        driver: 'Piloto',
        lead: 'Delante / detrás',
        value: 'Tiempo',
        sector: 'Sector'
      },
      header: { title: 'Nombre del widget', captions: 'Rótulos de los grupos' }
    },
    alerts: { parts: { notes: 'Qué hacer, tras cada aviso', chips: 'Otros avisos en chips' } },
    delta: {
      rows: {
        top: 'Línea superior',
        bar: 'Barra',
        sectors: 'Sectores',
        laps: 'Tiempos de vuelta'
      },
      top: { state: 'Estado de la vuelta', predicted: 'Vuelta prevista', reference: 'Referencia' },
      laps: { last: 'Última vuelta', best: 'Mejor vuelta', optimal: 'Vuelta óptima', pb: 'Récord' }
    },
    fuel: {
      lines: {
        hero: 'Combustible y vueltas',
        gauge: 'Depósito',
        perLap: 'Consumo por vuelta',
        finish: 'Para meta y repostar',
        window: 'Ventana de parada',
        save: 'Ahorro',
        tyres: 'Neumáticos',
        limits: 'Reparaciones y juegos'
      }
    }
  },
  /** The info bars: their items, the marker, the size and the items' options. */
  infoBar: {
    items: {
      title: 'Nombre del widget',
      session: 'Sesión',
      remaining: 'Tiempo o vueltas restantes',
      clock: 'Hora local',
      sof: 'SoF',
      carCount: 'Número de coches',
      incidents: 'Incidentes',
      iRating: 'iRating proyectado',
      safetyRating: 'SR proyectado',
      fastestLap: 'Vuelta rápida',
      fuelLaps: 'Vueltas de combustible',
      trackTemp: 'Temperatura de la pista',
      airTemp: 'Temperatura del aire',
      wind: 'Viento',
      wet: 'Agua en la pista',
      rubber: 'Goma'
    },
    hints: {
      remaining: '«38:19  ≈19 v», «Quedan 12 v»; «Final» tras tu bandera',
      sof: 'La de tu clase',
      carCount: 'Los inscritos en tu clase',
      incidents: 'Los tuyos y el próximo límite: «3x · DQ a 17x»',
      iRating: 'Solo en carreras oficiales: cuánto ganas o pierdes en tu puesto',
      safetyRating: 'Con tu margen de incidentes',
      fastestLap: 'La de tu clase en esta sesión: «VR #9 1:01.234»',
      fuelLaps: 'A tu consumo medio',
      trackTemp: 'Con una flecha si sube o baja',
      wind: 'La media del último minuto, con su dirección respecto a tu coche',
      wet: 'Solo cuando la hay: cuánta, la lluvia y «Declarada mojada»',
      rubber: 'La que había al empezar la sesión'
    },
    split: 'A la derecha',
    splitHint: 'Lo que va después se alinea al otro extremo',
    size: 'Tamaño',
    sizeChoices: {
      off: { label: 'Oculta' },
      small: { label: 'Pequeña' },
      normal: { label: 'Normal' },
      large: { label: 'Grande' }
    },
    /** How a short bar behaves (legibility rules). */
    fitNote:
      'El texto nunca baja del tamaño mínimo: si no cabe, se quitan primero los datos menos importantes'
  },
  /** The driver cell's extras in the relative, the standings and the battle. */
  driverCell: {
    brandMarks: 'Logotipo de la marca',
    brandMarksHelp: 'Delante del nombre; en Auto, solo si hay más de una marca en pista',
    brandChoices: {
      auto: { label: 'Auto', hint: 'Solo con varias marcas en la sesión' },
      on: { label: 'Siempre' },
      off: { label: 'Nunca' }
    },
    countryFlags: 'Bandera del país',
    countryFlagsHelp: 'La que cada piloto eligió en iRacing; nada si no eligió ninguna',
    columnHeads: 'Cabeceras de columna',
    columnHeadsHelp: 'Una fila con el nombre de cada columna: «POS», «PILOTO», «iR»…'
  }
} as const

export const settingsEn: Dict<typeof settingsEs> = {
  app: {
    pageSelect: 'Section',
    editBanner: {
      before:
        'Edit mode: drag a widget to move it and drag its edges to change its width; the mouse wheel scales it and holding',
      after:
        'turns off snapping. Locked widgets stay put; each widget’s eye and padlock hide or lock it.'
    },
    updateError: 'Couldn’t apply the change. Please try again.',
    loading: 'Loading settings…',
    footNote: 'Changes apply instantly and are saved automatically.',
    openFolder: 'Open settings folder'
  },
  nav: {
    title: 'Settings',
    sections: 'Settings sections',
    appearance: 'Appearance',
    shortcuts: 'Keyboard shortcuts',
    widgets: 'Widgets',
    keys: {
      editMode: 'edit mode',
      overlay: 'show or hide',
      exit: 'leave editing'
    },
    hidden: {
      title: 'Overlay hidden',
      press: (keys) => `${keys} shows it`,
      show: 'Show'
    }
  },
  editMode: {
    tooltip:
      'Move and resize the widgets. In the car iRacing hides the cursor: start here, this window frees it',
    tooltipKeys: (keys) =>
      `Move and resize the widgets (${keys}). In the car iRacing hides the cursor: start here, this window frees it`,
    enter: 'Edit mode',
    exit: 'Exit edit mode'
  },
  visibility: {
    label: (widget) => `${widget} visible`,
    hide: (widget) => `Hide ${widget}`,
    show: (widget) => `Show ${widget}`
  },
  confirm: {
    pressAgain: (description) => `Press again to confirm: ${description}`,
    reset: 'Reset? Click again'
  },
  sample: {
    caption: 'Preview with sample data',
    scene: 'Background',
    sceneChoices: {
      dark: { label: 'Night', hint: 'The widget over dark asphalt' },
      light: { label: 'Day', hint: 'The widget over a bright scene' }
    }
  },
  controls: {
    customColor: 'Custom colour',
    customColorLabel: (label) => `${label}: custom colour`,
    hexLabel: (label) => `${label}: hex code`,
    presetsLabel: (label) => `${label}: presets`,
    decrease: 'Decrease',
    increase: 'Increase'
  },
  common: {
    content: 'Content',
    customize: 'Customise',
    customizeNote: 'Order and visibility of each part',
    show: 'Show',
    layout: 'Layout',
    keepVisible: 'Keep visible',
    nameFormat: 'Name format',
    density: 'Density',
    license: 'Licence',
    iRating: 'iRating',
    penaltyFlags: 'Penalty flags',
    penaltyFlagsHelp: 'Black flag, meatball and warning (furled black flag), after the name'
  },
  choices: {
    nameFormat: {
      full: 'Full',
      abbr: 'Abbreviated',
      surname: 'Surname',
      tv: 'TV'
    },
    density: {
      comfortable: { label: 'Comfortable', hint: 'Taller rows' },
      compact: { label: 'Compact', hint: 'More rows in the same height' }
    },
    inherit: (current) => `Global (${current})`,
    nameInheritHint: 'As set in Appearance',
    densityInheritHint: 'As set in Appearance',
    example: (sample, formatted) => `Example: ${sample} → ${formatted}`
  },
  appearance: {
    sub: 'The look shared by every widget. Each widget can use its own name format and density on its page.',
    language: {
      title: 'Language',
      label: 'Language',
      help: 'Language of the widgets, the settings and the tray menu'
    },
    color: {
      title: 'Colour',
      accent: 'Accent colour',
      accentHelp: 'Highlights you and only you: your row, your position and your bar',
      accentNames: {
        yellow: 'Yellow',
        orange: 'Orange',
        cyan: 'Cyan',
        lime: 'Lime',
        pink: 'Pink',
        white: 'White'
      },
      colorBlind: 'Colour-blind palette',
      colorBlindHelp: 'Blue and orange instead of green and red; arrows and icons stay the same'
    },
    text: {
      title: 'Text',
      fontScale: 'Text size',
      fontScaleHelp:
        'Multiplies the scale of Standings and Battle; the other widgets fit their text to the window',
      halo: 'Text outline',
      haloHelp: 'A thin dark edge that keeps text readable over the game',
      haloChoices: {
        auto: {
          label: 'Auto',
          hint: 'Only with a nearly transparent background (below 35%)'
        },
        on: { label: 'Always' },
        off: { label: 'Never' }
      }
    },
    rows: {
      title: 'Rows and drivers',
      densityHelp: 'Row height in Standings and Relative',
      stripes: 'Alternating rows',
      stripesHelp: 'Shades every other row',
      licenseChoices: {
        outline: { label: 'Outline', hint: 'A thin border in the licence colour, no fill' },
        soft: { label: 'Soft', hint: 'The letter in the licence colour, no border' },
        solid: { label: 'Solid', hint: 'As in iRacing' },
        letter: { label: 'Letter only', hint: 'The letter in its colour, no chip' }
      },
      number: 'Car number',
      numberChoices: {
        chip: { label: 'Chip', hint: 'Number on its class colour' },
        stripe: { label: 'Stripe', hint: 'Class-colour stripe and the number as text' }
      }
    },
    other: {
      title: 'Other',
      units: 'Units',
      unitsHelp: 'Speeds and temperatures in the widgets',
      unitChoices: {
        metric: { label: 'Metric', hint: 'km/h, °C' },
        imperial: { label: 'Imperial', hint: 'mph, °F' }
      },
      simPill: 'SIM tag',
      simPillHelp: 'Marks the widgets when the data is simulated'
    },
    screen: {
      title: 'Visibility',
      showWhen: 'Show the overlay',
      showWhenHelp: {
        car: 'While you drive; out of the car (garage, session screen, a teammate’s stint) it hides',
        race: 'While you drive in a race session; not in practice or qualifying',
        always: 'Out of the car too; only the rules below and each widget’s own hide it'
      },
      showWhenHints: {
        car: 'The usual: the overlay only while you are in the car',
        race: 'Like “Only when you are in the car”, and in races only',
        always: 'Out of the car too: the session screen, a teammate’s stint and watching the race'
      },
      keepStandings: 'Standings on the session screen',
      keepStandingsHelp: (widgets) =>
        `Out of the car they stay with the results; ${widgets} can stay too (in their Window section)`,
      keepStandingsOff: 'Shown: without “Hide on the session screen”, everything shows there',
      simUi: 'Hide with the iRacing UI',
      simUiHelp: 'When you hide the sim’s interface, the widgets hide too',
      garage: 'Hide in the garage',
      garageHelp: 'While the garage screen is open',
      sessionScreen: 'Hide on the session screen',
      sessionScreenHelp: 'Out of the car they keep clear of iRacing’s results and chat',
      sessionScreenAlready: (rule) =>
        `Already hidden with “${rule}” and replays hidden: only the widgets you keep there stay`,
      replays: 'In replays',
      replaysHelp: {
        hide: 'No widgets while you watch a replay, nor while you watch other cars live from out of the car',
        hideAlways: 'No widgets when you rewind; live, they follow the car you are watching',
        follow: (widgets) =>
          `They follow the car you are watching and, when you rewind, only the live standings stay; ${widgets} only have your car’s data and hide when you watch another`
      },
      replayChoices: {
        hide: { label: 'Hide', hint: 'No widgets while you watch a replay' },
        follow: {
          label: 'Follow the car on camera',
          hint: 'The widgets follow the car you are watching; when you rewind, the live race’s standings stay'
        }
      },
      waiting: 'Keep “Waiting for iRacing”',
      waitingHelp:
        'Without iRacing, Standings and Relative hide after a few seconds; on, they keep the notice'
    },
    reset: {
      label: 'Reset appearance',
      description:
        'Returns the appearance to its defaults; the language, the visibility and each widget’s options stay as they are'
    }
  },
  shortcuts: {
    sub: 'Key combinations that work all over Windows, with iRacing in front too.',
    section: 'Global shortcuts',
    actions: {
      toggleOverlay: {
        label: 'Show or hide the overlay',
        help: 'Hides every widget at once; telemetry keeps running, so they come back instantly'
      },
      toggleEditMode: {
        label: 'Edit mode',
        help: 'Enters or leaves edit mode to move and resize the widgets'
      },
      cycleDeltaReference: {
        label: 'Next delta reference',
        help: 'Moves to the next one for this kind of session; applied when the next lap starts'
      }
    },
    escape: {
      label: 'Leave edit mode',
      help: 'Only while editing; it can’t be changed',
      tag: 'Fixed'
    },
    status: {
      disabled: 'Off',
      unavailable: 'Used by another app'
    },
    unavailableHelp:
      'Another app already uses this combination. Pick another, or close that app and assign it again here',
    change: 'Change',
    cancel: 'Cancel',
    disable: 'Disable',
    reset: 'Reset',
    changeLabel: (action) => `Change: ${action}`,
    cancelLabel: (action) => `Cancel the change: ${action}`,
    disableLabel: (action) => `Disable: ${action}`,
    resetLabel: (action, keys) => `Reset ${action} to ${keys}`,
    capture: {
      prompt: 'Press the combination… (Esc cancels)',
      clearHint: 'Backspace or Delete turns it off'
    },
    errors: {
      invalid: 'That isn’t a valid combination',
      unsupportedKey:
        'That key can’t be used: pick letters, digits, F1–F24, the numeric keypad, Space or the navigation keys',
      meta: 'The Windows key can’t be used',
      needsModifier: 'Add Ctrl or Alt: only F13–F24 work alone',
      reserved: 'Windows or other programs already use that combination',
      duplicate: (action) => `Already used by “${action}”`
    },
    saved: (keys) => `Saved: ${keys}`,
    disabled: 'Off: this action has no shortcut now',
    warnings: {
      altgr:
        'On a Spanish keyboard, Ctrl+Alt is AltGr: it may stop you typing @, # or € while OverLap is open'
    },
    notes: {
      title: 'How they work',
      focus: 'They work while iRacing has focus, without leaving the game.',
      exclusive:
        'An assigned combination no longer reaches other programs, iRacing included: don’t pick one you use in the sim.',
      buttonBox: 'Tip: F13–F24 work without Ctrl or Alt: map them to a button box or a macro pad.'
    },
    resetAll: {
      label: 'Reset shortcuts',
      description: 'Returns every keyboard shortcut to its default'
    }
  },
  widgetPage: {
    sizeFree: (size) => `Free size · ${size} px`,
    sizeAuto: (width, scale) => `Auto height · ${width} px wide · ${scale}`,
    sizeFixed: (size, scale) => `Fixed height · ${size} px · ${scale}`,
    visible: 'Visible',
    hiddenNote: 'Hidden: not drawn or computed. Turn it on to see it over the game.',
    resetOptions: {
      label: 'Reset options',
      description:
        'Returns this widget’s options, scale, opacity and rules to their defaults; its position doesn’t change'
    },
    resetBounds: {
      label: 'Reset position and size',
      confirm: 'Move it? Click again',
      description: 'Moves the widget back to its default position and size'
    }
  },
  window: {
    title: 'Window',
    locked: 'Locked',
    lockedHelp: 'Can’t be moved or resized, not even in edit mode',
    opacity: 'Background opacity',
    opacityHelp:
      'Only the panel: text and cars stay opaque. Below 35% the text gets an outline (see Appearance)',
    scale: 'Scale',
    scaleHelp: 'This widget’s text size; you can also use the mouse wheel in edit mode',
    height: 'Height',
    heightHelp: 'Automatic: no empty space; in edit mode you only choose the width',
    heightChoices: {
      on: { label: 'Automatic', hint: 'The window grows and shrinks with its content' },
      off: { label: 'Fixed', hint: 'The height you give it in edit mode' }
    },
    anchor: 'Grows',
    anchorHelp: 'Up if it sits against the bottom edge of the screen',
    anchorOff: 'Only with automatic height',
    anchorChoices: {
      top: { label: 'Down', hint: 'The top edge stays put' },
      bottom: { label: 'Up', hint: 'The bottom edge stays put' }
    },
    sizeNote:
      'Free size: the content fits the window. Resize it by dragging its edges in edit mode, or use the mouse wheel to scale it as a whole.',
    showIn: 'Show in',
    showInKinds: {
      practice: 'Practice',
      qualify: 'Qualifying',
      race: 'Race'
    },
    showInNowhere: 'Won’t show in any session (only in edit mode, so you can place it)',
    showInHelp: 'In other sessions it’s hidden and uses no resources; in edit mode it always shows',
    showInRaceOnly:
      'Appearance > Visibility only shows the overlay in races: not in practice or qualifying',
    hideInPits: 'Hide in the pits',
    hideInPitsHelp: 'While you are on pit road or stopped in your pit box',
    sessionScreen: 'Show on the session screen',
    sessionScreenHelp:
      'Out of the car, over iRacing’s results and chat (even with the overlay for the car only)',
    sessionScreenOff: 'Shown: Appearance > Visibility hides nothing on the session screen',
    replay: {
      keepsLive:
        'Live, it follows the car you are watching; when you rewind, it keeps the live race',
      follows: 'Live, it follows the car you are watching; hidden when you rewind a replay',
      liveOnly: 'Only your car’s data: hidden in replays and when you watch another car',
      inCarOnly:
        'Only your car’s data, from inside it: hidden out of the car (the session screen too), in replays and when you watch another car',
      noSessionScreen:
        'Only your car’s data: hidden in replays, on the session screen and when you watch another car',
      hidden:
        'Hidden when you rewind (Appearance > Visibility); live, it follows the car you watch',
      hiddenOutOfCar:
        'Hidden in replays and while you watch other cars from out of the car (Appearance > Visibility)'
    }
  },
  relative: {
    carsAhead: 'Cars ahead',
    carsBehind: 'Cars behind',
    columns: 'Columns',
    classPosition: 'Class position',
    stint: 'Stint laps',
    stintHelp: 'Since its last stop, or since the start',
    tyre: 'Tyre',
    tyreHelp:
      'Compound letter (H hard, W wet) once not everyone runs the dry one; only for your car model',
    incidents: 'Incidents in the header',
    incidentsHelp: 'Yours (and your team’s) and the session’s next limit: “3x · DQ at 17x”'
  },
  radar: {
    range: 'Range',
    rangeHelp: 'How far ahead and behind the radar looks',
    labels: 'Show distances',
    labelsHelp: 'Distance labels on the radar’s guide lines'
  },
  standings: {
    mode: 'Mode',
    modeChoices: {
      compact: { label: 'Compact', hint: 'The front, the cars around you and other class leaders' },
      full: { label: 'Full', hint: 'Every car in every class' }
    },
    compact: 'Compact mode',
    compactOff: '(not used in full mode)',
    topRows: 'Top positions',
    topRowsHelp: 'Rows from the front of your class',
    aroundRows: 'Around you',
    aroundRowsHelp: 'Cars ahead of and behind you',
    leaders: 'Other class leaders',
    leadersHelp: 'A line with the leader of each other class',
    gap: 'Gap',
    gapHelp: 'Outside a race, the gap is to the best lap',
    gapChoices: {
      interval: { label: 'Interval' },
      leader: { label: 'Leader' },
      both: { label: 'Both', hint: 'To the car ahead and, in another column, to the leader' }
    },
    deltaAll: 'Δ iRating for everyone',
    deltaAllHelp: 'The projected iRating change on every row, not just yours (turns the column on)',
    header: 'Header',
    headerHelp: 'Your projected iRating and SR, with the incident margin (estimate, race only)',
    safetyRating: 'Safety Rating',
    incidents: 'Incidents',
    incidentsHelp: 'In every session, with the next limit: “3x · DQ at 17x”',
    classLine: 'Class line',
    sof: 'SoF',
    carCount: 'Car count'
  },
  columns: {
    title: 'Columns',
    count: (visible, total) => `${visible} of ${total} visible`,
    intro: {
      before: 'Drag',
      after:
        'or use ↑ ↓ to reorder them. If the window gets narrow, the least important ones are hidden first; the name always fits.'
    },
    fixedList: 'Fixed columns',
    fixedTag: 'Fixed',
    fixed: {
      pos: 'Position',
      num: 'Number',
      name: 'Name'
    },
    list: 'Right-hand columns, in order',
    labels: {
      gained: 'Positions gained',
      ir: 'iRating',
      lic: 'Licence',
      delta: 'Δ iRating',
      gap: 'Gap',
      gapLeader: 'Gap to leader',
      last: 'Last lap',
      best: 'Best lap',
      pit: 'Pit',
      pitLap: 'Last stop',
      stint: 'Stint laps',
      tyre: 'Tyre'
    },
    hints: {
      gained: 'Race only: positions gained since the start',
      delta: 'Your projected iRating change (or everyone’s, with the option)',
      gap: 'Set by “Gap”: to the car ahead or to the leader',
      gapLeader: 'Only with “Gap: Both”',
      last: 'Outside races, the best lap',
      best: 'Race only: outside races “Last lap” already shows it',
      pit: 'PIT / OUT / TOW and pit stop count (a tow is not one)',
      pitLap: 'Race only: the lap of its last stop (L12)',
      stint: 'Since its last stop, or since the start (7 L)',
      tyre: 'Compound letter (H hard, W wet) once not everyone runs the dry one; only for your car model'
    },
    move: (column) => `Move ${column}`,
    moveUp: (column) => `Move ${column} up`,
    moveDown: (column) => `Move ${column} down`,
    defaultOrder: 'Default order',
    moved: (column, position, total) => `${column} moved to position ${position} of ${total}.`,
    shown: (column) => `${column} shown.`,
    hidden: (column) => `${column} hidden.`,
    reordered: 'Columns back in the default order.'
  },
  battle: {
    threshold: 'Show when the gap is under',
    thresholdHelp: 'Only appears with a rival from your class closer than this',
    holdHelp: 'Stays on screen this long after the gap opens up, so it doesn’t flicker',
    rivals: 'Rivals',
    noRivals: 'With no rival selected, the widget never shows',
    ahead: 'Car ahead',
    behind: 'Car behind',
    layoutChoices: {
      stacked: { label: 'Stacked', hint: 'Ahead on top, behind below' },
      side: { label: 'Side by side', hint: 'For wide windows (520 px or more)' }
    },
    detail: 'Detail',
    detailHelp: 'Difference per sector or per lap: + is in your favour',
    detailChoices: {
      none: { label: 'None' },
      sectors: { label: 'Sectors', hint: 'S1 S2 S3 and the last lap' },
      laps: { label: 'Laps', hint: 'The last three laps' },
      both: { label: 'Both' }
    },
    prediction: 'Catch prediction',
    // The battle widget's own wording: catchIn(laps.about(4)) and ofLaps(19).
    predictionHelp: '“Catching in ~4 L of 19”',
    atStake: 'iRating at stake',
    atStakeHelp: 'How much iRating that position is worth'
  },
  inputs: {
    layoutChoices: {
      'trace-bars-info': { label: 'Trace · bars · info' },
      'info-bars-trace': { label: 'Info · bars · trace' },
      bars: { label: 'Bars only', hint: 'For a small widget (~140 × 110)' }
    },
    traceSeconds: 'Trace length',
    traceSecondsHelp: 'How much throttle, brake and clutch history the graph shows',
    traceWidth: 'Trace thickness',
    clutchInTrace: 'Clutch in the trace',
    clutchInTraceHelp: 'Turn it off if you shift with paddles',
    steering: 'Steering',
    gearSpeed: 'Gear and speed',
    steeringStyle: 'Steering style',
    steeringChoices: {
      bar: { label: 'Bar' },
      wheel: { label: 'Wheel', hint: 'A rim that turns with your wheel' }
    },
    colors: 'Colours',
    colorsNote: 'Solid colours only, as the traces overlap',
    pedals: {
      throttle: 'Throttle',
      brake: 'Brake',
      clutch: 'Clutch'
    }
  },
  traffic: {
    warnAbout: 'Warn about',
    nothing: 'With nothing selected, the widget never shows',
    faster: 'Faster class',
    fasterHelp: 'Catching you from behind: how soon and where',
    slower: 'Slower traffic',
    slowerHelp: 'A slower class you are catching',
    hazards: 'Hazards',
    hazardsHelp: 'Stopped, very slow or off-track cars ahead',
    behind: 'Look behind',
    behindHelp: 'Faster cars up to this far behind you',
    ahead: 'Look ahead',
    aheadHelp: 'Slower traffic up to this far ahead of you',
    hazardRange: 'Hazards up to',
    hazardRangeHelp: 'Warns about a stopped or slow car less than this far ahead',
    entries: 'Entries per group',
    entriesHelp: 'Closest first',
    multiclass: 'Multiclass only',
    multiclassHelp:
      'With no other classes on track, it only warns about cars lapping you (or under blue flag) and hazards'
  },
  alerts: {
    nothing: 'With no alert selected, the widget never shows',
    limiterHidden: 'With “Hide in the pits” (Window) the limiter never shows',
    pitGroup: 'Pit lane',
    raceGroup: 'Race',
    engineGroup: 'Engine',
    flags: 'Flags',
    flagsHelp: 'The ones that affect you: the most important one large, the rest beside it',
    blue: 'Blue flag',
    // The blue flag's note in the alerts widget.
    blueHelp: '“Let them pass”: a faster car is about to lap you',
    furled: 'Furled black flag',
    furledHelp: '“WARNING” from race control; the data does not say what for',
    limiter: 'Pit limiter',
    limiterHelp: 'On pit road: on, off or over the limit',
    overspeed: 'Speeding with the limiter off',
    overspeedHelp: 'Compares your speed with the limit without the limiter too',
    pitEntry: 'Before the pit entry',
    pitEntryHelp: 'As you turn into the pit lane entry with the limiter off',
    lapsToGo: '10 and 5 laps to go',
    lapsToGoHelp: 'A few seconds as 10 and 5 laps of the race remain',
    tow: 'Tow',
    towHelp: 'Tow countdown: time until you can leave your box',
    wrongWay: 'Wrong way',
    wrongWayHelp: 'Driving backwards around the lap; reverse gear and pit road do not count',
    incidents: 'Incidents',
    incidentsHelp: (s) =>
      `When you get points, for ${s}${NB}s at least: “+2x Loss of control · L5 · S3 · gravel”`,
    engineNote:
      'The temperatures, the fuel pressure and the optional repairs are in Warning lights',
    stalled: 'Engine stalled',
    stalledHelp: 'With the car on track',
    oilPressure: 'Oil pressure',
    oilPressureHelp: 'Low, with the engine running: “OIL PRESSURE · low”',
    damage: 'Damage',
    damageHelp:
      'When the car is damaged, before the meatball flag: “DAMAGE · pit for mandatory repairs”',
    fuelGroup: 'Fuel',
    fuelLow: 'Low fuel',
    fuelLowHelp: (laps) =>
      `Under ${laps}${NB}laps of fuel and not enough to finish: “FUEL · 1.6 LAPS”`,
    boxThisLap: 'Box this lap',
    boxThisLapHelp:
      'The pit window closes on this lap and at your average you will not reach the flag',
    holdHelp: 'A brief alert stays on screen at least this long, so there is time to read it'
  },
  delta: {
    reference: 'Reference',
    referenceNote: 'The personal best is stored per car and layout',
    referenceBySession: 'Reference per session',
    referenceBySessionNote: 'A change applies when the next lap starts',
    sessions: { practice: 'Practice', qualify: 'Qualifying', race: 'Race' },
    referencesShort: {
      pb: 'Best ever',
      session: 'Session best',
      optimal: 'Optimal',
      class: 'Class best',
      classOptimal: 'Class optimal'
    },
    cycleKeys: (keys) => `${keys} moves to the next one in the current session`,
    cycleNoKeys: 'Give it a shortcut in “Keyboard shortcuts” to change it from the car',
    lapTimes: 'Lap times',
    lapTimesHelp: 'Your last, best and optimal laps at once; the one the delta uses is marked “Δ”',
    compareWith: 'Compare with',
    references: {
      pb: {
        label: 'Personal best',
        hint: 'Your all-time best lap with this car on this layout'
      },
      session: { label: 'Session best', hint: 'Your best lap of this session' },
      optimal: {
        label: 'Optimal lap',
        hint: 'Your best sectors of this session, joined into one lap'
      },
      class: {
        label: 'Class best',
        hint: 'The fastest lap in your class this session, whoever set it'
      },
      classOptimal: {
        label: 'Class optimal',
        hint: 'The best sectors in your class this session, whoever set them'
      }
    },
    referenceHelp: {
      pb: 'Your all-time best clean lap with this car on this layout. Stored on your computer and kept from one session to the next',
      session: 'Your best clean lap of this session, like iRacing’s own delta bar',
      optimal:
        'Your best times in each sector of the track over your clean laps this session, joined into one lap: what you would do putting the best of each together',
      class:
        'The fastest clean lap in your class this session, whoever set it (you included): the pace to beat',
      classOptimal:
        'The best times in each sector over the clean laps of your class this session, whoever set them (you included), joined into one lap: the theoretical limit'
    },
    fallback: 'Fall back to the next one',
    fallbackHelp: {
      pb: 'With no personal best stored yet, compares with your session best and, failing that, with your class best',
      session: 'Until you set a lap this session, compares with your class best',
      optimal:
        'Until you set a lap this session, compares with your personal best and, failing that, with your class optimal',
      class:
        'This is the last reference: if nobody in your class has set a lap yet, there is nothing to fall back to',
      classOptimal:
        'Until someone in your class sets a lap this session, compares with your personal best'
    },
    fallbackOff: 'Off: the delta stays hidden until the chosen reference exists',
    range: 'Bar scale',
    rangeHelp:
      'The time difference that fills the bar on each side; anything beyond is shown at the end',
    predicted: 'Predicted lap',
    predictedHelp: 'The lap time you’ll set if you keep this pace: reference + delta',
    sectors: 'Sectors',
    sectorsHelp: 'Each sector against the reference; the current one updates live',
    trend: 'Trend',
    trendHelp: '“Gaining” or “losing” depending on how the delta is changing right now'
  },
  conditionsFooter: {
    title: 'Conditions footer',
    note: 'iRacing gives no forecast: everything here is how it is right now',
    show: 'Show the footer',
    relativeHelp:
      'A line under the table with the track, water, wind and rubber; the rows give up its height',
    standingsHelp:
      'A line under the table with the track, water, wind and rubber; the table grows by one line',
    readings: 'Readings',
    readingsHelp: 'In this order: on a narrow table the last ones go first',
    nothing: 'With no reading ticked the footer stays hidden',
    trackTemp: 'Track temperature',
    trackTempHelp: 'Measured by the crew around the circuit',
    trend: 'Track trend',
    trendHelp: 'An arrow when it rises or falls over the last few minutes',
    wet: 'Water on track',
    wetHelp:
      'Only when there is some: how much (from mostly dry to extremely wet), the rain, and “Declared wet” when rain tyres are allowed',
    wind: 'Wind',
    windHelp: 'The mean of the last minute, measured at the start/finish line',
    windDirection: 'Direction relative to your car',
    windDirectionHelp: 'The arrow points at your car from where the wind blows. Only while driving',
    airTemp: 'Air temperature',
    rubber: 'Rubber',
    rubberHelp: 'The rubber on the track when the session started'
  },
  fuel: {
    note: 'What you burn on each clean lap: no pit lane, caution, tow or the race’s first lap',
    header: 'Header',
    headerHelp: 'A band with the widget’s name and the SIM tag',
    lines: 'Lines',
    gauge: 'Tank',
    gaugeHelp: 'A bar of the fuel against what the tank holds, marked where you need it',
    perLap: 'Use per lap',
    perLapHelp: 'The average of your last clean laps, the last one and the thirstiest',
    finish: 'To finish and to add',
    finishHelp: 'What you need to the flag with the margin, and what to add at the next stop',
    box: 'Pit menu',
    boxHelp: 'The fuel set in the pit menu, next to what to add; orange when it falls short',
    window: 'Pit window',
    windowHelp: 'The first and last lap you can stop on and still finish, and the stops left',
    save: 'Saving',
    saveHelp: (pct) =>
      `What to burn per lap to save a stop, when within reach (up to ${pct}% less)`,
    tyres: 'Tyres',
    tyresHelp:
      'The wear the crew measured at your last stop: iRacing only measures it in the stall',
    limits: 'Repairs and tyre sets',
    limitsHelp: 'The fast repairs and tyre sets you have left, when the session limits them',
    calc: 'Calculation',
    calcNote: 'The fuel alerts use the same average, without the margin',
    avgLaps: 'Laps to average',
    avgLapsHelp: 'How many of your last clean laps are averaged',
    margin: 'Margin',
    marginHelp: 'Laps of fuel to spare as you cross the line',
    marginValue: (laps) => `${laps}${NB}laps`
  },
  lights: {
    note: 'Like a dashboard’s warning lights: grey when off, lit with their colour and their shape',
    nothing: 'With no light selected, the widget never shows',
    layout: 'Layout',
    layoutChoices: {
      row: { label: 'Row', hint: 'Lights that do not fit the width go on below' },
      column: { label: 'Column' }
    },
    labelSide: 'Captions',
    labelSideChoices: {
      right: { label: 'On the right' },
      left: { label: 'On the left' }
    },
    labelSideOff: 'Column only',
    onlyWhenLit: 'Lit only',
    onlyWhenLitHelp: 'Without the lights that are off; the widget hides while none is lit',
    captions: 'Captions',
    captionsHelp: 'A word after each icon: “WATER”, “REPAIR”',
    temps: 'Temperatures',
    tempsHelp: 'The water and oil temperature next to their lights: “98°”',
    repairTime: 'Repair time',
    repairTimeHelp: 'How long they take in the pits: “REPAIR · 42 s”, “OPT. · 38 s”',
    lightsGroup: 'Lights',
    trend: 'Rising temperature',
    trendHelp: (s) => `Water or oil turns yellow after ${s}${NB}s well above your average: “+6°”`,
    help: {
      oilPressure: 'Only with the engine running',
      fuelPressure: 'Nearly always a tank running dry',
      stalled: 'With the car on track',
      repair: 'Damage you must repair to race on',
      repairOptional: 'Minor damage, fixable at the stop',
      water: 'The car’s own light',
      oilTemp: 'The car’s own light',
      pitLimiter: 'On, in blue',
      revLimiter: 'On the limiter, in blue'
    },
    legend: 'Legend',
    legendNote: 'What each light means and what to do',
    looks: {
      alarm: 'Red and filled: act now',
      warn: 'Orange with a border: attention',
      caution: 'Yellow, underlined: above your average',
      info: 'Blue with a bar: a state'
    },
    entries: {
      oilPressure: {
        meaning: 'Low oil pressure with the engine running',
        action: 'Back off and pit: the engine may fail'
      },
      fuelPressure: {
        meaning: 'Low fuel pressure; nearly always a tank running dry',
        action: 'Pit to refuel; the engine may cut out in corners'
      },
      stalled: {
        meaning: 'The engine stalled with the car on track',
        action: 'Restart it with the starter button and go on'
      },
      repair: {
        meaning: 'Damage you must repair to race on; the meatball flag will follow',
        action: 'Pit now. “REPAIR · 42 s” is how long it takes'
      },
      repairOptional: {
        meaning: 'Minor damage: you can race on with it',
        action: 'Fix it at your next stop if it pays off: “OPT. · 38 s”'
      },
      water: {
        meaning: 'Water too hot: the car’s own warning light',
        action: 'Get out of the slipstream and off the grass; if it stays, pit'
      },
      oilTemp: {
        meaning: 'Oil too hot: the car’s own warning light',
        action: 'Get out of the slipstream and off the grass; if it stays, pit'
      },
      trend: {
        meaning: (s) =>
          `Water or oil well above your own average this session for ${s}${NB}s, before its light`,
        action: 'Leave the slipstream for a while to cool it; if it keeps rising, nurse the engine'
      },
      pitLimiter: {
        meaning: 'The pit limiter is on',
        action: 'Turn it off as you leave pit road'
      },
      revLimiter: {
        meaning: 'The engine is on the rev limiter',
        action: 'Shift up earlier'
      }
    }
  },
  personalBests: {
    title: 'Personal bests',
    note: 'One per car and layout, stored on your computer',
    mock: 'Simulated telemetry: these personal bests are for testing and are stored apart from the real ones.',
    now: 'Now',
    record: (time) => `PB ${time}`,
    noRecord: 'no PB yet: your next clean lap sets it',
    deleteCurrent: {
      label: 'Delete this PB',
      confirm: 'Delete it? Click again',
      description:
        'Deletes your personal best with this car on this layout; your next clean lap here becomes the new one'
    },
    loading: 'Loading personal bests…',
    empty:
      'No personal bests yet. Each clean lap is saved automatically when it beats your previous best with that car on that layout, and the delta uses it as its reference.',
    search: 'Search',
    searchPlaceholder: 'Car or track',
    list: 'Saved personal bests',
    deleteOne: {
      label: 'Delete',
      confirm: 'Sure?',
      description: (car, place) => `Deletes the personal best for ${car} at ${place}`
    },
    noMatch: (query) => `No personal best matches “${query}”.`,
    count: (n) => (n === 1 ? '1 personal best saved' : `${n} personal bests saved`),
    deleteAll: {
      label: 'Delete all',
      confirm: (n) => (n === 1 ? 'Delete it? Click again' : `Delete all ${n}? Click again`),
      description:
        'Deletes all your personal bests, for every car and layout; this cannot be undone'
    },
    unnamedCar: 'Unnamed car',
    unnamedTrack: 'Unnamed track'
  },
  elements: {
    intro: {
      before: 'Drag',
      after: 'or use ↑ ↓ to reorder; the eye shows or hides each element in the widget.'
    },
    introFixed: 'The eye shows or hides each element in the widget; their order is fixed.',
    count: (visible, total) => `${visible} of ${total} shown`,
    move: (item) => `Move ${item}`,
    moveUp: (item) => `Move ${item} up`,
    moveDown: (item) => `Move ${item} down`,
    show: (item) => `Show ${item} in the widget`,
    hide: (item) => `Hide ${item} in the widget`,
    required: 'Always shown',
    fixedTag: 'Fixed',
    needsParent: (parent) => `Needs “${parent}”`,
    reset: 'Reset',
    resetLabel: (zone) => `Reset ${zone}`,
    moved: (item, position, total) => `${item}: position ${position} of ${total}.`,
    shown: (item) => `${item} shown.`,
    hidden: (item) => `${item} hidden.`,
    resetDone: (zone) => `${zone}: defaults.`,
    empty: 'With nothing shown it is not drawn',
    emptyHides: 'With nothing shown the widget does not show'
  },
  zones: {
    relative: { columns: 'Columns', headerBar: 'Header', footerBar: 'Footer' },
    radar: { parts: 'Layers' },
    standings: {
      columns: 'Columns',
      headerBar: 'Header',
      subheaderBar: 'Second line',
      footerBar: 'Footer',
      classLine: 'Class line'
    },
    battle: { lanes: 'Rivals', rows: 'Rows', parts: 'Details' },
    inputs: { sections: 'Blocks', bars: 'Bars', info: 'Readouts' },
    traffic: { groups: 'Groups', parts: 'Columns', header: 'Header' },
    alerts: { parts: 'Extras' },
    delta: { rows: 'Rows', top: 'Top line', laps: 'Lap times' },
    fuel: { headerBar: 'Header', lines: 'Lines' },
    lights: { icons: 'Lights' }
  },
  items: {
    relative: {
      columns: {
        pos: 'Class position',
        driver: 'Driver',
        lic: 'Licence',
        ir: 'iRating',
        tyre: 'Tyre',
        stint: 'Stint laps',
        gap: 'Gap'
      }
    },
    radar: {
      parts: {
        guides: 'Distance guides',
        sideAlerts: 'Side alerts',
        rangeLabels: 'Distances on the guides'
      }
    },
    standings: { classLine: { sof: 'SoF', carCount: 'Car count' } },
    battle: {
      lanes: { ahead: 'Car ahead', behind: 'Car behind' },
      rows: { prediction: 'Catch prediction', sectors: 'Sectors', laps: 'Laps' },
      parts: {
        rating: 'Rival iRating',
        license: 'Rival licence',
        trendNote: 'Trend text',
        stake: 'iRating at stake'
      }
    },
    inputs: {
      sections: { trace: 'Trace', bars: 'Bars', info: 'Gear, speed and steering' },
      bars: { clutch: 'Clutch', brake: 'Brake', throttle: 'Throttle' },
      info: { gear: 'Gear', speed: 'Speed', steering: 'Steering' }
    },
    traffic: {
      groups: { hazard: 'Hazards', slower: 'Slower traffic', faster: 'Faster class' },
      parts: {
        icon: 'Icon',
        cls: 'Class',
        driver: 'Driver',
        lead: 'Ahead / behind',
        value: 'Time',
        sector: 'Sector'
      },
      header: { title: 'Widget name', captions: 'Group captions' }
    },
    alerts: { parts: { notes: 'What to do, after each alert', chips: 'Other alerts as chips' } },
    delta: {
      rows: { top: 'Top line', bar: 'Bar', sectors: 'Sectors', laps: 'Lap times' },
      top: { state: 'Lap state', predicted: 'Predicted lap', reference: 'Reference' },
      laps: { last: 'Last lap', best: 'Best lap', optimal: 'Optimal lap', pb: 'Personal best' }
    },
    fuel: {
      lines: {
        hero: 'Fuel and laps',
        gauge: 'Tank',
        perLap: 'Use per lap',
        finish: 'To finish and add',
        window: 'Pit window',
        save: 'Saving',
        tyres: 'Tyres',
        limits: 'Repairs and sets'
      }
    }
  },
  infoBar: {
    items: {
      title: 'Widget name',
      session: 'Session',
      remaining: 'Time or laps left',
      clock: 'Local time',
      sof: 'SoF',
      carCount: 'Car count',
      incidents: 'Incidents',
      iRating: 'Projected iRating',
      safetyRating: 'Projected SR',
      fastestLap: 'Fastest lap',
      fuelLaps: 'Laps of fuel',
      trackTemp: 'Track temperature',
      airTemp: 'Air temperature',
      wind: 'Wind',
      wet: 'Water on track',
      rubber: 'Rubber'
    },
    hints: {
      remaining: '“38:19  ≈19 laps”, “12 laps to go”; “Finished” after your flag',
      sof: 'Of your class',
      carCount: 'The entries of your class',
      incidents: 'Yours and the next limit: “3x · DQ at 17x”',
      iRating: 'Official races only: what you win or lose in your position',
      safetyRating: 'With your incident margin',
      fastestLap: 'Of your class this session: “FL #9 1:01.234”',
      fuelLaps: 'At your average use',
      trackTemp: 'With an arrow when it rises or falls',
      wind: 'The last minute’s mean, with its direction relative to your car',
      wet: 'Only when there is some: how much, the rain and “Declared wet”',
      rubber: 'What was down when the session started'
    },
    split: 'On the right',
    splitHint: 'What follows lines up at the other end',
    size: 'Size',
    sizeChoices: {
      off: { label: 'Hidden' },
      small: { label: 'Small' },
      normal: { label: 'Normal' },
      large: { label: 'Large' }
    },
    fitNote:
      'Text never goes below the minimum size: when it does not fit, the least important items go first'
  },
  driverCell: {
    brandMarks: 'Car make logo',
    brandMarksHelp: 'Before the name; on Auto, only when there is more than one make on track',
    brandChoices: {
      auto: { label: 'Auto', hint: 'Only with several makes in the session' },
      on: { label: 'Always' },
      off: { label: 'Never' }
    },
    countryFlags: 'Country flag',
    countryFlagsHelp: 'The one each driver chose in iRacing; nothing when they chose none',
    columnHeads: 'Column headers',
    columnHeadsHelp: 'A row naming each column: “POS”, “DRIVER”, “iR”…'
  }
}
