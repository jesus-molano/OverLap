# Registro de cambios

Aquí se apuntan todos los cambios importantes de OverLap.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Cambiado

- **«Clasificación» pasa a llamarse «Posiciones»** en español (barra lateral, bandeja, título del
  widget y ajustes), para no confundirla con la sesión de clasificación, que conserva su nombre. En
  inglés sigue siendo «Standings». Los ajustes guardados no cambian.

### Corregido

- **La ayuda de «Tamaño del texto»** (Apariencia) dice exactamente a qué widgets cambia (Posiciones,
  Batalla, Pedales, Tráfico, Avisos, Testigos y Combustible) y cuáles ajustan el texto a su ventana
  (Relativo, Radar y Delta). Antes solo nombraba Clasificación y Batalla.

## [2.2.0] - 2026-10-29

### Añadido

- **Atajos en los botones del volante**: cualquier atajo puede ir en un botón del volante o su aro,
  una button box, los pedales, el cambio o el freno de mano, en vez de en una combinación de
  teclas. En **Ajustes > Atajos** (antes «Atajos de teclado»), **+ Añadir** espera una combinación
  o un botón; se ve como «Botón 12 · G29 Driving Force Racing Wheel», con más de 32 botones
  también.
- Los botones solo se leen (Raw Input de Windows, como SimHub o Crew Chief): se comparten con
  iRacing, que también recibe la pulsación, y no se bloquea nada. Mantener pulsado cuenta una vez.
- Un dispositivo desenchufado conserva su atajo y la página dice «Desconectado»; al enchufarlo
  vuelve a funcionar solo. Sin ningún atajo en un botón, OverLap no lee los mandos.
- Las crucetas (D-pad) y los hats no se pueden asignar. Volver a la 2.1.1 devuelve a su
  combinación de fábrica los atajos que estaban en un botón.
- **Editar en la vista previa**: en la página de cada widget, pasa el ratón por un elemento de la
  vista previa para ver su nombre, arrástralo para cambiarlo de sitio (en las cabeceras y pies,
  también de un lado al otro) y haz clic para mostrarlo u ocultarlo. Mientras editas, los ocultos
  se dibujan translúcidos donde caben, para poder recuperarlos: un clic los muestra en su sitio y
  arrastrarlos los muestra donde los sueltes. La lista y la vista previa se señalan una a otra, y
  al tocar algo en la vista previa se abre su sección.
- **Deshacer al ocultar o mover**: al ocultar un elemento (con un clic en la vista previa o con su
  ojo en la lista) o al arrastrarlo a otro sitio en la vista previa, aparece abajo durante unos
  segundos un aviso «SoF» oculto con **Deshacer**, por si fue sin querer. Con el ratón encima o el
  foco dentro no se va; **Ctrl+Z** también deshace mientras se ve. Solo deshace el último cambio,
  y nunca lo que hayas tocado después.
- **Cabecera y pie en todos los paneles**: Combustible, Tráfico y Batalla tienen ahora la misma
  cabecera y el mismo pie que Relativo y Clasificación, con el mismo catálogo de datos (tiempo
  restante, SoF, vueltas de combustible, temperatura de pista…), interruptor, tamaño y cajas
  Izquierda/Derecha, y se editan también en la vista previa. Los nuevos vienen apagados, así que
  nada cambia hasta que los enciendas. Delta, Pedales, Radar, Testigos y Avisos siguen sin ellos,
  y su página lo explica.
- **Varios atajos por acción**: hasta tres a la vez, mezclando combinaciones de teclas y botones
  (por ejemplo `Ctrl+Shift+H` y «Botón 24 · G29», o un botón en cada volante); cualquiera la
  ejecuta. En **Ajustes > Atajos** cada acción los muestra uno al lado del otro, cada uno con su
  **×** para quitarlo, y **+ Añadir** graba otro; pulsar uno lo cambia. Quitar el primero sube el
  siguiente. Un atajo que ya tiene otra acción (o la misma) se rechaza y la página dice quién lo
  tiene; uno que no funciona (desconectado, o en uso por otra aplicación) se marca él solo.
  Donde una frase nombra los atajos de una acción (el aviso de overlay oculto, el delta, el modo
  edición) aparecen como «Ctrl+Shift+H o Botón 24».
