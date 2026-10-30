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
    /**
     * The edit-mode banner (R25): one line of keys and what each does, instead of two lines of
     * text. `key` is drawn as a keycap.
     */
    editBanner: {
      title: 'Modo edición',
      keys: [
        { key: 'Arrastra', text: 'mover' },
        { key: 'Bordes', text: 'ancho' },
        { key: 'Rueda', text: 'escala' },
        { key: 'Alt', text: 'sin imán' },
        { key: 'Esc', text: 'salir' }
      ],
      /** The chip of each widget: what its buttons do. */
      chip: 'En la etiqueta: ojo, candado y ⚙ (sus ajustes)',
      exit: 'Salir'
    },
    updateError: 'No se pudo aplicar el cambio. Vuelve a intentarlo.',
    /** Main could not write settings.json; it keeps retrying. */
    saveError:
      'Los cambios no se están guardando en el disco (se reintenta solo). Si sigue, cierra OverLap desde la bandeja y vuelve a abrirlo.',
    /** The telemetry cannot load the iRacing SDK module: nothing gets data (R35). */
    nativeMissing:
      'No se pudo cargar el módulo nativo del SDK de iRacing: los widgets no recibirán datos. Vuelve a descargar OverLap; si sigue, copia el diagnóstico.',
    loading: 'Cargando ajustes…',
    footNote: 'Los cambios se aplican al momento y se guardan solos.',
    openFolder: 'Abrir carpeta de ajustes'
  },
  /** The welcome of a first run (R07). */
  welcome: {
    step: (n: number, of: number) => `Paso ${n} de ${of}`,
    start: {
      title: 'Bienvenido a OverLap',
      text: 'Widgets sobre iRacing: relativo, posiciones, delta, combustible y más. Primero, tu idioma y tus unidades.'
    },
    widgets: {
      title: 'Elige tus widgets',
      text: 'Empieza con estos; los demás se activan con un clic en la barra lateral o en la bandeja.',
      none: 'Sin ninguno no verás nada sobre el juego: elige al menos uno.'
    },
    where: {
      title: 'Dónde está todo',
      tray: 'OverLap vive en la bandeja de Windows, junto al reloj (o bajo ^): su icono abre estos Ajustes, los widgets, las disposiciones y el modo edición.',
      car: 'Los widgets salen solos al subirte al coche en iRacing; fuera de él se ocultan.',
      try: 'Probar con datos de ejemplo',
      tryHelp: 'Muestra los widgets en tu pantalla, en el modo edición: arrástralos a su sitio.',
      trying: 'Mueve los widgets a su sitio; Esc o «Salir» arriba terminan el modo edición.'
    },
    /** The shortcuts that matter on day one. */
    keys: {
      edit: 'mover los widgets (modo edición)',
      overlay: 'mostrar u ocultar el overlay',
      settings: 'abrir estos Ajustes'
    },
    skip: 'Saltar',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Empezar'
  },
  /** «Buscar ajuste» (R33): the search at the top of the sidebar. */
  search: {
    placeholder: 'Buscar ajuste',
    label: 'Buscar un ajuste en todas las páginas',
    preparing: 'Preparando la búsqueda…',
    none: (q: string) => `Ningún ajuste con «${q}»`,
    /** Under a result that is a whole page. */
    page: 'Página'
  },
  /**
   * The status chip (sidebar, narrow top bar) and its panel (R35): the connection, what is
   * hidden now and why, what does not work, «Copiar diagnóstico» and the log.
   */
  status: {
    /** The chip's accessible name: 'Estado: Simulación. Ver detalles'. */
    chipAria: (label: string) => `Estado: ${label}. Ver detalles`,
    title: 'Estado',
    /** The chip's second line: what is hidden now. */
    sub: {
      overlayHidden: 'Overlay oculto',
      noneOn: 'Ningún widget activado',
      hiddenNow: (n: number) => (n === 1 ? '1 widget oculto ahora' : `${n} widgets ocultos ahora`),
      shortcuts: (n: number) => (n === 1 ? '1 atajo no funciona' : `${n} atajos no funcionan`)
    },
    /** What the connection state means for you, under it. */
    advice: {
      starting: 'Arrancando la lectura de la telemetría.',
      waiting: 'Abre iRacing y entra en una sesión: los widgets salen al subirte al coche.',
      connected: 'Recibiendo datos de iRacing.',
      mock: 'Datos de ejemplo, sin iRacing.',
      restarting: 'La telemetría se reinicia sola en unos segundos.',
      error: 'Si no se arregla solo, copia el diagnóstico y mira el registro.',
      nativeMissing: 'Sin él no hay datos de iRacing. Vuelve a descargar OverLap.'
    },
    overlayHidden: 'Has ocultado el overlay.',
    /** With the show / hide shortcut: 'Ctrl+Shift+H lo muestra'. */
    overlayKeys: (keys: string) => `${keys} lo muestra.`,
    show: 'Mostrar',
    enabled: (on: number, total: number) => `${on} de ${total} widgets activados`,
    hiddenTitle: 'Ocultos ahora por una regla',
    /** The same heading while you have hidden the overlay (no rule needed). */
    hiddenNowTitle: 'Ocultos ahora',
    /** One rule hides every enabled widget: 'Todos los activados · Oculto: fuera del coche'. */
    allHidden: (caption: string) => `Todos los activados · ${caption}`,
    hiddenOne: (widget: string, caption: string) => `${widget} · ${caption}`,
    noneHidden: 'Ninguno: se ven todos los activados (si estás en pista).',
    /** The overlay hidden by you: every widget is hidden, whatever the rules say. */
    allByYou: 'Todos: has ocultado el overlay.',
    shortcutsFailing: (n: number) =>
      n === 1 ? '1 atajo no funciona.' : `${n} atajos no funcionan.`,
    openShortcuts: 'Ver Atajos',
    saveFailing: 'Los cambios no se están guardando en el disco.',
    copy: 'Copiar diagnóstico',
    copyHelp:
      'Versiones, estado, pantallas y atajos, sin nombres: para pegarlo en un informe de error.',
    copied: 'Copiado',
    openLog: 'Abrir registro',
    openLogHelp: 'overlap.log, lo que pasó en esta sesión y la anterior.'
  },
  nav: {
    title: 'Ajustes',
    sections: 'Secciones de ajustes',
    appearance: 'Apariencia',
    /** When the overlay shows, and where each widget does (R34). */
    visibility: 'Visibilidad',
    shortcuts: 'Atajos',
    layouts: 'Disposiciones',
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
  /**
   * The «Visibilidad» page (R34): the overlay's rules, then one table of where each widget shows,
   * the same values as each widget's «Ventana y visibilidad».
   */
  visibilityPage: {
    sub: 'Cuándo se ve el overlay y, en una tabla, dónde se ve cada widget',
    subMore:
      'Cada casilla es el mismo ajuste que «Ventana y visibilidad» en la página del widget; su nombre lleva a ella.',
    resetMenu: 'Restablecer Visibilidad',
    matrixTitle: 'Dónde se ve cada widget',
    matrixNote: 'Lo mismo que en la página de cada uno',
    cols: {
      widget: 'Widget',
      visible: 'Visible',
      practice: 'Práctica',
      qualify: 'Clasificación',
      race: 'Carrera',
      pits: 'Boxes',
      session: 'Pantalla de sesión',
      locked: 'Bloqueado'
    },
    colHints: {
      visible: 'Activado: se dibuja sobre el juego',
      practice: 'Se ve en las sesiones de práctica',
      qualify: 'Se ve en clasificación',
      race: 'Se ve en carrera',
      pits: 'Se ve también en boxes (sin marcar: se oculta en boxes)',
      session: 'Se queda en la pantalla de sesión, con los resultados',
      locked: 'No se mueve en el modo edición'
    },
    /** A cell's accessible name: 'Batalla: Práctica'. */
    cell: (widget: string, col: string) => `${widget}: ${col}`,
    pitsAlways: (widget: string) => `${widget} se ve siempre en boxes: avisa del limitador`,
    open: (widget: string) => `Abrir la página de ${widget}`,
    raceOnly:
      'Con «Solo en carrera» arriba, práctica y clasificación no se ven aunque estén marcadas.'
  },
  /** Sidebar eye that shows or hides a widget. */
  visibility: {
    label: (widget: string) => `${widget} visible`,
    hide: (widget: string) => `Ocultar ${widget}`,
    show: (widget: string) => `Mostrar ${widget}`,
    /**
     * On, but a rule hides it now (R35): 'Batalla: activado, pero ahora no se ve (oculto en
     * práctica). Clic para desactivarlo'. `caption` is hiddenText in lower case, as in the tray.
     */
    held: (widget: string, caption: string) =>
      `${widget}: activado, pero ahora no se ve (${caption}). Clic para desactivarlo`
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
    },
    /** settingsWindow.previewFold (R14): the preview while the options scroll. */
    fold: 'Al bajar',
    foldChoices: {
      auto: { label: 'Se pliega', hint: 'Se encoge a una franja al bajar por los ajustes' },
      pinned: { label: 'Fija', hint: 'Siempre entera, aunque bajes' },
      small: { label: 'Franja', hint: 'Siempre una franja: más sitio para los ajustes' }
    },
    /** On the folded strip: back to the whole preview. */
    unfold: 'Ver entera'
  },
  /** Editing in a widget page's preview (settings/preview/PreviewEditLayer.vue). */
  preview: {
    /** Above the preview until dismissed (settingsWindow.previewHint). */
    hint: 'Arrastra en la vista previa para ordenar; clic para mostrar u ocultar',
    /** Where no list can be reordered (Radar, Avisos, Testigos): no drag promised. */
    hintFixed: 'Clic en la vista previa para mostrar u ocultar; el orden es fijo',
    /** The same text on every page whose lists all ghost what is hidden (R41). */
    hintMore: 'Lo oculto se ve translúcido mientras editas, donde cabe: un clic lo muestra.',
    /** Some lists ghost, some do not (Avisos: its alerts come back from their list). */
    hintMoreSome:
      'Lo oculto se ve translúcido donde cabe (un clic lo muestra); si no, desde su lista.',
    hintMoreNone: 'Lo oculto vuelve desde su lista, debajo.',
    hintDismiss: 'Entendido',
    hintDismissLabel: 'Ocultar este consejo',
    /** Under an element's name on hover: what the pointer does to it. */
    actions: {
      'move-hide': 'Arrastra para mover · clic para ocultar',
      hide: 'Clic para ocultar · su orden es fijo',
      'move-required': 'Arrastra para mover · siempre visible',
      required: 'Siempre visible y en orden fijo',
      show: 'Oculto · clic o arrastra para mostrarlo'
    },
    /** A click or a drag that the rules refuse. */
    refused: {
      required: (item: string) => `${item} está siempre visible: no se puede ocultar`,
      fixed: (zone: string) => `${zone} tiene un orden fijo: no se reordena`
    },
    /** While dragging, under the element's name: what the drop does (and on which side). */
    moving: 'Suelta para colocarlo aquí',
    movingSide: (side: string) => `Suelta para colocarlo aquí · ${side}`,
    /** After hiding an element the preview cannot draw ghosted. */
    hiddenNote: (item: string) => `${item} oculto: vuelve a mostrarlo desde su lista`
  },
  controls: {
    customColor: 'Color personalizado',
    customColorLabel: (label: string) => `${label}: color personalizado`,
    hexLabel: (label: string) => `${label}: código hexadecimal`,
    presetsLabel: (label: string) => `${label}: valores rápidos`,
    /** A help line's ⓘ (HelpText): the rest of the help. */
    moreInfo: 'Más información',
    decrease: 'Reducir',
    increase: 'Aumentar'
  },
  /** Labels several pages share. */
  common: {
    content: 'Contenido',
    /** The widget page's element editors (settings/layout/CustomizeSection.vue). */
    customize: 'Personalizar',
    /** Every accordion of "Personalizar" at once. */
    expandAll: 'Expandir todo',
    collapseAll: 'Contraer todo',
    show: 'Mostrar',
    /** The battle's and the lights' stacking (not a saved layout: those are Disposiciones). */
    layout: 'Orientación',
    keepVisible: 'Mantener visible',
    nameFormat: 'Formato de nombre',
    density: 'Densidad',
    license: 'Licencia',
    iRating: 'iRating',
    /** The per-car flag badges of the four driver widgets (the «Piloto» block). */
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
      comfortable: { label: 'Cómoda', hint: 'Filas más holgadas' },
      compact: { label: 'Compacta', hint: 'Filas más juntas' }
    },
    /** 'inherit', labelled with what it resolves to: 'Global (Apellido)'. */
    inherit: (current: string) => `Global (${current})`,
    nameInheritHint: 'El de Apariencia',
    densityInheritHint: 'La de Apariencia',
    /** A switch that can follow Apariencia's: 'Global (Sí)', 'Sí', 'No'. */
    onOff: { on: { label: 'Sí' }, off: { label: 'No' } },
    flagInheritHint: 'Lo que diga Apariencia',
    example: (sample: string, formatted: string) => `Ejemplo: ${sample} → ${formatted}`
  },
  appearance: {
    /** One line under the title; the rest behind its ⓘ (`…More`, as every long help here). */
    sub: 'El aspecto común de todos los widgets',
    subMore:
      'En su página, cada uno puede usar su propio fondo, densidad o bloque «Piloto» (nombre, logo y banderas).',
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
      background: 'Fondo de los widgets',
      backgroundHelp:
        'La opacidad de los que tienen «Global» en su página; el contenido sigue opaco',
      /** Widgets whose page says «Propio» (every one, in a file from before 2.3). */
      ownBackgrounds: (n: number) =>
        n === 1 ? '1 widget tiene su propio fondo' : `${n} widgets tienen su propio fondo`,
      followGlobal: 'Usar «Global» en todos',
      followGlobalDone: 'Todos los widgets siguen el fondo global',
      colorBlind: 'Paleta para daltónicos',
      colorBlindHelp:
        'Azul y naranja en lugar de verde y rojo; las flechas y los iconos se mantienen'
    },
    text: {
      title: 'Texto',
      fontScale: 'Tamaño del texto',
      /**
       * `scaled`: the widgets whose text it changes (auto height: 'Posiciones, Batalla…'); `free`:
       * those that fit their text to their window instead ('Relativo, Radar y Delta').
       */
      fontScaleHelp: (scaled: string) => `Cambia ${scaled}`,
      fontScaleMore: (free: string) => `${free} no: ajustan el texto al tamaño de su ventana.`,
      halo: 'Contorno del texto',
      haloHelp: 'Un borde oscuro fino para leer el texto sobre el juego',
      haloChoices: {
        auto: {
          label: 'Auto',
          hint: 'Con el fondo por debajo del 65 %, donde un cielo claro lo haría ilegible'
        },
        on: { label: 'Siempre' },
        off: { label: 'Nunca' }
      }
    },
    rows: {
      title: 'Filas y pilotos',
      densityHelp: 'Alto de las filas en Posiciones y Relativo',
      stripes: 'Filas alternas',
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
      },
      /** The «Piloto» block's globals: what each driver widget on «Global» draws. */
      blockHelp: 'Para Relativo, Posiciones, Batalla y Tráfico, si su página dice «Global»',
      ownBlocks: (n: number) =>
        n === 1
          ? '1 widget usa su propio bloque «Piloto»'
          : `${n} widgets usan su propio bloque «Piloto»`,
      followGlobal: 'Usar «Global» en todos',
      followGlobalDone: 'Todos los widgets siguen el bloque «Piloto» global',
      brandLogos: 'Color del logo',
      brandLogosHelp: 'La marca de cada coche, donde se muestre',
      brandLogoChoices: {
        color: {
          label: 'Color',
          hint: 'Cada marca con sus colores: Ferrari en amarillo, BMW en azul'
        },
        mono: { label: 'Monocromo', hint: 'Todas en el color del texto' }
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
      title: 'Cuándo se ve el overlay',
      /** visibility.showWhen; its choices are core.showWhen. */
      showWhen: 'Cuándo mostrar el overlay',
      /** The help line under it, for the current choice. */
      showWhenHelp: {
        car: 'Mientras conduces; fuera del coche (garaje, pantalla de sesión…) se oculta',
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
      simUi: 'Ocultar con la interfaz de iRacing',
      simUiHelp: 'Si ocultas la interfaz del simulador, los widgets también se ocultan',
      garage: 'Ocultar en el garaje',
      garageHelp: 'Mientras tienes abierta la pantalla del garaje',
      /**
       * Only offered while it changes something: with the overlay only for the car and replays
       * hidden, out of the car hides the session screen already (each widget's exception stays).
       */
      sessionScreen: 'Ocultar en la pantalla de sesión',
      sessionScreenHelp:
        'No tapan los resultados ni el chat; cada widget puede quedarse, desde su página',
      replays: 'En repeticiones',
      /** The help line under it, for the current choice. */
      replaysHelp: {
        /** With showWhen 'car' or 'race'. */
        hide: 'Ningún widget en las repeticiones ni al mirar otros coches desde fuera del coche',
        /** With showWhen 'always': the live point is live. */
        hideAlways: 'Al rebobinar no se ve ningún widget; en directo siguen al coche que miras',
        follow: 'Siguen al coche que miras; al rebobinar solo queda Posiciones, en directo',
        /** `widgets`: the names of the widgets with your car's data only ('Radar, Pedales y Delta'). */
        followMore: (widgets: string) =>
          `${widgets} solo tienen datos de tu coche y se ocultan si miras otro.`
      },
      replayChoices: {
        hide: { label: 'Ocultar', hint: 'Ningún widget mientras ves una repetición' },
        follow: {
          label: 'Seguir al coche en cámara',
          hint: 'Los widgets siguen al coche que miras; al rebobinar queda Posiciones, con la carrera en directo'
        }
      },
      waiting: 'Mantener «Esperando a iRacing»',
      waitingHelp: 'Sin iRacing, Posiciones y Relativo siguen con el aviso en vez de ocultarse'
    },
    /**
     * The page's resets (R24), as a widget page's: "Restablecer…" at the top and an icon in each
     * section's head (its title names it). One click, then "Deshacer".
     */
    reset: {
      /** The menu's name for screen readers. */
      menuLabel: 'Restablecer Apariencia',
      color: 'Color de acento, fondo de los widgets y paleta para daltónicos, de fábrica',
      text: 'Tamaño y contorno del texto, de fábrica',
      rows: 'Filas, licencia, número y los valores globales del bloque Piloto, de fábrica',
      screen: 'Cuándo se muestra el overlay, de fábrica',
      other: 'Unidades y etiqueta SIM, de fábrica',
      all: {
        label: 'Toda la página',
        description: 'Todo lo anterior; el idioma y las opciones de cada widget no cambian'
      },
      /** A section head's icon: 'Restablecer Color'. */
      sectionLabel: (section: string) => `Restablecer ${section}`
    }
  },
  /** "Atajos" page: key combinations and controller buttons. */
  shortcuts: {
    sub: 'Teclas o botones del volante que funcionan en todo Windows, también con iRacing delante',
    /** A shortcut ran (R37): on its row, to test it from the game. `s`: whole seconds ago. */
    used: (s: number) => (s === 0 ? 'Pulsado ahora' : `Pulsado hace ${s} s`),
    /** The confirmation over the game when a shortcut runs (settingsWindow.shortcutToasts). */
    toasts: {
      label: 'Confirmar sobre el juego',
      help: 'Un aviso breve arriba de la pantalla dice qué ha hecho cada atajo («Overlay oculto»)',
      more: 'Sale en la pantalla donde están tus widgets. También confirma Esc al salir del modo edición, y «Traer todos…» y «Vincular…» de la bandeja.'
    },
    /** Under the table: how to test one. */
    test: 'Pulsa un atajo, aquí o en el juego, para probarlo: su fila dice «Pulsado».',
    subMore: 'También botones de la button box o los pedales.',
    /** The table's column heads: the action, then one column per binding (1 is what 2.1 reads). */
    columns: {
      action: 'Acción',
      slot: (n: number) => `Atajo ${n}`,
      primary: 'principal'
    },
    actions: {
      toggleOverlay: {
        label: 'Mostrar u ocultar el overlay',
        help: 'Oculta todos los widgets; vuelven al instante'
      },
      toggleEditMode: {
        label: 'Modo edición',
        help: 'Mover y redimensionar los widgets'
      },
      cycleDeltaReference: {
        label: 'Cambiar la referencia del delta',
        help: 'Solo esta sesión; cambia al empezar la vuelta'
      },
      nextLayout: {
        label: 'Siguiente disposición',
        help: 'Aplica la siguiente disposición guardada'
      },
      openSettings: {
        label: 'Abrir los ajustes',
        help: 'Abre esta ventana o la trae al frente'
      }
    },
    /** The fixed Esc row. */
    escape: {
      label: 'Salir del modo edición',
      help: 'Solo mientras editas',
      tag: 'Fijo'
    },
    status: {
      disabled: 'Desactivado',
      unavailable: 'En uso por otra aplicación',
      /** In a cell (about 135 px wide): the long form is its tooltip. */
      unavailableShort: 'En uso por otra app',
      /** A button whose controller is not connected (the binding is kept). */
      disconnected: 'Desconectado'
    },
    unavailableHelp:
      'Otra aplicación ya usa esta combinación. Elige otra, o ciérrala y vuelve a asignarla aquí',
    disconnectedHelp: 'No está conectado: al enchufarlo, el botón vuelve a funcionar solo',
    /** A controller's button in the field: 'Botón 12' then the controller's name. */
    buttonAria: (button: string, device: string) => `${button} de ${device}`,
    /** The first empty cell of a row: records there. */
    assign: 'Asignar',
    cancel: 'Cancelar',
    reset: 'Restablecer',
    /**
     * Cell names for screen readers: a binding ('Atajo 2 de Modo edición: Botón 3 de G29…,
     * pulsa para cambiar'), its × ('Quitar Ctrl+Shift+E de Modo edición'), the first empty one.
     */
    changeLabel: (n: number, action: string, keys: string) =>
      `Atajo ${n} de ${action}: ${keys}, pulsa para cambiar`,
    removeLabel: (keys: string, action: string) => `Quitar ${keys} de ${action}`,
    addLabel: (n: number, action: string) => `Asignar el atajo ${n}: ${action}`,
    cancelLabel: (action: string) => `Cancelar el cambio: ${action}`,
    resetLabel: (action: string, keys: string) => `Restablecer ${action} a ${keys}`,
    /**
     * An action's bindings inside a sentence, any of them does it: 'Ctrl+Shift+H o Botón 24',
     * 'Ctrl+Shift+E, Botón 3 o F13' (`first`: the others but the last, joined by commas).
     */
    anyOf: (first: string, last: string) => `${first} o ${last}`,
    capture: {
      /** The first line of the cell recorded (the short one in a narrow cell). */
      prompt: 'Pulsa tecla o botón…',
      promptShort: 'Pulsa…',
      /** Its second line. */
      escHint: 'Esc cancela',
      /** Said to screen readers when recording over a binding: Backspace removes it. */
      clearHint: 'Esc cancela · Retroceso o Supr lo quitan',
      /** Said when recording one more. */
      addHint: 'Esc cancela',
      /**
       * A button from a controller's first report since the reader started (or it was
       * plugged in): it may be resting down (a rotary, a latched switch), so it is not saved.
       */
      pressAgain: 'Mando detectado: pulsa el botón otra vez'
    },
    /** Why a combination was refused (accelerator.ts). */
    errors: {
      invalid: 'Esa combinación no es válida',
      unsupportedKey:
        'Esa tecla no sirve: usa letras, números, F1–F24, el teclado numérico, Espacio o las de navegación',
      meta: 'La tecla Windows no se puede usar',
      needsModifier: 'Añade Ctrl o Alt: sin ellas solo valen F13–F24',
      reserved: 'Windows o los programas ya usan esa combinación',
      duplicate: (action: string) => `Ya lo usa «${action}»`,
      /** A button another action has: which one was pressed ('Botón 12 · G29 …'), and by whom. */
      duplicateButton: (button: string, action: string) => `${button} ya lo usa «${action}»`,
      /** Another binding of the same action. */
      duplicateSame: 'Esta acción ya tiene esa combinación',
      duplicateSameButton: (button: string) => `${button} ya es un atajo de esta acción`
    },
    saved: (keys: string) => `Guardado: ${keys}`,
    /** One binding removed, others left. */
    removed: (keys: string) => `Quitado: ${keys}`,
    disabled: 'Desactivado: esta acción ya no tiene atajo',
    warnings: {
      altgr:
        'En teclado español, Ctrl+Alt es AltGr: con OverLap abierto puede impedir escribir @, # o €'
    },
    /** Under the table: how a cell is used (the keys between the parts are keycaps). */
    legend: {
      click: 'Haz clic en una casilla para asignar o cambiar',
      clear: 'o × la vacían',
      esc: 'cancela',
      any: 'cualquiera de los tres ejecuta la acción'
    },
    /** Above the table: the one thing that can break something in iRacing. */
    exclusive: {
      lead: 'Teclas, exclusivas:',
      text: 'una combinación asignada deja de llegar a iRacing y a los demás programas',
      more: 'Los botones del volante no: se comparten, iRacing también recibe la pulsación.'
    },
    notes: {
      title: 'Cómo funcionan',
      /** After the title of the closed block: what is inside. */
      summary: 'botones del volante, button box, F13–F24',
      buttons: 'Los botones solo se leen: iRacing también recibe la pulsación.',
      buttonsMore:
        'Volante, button box o pedales: no se bloquea nada, así que elige un botón que no tengas asignado en iRacing. Las crucetas (D-pad) y los hats no se pueden asignar.',
      buttonBox: 'Consejo: F13–F24 (muchas button box y teclados de macros) van sin Ctrl ni Alt.'
    },
    resetAll: {
      /** The page's "Restablecer…" (R24): its name for screen readers, then its one item. */
      menuLabel: 'Restablecer Atajos',
      label: 'Todos los atajos',
      description: 'Vuelve todos los atajos a los de fábrica',
      /** With `n` controller buttons assigned: they are removed (no button is a default). */
      descriptionButtons: (n: number) =>
        n === 1
          ? 'Vuelve todos los atajos a los de fábrica y quita el botón asignado'
          : `Vuelve todos los atajos a los de fábrica y quita los ${n} botones asignados`
    }
  },
  /** One widget's page: header, hidden note and resets. */
  widgetPage: {
    sizeFree: (size: string, scale: string) => `Tamaño libre · ${size} px · ${scale}`,
    sizeAuto: (width: number, scale: string) => `Alto automático · ${width} px de ancho · ${scale}`,
    sizeFixed: (size: string, scale: string) => `Alto fijo · ${size} px · ${scale}`,
    visible: 'Visible',
    /** Beside «Visible» (R25): edit mode, with this widget pointed out over the game. */
    editPosition: 'Editar posición',
    editPositionHelp: (widget: string) =>
      `Entra en modo edición y señala ${widget} sobre el juego para moverlo o cambiar su tamaño`,
    hiddenNote: 'Oculto: no se dibuja ni se calcula. Actívalo para verlo sobre el juego.',
    /** On, but a rule hides it now (R35): 'Activado, pero ahora no se ve: oculto en práctica.' */
    heldNote: (caption: string) => `Activado, pero ahora no se ve: ${caption}.`,
    /**
     * The page's resets (R24): a menu at the top and an icon in each section's head. One click,
     * then "Deshacer" (the toast names the layout).
     */
    reset: {
      menu: 'Restablecer…',
      /** The menu's name for screen readers. */
      menuLabel: (widget: string) => `Restablecer ${widget}`,
      content: {
        label: 'Contenido',
        description:
          'Lo que hace el widget, de fábrica; Piloto, Personalizar y la ventana no cambian'
      },
      driver: {
        label: 'Piloto',
        description: 'Nombre, logo, bandera y sanciones vuelven a «Global» (Apariencia)'
      },
      customize: {
        label: 'Personalizar',
        description: 'Cada lista y lo que va con ella, de fábrica; Contenido y Piloto no cambian'
      },
      window: {
        label: 'Ventana y visibilidad',
        description:
          'Escala, alto, fondo y cuándo se muestra, de fábrica; la posición y el bloqueo no cambian'
      },
      bounds: {
        label: 'Posición y tamaño',
        description: 'Lleva el widget a su posición y tamaño de fábrica'
      },
      all: {
        label: 'Todo el widget',
        description: 'Todo lo anterior; sigue visible y con su bloqueo'
      },
      /** Under the menu's items. */
      undoNote: 'Se puede deshacer',
      /** A section head's icon: 'Restablecer Ventana y visibilidad de Relativo'. */
      sectionLabel: (section: string, widget: string) => `Restablecer ${section} de ${widget}`
    },
    /** Where this page's changes are kept (layout/OptionsTarget.vue). */
    target: {
      savingIn: 'Guardando en',
      shared: 'Opciones comunes',
      layoutHelp: 'Lo que cambies aquí solo cambia la disposición en uso',
      /** The Ventana section (place, size, scale, lock) is always the layout's own. */
      sharedHelp: (name: string) =>
        `${name} es de solo posición: las opciones de este widget son las comunes a todas las de solo posición; posición, tamaño, escala y bloqueo son solo de ${name}`,
      toAll: {
        label: 'Copiar estas opciones a todas',
        confirm: '¿Copiarlas a todas? Pulsa otra vez',
        description:
          'Copia las opciones de este widget a todas las disposiciones con opciones y a las opciones comunes; las posiciones no cambian',
        /** Main's answer (LayoutNotice 'options-copied'). */
        done: {
          copied: 'Copiadas a todas las disposiciones',
          unchanged: 'Todas las disposiciones ya tenían estas opciones',
          stale: 'La disposición en uso cambió: no se ha copiado nada'
        }
      }
    }
  },
  /** "Ventana y visibilidad" section of every widget page, after its content and editors. */
  window: {
    title: 'Ventana y visibilidad',
    locked: 'Bloqueado',
    lockedHelp: 'No se mueve ni se redimensiona, ni siquiera en modo edición',
    /** Its background: the global one (Apariencia) or its own opacity. */
    background: 'Fondo',
    backgroundInheritHint: 'El de Apariencia',
    backgroundOwn: { label: 'Propio', hint: 'Una opacidad solo para este widget' },
    opacity: 'Opacidad del fondo',
    opacityHelp: 'Solo el fondo del panel: el contenido sigue opaco',
    /** The preview on «Día» and the background below 60 % (settings/opacityNote.ts). */
    dayUnreadable:
      'Sobre la vista «Día» se lee mal: con un cielo claro, sube el fondo al 60 % o más',
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
    // The anchor is the edge that stays put: anchored at the top, it grows downwards.
    anchorChoices: {
      top: { label: 'Abajo', hint: 'El borde de arriba se queda fijo' },
      bottom: { label: 'Arriba', hint: 'El borde de abajo se queda fijo' }
    },
    /** A free-size widget (Relativo, Radar, Delta): the scale is its window's. */
    scaleFreeHelp:
      'Tamaño de la ventana (el texto se ajusta); también con la rueda del ratón en modo edición',
    /** Its height row, off: why. */
    heightFree: 'Libre en este widget: el contenido llena la ventana que le des',
    showIn: 'Mostrar en',
    showInKinds: {
      practice: 'Práctica',
      qualify: 'Clasificación',
      race: 'Carrera'
    },
    showInNowhere: 'No se mostrará en ninguna sesión (en modo edición sí, para colocarlo)',
    showInHelp: 'En las demás sesiones se oculta y no consume nada; en modo edición siempre se ve',
    /** Visibilidad shows the overlay in races only (showWhen 'race'). */
    showInRaceOnly:
      'Visibilidad solo muestra el overlay en carrera: en práctica y clasificación no se ve',
    hideInPits: 'Ocultar en boxes',
    hideInPitsHelp: 'Mientras estás en el pit lane o parado en tu box',
    sessionScreen: 'Mostrar en la pantalla de sesión',
    sessionScreenHelp:
      'Fuera del coche, sobre los resultados y el chat de iRacing (aunque el overlay sea solo para el coche)',
    /** Visibilidad does not hide anything on the session screen. */
    sessionScreenOff: 'Se muestra: Visibilidad no oculta nada en la pantalla de sesión',
    /** Where it cannot apply: an in-car widget (WidgetDef.inCarOnly) or the fuel (noSessionScreen). */
    sessionScreenNoData: 'No aplica: solo tiene datos dentro del coche',
    sessionScreenNoReplay: 'No aplica: con las repeticiones activas no muestra nada',
    /** What the widget does in a replay (Visibilidad decides the rest). */
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
      hidden: 'Al rebobinar se oculta (Visibilidad); en directo sigue al coche que miras',
      /** Replays hidden with the overlay only in the car: watching from out of it hides too. */
      hiddenOutOfCar:
        'Se oculta en repeticiones y al mirar otros coches desde fuera del coche (Visibilidad)'
    }
  },
  relative: {
    carsAhead: 'Coches delante',
    carsBehind: 'Coches detrás',
    columns: 'Columnas',
    stint: 'Vueltas del stint',
    stintHelp: 'Desde su última parada, o desde la salida',
    tyre: 'Neumático',
    /** Column hints (R10: the same words as the standings'). */
    posHelp: 'En tu clase',
    /** The number is the driver cell's, as in the standings (R10). */
    driverHelp: 'Con el número del coche',
    pitHelp: 'PIT o GRÚA en su columna; oculta, tras el nombre',
    tyreHelp:
      'Letra del compuesto (H duro, W lluvia) cuando no todos llevan el de seco; solo para tu modelo de coche'
  },
  radar: {
    range: 'Alcance',
    rangeHelp: 'Distancia por delante y por detrás que cubre el radar',
    labelsHelp: 'Etiquetas con la distancia en las guías del radar'
  },
  standings: {
    mode: 'Modo',
    modeChoices: {
      compact: { label: 'Compacto', hint: 'Primeros, tu entorno y líderes de otras clases' },
      full: { label: 'Completo', hint: 'Todos los coches de todas las clases' }
    },
    compact: 'Modo compacto',
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
    deltaAll: 'iRating en juego de todos',
    deltaAllHelp:
      'El iRating que se gana o se pierde en cada fila, no solo en la tuya (activa la columna)',
    classLine: 'Línea de clase',
    /** A header or footer item the class lines say instead, with several classes (R13). */
    inClassLine: 'Con varias clases va en la línea de clase, no aquí'
  },
  /** Standings column editor. */
  columns: {
    title: 'Columnas',
    /** «Igualar con…» (R10): the columns both tables have, in the other's order and eyes. */
    match: {
      fromStandings: 'Igualar con Posiciones',
      fromRelative: 'Igualar con Relativo',
      help: 'Las columnas que comparten, en el mismo orden y con el mismo ojo',
      done: (other: string) => `Columnas igualadas con ${other}`
    },
    /**
     * The same words and hints as the relative's columns (R10): the number is the driver cell's,
     * in both tables; here the two stay at the start of the row (the class and leader lines span
     * them).
     */
    fixed: {
      pos: 'Posición',
      name: 'Piloto'
    },
    fixedHints: {
      pos: 'En tu clase · siempre al principio de la fila',
      name: 'Con el número del coche · siempre tras la posición'
    },
    labels: {
      gained: 'Puestos ganados',
      ir: 'iRating',
      lic: 'Licencia',
      delta: 'iRating en juego',
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
      delta: 'Lo que ganas o pierdes en tu puesto (o el de todos, con la opción)',
      gap: 'Según «Hueco»: al de delante o al líder',
      gapLeader: 'Con «Hueco: Ambos»',
      last: 'Fuera de carrera, la mejor vuelta',
      best: 'Solo en carrera: fuera de carrera ya la muestra «Última vuelta»',
      pit: 'PIT, OUT o GRÚA y las paradas; oculta, PIT va tras el nombre',
      pitLap: 'Solo en carrera: la vuelta de su última parada (V12)',
      stint: 'Desde su última parada, o desde la salida (7 v)',
      tyre: 'Letra del compuesto (H duro, W lluvia) cuando no todos llevan el de seco; solo para tu modelo de coche'
    }
  },
  battle: {
    threshold: 'Mostrar cuando el hueco sea menor de',
    thresholdHelp: 'Aparece solo con un rival de tu clase a menos de este tiempo',
    holdHelp:
      'Sigue en pantalla este tiempo después de que el rival se aleje, para que no parpadee',
    layoutChoices: {
      stacked: { label: 'Apilada', hint: 'Delante arriba, detrás abajo' },
      side: { label: 'Lado a lado', hint: 'Para ventanas anchas (520 px o más)' }
    },
    detailChoices: {
      sectors: { label: 'Sectores', hint: 'S1 S2 S3 y la última vuelta' },
      laps: { label: 'Vueltas', hint: 'Las tres últimas vueltas' }
    },
    predictionHelp: '«Le alcanzas en ~4 v de 19»',
    atStakeHelp: 'Cuánto iRating vale ese puesto'
  },
  inputs: {
    traceSeconds: 'Segundos de traza',
    traceSecondsHelp: 'Historia de acelerador, freno y embrague que muestra la gráfica',
    traceWidth: 'Grosor de la traza',
    clutchInTrace: 'Embrague en la traza',
    clutchInTraceHelp: 'Desactívalo si cambias con levas',
    steering: 'Volante',
    steeringStyle: 'Estilo del volante',
    steeringChoices: {
      bar: { label: 'Barra' },
      minimal: { label: 'Minimalista', hint: 'Un aro fino con la marca del centro' },
      realistic: { label: 'Realista', hint: 'Un volante de GT, con radios y la marca arriba' },
      formula: { label: 'Fórmula', hint: 'Un volante rectangular con empuñaduras' }
    },
    wheelSize: 'Tamaño del volante',
    wheelSizeChoices: {
      small: { label: 'Pequeño' },
      medium: { label: 'Mediano' },
      large: { label: 'Grande' }
    },
    wheelColor: 'Color de la marca central',
    wheelColorHelp: 'La marca del centro del volante, arriba cuando vas recto',
    steeringDegrees: 'Grados del volante',
    steeringDegreesHelp: 'Cuánto giras, bajo el volante o la barra',
    shiftLights: 'Luces de cambio',
    shiftLightsHelp:
      'Se encienden con las revoluciones hasta el punto de cambio del coche, donde se ponen todas en rojo, y parpadean si te pasas',
    /** In «Contenido», after the trace options: one colour per pedal. */
    pedalColors: {
      throttle: 'Color del acelerador',
      brake: 'Color del freno',
      clutch: 'Color del embrague'
    },
    colorsNote: 'Colores opacos: la traza los superpone',
    pedals: {
      throttle: 'Acelerador',
      brake: 'Freno',
      clutch: 'Embrague'
    }
  },
  traffic: {
    fasterHelp: 'Te alcanza por detrás: en cuánto y dónde',
    slowerHelp: 'Una clase más lenta a la que alcanzas',
    hazardsHelp: 'Coches parados, muy lentos o fuera de pista delante',
    /** The groups' captions switch: drawn over each group, whatever the header's switch says. */
    captions: 'Rótulos de los grupos',
    captionsHelp: 'PELIGRO, DELANTE, POR DETRÁS sobre cada grupo; aunque no se muestre la cabecera',
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
    /** Groups of toggles after the flags ('Mostrar'). */
    /** Personalizar's list of alerts (R12), and its groups' titles. */
    listTitle: 'Avisos',
    groups: {
      flags: 'Banderas',
      pit: 'Boxes',
      race: 'Durante la carrera',
      engine: 'Motor',
      fuel: 'Combustible'
    },
    flags: 'Banderas de carrera',
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
    /** Under the list: where the other engine lights went. */
    engineNote: 'Temperaturas, presión de gasolina y reparaciones opcionales: en Testigos',
    /** The band's extras (alerts.parts), described as every alert is. */
    notesHelp: 'Una línea bajo el aviso: «hasta poder salir», «LIMITADOR OFF»',
    chipsHelp: 'Las demás banderas y avisos activos, en pequeño bajo el principal',
    stalled: 'Motor calado',
    stalledHelp: 'Con el coche en pista',
    oilPressure: 'Presión de aceite',
    oilPressureHelp: 'Baja, con el motor en marcha: «PRESIÓN ACEITE · baja»',
    damage: 'Daños',
    damageHelp:
      'Al dañarse el coche, antes de la bandera de reparación: «DAÑO · reparación obligatoria en boxes»',
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
    /**
     * «Contenido»'s note, over delta.reference*: one per kind of session (practice also warmup
     * and testing). How the records are kept is said once, in «Récords personales».
     */
    referenceBySessionNote:
      'Referencia por sesión: un cambio se aplica al empezar la próxima vuelta',
    /** Under the three rows: which one the preview draws (R21: the reference in use, seen). */
    previewShows: (session: string, reference: string) =>
      `La vista previa usa la de ${session}: ${reference}`,
    sessions: { practice: 'Práctica', qualify: 'Clasificación', race: 'Carrera' },
    /** The cycle shortcut, under the selector: 'Ctrl+Alt+D pasa a la siguiente en la sesión'. */
    cycleKeys: (keys: string) => `${keys} pasa a la siguiente solo en esta sesión, sin guardarla`,
    cycleNoKeys: 'Con un atajo en «Atajos» la cambias sin salir del coche',
    /** The lap times line (delta.rows 'laps', its items delta.laps). */
    lapTimes: 'Tiempos de vuelta',
    lapTimesHelp: 'Tu última, tu mejor y tu óptima a la vez; la que usa el delta lleva «Δ»',
    /** Under the lap times list while their row is off in Líneas. */
    lapTimesRowOff:
      'La línea de tiempos está oculta en «Líneas»; al mostrar aquí un tiempo, se muestra la línea',
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
        label: 'Vuelta rápida de clase',
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
    /** The switch's help while on: each session's chain is under its own selector. */
    fallbackOn: 'Mientras la elegida no exista, compara con la siguiente de su cadena',
    /** The switch's help when every session uses the class best (it has no fallback). */
    fallbackLast:
      'La vuelta rápida de clase es la última referencia: si nadie ha marcado vuelta, no hay otra',
    /**
     * Under each session's selector, its fallback chain (DELTA_FALLBACK in choice.ts):
     * 'Si no existe: Récord → Óptima de clase'.
     */
    fallbackThen: (chain: string) => `Si no existe: ${chain}`,
    /** The class best under a session's selector: nothing after it. */
    fallbackNone: 'Sin otra si no existe',
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
  fuel: {
    note: 'Lo que gastas en cada vuelta limpia: sin boxes, amarilla, grúa ni la primera de la carrera',
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
    /** «Contenido»'s note: how the numbers are worked out. */
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
    layout: 'Orientación',
    layoutChoices: {
      row: { label: 'En fila', hint: 'Si no caben en el ancho, siguen debajo' },
      column: { label: 'En columna' }
    },
    /**
     * lights.labelSide: where the captions and values go in a column. Its own row only for the
     * values with the captions off (with them on, "Rótulos" says the side).
     */
    labelSide: 'Lado de los textos',
    labelSideChoices: {
      right: { label: 'A la derecha' },
      left: { label: 'A la izquierda' }
    },
    onlyWhenLit: 'Solo encendidos',
    onlyWhenLitHelp: 'Sin los apagados; el widget se oculta mientras no hay ninguno encendido',
    /** lights.showCaptions with, in a column, lights.labelSide: one choice. */
    captions: 'Rótulos',
    captionsHelp: 'Una palabra tras cada icono: «AGUA», «REPARAR»',
    captionsChoices: {
      off: { label: 'No' },
      on: { label: 'Sí' },
      right: { label: 'Derecha' },
      left: { label: 'Izquierda' }
    },
    temps: 'Temperaturas',
    tempsHelp: 'La del agua y la del aceite junto a su testigo, y su subida: «98° +6°»',
    repairTime: 'Tiempo de reparación',
    repairTimeHelp:
      'Lo que tardará el equipo en boxes: «REPARAR · 42 s (equipo)», «OPC. · 38 s (equipo)»',
    repairCrewTag: 'Marcar tiempo del equipo',
    repairCrewTagHelp:
      'iRacing da el tiempo de los mecánicos, que puede correr más despacio que el reloj: «42 s (equipo)», «42 s eq.» si la ventana es estrecha',
    repairRealTime: 'Cuenta atrás real (estimada)',
    /** `s`: REPAIR_CLOCK.windowS. */
    repairRealTimeHelp: (s: number) =>
      `Parado en tu box con el servicio en marcha, mide cuánto baja la cifra del equipo en los últimos ${s}${NB}s y muestra los segundos reales que faltan, a menudo más: «42 s (equipo)» puede ser «≈ 95 s (real)». Hasta saberlo, remolcado o fuera del box, la del equipo. Nunca sube ni pasa de 0`,
    trend: 'Temperatura al alza',
    /** `s`: ENGINE_TREND.sustainS. */
    trendHelp: (s: number) =>
      `El agua o el aceite en amarillo tras ${s}${NB}s muy por encima de tu media`,
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
        /** `example`: the light as the strip writes it (the crew's time). */
        action: (example: string) => `Entra en boxes. «${example}» es lo que tardará el equipo`,
        /** With lights.repairRealTime: `example` is the real seconds estimated in the stall. */
        actionReal: (example: string) =>
          `Entra en boxes. «${example}» son los segundos reales que faltan, estimados parado en tu box; antes, la cifra del equipo`
      },
      repairOptional: {
        meaning: 'Daños leves: puedes seguir con ellos',
        /** `example`: the light as the strip writes it. */
        action: (example: string) => `Arréglalos en tu próxima parada si compensa: «${example}»`
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
    /** An info bar's list, split around the drag handle glyph and the side button's. */
    introSides: {
      before: 'Arrastra',
      middle: 'o usa ↑ ↓ para ordenar, y',
      after: 'para pasar al otro lado; el ojo muestra u oculta cada elemento.'
    },
    /** An info bar's two ends: what goes at the start of the line, what at its far end. */
    sides: { left: 'Izquierda', right: 'Derecha' },
    sidesHelp: { left: 'Al principio de la línea', right: 'Al final de la línea' },
    sideEmpty: 'Nada a este lado: arrastra aquí un elemento',
    /** An info bar's hidden items, to add (R33): «+ Añadir dato (8)». */
    addItem: (n: number) => `Añadir dato (${n})`,
    addItemHelp: 'Elige el dato y a qué lado va',
    /** One of its side buttons: 'Añadir SoF a la izquierda'. */
    /** `side`: its side's name in lower case ('izquierda'). */
    addTo: (item: string, side: string) => `Añadir ${item} a la ${side}`,
    /** A hidden item's side, after its name. */
    hiddenSide: { left: 'Izquierda', right: 'Derecha' },
    toLeft: (item: string) => `Pasar ${item} a la izquierda`,
    toRight: (item: string) => `Pasar ${item} a la derecha`,
    movedLeft: (item: string) => `${item}: a la izquierda.`,
    movedRight: (item: string) => `${item}: a la derecha.`,
    count: (visible: number, total: number) => `${visible} de ${total} visibles`,
    move: (item: string) => `Mover ${item}`,
    moveUp: (item: string) => `Subir ${item}`,
    moveDown: (item: string) => `Bajar ${item}`,
    show: (item: string) => `Mostrar ${item} en el widget`,
    hide: (item: string) => `Ocultar ${item} en el widget`,
    /** A required element: a lock instead of the eye. */
    required: 'Siempre visible',
    /** A fixed row of the widget, listed for context (not in the list). */
    /** A column that is always there, in its place: the same lock as an always-shown one. */
    fixedTag: 'Siempre visible y en su sitio',
    /** A row that unfolds to its parts (R21): 'Partes', '2 de 3 partes'. */
    parts: 'Partes',
    partsCount: (shown: number, total: number) => `${shown} de ${total} partes`,
    partsLabel: (row: string) => `Partes de «${row}»`,
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
    /** The toast after hiding or moving an element (settings/undo/UndoToast.vue). */
    undo: {
      hidden: (item: string) => `Ocultado: «${item}»`,
      moved: (item: string) => `Movido: «${item}»`,
      /**
       * A bigger change, said with what it was and, with two layouts or more, where
       * (`where`: inLayout's words or ''): 'Restablecido: Columnas · en «Principal»'.
       */
      reset: (what: string, where: string) => `Restablecido: ${what}${where}`,
      inLayout: (name: string) => ` · en «${name}»`,
      inShared: ' · en las opciones comunes',
      /** What was reset ('Restablecido: …'). */
      /** A part of a page by its section's name: 'Contenido de Relativo'. */
      whatPart: (part: string, widget: string) => `${part} de ${widget}`,
      whatBounds: (widget: string) => `Posición y tamaño de ${widget}`,
      /** Worded so that no widget's name needs agreeing with it: 'Posiciones (todo)'. */
      whatAll: (widget: string) => `${widget} (todo)`,
      whatAppearance: 'Apariencia (toda la página)',
      whatShortcuts: 'Atajos (todos)',
      /** One action's bindings (its row's ↺): 'Atajos de «Modo edición»'. */
      whatShortcut: (action: string) => `Atajos de «${action}»`,
      /** «Usar el global en todos»: 'Global en Fondo (3 widgets)'. */
      whatFollowGlobal: (what: string, n: number) =>
        `Global en ${what} (${n === 1 ? '1 widget' : `${n} widgets`})`,
      widgetHidden: (widget: string) => `Ocultado: ${widget}`,
      layoutDeleted: (name: string) => `Disposición «${name}» eliminada`,
      action: 'Deshacer',
      dismiss: 'Cerrar aviso',
      /** After the announcement, for screen readers. */
      keyHint: 'Ctrl+Z para deshacer.',
      /** The toast's name (its buttons are read with it). */
      group: 'Deshacer el último cambio'
    },
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
    battle: {
      lanes: 'Rivales',
      rows: 'Líneas',
      parts: 'Detalles',
      headerBar: 'Cabecera',
      footerBar: 'Pie'
    },
    inputs: { sections: 'Bloques', bars: 'Barras', info: 'Datos', car: 'Coche' },
    traffic: { groups: 'Grupos', parts: 'Columnas', headerBar: 'Cabecera', footerBar: 'Pie' },
    alerts: { parts: 'Extras' },
    delta: { rows: 'Líneas', top: 'Línea superior', laps: 'Tiempos de vuelta' },
    fuel: { headerBar: 'Cabecera', lines: 'Líneas', footerBar: 'Pie' },
    lights: { icons: 'Testigos' },
    /** The accordions' open state (no editor of its own): named for completeness. */
    settingsWindow: { customizeOpen: 'Secciones abiertas de Personalizar' }
  },
  /**
   * Each element's name (and a hint where it helps), per widget and zone, for the zones no other
   * group names (the standings' columns are settings.columns, the lights widgets.lights.names, the
   * info bars' items settings.infoBar.items).
   */
  items: {
    relative: {
      columns: {
        pos: 'Posición',
        driver: 'Piloto',
        ir: 'iRating',
        lic: 'Licencia',
        pit: 'Boxes',
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
      sections: {
        trace: 'Traza',
        bars: 'Barras',
        info: 'Marcha, velocidad y volante',
        car: 'Revoluciones, reparto, TC y FFB'
      },
      bars: { clutch: 'Embrague', brake: 'Freno', throttle: 'Acelerador' },
      info: { gear: 'Marcha', speed: 'Velocidad', steering: 'Volante' },
      car: {
        rpm: 'Revoluciones',
        bias: 'Reparto de frenada',
        tc: 'Control de tracción',
        ffb: 'Fuerza del volante (FFB)'
      }
    },
    traffic: {
      groups: { hazard: 'Peligros', slower: 'Tráfico lento', faster: 'Clase más rápida' },
      parts: {
        icon: 'Icono',
        cls: 'Clase',
        driver: 'Piloto',
        lead: 'Texto antes del tiempo',
        value: 'Tiempo',
        sector: 'Sector'
      }
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
      // The references' own names (R21): the same words as the selectors above.
      laps: {
        last: 'Última vuelta',
        best: 'Mejor vuelta de la sesión',
        optimal: 'Vuelta óptima',
        pb: 'Récord personal'
      }
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
    /**
     * «Copiar a» (R13): this bar, its items and size, into the same bar of another widget, with
     * "Deshacer".
     */
    copyTo: 'Copiar a',
    copyToLabel: (bar: string, widget: string) => `Copiar «${bar}» a ${widget}`,
    copied: (bar: string, widget: string) => `Copiado: ${bar} → ${widget}`,
    items: {
      title: 'Título del widget',
      session: 'Sesión',
      remaining: 'Tiempo o vueltas restantes',
      clock: 'Hora local',
      sof: 'SoF',
      carCount: 'Número de coches',
      incidents: 'Incidentes',
      iRating: 'iRating en juego',
      safetyRating: 'SR proyectado',
      fastestLap: 'Vuelta rápida de clase',
      fuelLaps: 'Vueltas de combustible',
      trackTemp: 'Temperatura de la pista',
      airTemp: 'Temperatura del aire',
      wind: 'Viento',
      wet: 'Agua en la pista',
      rubber: 'Goma'
    },
    hints: {
      title: 'El nombre del widget en mayúsculas: «RELATIVO», «TRÁFICO»…',
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
    /** The bar's one choice, at the top of its editor: No (the size 'off') or its size. */
    show: {
      headerBar: 'Mostrar cabecera',
      subheaderBar: 'Mostrar segunda línea',
      footerBar: 'Mostrar pie'
    },
    /** A closed accordion's summary: 'Normal · 4 de 15 visibles'; 'No se muestra' when off. */
    summary: (size: string, visible: number, total: number) =>
      `${size} · ${visible} de ${total} visibles`,
    summaryOff: 'No se muestra',
    size: 'Tamaño',
    sizeChoices: {
      off: { label: 'No' },
      small: { label: 'Pequeña' },
      normal: { label: 'Normal' },
      large: { label: 'Grande' }
    },
    /** How a short bar behaves (legibility rules). */
    fitNote:
      'El texto nunca baja del tamaño mínimo: si no cabe, se quitan primero los datos menos importantes',
    /** Options of the track temperature and wind items, on whichever bar shows them. */
    trend: 'Tendencia de la pista',
    trendHelp: 'Flecha si sube o baja en los últimos minutos',
    windDirection: 'Dirección respecto a tu coche',
    windDirectionHelp: 'La flecha apunta a tu coche desde donde sopla. Solo al volante'
  },
  /** The driver cell's extras in the relative, the standings and the battle. */
  /**
   * The «Piloto» block (R08): the same four rows in the same place on the four driver widgets'
   * pages, each with «Global (…)» from Apariencia.
   */
  driverBlock: {
    title: 'Piloto'
  },
  driverCell: {
    brandMarks: 'Logo de la marca',
    brandMarksHelp: 'Delante del nombre; en Auto, solo si hay más de una marca en pista',
    brandChoices: {
      auto: { label: 'Auto', hint: 'Solo con varias marcas en la sesión' },
      on: { label: 'Siempre' },
      off: { label: 'Nunca' }
    },
    countryFlags: 'Bandera del país',
    countryFlagsHelp: 'La que cada piloto eligió en iRacing; nada si no eligió ninguna',
    columnHeads: 'Títulos de columna',
    columnHeadsHelp: 'Una fila con el nombre de cada columna: «POS», «PILOTO», «iR»…'
  },
  /** The saved layouts page (pages/LayoutsPage.vue). */
  layouts: {
    sub: 'Guarda dónde está cada widget y, si quieres, sus opciones: una para cada coche',
    subMore:
      'Su tamaño, escala, si se ve y si está bloqueado, y sus opciones (columnas, elementos, referencias del delta, opacidad…). Una de «Solo posición» usa las opciones comunes. La apariencia, la visibilidad y los atajos son siempre los mismos.',
    listTitle: 'Disposiciones guardadas',
    listNote: 'La que está en uso se actualiza sola al mover los widgets o cambiar sus opciones',
    inUse: 'En uso',
    search: 'Buscar disposiciones',
    searchPlaceholder: 'Nombre o coche',
    clearSearch: 'Borrar la búsqueda',
    /** How many match the search: '3 de 30'. */
    matches: (shown: number, total: number) => `${shown} de ${total}`,
    noMatch: (query: string) => `Ninguna disposición coincide con «${query}»`,
    /** The one in use, shown apart although the search leaves it out. */
    pinnedNoMatch: 'No coincide con la búsqueda; se muestra porque está en uso',
    sort: 'Orden',
    sorts: {
      custom: 'Personalizado',
      name: 'Nombre',
      recent: 'Uso reciente'
    },
    sortHints: {
      custom: 'Tu orden, el de la bandeja y el atajo; se cambia con las flechas',
      name: 'De la A a la Z',
      recent: 'La última que usaste primero'
    },
    apply: 'Aplicar',
    applyLabel: (name: string) => `Aplicar ${name}`,
    edit: 'Editar',
    editLabel: (name: string) => `Editar ${name}: nombre y qué restaura`,
    /** What a layout restores when applied (SavedLayout.mode). */
    modes: {
      full: 'Posición y opciones',
      position: 'Solo posición'
    },
    modeHints: {
      full: 'Guarda y restaura también las opciones de cada widget',
      position: 'Solo se mueven los widgets; usan las opciones comunes'
    },
    modeLabel: 'Al aplicarla',
    importMode: 'Importar como',
    dropOptions: 'Sus opciones propias se descartarán: pasará a usar las opciones comunes',
    /** The same, for the layout in use: its widgets change as soon as it is saved. */
    dropOptionsActive:
      'Sus opciones propias se descartarán y los widgets cambiarán ahora a las opciones comunes',
    nameLabel: 'Nombre',
    saveName: 'Guardar',
    cancel: 'Cancelar',
    duplicate: 'Duplicar',
    duplicateLabel: (name: string) => `Duplicar ${name}`,
    /** The name of a copy (main makes it unique: 'Mazda (copia) (2)'). */
    copyName: (name: string) => `${name} (copia)`,
    export: 'Exportar…',
    exportLabel: (name: string) => `Exportar ${name} a un archivo`,
    moveUp: (name: string) => `Subir ${name}`,
    moveDown: (name: string) => `Bajar ${name}`,
    delete: {
      label: 'Eliminar',
      description: (name: string) =>
        `Elimina la disposición ${name} y sus coches vinculados (se puede deshacer)`
    },
    deleteActive: 'Aplica otra antes de eliminar la que está en uso',
    /** The cars linked to a layout: 'Coches: Mazda MX-5 Cup, BMW M2'. */
    /** Before the tags of the cars linked to a layout (R26), for screen readers. */
    cars: (list: string) => `Coches: ${list}`,
    saveTitle: 'Guardar la actual',
    saveHelp: 'Una disposición nueva igual a lo que ves ahora; pasa a ser la que está en uso',
    savePlaceholder: 'Mazda MX-5, GT3, Resistencia…',
    save: 'Guardar como nueva',
    full: (max: number) => `Has llegado al máximo de ${max} disposiciones`,
    filesTitle: 'Archivos',
    /** «Traer todos los widgets a esta pantalla» (R51), also in the tray. */
    screens: {
      title: 'Pantallas',
      gather: 'Traer todos los widgets a esta pantalla',
      gatherHelp: 'Los de otra pantalla, o de una desconectada, vienen a la de esta ventana',
      button: 'Traer aquí',
      gathered: (n: number) =>
        n === 1 ? '1 widget traído a esta pantalla.' : `${n} widgets traídos a esta pantalla.`,
      none: 'Ya estaban todos en esta pantalla.',
      undo: 'Widgets traídos a esta pantalla',
      /** From the tray: to the screen the mouse was on, maybe not this window's. */
      gatheredCursor: (n: number) =>
        n === 1
          ? '1 widget traído a la pantalla del ratón (desde la bandeja).'
          : `${n} widgets traídos a la pantalla del ratón (desde la bandeja).`,
      noneCursor: 'Ya estaban todos en la pantalla del ratón.',
      undoCursor: 'Widgets traídos a la pantalla del ratón'
    },
    filesHelp:
      'Exporta una disposición a un .json para guardarla o compartirla; importarla no la aplica',
    filesMore:
      'Lleva sus opciones si las tiene. Un archivo de una versión anterior, sin opciones, recibe las opciones comunes.',
    import: 'Importar…',
    notices: {
      exported: (name: string) => `Exportada: ${name}`,
      exportFailed: (name: string) => `No se pudo guardar el archivo de ${name}`,
      imported: (name: string) => `Importada: ${name}. Aplícala cuando quieras`,
      importFailed: {
        json: 'El archivo no es un JSON válido',
        format: 'No es un archivo de disposición de OverLap',
        version: 'El archivo es de una versión más nueva de OverLap',
        empty: 'El archivo no tiene ningún widget conocido',
        tooBig: 'El archivo es demasiado grande para ser una disposición',
        read: 'No se pudo leer el archivo',
        full: 'No caben más disposiciones: elimina alguna antes'
      }
    },
    autoTitle: 'Cambio automático',
    auto: 'Según el coche',
    autoHelp: 'Al subirte a un coche vinculado se aplica su disposición',
    autoMore:
      'Con uno sin vincular se queda la última que usaste. Mientras editas, espera a que salgas.',
    currentCar: 'Coche actual',
    noCar: 'Ningún coche ahora: entra en una sesión de iRacing para vincular el tuyo',
    seenCars: 'Otros coches: recientes y de tus récords',
    noSeenCars: 'Los coches a los que te subas, o con un récord personal, aparecerán aquí',
    /** You are in a car with no layout and there are two or more (R26). */
    linkSuggest: (layout: string) => `Vincular a «${layout}»`,
    /** In the save form while you are in a car: link it to the new layout (R26). */
    linkNew: (car: string) => `Vincular a ${car} (se aplicará sola al subirte)`,
    linkSuggestHelp: (car: string, layout: string) =>
      `${car} no tiene disposición: con «${layout}» se aplicará sola al subirte`,
    /** Linking a car turned «Según el coche» on (R26). */
    autoOn: (car: string) =>
      `«Según el coche» activado: al subirte a ${car} se aplicará su disposición.`,
    autoOnUndo: '«Según el coche» activado',
    noLink: 'Sin vincular',
    linkLabel: (car: string) => `Disposición para ${car}`,
    /** A car the session gave no name. */
    unknownCar: (id: number) => `Coche ${id}`,
    autoOff: 'Activa «Según el coche» para que los vínculos se apliquen'
  }
} as const

export const settingsEn: Dict<typeof settingsEs> = {
  app: {
    pageSelect: 'Section',
    editBanner: {
      title: 'Edit mode',
      keys: [
        { key: 'Drag', text: 'move' },
        { key: 'Edges', text: 'width' },
        { key: 'Wheel', text: 'scale' },
        { key: 'Alt', text: 'no snap' },
        { key: 'Esc', text: 'exit' }
      ],
      chip: 'On the label: eye, padlock and ⚙ (its settings)',
      exit: 'Exit'
    },
    updateError: 'Couldn’t apply the change. Please try again.',
    saveError:
      'Changes are not being saved to disk (retrying on its own). If it goes on, quit OverLap from the tray and open it again.',
    nativeMissing:
      'Couldn’t load the native iRacing SDK module: the widgets will get no data. Download OverLap again; if it goes on, copy the diagnostics.',
    loading: 'Loading settings…',
    footNote: 'Changes apply instantly and are saved automatically.',
    openFolder: 'Open settings folder'
  },
  welcome: {
    step: (n, of) => `Step ${n} of ${of}`,
    start: {
      title: 'Welcome to OverLap',
      text: 'Widgets over iRacing: relative, standings, delta, fuel and more. First, your language and your units.'
    },
    widgets: {
      title: 'Pick your widgets',
      text: 'Start with these; the others are one click away in the sidebar or the tray.',
      none: 'With none you will see nothing over the game: pick at least one.'
    },
    where: {
      title: 'Where everything is',
      tray: 'OverLap lives in the Windows tray, by the clock (or under ^): its icon opens these settings, the widgets, the layouts and edit mode.',
      car: 'The widgets show by themselves when you get in the car in iRacing; out of it they hide.',
      try: 'Try with sample data',
      tryHelp: 'Shows the widgets on your screen, in edit mode: drag them into place.',
      trying: 'Move the widgets into place; Esc or “Exit” at the top ends edit mode.'
    },
    keys: {
      edit: 'move the widgets (edit mode)',
      overlay: 'show or hide the overlay',
      settings: 'open these settings'
    },
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    done: 'Start'
  },
  search: {
    placeholder: 'Search settings',
    label: 'Search a setting on every page',
    preparing: 'Getting the search ready…',
    none: (q) => `No setting with “${q}”`,
    page: 'Page'
  },
  status: {
    chipAria: (label) => `Status: ${label}. Show details`,
    title: 'Status',
    sub: {
      overlayHidden: 'Overlay hidden',
      noneOn: 'No widget turned on',
      hiddenNow: (n) => (n === 1 ? '1 widget hidden now' : `${n} widgets hidden now`),
      shortcuts: (n) => (n === 1 ? '1 shortcut not working' : `${n} shortcuts not working`)
    },
    advice: {
      starting: 'Starting to read the telemetry.',
      waiting: 'Open iRacing and join a session: the widgets appear when you get in the car.',
      connected: 'Receiving data from iRacing.',
      mock: 'Sample data, without iRacing.',
      restarting: 'The telemetry restarts on its own in a few seconds.',
      error: 'If it doesn’t fix itself, copy the diagnostics and check the log.',
      nativeMissing: 'Without it there is no iRacing data. Download OverLap again.'
    },
    overlayHidden: 'You hid the overlay.',
    overlayKeys: (keys) => `${keys} shows it.`,
    show: 'Show',
    enabled: (on, total) => `${on} of ${total} widgets turned on`,
    hiddenTitle: 'Hidden now by a rule',
    hiddenNowTitle: 'Hidden now',
    allHidden: (caption) => `Every one turned on · ${caption}`,
    hiddenOne: (widget, caption) => `${widget} · ${caption}`,
    noneHidden: 'None: every widget turned on shows (when you are on track).',
    allByYou: 'All of them: you hid the overlay.',
    shortcutsFailing: (n) =>
      n === 1 ? '1 shortcut is not working.' : `${n} shortcuts are not working.`,
    openShortcuts: 'Open Shortcuts',
    saveFailing: 'Changes are not being saved to disk.',
    copy: 'Copy diagnostics',
    copyHelp: 'Versions, status, displays and shortcuts, no names: to paste into a bug report.',
    copied: 'Copied',
    openLog: 'Open log',
    openLogHelp: 'overlap.log, what happened in this session and the one before.'
  },
  nav: {
    title: 'Settings',
    sections: 'Settings sections',
    appearance: 'Appearance',
    visibility: 'Visibility',
    shortcuts: 'Shortcuts',
    layouts: 'Layouts',
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
  visibilityPage: {
    sub: 'When the overlay shows and, in one table, where each widget does',
    subMore:
      'Each box is the same setting as “Window and visibility” on the widget’s page; its name takes you there.',
    resetMenu: 'Reset Visibility',
    matrixTitle: 'Where each widget shows',
    matrixNote: 'The same as on each one’s page',
    cols: {
      widget: 'Widget',
      visible: 'Visible',
      practice: 'Practice',
      qualify: 'Qualifying',
      race: 'Race',
      pits: 'Pits',
      session: 'Session screen',
      locked: 'Locked'
    },
    colHints: {
      visible: 'On: drawn over the game',
      practice: 'Shows in practice sessions',
      qualify: 'Shows in qualifying',
      race: 'Shows in races',
      pits: 'Shows in the pits too (unticked: hides in the pits)',
      session: 'Stays on the session screen, with the results',
      locked: 'Does not move in edit mode'
    },
    cell: (widget, col) => `${widget}: ${col}`,
    pitsAlways: (widget) => `${widget} always shows in the pits: it warns about the limiter`,
    open: (widget) => `Open the ${widget} page`,
    raceOnly: 'With “Races only” above, practice and qualifying never show even when ticked.'
  },
  visibility: {
    label: (widget) => `${widget} visible`,
    hide: (widget) => `Hide ${widget}`,
    show: (widget) => `Show ${widget}`,
    held: (widget, caption) =>
      `${widget}: on, but not showing now (${caption}). Click to turn it off`
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
    },
    fold: 'Scrolling',
    foldChoices: {
      auto: { label: 'Folds', hint: 'Shrinks to a strip as you scroll down the settings' },
      pinned: { label: 'Fixed', hint: 'Always whole, even when you scroll' },
      small: { label: 'Strip', hint: 'Always a strip: more room for the settings' }
    },
    unfold: 'Show whole'
  },
  preview: {
    hint: 'Drag in the preview to reorder; click to show or hide',
    hintFixed: 'Click in the preview to show or hide; the order is fixed',
    hintMore: 'What is hidden shows translucent while you edit, where it fits: a click shows it.',
    hintMoreSome:
      'What is hidden shows translucent where it fits (a click shows it); if not, from its list.',
    hintMoreNone: 'What is hidden comes back from its list, below.',
    hintDismiss: 'Got it',
    hintDismissLabel: 'Hide this tip',
    actions: {
      'move-hide': 'Drag to move · click to hide',
      hide: 'Click to hide · its order is fixed',
      'move-required': 'Drag to move · always shown',
      required: 'Always shown, in a fixed order',
      show: 'Hidden · click or drag to show it'
    },
    refused: {
      required: (item) => `${item} is always shown: it cannot be hidden`,
      fixed: (zone) => `${zone} has a fixed order: it cannot be reordered`
    },
    moving: 'Drop to place it here',
    movingSide: (side) => `Drop to place it here · ${side}`,
    hiddenNote: (item) => `${item} hidden: show it again from its list`
  },
  controls: {
    customColor: 'Custom colour',
    customColorLabel: (label) => `${label}: custom colour`,
    hexLabel: (label) => `${label}: hex code`,
    presetsLabel: (label) => `${label}: presets`,
    moreInfo: 'More information',
    decrease: 'Decrease',
    increase: 'Increase'
  },
  common: {
    content: 'Content',
    customize: 'Customise',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    show: 'Show',
    layout: 'Orientation',
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
      comfortable: { label: 'Comfortable', hint: 'Roomier rows' },
      compact: { label: 'Compact', hint: 'Tighter rows' }
    },
    inherit: (current) => `Global (${current})`,
    nameInheritHint: 'As set in Appearance',
    densityInheritHint: 'As set in Appearance',
    onOff: { on: { label: 'Yes' }, off: { label: 'No' } },
    flagInheritHint: 'As set in Appearance',
    example: (sample, formatted) => `Example: ${sample} → ${formatted}`
  },
  appearance: {
    sub: 'The look shared by every widget',
    subMore:
      'On its page, each one can use its own background, density or “Driver” block (name, logo and flags).',
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
      background: 'Widget background',
      backgroundHelp:
        'The opacity of those set to “Global” on their page; the content stays opaque',
      ownBackgrounds: (n) =>
        n === 1 ? '1 widget has its own background' : `${n} widgets have their own background`,
      followGlobal: 'Use Global on all',
      followGlobalDone: 'Every widget follows the global background',
      colorBlind: 'Colour-blind palette',
      colorBlindHelp: 'Blue and orange instead of green and red; arrows and icons stay the same'
    },
    text: {
      title: 'Text',
      fontScale: 'Text size',
      fontScaleHelp: (scaled) => `Changes ${scaled}`,
      fontScaleMore: (free) => `Not ${free}: they fit their text to their window.`,
      halo: 'Text outline',
      haloHelp: 'A thin dark edge that keeps text readable over the game',
      haloChoices: {
        auto: {
          label: 'Auto',
          hint: 'With the background below 65%, where a bright sky would make it unreadable'
        },
        on: { label: 'Always' },
        off: { label: 'Never' }
      }
    },
    rows: {
      title: 'Rows and drivers',
      densityHelp: 'Row height in Standings and Relative',
      stripes: 'Alternating rows',
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
      },
      blockHelp: 'For Relative, Standings, Battle and Traffic, when their page says “Global”',
      ownBlocks: (n) =>
        n === 1
          ? '1 widget uses its own “Driver” block'
          : `${n} widgets use their own “Driver” block`,
      followGlobal: 'Use Global on all',
      followGlobalDone: 'Every widget follows the global “Driver” block',
      brandLogos: 'Logo colour',
      brandLogosHelp: "Each car's make, wherever it shows",
      brandLogoChoices: {
        color: { label: 'Colour', hint: 'Each make in its own colours: Ferrari yellow, BMW blue' },
        mono: { label: 'Monochrome', hint: 'All in the text colour' }
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
      title: 'When the overlay shows',
      showWhen: 'When to show the overlay',
      showWhenHelp: {
        car: 'While you drive; out of the car (garage, session screen…) it hides',
        race: 'While you drive in a race session; not in practice or qualifying',
        always: 'Out of the car too; only the rules below and each widget’s own hide it'
      },
      showWhenHints: {
        car: 'The usual: the overlay only while you are in the car',
        race: 'Like “Only when you are in the car”, and in races only',
        always: 'Out of the car too: the session screen, a teammate’s stint and watching the race'
      },
      simUi: 'Hide with the iRacing UI',
      simUiHelp: 'When you hide the sim’s interface, the widgets hide too',
      garage: 'Hide in the garage',
      garageHelp: 'While the garage screen is open',
      sessionScreen: 'Hide on the session screen',
      sessionScreenHelp:
        'They keep clear of the results and chat; each widget can stay, from its page',
      replays: 'In replays',
      replaysHelp: {
        hide: 'No widgets in replays, nor when you watch other cars from out of the car',
        hideAlways: 'No widgets when you rewind; live, they follow the car you are watching',
        follow:
          'They follow the car you are watching; when you rewind, only the live standings stay',
        followMore: (widgets) =>
          `${widgets} only have your car’s data and hide when you watch another.`
      },
      replayChoices: {
        hide: { label: 'Hide', hint: 'No widgets while you watch a replay' },
        follow: {
          label: 'Follow the car on camera',
          hint: 'The widgets follow the car you are watching; when you rewind, the live race’s standings stay'
        }
      },
      waiting: 'Keep “Waiting for iRacing”',
      waitingHelp: 'Without iRacing, Standings and Relative keep the notice instead of hiding'
    },
    reset: {
      menuLabel: 'Reset Appearance',
      color: 'Accent colour, widget background and colour-blind palette, back to default',
      text: 'Text size and outline, back to default',
      rows: 'Rows, licence, number and the Driver block’s global values, back to default',
      screen: 'When the overlay shows, back to default',
      other: 'Units and SIM tag, back to default',
      all: {
        label: 'The whole page',
        description: 'All of the above; the language and each widget’s options stay as they are'
      },
      sectionLabel: (section) => `Reset ${section}`
    }
  },
  shortcuts: {
    sub: 'Keys or wheel buttons that work all over Windows, with iRacing in front too',
    used: (s) => (s === 0 ? 'Pressed just now' : `Pressed ${s} s ago`),
    toasts: {
      label: 'Confirm over the game',
      help: 'A short note at the top of the screen says what each shortcut did (“Overlay hidden”)',
      more: 'It shows on the screen your widgets are on. It also confirms Esc leaving edit mode, and the tray’s “Bring every widget…” and “Link…”.'
    },
    test: 'Press a shortcut, here or in the game, to test it: its row says “Pressed”.',
    subMore: 'Button box or pedal buttons too.',
    columns: {
      action: 'Action',
      slot: (n) => `Shortcut ${n}`,
      primary: 'main'
    },
    actions: {
      toggleOverlay: {
        label: 'Show or hide the overlay',
        help: 'Hides every widget; they come back instantly'
      },
      toggleEditMode: {
        label: 'Edit mode',
        help: 'Move and resize the widgets'
      },
      cycleDeltaReference: {
        label: 'Next delta reference',
        help: 'This session only; changes when the lap starts'
      },
      nextLayout: {
        label: 'Next layout',
        help: 'Applies the next saved layout'
      },
      openSettings: {
        label: 'Open settings',
        help: 'Opens this window or brings it to the front'
      }
    },
    escape: {
      label: 'Leave edit mode',
      help: 'Only while editing',
      tag: 'Fixed'
    },
    status: {
      disabled: 'Off',
      unavailable: 'Used by another app',
      unavailableShort: 'Used by another app',
      disconnected: 'Disconnected'
    },
    unavailableHelp:
      'Another app uses this combination: pick another, or close that app and assign it',
    disconnectedHelp: 'Not connected: once you plug it in, the button works again by itself',
    buttonAria: (button, device) => `${button} of ${device}`,
    assign: 'Assign',
    cancel: 'Cancel',
    reset: 'Reset',
    changeLabel: (n, action, keys) => `Shortcut ${n} of ${action}: ${keys}, press to change`,
    removeLabel: (keys, action) => `Remove ${keys} from ${action}`,
    addLabel: (n, action) => `Assign shortcut ${n}: ${action}`,
    cancelLabel: (action) => `Cancel the change: ${action}`,
    resetLabel: (action, keys) => `Reset ${action} to ${keys}`,
    anyOf: (first, last) => `${first} or ${last}`,
    capture: {
      prompt: 'Press a key or button…',
      promptShort: 'Press…',
      escHint: 'Esc cancels',
      clearHint: 'Esc cancels · Backspace or Delete remove it',
      addHint: 'Esc cancels',
      pressAgain: 'Controller found: press the button again'
    },
    errors: {
      invalid: 'That isn’t a valid combination',
      unsupportedKey:
        'That key can’t be used: pick letters, digits, F1–F24, the numeric keypad, Space or the navigation keys',
      meta: 'The Windows key can’t be used',
      needsModifier: 'Add Ctrl or Alt: only F13–F24 work alone',
      reserved: 'Windows or other programs already use that combination',
      duplicate: (action) => `Already used by “${action}”`,
      duplicateButton: (button, action) => `${button} is already used by “${action}”`,
      duplicateSame: 'This action already has that combination',
      duplicateSameButton: (button) => `${button} is already a shortcut of this action`
    },
    saved: (keys) => `Saved: ${keys}`,
    removed: (keys) => `Removed: ${keys}`,
    disabled: 'Off: this action has no shortcut now',
    warnings: {
      altgr: 'On a Spanish keyboard Ctrl+Alt is AltGr: with OverLap open you may not type @, # or €'
    },
    legend: {
      click: 'Click a cell to assign or change it',
      clear: 'or × empty it',
      esc: 'cancels',
      any: 'any of the three runs the action'
    },
    exclusive: {
      lead: 'Keys are exclusive:',
      text: 'an assigned combination no longer reaches iRacing or other programs',
      more: 'Wheel buttons don’t: they are shared, iRacing gets the press too.'
    },
    notes: {
      title: 'How they work',
      summary: 'wheel buttons, button box, F13–F24',
      buttons: 'Buttons are only read: iRacing gets the press too.',
      buttonsMore:
        'Wheel, button box or pedals: nothing is blocked, so pick a button you haven’t assigned in iRacing. D-pads and hats can’t be assigned.',
      buttonBox: 'Tip: F13–F24 work without Ctrl or Alt: map them to a button box or a macro pad.'
    },
    resetAll: {
      menuLabel: 'Reset Shortcuts',
      label: 'All shortcuts',
      description: 'Returns every shortcut to its default',
      descriptionButtons: (n) =>
        n === 1
          ? 'Returns every shortcut to its default and removes the assigned button'
          : `Returns every shortcut to its default and removes the ${n} assigned buttons`
    }
  },
  widgetPage: {
    sizeFree: (size, scale) => `Free size · ${size} px · ${scale}`,
    sizeAuto: (width, scale) => `Auto height · ${width} px wide · ${scale}`,
    sizeFixed: (size, scale) => `Fixed height · ${size} px · ${scale}`,
    visible: 'Visible',
    editPosition: 'Edit position',
    editPositionHelp: (widget) =>
      `Enters edit mode and points out ${widget} over the game, to move or resize it`,
    hiddenNote: 'Hidden: not drawn or computed. Turn it on to see it over the game.',
    heldNote: (caption) => `On, but not showing now: ${caption}.`,
    reset: {
      menu: 'Reset…',
      menuLabel: (widget) => `Reset ${widget}`,
      content: {
        label: 'Content',
        description: 'What the widget does, back to default; Driver, Customize and the window stay'
      },
      driver: {
        label: 'Driver',
        description: 'Name, logo, flag and penalties go back to “Global” (Appearance)'
      },
      customize: {
        label: 'Customize',
        description: 'Every list and what goes with it, back to default; Content and Driver stay'
      },
      window: {
        label: 'Window and visibility',
        description:
          'Scale, height, background and when it shows, back to default; position and lock stay'
      },
      bounds: {
        label: 'Position and size',
        description: 'Moves the widget back to its default position and size'
      },
      all: {
        label: 'The whole widget',
        description: 'All of the above; it stays visible and keeps its lock'
      },
      undoNote: 'You can undo it',
      sectionLabel: (section, widget) => `Reset ${section} of ${widget}`
    },
    target: {
      savingIn: 'Saving to',
      shared: 'Shared options',
      layoutHelp: 'What you change here only changes the layout in use',
      sharedHelp: (name) =>
        `${name} is position only: this widget’s options are shared by every position-only layout; position, size, scale and lock stay ${name}’s own`,
      toAll: {
        label: 'Copy these options to all layouts',
        confirm: 'Copy to all? Click again',
        description:
          'Copies this widget’s options to every layout with options and to the shared options; positions don’t change',
        done: {
          copied: 'Copied to every layout',
          unchanged: 'Every layout already had these options',
          stale: 'The layout in use changed: nothing was copied'
        }
      }
    }
  },
  window: {
    title: 'Window and visibility',
    locked: 'Locked',
    lockedHelp: 'Can’t be moved or resized, not even in edit mode',
    background: 'Background',
    backgroundInheritHint: 'As set in Appearance',
    backgroundOwn: { label: 'Own', hint: 'An opacity for this widget only' },
    opacity: 'Background opacity',
    opacityHelp: 'Only the panel’s background: the content stays opaque',
    dayUnreadable:
      'Hard to read over the “Day” preview: with a bright sky, raise it to 60% or more',
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
    anchorChoices: {
      top: { label: 'Down', hint: 'The top edge stays put' },
      bottom: { label: 'Up', hint: 'The bottom edge stays put' }
    },
    scaleFreeHelp:
      'The window’s size (the text fits it); you can also use the mouse wheel in edit mode',
    heightFree: 'Free in this widget: the content fills the window you give it',
    showIn: 'Show in',
    showInKinds: {
      practice: 'Practice',
      qualify: 'Qualifying',
      race: 'Race'
    },
    showInNowhere: 'Won’t show in any session (only in edit mode, so you can place it)',
    showInHelp: 'In other sessions it’s hidden and uses no resources; in edit mode it always shows',
    showInRaceOnly: 'Visibility only shows the overlay in races: not in practice or qualifying',
    hideInPits: 'Hide in the pits',
    hideInPitsHelp: 'While you are on pit road or stopped in your pit box',
    sessionScreen: 'Show on the session screen',
    sessionScreenHelp:
      'Out of the car, over iRacing’s results and chat (even with the overlay for the car only)',
    sessionScreenOff: 'Shown: Visibility hides nothing on the session screen',
    sessionScreenNoData: 'Not available: it only has data in the car',
    sessionScreenNoReplay: 'Not available: it shows nothing while replays are on',
    replay: {
      keepsLive:
        'Live, it follows the car you are watching; when you rewind, it keeps the live race',
      follows: 'Live, it follows the car you are watching; hidden when you rewind a replay',
      liveOnly: 'Only your car’s data: hidden in replays and when you watch another car',
      inCarOnly:
        'Only your car’s data, from inside it: hidden out of the car (the session screen too), in replays and when you watch another car',
      noSessionScreen:
        'Only your car’s data: hidden in replays, on the session screen and when you watch another car',
      hidden: 'Hidden when you rewind (Visibility); live, it follows the car you watch',
      hiddenOutOfCar:
        'Hidden in replays and while you watch other cars from out of the car (Visibility)'
    }
  },
  relative: {
    carsAhead: 'Cars ahead',
    carsBehind: 'Cars behind',
    columns: 'Columns',
    stint: 'Stint laps',
    stintHelp: 'Since its last stop, or since the start',
    tyre: 'Tyre',
    posHelp: 'In your class',
    driverHelp: 'With the car number',
    pitHelp: 'PIT or TOW in its own column; hidden, after the name',
    tyreHelp:
      'Compound letter (H hard, W wet) once not everyone runs the dry one; only for your car model'
  },
  radar: {
    range: 'Range',
    rangeHelp: 'How far ahead and behind the radar looks',
    labelsHelp: 'Distance labels on the radar’s guide lines'
  },
  standings: {
    mode: 'Mode',
    modeChoices: {
      compact: { label: 'Compact', hint: 'The front, the cars around you and other class leaders' },
      full: { label: 'Full', hint: 'Every car in every class' }
    },
    compact: 'Compact mode',
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
    deltaAll: 'iRating at stake for everyone',
    deltaAllHelp: 'The iRating won or lost on every row, not just yours (turns the column on)',
    classLine: 'Class line',
    inClassLine: 'With several classes it goes on the class line, not here'
  },
  columns: {
    title: 'Columns',
    match: {
      fromStandings: 'Match Standings',
      fromRelative: 'Match Relative',
      help: 'The columns both have, in the same order and with the same eye',
      done: (other) => `Columns matched to ${other}`
    },
    fixed: {
      pos: 'Position',
      name: 'Driver'
    },
    fixedHints: {
      pos: 'In your class · always at the start of the row',
      name: 'With the car number · always after the position'
    },
    labels: {
      gained: 'Positions gained',
      ir: 'iRating',
      lic: 'Licence',
      delta: 'iRating at stake',
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
      delta: 'What you win or lose in your position (or everyone’s, with the option)',
      gap: 'Set by “Gap”: to the car ahead or to the leader',
      gapLeader: 'Only with “Gap: Both”',
      last: 'Outside races, the best lap',
      best: 'Race only: outside races “Last lap” already shows it',
      pit: 'PIT, OUT or TOW and the stops; hidden, PIT goes after the name',
      pitLap: 'Race only: the lap of its last stop (L12)',
      stint: 'Since its last stop, or since the start (7 L)',
      tyre: 'Compound letter (H hard, W wet) once not everyone runs the dry one; only for your car model'
    }
  },
  battle: {
    threshold: 'Show when the gap is under',
    thresholdHelp: 'Only appears with a rival from your class closer than this',
    holdHelp: 'Stays on screen this long after the gap opens up, so it doesn’t flicker',
    layoutChoices: {
      stacked: { label: 'Stacked', hint: 'Ahead on top, behind below' },
      side: { label: 'Side by side', hint: 'For wide windows (520 px or more)' }
    },
    detailChoices: {
      sectors: { label: 'Sectors', hint: 'S1 S2 S3 and the last lap' },
      laps: { label: 'Laps', hint: 'The last three laps' }
    },
    // The battle widget's own wording: catchIn(laps.about(4)) and ofLaps(19).
    predictionHelp: '“Catching in ~4 L of 19”',
    atStakeHelp: 'How much iRating that position is worth'
  },
  inputs: {
    traceSeconds: 'Trace length',
    traceSecondsHelp: 'How much throttle, brake and clutch history the graph shows',
    traceWidth: 'Trace thickness',
    clutchInTrace: 'Clutch in the trace',
    clutchInTraceHelp: 'Turn it off if you shift with paddles',
    steering: 'Steering',
    steeringStyle: 'Steering style',
    steeringChoices: {
      bar: { label: 'Bar' },
      minimal: { label: 'Minimal', hint: 'A thin ring with the centre mark' },
      realistic: { label: 'Realistic', hint: 'A GT wheel, with spokes and the mark on top' },
      formula: { label: 'Formula', hint: 'A rectangular wheel with grips' }
    },
    wheelSize: 'Wheel size',
    wheelSizeChoices: {
      small: { label: 'Small' },
      medium: { label: 'Medium' },
      large: { label: 'Large' }
    },
    wheelColor: 'Centre mark colour',
    wheelColorHelp: "The wheel's centre mark, on top when you drive straight",
    steeringDegrees: 'Steering angle',
    steeringDegreesHelp: 'How far you turn, under the wheel or the bar',
    shiftLights: 'Shift lights',
    shiftLightsHelp:
      "Light up with the revs to the car's shift point, all red there, and blink if you go past it",
    pedalColors: {
      throttle: 'Throttle colour',
      brake: 'Brake colour',
      clutch: 'Clutch colour'
    },
    colorsNote: 'Solid colours only, as the traces overlap',
    pedals: {
      throttle: 'Throttle',
      brake: 'Brake',
      clutch: 'Clutch'
    }
  },
  traffic: {
    fasterHelp: 'Catching you from behind: how soon and where',
    slowerHelp: 'A slower class you are catching',
    hazardsHelp: 'Stopped, very slow or off-track cars ahead',
    captions: 'Group captions',
    captionsHelp: 'HAZARD, AHEAD, BEHIND over each group; even with the header hidden',
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
    listTitle: 'Alerts',
    groups: {
      flags: 'Flags',
      pit: 'Pit lane',
      race: 'During the race',
      engine: 'Engine',
      fuel: 'Fuel'
    },
    flags: 'Race flags',
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
    engineNote: 'Temperatures, fuel pressure and optional repairs: in Warning lights',
    notesHelp: 'A line under the alert: “until you can leave”, “LIMITER OFF”',
    chipsHelp: 'The other active flags and alerts, small under the main one',
    stalled: 'Engine stalled',
    stalledHelp: 'With the car on track',
    oilPressure: 'Oil pressure',
    oilPressureHelp: 'Low, with the engine running: “OIL PRESSURE · low”',
    damage: 'Damage',
    damageHelp:
      'When the car is damaged, before the meatball flag: “DAMAGE · pit for mandatory repairs”',
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
    referenceBySessionNote: 'Reference per session: a change applies when the next lap starts',
    previewShows: (session, reference) => `The preview uses the ${session} one: ${reference}`,
    sessions: { practice: 'Practice', qualify: 'Qualifying', race: 'Race' },
    cycleKeys: (keys) => `${keys} moves to the next one for this session only, not saved`,
    cycleNoKeys: 'Give it a shortcut in “Shortcuts” to change it from the car',
    lapTimes: 'Lap times',
    lapTimesHelp: 'Your last, best and optimal laps at once; the one the delta uses is marked “Δ”',
    lapTimesRowOff: 'The lap times line is hidden in “Lines”; showing a time here shows the line',
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
        label: 'Class fastest lap',
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
    fallbackOn: 'While the chosen one doesn’t exist, compares with the next in its chain',
    fallbackLast:
      'The class fastest lap is the last reference: if nobody has set a lap yet, there is nothing to fall back to',
    fallbackThen: (chain) => `If missing: ${chain}`,
    fallbackNone: 'Nothing after it if missing',
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
  fuel: {
    note: 'What you burn on each clean lap: no pit lane, caution, tow or the race’s first lap',
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
    calcNote: 'The fuel alerts use the same average, without the margin',
    avgLaps: 'Laps to average',
    avgLapsHelp: 'How many of your last clean laps are averaged',
    margin: 'Margin',
    marginHelp: 'Laps of fuel to spare as you cross the line',
    marginValue: (laps) => `${laps}${NB}laps`
  },
  lights: {
    note: 'Like a dashboard’s warning lights: grey when off, lit with their colour and their shape',
    layout: 'Orientation',
    layoutChoices: {
      row: { label: 'Row', hint: 'Lights that do not fit the width go on below' },
      column: { label: 'Column' }
    },
    labelSide: 'Text side',
    labelSideChoices: {
      right: { label: 'On the right' },
      left: { label: 'On the left' }
    },
    onlyWhenLit: 'Lit only',
    onlyWhenLitHelp: 'Without the lights that are off; the widget hides while none is lit',
    captions: 'Captions',
    captionsHelp: 'A word after each icon: “WATER”, “REPAIR”',
    captionsChoices: {
      off: { label: 'No' },
      on: { label: 'Yes' },
      right: { label: 'Right' },
      left: { label: 'Left' }
    },
    temps: 'Temperatures',
    tempsHelp: 'The water and oil temperature next to their lights, and its rise: “98° +6°”',
    repairTime: 'Repair time',
    repairTimeHelp:
      'How long the crew will take in the pits: “REPAIR · 42 s (crew)”, “OPT. · 38 s (crew)”',
    repairCrewTag: 'Mark as crew time',
    repairCrewTagHelp:
      'iRacing gives the mechanics’ time, which can run slower than the clock: “42 s (crew)”, “42 s crew” in a narrow window',
    repairRealTime: 'Real countdown (estimated)',
    repairRealTimeHelp: (s) =>
      `Stopped in your stall with the service on, it measures how fast the crew’s figure falls over the last ${s}${NB}s and shows the real seconds left, often more: “42 s (crew)” can be “≈ 95 s (real)”. Until it knows, towed or out of the stall, the crew’s. It never rises nor goes below 0`,
    trend: 'Rising temperature',
    trendHelp: (s) => `Water or oil turns yellow after ${s}${NB}s well above your average`,
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
        action: (example) => `Pit now. “${example}” is the crew’s time`,
        actionReal: (example) =>
          `Pit now. “${example}” is the real seconds left, estimated stopped in your stall; before that, the crew’s figure`
      },
      repairOptional: {
        meaning: 'Minor damage: you can race on with it',
        action: (example) => `Fix it at your next stop if it pays off: “${example}”`
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
    introSides: {
      before: 'Drag',
      middle: 'or use ↑ ↓ to reorder, and',
      after: 'to move to the other side; the eye shows or hides each element.'
    },
    sides: { left: 'Left', right: 'Right' },
    sidesHelp: { left: 'At the start of the line', right: 'At the end of the line' },
    sideEmpty: 'Nothing on this side: drag an element here',
    addItem: (n) => `Add a data item (${n})`,
    addItemHelp: 'Pick the item and the side it goes on',
    addTo: (item, side) => `Add ${item} on the ${side}`,
    hiddenSide: { left: 'Left', right: 'Right' },
    toLeft: (item) => `Move ${item} to the left`,
    toRight: (item) => `Move ${item} to the right`,
    movedLeft: (item) => `${item}: on the left.`,
    movedRight: (item) => `${item}: on the right.`,
    count: (visible, total) => `${visible} of ${total} shown`,
    move: (item) => `Move ${item}`,
    moveUp: (item) => `Move ${item} up`,
    moveDown: (item) => `Move ${item} down`,
    show: (item) => `Show ${item} in the widget`,
    hide: (item) => `Hide ${item} in the widget`,
    required: 'Always shown',
    fixedTag: 'Always shown, in its place',
    parts: 'Parts',
    partsCount: (shown, total) => `${shown} of ${total} parts`,
    partsLabel: (row) => `Parts of “${row}”`,
    needsParent: (parent) => `Needs “${parent}”`,
    reset: 'Reset',
    resetLabel: (zone) => `Reset ${zone}`,
    moved: (item, position, total) => `${item}: position ${position} of ${total}.`,
    shown: (item) => `${item} shown.`,
    hidden: (item) => `${item} hidden.`,
    resetDone: (zone) => `${zone}: defaults.`,
    undo: {
      hidden: (item) => `Hidden: “${item}”`,
      moved: (item) => `Moved: “${item}”`,
      reset: (what, where) => `Reset: ${what}${where}`,
      inLayout: (name) => ` · in “${name}”`,
      inShared: ' · in the shared options',
      whatPart: (part, widget) => `${part} of ${widget}`,
      whatBounds: (widget) => `Position and size of ${widget}`,
      whatAll: (widget) => `${widget} (all)`,
      whatAppearance: 'Appearance (the whole page)',
      whatShortcuts: 'Shortcuts (all)',
      whatShortcut: (action) => `Shortcuts of “${action}”`,
      whatFollowGlobal: (what, n) => `Global in ${what} (${n === 1 ? '1 widget' : `${n} widgets`})`,
      widgetHidden: (widget) => `Hidden: ${widget}`,
      layoutDeleted: (name) => `Layout “${name}” deleted`,
      action: 'Undo',
      dismiss: 'Dismiss',
      keyHint: 'Ctrl+Z to undo.',
      group: 'Undo the last change'
    },
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
    battle: {
      lanes: 'Rivals',
      rows: 'Lines',
      parts: 'Details',
      headerBar: 'Header',
      footerBar: 'Footer'
    },
    inputs: { sections: 'Blocks', bars: 'Bars', info: 'Readouts', car: 'Car' },
    traffic: { groups: 'Groups', parts: 'Columns', headerBar: 'Header', footerBar: 'Footer' },
    alerts: { parts: 'Extras' },
    delta: { rows: 'Lines', top: 'Top line', laps: 'Lap times' },
    fuel: { headerBar: 'Header', lines: 'Lines', footerBar: 'Footer' },
    lights: { icons: 'Lights' },
    settingsWindow: { customizeOpen: 'Open sections of Customise' }
  },
  items: {
    relative: {
      columns: {
        pos: 'Position',
        driver: 'Driver',
        ir: 'iRating',
        lic: 'Licence',
        pit: 'Pits',
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
      sections: {
        trace: 'Trace',
        bars: 'Bars',
        info: 'Gear, speed and steering',
        car: 'Revs, bias, TC and FFB'
      },
      bars: { clutch: 'Clutch', brake: 'Brake', throttle: 'Throttle' },
      info: { gear: 'Gear', speed: 'Speed', steering: 'Steering' },
      car: {
        rpm: 'Revs',
        bias: 'Brake bias',
        tc: 'Traction control',
        ffb: 'Force feedback (FFB)'
      }
    },
    traffic: {
      groups: { hazard: 'Hazards', slower: 'Slower traffic', faster: 'Faster class' },
      parts: {
        icon: 'Icon',
        cls: 'Class',
        driver: 'Driver',
        lead: 'Words before the time',
        value: 'Time',
        sector: 'Sector'
      }
    },
    alerts: { parts: { notes: 'What to do, after each alert', chips: 'Other alerts as chips' } },
    delta: {
      rows: { top: 'Top line', bar: 'Bar', sectors: 'Sectors', laps: 'Lap times' },
      top: { state: 'Lap state', predicted: 'Predicted lap', reference: 'Reference' },
      laps: { last: 'Last lap', best: 'Session best', optimal: 'Optimal lap', pb: 'Personal best' }
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
    copyTo: 'Copy to',
    copyToLabel: (bar, widget) => `Copy “${bar}” to ${widget}`,
    copied: (bar, widget) => `Copied: ${bar} → ${widget}`,
    items: {
      title: 'Widget title',
      session: 'Session',
      remaining: 'Time or laps left',
      clock: 'Local time',
      sof: 'SoF',
      carCount: 'Car count',
      incidents: 'Incidents',
      iRating: 'iRating at stake',
      safetyRating: 'Projected SR',
      fastestLap: 'Class fastest lap',
      fuelLaps: 'Laps of fuel',
      trackTemp: 'Track temperature',
      airTemp: 'Air temperature',
      wind: 'Wind',
      wet: 'Water on track',
      rubber: 'Rubber'
    },
    hints: {
      title: 'The widget’s name in capitals: “RELATIVE”, “TRAFFIC”…',
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
    show: {
      headerBar: 'Show header',
      subheaderBar: 'Show second line',
      footerBar: 'Show footer'
    },
    summary: (size, visible, total) => `${size} · ${visible} of ${total} shown`,
    summaryOff: 'Not shown',
    size: 'Size',
    sizeChoices: {
      off: { label: 'No' },
      small: { label: 'Small' },
      normal: { label: 'Normal' },
      large: { label: 'Large' }
    },
    fitNote:
      'Text never goes below the minimum size: when it does not fit, the least important items go first',
    trend: 'Track trend',
    trendHelp: 'An arrow when it rises or falls over the last few minutes',
    windDirection: 'Direction relative to your car',
    windDirectionHelp: 'The arrow points at your car from where the wind blows. Only while driving'
  },
  driverBlock: {
    title: 'Driver'
  },
  driverCell: {
    brandMarks: 'Make logo',
    brandMarksHelp: 'Before the name; on Auto, only when there is more than one make on track',
    brandChoices: {
      auto: { label: 'Auto', hint: 'Only with several makes in the session' },
      on: { label: 'Always' },
      off: { label: 'Never' }
    },
    countryFlags: 'Country flag',
    countryFlagsHelp: 'The one each driver chose in iRacing; nothing when they chose none',
    columnHeads: 'Column titles',
    columnHeadsHelp: 'A row naming each column: “POS”, “DRIVER”, “iR”…'
  },
  layouts: {
    sub: 'Save where each widget is and, if you like, its options: one for each car',
    subMore:
      'Its size, scale, whether it shows and whether it is locked, and its options (columns, elements, delta references, opacity…). A “Position only” one uses the shared options. Appearance, visibility and shortcuts are always the same.',
    listTitle: 'Saved layouts',
    listNote: 'The one in use updates itself as you move the widgets or change their options',
    inUse: 'In use',
    search: 'Search layouts',
    searchPlaceholder: 'Name or car',
    clearSearch: 'Clear the search',
    matches: (shown, total) => `${shown} of ${total}`,
    noMatch: (query) => `No layout matches “${query}”`,
    pinnedNoMatch: 'Doesn’t match the search; shown because it is in use',
    sort: 'Sort by',
    sorts: {
      custom: 'Custom',
      name: 'Name',
      recent: 'Recently used'
    },
    sortHints: {
      custom: 'Your order, the tray’s and the shortcut’s; change it with the arrows',
      name: 'From A to Z',
      recent: 'The one you used last first'
    },
    apply: 'Apply',
    applyLabel: (name) => `Apply ${name}`,
    edit: 'Edit',
    editLabel: (name) => `Edit ${name}: name and what it restores`,
    modes: {
      full: 'Position and options',
      position: 'Position only'
    },
    modeHints: {
      full: 'Also saves and restores each widget’s options',
      position: 'Only the widgets move; they use the shared options'
    },
    modeLabel: 'When applied',
    importMode: 'Import as',
    dropOptions: 'Its own options will be discarded: it will use the shared options',
    dropOptionsActive:
      'Its own options will be discarded and the widgets switch to the shared options now',
    nameLabel: 'Name',
    saveName: 'Save',
    cancel: 'Cancel',
    duplicate: 'Duplicate',
    duplicateLabel: (name) => `Duplicate ${name}`,
    copyName: (name) => `${name} (copy)`,
    export: 'Export…',
    exportLabel: (name) => `Export ${name} to a file`,
    moveUp: (name) => `Move ${name} up`,
    moveDown: (name) => `Move ${name} down`,
    delete: {
      label: 'Delete',
      description: (name) => `Deletes the layout ${name} and its linked cars (you can undo it)`
    },
    deleteActive: 'Apply another one before deleting the one in use',
    cars: (list) => `Cars: ${list}`,
    saveTitle: 'Save the current one',
    saveHelp: 'A new layout equal to what you see now; it becomes the one in use',
    savePlaceholder: 'Mazda MX-5, GT3, Endurance…',
    save: 'Save as new',
    full: (max) => `You have reached the maximum of ${max} layouts`,
    filesTitle: 'Files',
    screens: {
      title: 'Screens',
      gather: 'Bring every widget to this screen',
      gatherHelp: 'The ones on another screen, or on one unplugged, come to this window’s screen',
      button: 'Bring here',
      gathered: (n) =>
        n === 1 ? '1 widget brought to this screen.' : `${n} widgets brought to this screen.`,
      none: 'They were all on this screen already.',
      undo: 'Widgets brought to this screen',
      gatheredCursor: (n) =>
        n === 1
          ? '1 widget brought to the mouse’s screen (from the tray).'
          : `${n} widgets brought to the mouse’s screen (from the tray).`,
      noneCursor: 'They were all on the mouse’s screen already.',
      undoCursor: 'Widgets brought to the mouse’s screen'
    },
    filesHelp:
      'Export a layout to a .json file to keep or share it; importing one does not apply it',
    filesMore:
      'It carries its options if it has them. A file from an older version, without options, gets the shared options.',
    import: 'Import…',
    notices: {
      exported: (name) => `Exported: ${name}`,
      exportFailed: (name) => `Could not save the file of ${name}`,
      imported: (name) => `Imported: ${name}. Apply it whenever you like`,
      importFailed: {
        json: 'The file is not valid JSON',
        format: 'It is not an OverLap layout file',
        version: 'The file comes from a newer version of OverLap',
        empty: 'The file has no widget this version knows',
        tooBig: 'The file is too large to be a layout',
        read: 'Could not read the file',
        full: 'No room for more layouts: delete one first'
      }
    },
    autoTitle: 'Automatic switch',
    auto: 'By car',
    autoHelp: 'Getting in a linked car applies its layout',
    autoMore:
      'A car without a link keeps the last one you used. While editing, it waits until you leave.',
    currentCar: 'Current car',
    noCar: 'No car now: join an iRacing session to link yours',
    seenCars: 'Other cars: recent and from your records',
    noSeenCars: 'The cars you get in, or have a personal best in, will show up here',
    linkSuggest: (layout) => `Link to “${layout}”`,
    linkNew: (car) => `Link to ${car} (applies by itself when you get in)`,
    linkSuggestHelp: (car, layout) =>
      `${car} has no layout: with “${layout}” it applies by itself when you get in`,
    autoOn: (car) => `“By car” turned on: getting in ${car} will apply its layout.`,
    autoOnUndo: '“By car” turned on',
    noLink: 'Not linked',
    linkLabel: (car) => `Layout for ${car}`,
    unknownCar: (id) => `Car ${id}`,
    autoOff: 'Turn “By car” on for the links to apply'
  }
}