- Los ajustes de antes se cargan igual. La 2.1.1 sigue funcionando con el primer atajo de cada
  acción; los demás se pierden si guarda los ajustes.

### Cambiado

- **Tráfico**: su título es ahora la cabecera compartida (se ve igual y admite más datos); los
  rótulos de los grupos pasan a ser un interruptor en «Grupos». Un archivo de ajustes anterior
  conserva cómo los tenías, y la sección «Cabecera» abierta o cerrada como estaba.
- En las listas de cabecera, segunda línea y pie, los elementos ocultos ya no llenan la caja
  «Derecha»: van en un grupo «Ocultos» plegado debajo; al mostrar uno, va al final de su lado.
- **Logos de marca del mismo tamaño**: en Relativo, Clasificación y Batalla los logos anchos
  (McLaren, Hyundai, Subaru, Ford...) ya no se ven mucho más grandes que los redondos (BMW) o los
  escudos (Ferrari, Porsche): cada uno se dibuja a una escala medida de su propio trazo, en color
  y en monocromo, centrado en el mismo hueco para que la columna siga alineada.

- **Ajustes > Personalizar en acordeones**: cada sección (columnas, cabecera, pie…) se abre y se
  cierra por separado, con un resumen al estar cerrada y «Expandir todo / Contraer todo»; recuerda
  cuáles dejaste abiertas. Cada cabecera, segunda línea y pie tiene un interruptor «Mostrar» con
  su tamaño al lado, y sus elementos se reparten en las cajas «Izquierda» y «Derecha».
- Las banderas de los pilotos son un poco más pequeñas (82 % del alto de la fila).

### Corregido

- **Clasificación con coches en boxes**: un coche en el pit lane o en su box (también remolcado
  por la grúa) ya no salta por delante de ti al cruzar la meta para volver a caer detrás al pasar
  por su box; conserva su puesto como en iRacing y baja si le pasan. También un coche que cruzaba
  la meta en el pit lane tras la bandera de cuadros podía salir primero. Afecta igual a Relativo y
  Batalla.
- En la vista previa, el contorno de los elementos ocultos ya no sale cortado dentro de las
  cabeceras y pies.

## [2.1.1] - 2026-10-29

### Corregido

- **Ajustes que no se guardaban**: en algunas sesiones los cambios se veían en Ajustes pero no
  llegaban al archivo, y se perdían al cerrar. Ahora un guardado fallido se reintenta solo cada
  pocos segundos, Ajustes avisa mientras los cambios estén solo en memoria, y los errores quedan en
  `overlap.log`, junto a los ajustes («Abrir carpeta de ajustes»).
- **Delta**: encender un tiempo en «Tiempos de vuelta» no se veía si la línea estaba oculta en
  «Filas»; ahora la lista lo avisa y, al encender un tiempo, se muestra la línea.
- «Nombre del widget» pasa a llamarse «Título del widget», con una explicación de qué es.

### Añadido

- Atajo para abrir los Ajustes (`Ctrl+Shift+O` por defecto, la O de opciones): los abre o los trae
  al frente, también con iRacing delante. Se cambia o se desactiva en **Ajustes > Atajos de teclado**.

## [2.1.0] - 2026-10-29

### Disposiciones

- Con muchas disposiciones (hasta 30): buscador por nombre o coche (sin distinguir mayúsculas ni
  acentos) a partir de 9, la lista con su propio scroll y la que está en uso fija arriba, y orden
  personalizado, por nombre o por uso reciente. Los coches del cambio automático salen por nombre.
- La bandeja muestra la que está en uso, la del coche actual y las más recientes (5 como mucho) y
  «Más…», que abre Ajustes directamente en Disposiciones (también «Gestionar disposiciones…").
- Las disposiciones guardan también las opciones de cada widget (columnas y su orden, elementos,
  barras de información, referencias del delta, estilo del volante, opacidad, sesiones en que se
  ve…), y al aplicar una vuelven junto con las posiciones, de una vez. La apariencia, la
  visibilidad y los atajos siguen siendo los mismos para todas.
- Cada una es «Posición y opciones» o «Solo posición» (usa las opciones comunes); se elige al
  guardarla o importarla y se cambia con «Editar».
- Cada página de widget dice dónde se guardan sus cambios («Guardando en: …» u «Opciones
  comunes») y ofrece «Copiar estas opciones a todas».
- Los archivos exportados (versión 2) llevan las opciones; los de la versión 1 se siguen
  importando. Tus disposiciones pasan a «Posición y opciones» con las opciones de ahora: nada
  cambia.
- Los ajustes pasan a la versión 6. La 2.0.0 los abre, pero sin las opciones de cada
  disposición; por eso, la primera vez que esta versión guarda los ajustes de una anterior, deja
  una copia en `settings.json.v5.bak` para poder volver atrás.

### Widgets

- Delta y Batalla sin el borde de color del estado: el número, las flechas y el texto lo dicen.
  La disposición en uso tampoco lleva franja lateral, solo la etiqueta «EN USO».
- Número, logotipo, bandera y nombre alineados en todas las filas del Relativo, la Clasificación y
  la Batalla, también en la fila del líder de otra clase («LMP2» se lee entero).
- Un globo en el hueco de la bandera para quien no corre por ningún país («-none-» o una bandera
  que no es de un país); el coche de seguridad, los espectadores y la IA siguen sin bandera.

### Calidad

- Prueba de memoria de más de 20 minutos con cambios de coche cada 3 s, Ajustes abriéndose y
  cerrándose, modo edición y cambios de disposición: sin fugas en el código de OverLap, CPU por
  debajo del 0,3 %. El cambio automático por coche, probado con miles de ciclos: una sola vez por
  cambio real, nunca en modo edición y sin bucles.

## [2.0.0] - 2026-10-29

Primera versión publicada. OverLap es un overlay para iRacing en Windows: lee la telemetría oficial
del SDK, solo lectura y sin inyectar nada en el juego, y dibuja diez widgets encima del simulador.
La 1.x, con relativo y radar, fue de uso personal y no se publicó; sus ajustes se migran solos.

### Widgets

- **Relativo**: los coches que tienes delante y detrás en pista (3 y 3 por defecto, hasta 10), con
  posición en clase, número, nombre, licencia, iRating y hueco. Color de clase en cada fila, en rojo
  quien te va a doblar, en azul los doblados y atenuados los que están en boxes. Opcionales:
  columnas de neumático y de vueltas del stint, banderas de penalización tras el nombre y tus
  incidentes en la cabecera («3x · DQ a 17x»).
- **Radar**: vista cenital con los coches a escala alrededor del tuyo, que pasan de neutros a rojo
  según se acercan. Alcance de 5 a 100 m (20 m por defecto). Un coche que se pone a tu lado se
  desliza a su carril en vez de saltar y conserva su lado hasta 3 s después de que iRacing deje de
  darlo.
- **Clasificación**: modo compacto (primeros, tu entorno y líderes de otras clases) o completo.
  Columnas que se ordenan arrastrando y se esconden solas si la ventana se estrecha: puestos
  ganados, iRating, licencia, Δ iRating, hueco al de delante y al líder, última y mejor vuelta,
  boxes, última parada, stint y neumático. Cabecera con tu iRating y SR proyectados, SoF, número de
  coches e incidentes.
- **Batalla** (por defecto solo en carrera): tu rival de clase de delante y el de detrás mientras
  estén a menos del hueco que elijas, con la tendencia del hueco, la predicción de alcance («Le
  alcanzas en ~4 v de 19»), la diferencia por sector o por vuelta y el iRating en juego.
- **Pedales**: traza de acelerador, freno y embrague, barras, volante,
  marcha, velocidad y ABS, en tres disposiciones (la más pequeña, solo barras). La traza avanza su
  distancia exacta en cada muestra, sin saltos de un píxel.
- **Tráfico**: la clase más rápida que te alcanza por detrás (en cuánto y dónde), el tráfico lento
  al que alcanzas y los peligros de delante (coches parados, muy lentos o fuera de pista). Quien te
  dobla, o te adelanta con bandera azul, sale siempre, en ámbar o rojo según se acerca.
- **Avisos**: una banda con lo que te afecta, lo más importante en grande. Banderas (también la
  negra enrollada), limitador y exceso de velocidad en el pit lane, «PON LIMITADOR» antes de entrar,
  10 y 5 vueltas para el final, grúa con cuenta atrás, motor calado, sentido contrario, presión de
  aceite, daños con reparación obligatoria, «ENTRA ESTA VUELTA», combustible bajo y cada incidente
  al sumarlo («+2x Pérdida de control · V5 · S3 · grava»). Cada caso tiene su opción.
- **Delta**: barra a 30 Hz frente a la referencia que elijas: tu récord personal con ese coche en
  ese trazado, la mejor vuelta de la sesión, tu vuelta óptima por sectores, la mejor de tu clase o
  la óptima de tu clase. Con tendencia, vuelta prevista y sectores. La referencia solo cambia al
  empezar una vuelta y, mientras no existe, se usa la siguiente. Los récords se guardan en tu equipo
  y no se pierden al cambiar de sesión.
- **Combustible** (por defecto solo en carrera): litros y vueltas que te dan, vueltas que quedan,
  depósito con la marca de lo que necesitas, consumo (media, última y máximo), lo que falta para
  meta y lo que hay que echar junto a lo del menú de boxes, ventana de parada («V24–V28»), paradas,
  el ahorro por vuelta que te quita una parada, la última lectura de neumáticos y las reparaciones
  rápidas y juegos de neumáticos que quedan si la sesión los limita. Solo mide vueltas limpias, y el
  plan no baila dentro de la vuelta.
- **Testigos**: los testigos del motor como en un salpicadero, en fila o en columna: presión de
  aceite y de gasolina, motor calado, reparación obligatoria y opcional (con el tiempo que falta),
  temperatura del agua y del aceite y, si los activas, limitador de boxes y corte de revoluciones.
  Cada gravedad tiene su color y su forma, así que se lee sin el color. Avisa en amarillo cuando el
  agua o el aceite suben muy por encima de tu media, antes de que se encienda el testigo del coche.
- **Pie de condiciones** bajo Relativo y Clasificación (activado en Clasificación): temperatura de
  la pista con su tendencia, agua y lluvia cuando las hay («DECLARADA MOJADA»), viento medio con un
  dial que apunta a tu coche desde donde sopla, aire y goma.

### Overlay y rendimiento

- Una sola ventana transparente por pantalla con todos sus widgets, en lugar de una por widget.
  Windows reparte el refresco entre las ventanas que se actualizan, y la traza de pedales y el radar
  se quedaban en 22–39 fps; ahora todos los paneles van a ~58 fps. La memoria del overlay baja de
  ~705 MB a ~203 MB.
- Las ventanas nunca cogen el foco y dejan pasar los clics al juego; solo cogen el ratón en modo
  edición, sobre un widget sin bloquear.
- Si la ventana falla o se cuelga, se pierde la GPU, el equipo se suspende o cambia la escala de una
  pantalla, el overlay se oculta y vuelve solo al recuperarse.
- Un widget oculto no se dibuja ni se calcula, y cada widget se calcula a su propia frecuencia.
- Para OBS, la captura de ventana es «Pantalla N · OverLap», con todos los widgets de esa pantalla.
- Diseño «Night Cluster»: paneles con el borde de arriba iluminado, tu fila marcada con un corchete
  de luz del color de acento y licencias como texto de color con su SR.
- Icono propio (monograma OL) para la app y la bandeja, que sigue el tema claro u oscuro de la barra
  de tareas.

### Modo edición

- Arrastra un widget para moverlo, usa sus bordes y esquinas para cambiar su tamaño o la rueda del
  ratón para escalarlo. Se pega a los bordes de los demás widgets y de la pantalla (con `Alt` o
  `Shift` pulsado, no).
- Arrastrado fuera de su pantalla, el widget pasa a la otra.
- Cada etiqueta tiene un ojo (mostrar u ocultar) y un candado (bloquear). Las etiquetas se dibujan
  encima de todo, y un widget oculto se ve como un hueco discontinuo para poder recuperarlo.
- El radar se dibuja encima de todos los widgets, y el modo edición marca en naranja lo que lo tapa.
- Con iRacing delante, el simulador oculta el cursor: el overlay lo avisa y dice cómo recuperarlo
  (los Ajustes desde la bandeja o `Alt+Tab`).
- Salir del modo edición en mitad de un arrastre lo cancela.

### Atajos de teclado

- Globales, funcionan con iRacing en primer plano: `Ctrl+Shift+H` muestra u oculta todo el overlay
  de golpe (la telemetría sigue, así que vuelve con los datos al día) y `Ctrl+Shift+E` entra o sale
  del modo edición. `Esc` sale del modo edición.
- Se cambian en **Ajustes > Atajos de teclado**: pulsa la combinación nueva, o desactiva o
  restablece cada atajo. Avisa si otra aplicación ya la usa o si `Ctrl+Alt` (el `AltGr` de un
  teclado español) puede impedir escribir `@`, `#` o `€`, y rechaza las de Windows, las de editar y
  las que no llevan `Ctrl` ni `Alt` (salvo `F13`–`F24`, que envían muchas button box).
- Usan `RegisterHotKey` de Windows: no hay ganchos de teclado ni nada que llegue al juego.

### Ajustes

- Ventana de Ajustes desde la bandeja, volviendo a abrir la app o con `--settings`. Todo se aplica
  en vivo y se guarda solo; arriba queda fija una muestra del widget y solo se desplazan las
  opciones.
- Por widget: visible, bloqueado, opacidad del fondo (el texto sigue nítido y lleva contorno con
  poca opacidad), escala, alto automático o fijo y hacia dónde crece, en qué sesiones se muestra
  (práctica, clasificación, carrera), ocultar en boxes y restablecer opciones o posición.
- Apariencia: color de acento (seis), paleta para daltónicos (azul y naranja en vez de verde y
  rojo), tamaño y contorno del texto, densidad y filas alternas, estilo de la licencia y del número,
  formato del nombre y unidades métricas o imperiales.
- Récords personales: la lista por coche y trazado, con borrar uno, el actual o todos.
- Bandeja: Ajustes, mostrar u ocultar cada widget, alcance del radar, cuándo se ve el overlay,
  ocultarlo, modo edición y la carpeta de ajustes.
- Un archivo de ajustes dañado se guarda como `.bak` y se usan los valores por defecto. Los widgets
  nuevos llegan a un hueco libre, sin tapar lo que ya tenías colocado.

### Personalización

- **Elementos de cada widget**: un editor común en Ajustes para mostrar, ocultar y ordenar lo que
  dibuja cada widget (columnas del Relativo y de la Clasificación, partes de Batalla, Tráfico,
  Delta, Pedales, Radar, Avisos, Combustible y Testigos), con una muestra en vivo. El aspecto de
  siempre es el valor por defecto y los ajustes anteriores se migran sin perder nada.
- **Barras de información** en cabeceras y pies: eliges, ordenas y dimensionas los datos (tiempo o
  vueltas que quedan, sesión, SoF, coches, incidentes, iRating y SR proyectados, vuelta rápida,
  temperaturas con tendencia, viento, goma, lluvia, vueltas de combustible, hora local). Siempre
  legibles: si no caben, saltan de línea o se recortan por prioridad, nunca se encogen.
- **Cabeceras de columna** opcionales (SR, iR, Líder, Intervalo…), en los dos idiomas.
- **Logotipos de marca** en color (o monocromos) en Relativo, Clasificación y Batalla, y
  **banderas** del país de cada piloto.
- **Vuelta rápida** más visible en la Clasificación, con marca en la fila y dato para la barra de
  información.
- **Licencias** con estilo contorno, el nuevo por defecto.
- **Delta**: referencia por tipo de sesión (récord personal en práctica, vuelta óptima en
  clasificación y en carrera), línea opcional con la última, la mejor y la óptima a la vez con la
  referencia en uso marcada, y un atajo para cambiar la referencia solo durante la sesión actual.
- **Pedales**: luces de cambio con los puntos del coche, bloque del coche (RPM, reparto de frenada,
  nivel de TC y force feedback con aviso de saturación) y cuatro estilos de volante (barra,
  minimalista, realista y fórmula) en tres tamaños, con color de la marca central y grados. El
  panel se ajusta a su contenido.
- **Testigos** en columna con los textos a la izquierda o a la derecha. El tiempo de reparación se
  marca «(equipo)», el que tarda el equipo según iRacing, con una estimación opcional en tiempo
  real.
- **Ventana de Ajustes**: fondo de la muestra claro u oscuro, más columnas y una muestra mayor al
  maximizar, y mejor encaje en pantallas ultrapanorámicas.
- Paneles sin franja lateral: el estado ilumina el borde de arriba.

### Disposiciones

- Guarda con nombre dónde está cada widget, su tamaño, escala, si se ve y si está bloqueado (una
  para el MX-5, otra para el GT3). Duplicar, renombrar, borrar, exportar e importar a .json.
- Se cambian desde Ajustes, la bandeja o un atajo, y opcionalmente solas al subirte a un coche
  vinculado. La disposición en uso se actualiza al mover los widgets. Los ajustes anteriores pasan a
  una disposición «Principal».

### Correcciones

- El modo edición dejaba de responder (ni mover ni ocultar) tras horas con la app abierta.

### Idiomas

- Español (por defecto) e inglés, en **Ajustes > Apariencia**. Cambia al momento los widgets, la
  ventana de Ajustes, los títulos de las ventanas y el menú de la bandeja.

### iRacing

- Solo lectura: lee la memoria compartida del SDK oficial y dibuja ventanas propias. No inyecta nada
  en el proceso del juego (iRacing usa EasyAntiCheat) ni enciende la grabación de telemetría `.ibt`.
- **Nombres con acentos**: iRacing escribe los datos de sesión en Windows-1252 y cada acento llegaba
  roto (`�`); ahora se leen bien. Los nombres que iRacing ya manda como `?` (cirílico, chino…) se
  muestran con el nombre del equipo o como «Piloto #7». Los récords guardados con un trazado de
  nombre roto se recuperan solos.
- **Solo en el coche**: por defecto el overlay se ve mientras conduces; también hay «Solo en
  carrera» y «Siempre». Fuera del coche solo se queda la Clasificación en la pantalla de sesión, con
  los resultados. Un instante fuera (un reset, el principio de una grúa) no lo hace parpadear.
  También se oculta con la interfaz de iRacing oculta y en el garaje.
- **Repeticiones**: ocultas por defecto. Con «Seguir al coche en cámara», los widgets siguen al
  coche que miras y, al rebobinar, la Clasificación se queda con la carrera en directo. La pantalla
  de sesión en directo («Playback: Live») no cuenta como repetición, y la cinta nunca suma vueltas,
  récords ni incidentes.
- En directo con la cámara en otro coche, Relativo, Clasificación, Batalla y Tráfico se centran en
  él; los widgets que solo tienen datos de tu coche se ocultan.
- Sin iRacing, «Esperando a iRacing…» se oculta a los 8 s. La conexión se reintenta cada ~2 s, y el
  proceso de telemetría se reinicia solo si falla.
- Modo simulado (`--mock`): una carrera de ~20 coches de dos clases para probarlo sin iRacing.

### Correcciones tras la carrera real

Lo que salió al usar OverLap en una carrera online real, al reproducir la grabación de esa carrera y
en una carrera offline contra la IA:

- **Cronometraje**: la vuelta 1 de una salida parada cuenta desde que el semáforo se pone verde, con
  el mismo tiempo que iRacing (salía un segundo más corta). Un coche remolcado o reiniciado se
  cronometra desde donde aparece, sin «+0.0» falsos, y la vuelta de enfriamiento no se cronometra.
- **Antes de la verde**: reloj, vueltas y margen de SR con la duración programada, no con la cuenta
  atrás de la parrilla. La Clasificación lista la parrilla entera y el Relativo, el puesto de
  salida.
- **Posiciones y huecos**: el Relativo usa las mismas posiciones que la Clasificación; el intervalo
  ya no repite el hueco al líder; un retirado queda a las vueltas que le faltan; fuera de carrera,
  sin tiempo no hay puesto ni «LÍDER». En práctica y clasificación las vueltas que quedan no suben
  al salir del coche, y con límite de vueltas y de tiempo también sale el reloj.
- **Final de la carrera**: la cabecera dice «Última vuelta» y luego «Final» cuando cruzas la meta
  (o al acabar la sesión, si te quedas en el box).
- **Grúa y boxes**: «GRÚA» solo mientras dura la grúa y después «PIT». La grúa no cuenta como
  parada, y la vuelta que iRacing te acredita en el box no suma al stint.
- **Avisos y testigos**: sin «LIMITADOR OFF» falso al aparecer en tu box tras la grúa ni «CALADO»
  mientras la grúa levanta el coche; las presiones y temperaturas del motor callan durante la grúa,
  en tu box y al subir al coche. La de cuadros cuenta desde que sale, no hay banderas fuera del
  coche y la negra enrollada no sale a quien ya terminó. Cada incidente se nombra por lo más grave
  que pasó, no por el byte de penalización.
- **Delta**: ya no dice «vuelta inválida» sin una vuelta en curso; la vuelta de salida y la grúa lo
  dicen.
- **Radar y tráfico**: un coche a tu lado del que iRacing no da el lado se dibuja atenuado a su
  distancia real, nunca encima de tu coche ni pegado a tu parachoques. En las sesiones en solitario
  el radar solo usa los avisos laterales de iRacing y Tráfico no lista a nadie.
- **Pilotos de IA y sesiones offline**: sin iRatings ni licencias de relleno («R 0.0», «SoF 1»).
- **Neumático**: sin columna de compuesto cuando todos llevan el de seco.

### Pendiente / conocido

- Falta una prueba de fps con iRacing en marcha que confirme los ~58 fps del overlay.
- Falta probar el overlay en pantallas con la escala de Windows al 125 % y al 150 %.
- Pie de condiciones: falta confirmar qué significa el estado de la goma (el que da iRacing al
  empezar la sesión) y el viento, cuya dirección solo se ha comprobado en una carrera; la escala de
  la lluvia tampoco está confirmada.
- Desgaste de neumáticos: iRacing solo lo mide con el coche parado en tu box, así que Combustible
  muestra la lectura de la última parada, no el desgaste en directo.
- Los límites de incidentes (penalización y DQ) se leen de los datos de sesión; falta confirmarlos
  en una carrera oficial.
- En pantalla completa exclusiva el overlay no se ve (usa ventana sin bordes), ni en VR sin una
  herramienta como OpenKneeboard.
- El `.exe` portable no está firmado: Windows SmartScreen puede avisar al abrirlo.

[2.2.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.2.0
[2.1.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.1
[2.1.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.0
[2.0.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.0.0
