# OverLap

Overlay para iRacing en Windows. OverLap lee la telemetría oficial del simulador y dibuja diez
widgets encima del juego: relativo, radar, posiciones, batalla, pedales, tráfico, avisos,
testigos, delta y combustible. Cada uno se coloca, se escala y se personaliza a tu gusto, y puedes
guardar una disposición distinta para cada coche.

- Solo **lee** los datos del SDK de iRacing: no inyecta nada en el juego ni usa la red (ver
  [Privacidad y anti-cheat](#privacidad-y-anti-cheat)).
- Los widgets van en ventanas transparentes, siempre encima, que nunca cogen el foco y dejan pasar
  los clics al juego.
- En español o en inglés: la primera vez, en el idioma de Windows (si no es ninguno de los dos, en
  inglés).

![Relativo, delta, radar, testigos y posiciones de OverLap](docs/screenshots/overlap.png)

_Todas las capturas usan los datos de ejemplo de la propia app (pilotos inventados) sobre fondo
transparente; en pista, el panel deja ver el juego a través según la opacidad que elijas._

## Contenido

- [Instalación](#instalación)
- [Widgets](#widgets)
- [Ajustes y personalización](#ajustes-y-personalización)
- [Modo edición](#modo-edición)
- [Disposiciones](#disposiciones)
- [Atajos de teclado](#atajos-de-teclado)
- [Cuándo se ve el overlay](#cuándo-se-ve-el-overlay)
- [Privacidad y anti-cheat](#privacidad-y-anti-cheat)
- [Problemas conocidos](#problemas-conocidos)
- [Licencia y créditos](#licencia-y-créditos)

## Instalación

### Requisitos

| Requisito | Detalle                                                           |
| --------- | ----------------------------------------------------------------- |
| Sistema   | Windows 10 u 11 de 64 bits                                        |
| iRacing   | En ventana sin bordes (borderless / pantalla completa en ventana) |

- En **pantalla completa exclusiva** el overlay no se ve.
- En **VR** no se ve, salvo con una herramienta como OpenKneeboard.

### Descargar y abrir

1. Descarga `OverLap-2.2.0-portable.exe` de la última release en GitHub.
2. Ábrelo. No se instala nada: es un ejecutable portable que puedes dejar donde quieras.
3. El `.exe` no está firmado, así que **Windows SmartScreen** avisará la primera vez. Pulsa **Más
   información → Ejecutar de todas formas**.

OverLap se queda en la **bandeja del sistema** (junto al reloj). Desde su icono abres los
**Ajustes…**, muestras u ocultas cada widget, cambias el alcance del radar, cuándo se ve el overlay y
la disposición en uso, entras en modo edición, abres la carpeta de ajustes o sales. Volver a abrir
el `.exe` con OverLap ya en marcha abre los Ajustes.

Si iRacing no está abierto, Relativo y Posiciones muestran «Esperando a iRacing…» unos segundos y
se ocultan; OverLap se conecta solo en cuanto arranca el simulador.

Los ajustes se guardan en `%APPDATA%\iracing-overlay\` (**Ajustes › Acerca de y ayuda › Abrir carpeta**,
o la bandeja). En esa página, **Exportar todo…** guarda en un archivo todos los ajustes (Apariencia,
atajos, visibilidad y todas las disposiciones con sus opciones) y tus récords, e **Importar todo…**
los recupera en otro equipo o tras reinstalar: los ajustes se ponen al momento (con **Deshacer**,
mientras no cambies nada más) y los récords del archivo se suman a los tuyos (gana la vuelta más
rápida; ninguno de los tuyos se borra, y si la lista está llena se dice cuántos no caben). Ahí están también la
versión, una ayuda rápida, **Abrir registro**, **Copiar diagnóstico**, **Ver la bienvenida** y
**Restablecer todo** (como recién instalado, en tu idioma; tus récords se quedan; con **Deshacer**).

## Widgets

Cada widget tiene su página en los Ajustes, con una vista previa en vivo y sus opciones. Todos se
pueden mostrar u ocultar, bloquear, escalar y limitar a ciertas sesiones (práctica, clasificación,
carrera).

### Relativo

<img src="docs/screenshots/relativo.png" alt="Relativo" width="460">

Los coches que tienes delante y detrás en pista (3 y 3 por defecto, hasta 10) con el hueco en
segundos: positivo delante, negativo detrás. Cada fila lleva posición en clase, número con el color
de su clase, marca, bandera del país, nombre, iRating y licencia (en el mismo orden que Posiciones
y Batalla). En rojo quien te va a doblar, en
azul los doblados y atenuados los que están en boxes. En la cabecera, su nombre; tus incidentes y
el próximo límite de la sesión («3x · DQ a 17x»), la sesión y el tiempo restante salen por
defecto en Posiciones, y aquí con un clic en su cabecera.

Opcionales: columnas de boxes (PIT o GRÚA en su columna; sin ella, tras el nombre, como en
Posiciones), neumático y vueltas del stint, banderas de penalización tras el nombre, títulos de
columna y una barra de datos arriba y abajo (sesión, tiempo restante, SoF, iRating en
juego, SR proyectado, condiciones de pista…).

### Radar

<img src="docs/screenshots/radar.png" alt="Radar" width="213">

Vista cenital con los coches a escala alrededor del tuyo, que pasan a rojo según se acercan, y un
aviso en el lateral cuando tienes a alguien al lado. Alcance de 5 a 100 m (20 m por defecto). Un
coche que te acaba de pasar conserva su lado unos segundos aunque iRacing ya no lo diga. Se oculta
solo cuando no hay nadie cerca.

### Posiciones

<img src="docs/screenshots/clasificacion.png" alt="Posiciones" width="540">

Modo compacto (los primeros, tu entorno y los líderes de las otras clases) o completo. Columnas que
se ordenan arrastrando y se esconden solas si la ventana se estrecha: puestos ganados, iRating,
licencia, iRating en juego, hueco al de delante y al líder, última y mejor vuelta (en morado la
más rápida de la clase), boxes, última parada, stint y neumático. Cabecera con lo que queda de
sesión, tus incidentes, tu iRating en juego y tu SR proyectado; pie con las condiciones de pista
(temperatura y su tendencia, agua y lluvia, viento con un dial que apunta a tu coche, aire y goma).

Antes de la verde muestra la parrilla entera, y al acabar la sesión se queda con los resultados en
la pantalla de sesión.

### Batalla

<img src="docs/screenshots/batalla.png" alt="Batalla" width="380">

Tu rival de clase de delante y el de detrás mientras estén a menos del hueco que elijas (1,5 s por
defecto): el hueco y su tendencia, la predicción («Le alcanzas en ~4 v de 19»), la diferencia por
sector y por vuelta y el iRating en juego. Uno encima del otro o lado a lado. Por defecto, solo en
carrera. Opcionales: cabecera y pie con datos de la sesión (ver más abajo).

### Pedales

<img src="docs/screenshots/pedales.png" alt="Pedales" width="360">

Traza de acelerador, freno y embrague, barras, marcha, velocidad y volante, en el orden que quieras.
Luces de cambio con los regímenes del propio coche y un bloque «Coche» con RPM, reparto de frenada,
nivel de TC y FFB (en rojo cuando llega al 100 %). El volante puede ser una barra o un volante
minimalista, realista (GT) o de fórmula que gira los grados reales.

### Tráfico

<img src="docs/screenshots/trafico.png" alt="Tráfico" width="400">

Los coches más rápidos que te alcanzan por detrás (en cuánto tiempo y en qué sector), el tráfico
lento al que alcanzas y los peligros de delante (coches parados, muy lentos o fuera de pista). Quien
te dobla, o te adelanta con bandera azul, sale siempre, en ámbar o rojo según se acerca. Cada
coche lleva, como en el relativo, el logo de su marca, la bandera de su piloto y su bandera de
penalización (el bloque «Piloto» de su página). Se
desvanece cuando no hay nadie cerca. La cabecera (el título) admite más datos, y hay un pie
opcional.

### Avisos

<img src="docs/screenshots/avisos.png" alt="Avisos" width="400">

Una banda con lo que te afecta, lo más importante en grande y el resto al lado. Banderas (también
la negra enrollada), limitador y exceso de velocidad en el pit lane, «PON LIMITADOR» antes de
entrar, 10 y 5 vueltas para el final, grúa con cuenta atrás, motor calado, sentido contrario,
presión de aceite, daños con reparación obligatoria, «ENTRA ESTA VUELTA», combustible bajo y cada
incidente al sumarlo («+2x Pérdida de control · V5 · S3 · grava»). Cada caso se muestra u oculta
con su ojo en **Personalizar › Avisos**, agrupado (Banderas, Boxes, Durante la carrera, Motor,
Combustible), y cada aviso tiene su forma además de su color (se lee con la paleta para
daltónicos). Motor calado, presión de aceite, limitador de boxes y daños (la reparación
obligatoria) son también testigos: su fila tiene una casilla **Testigo** que enciende o apaga el
suyo en Testigos, y al revés (**Aviso** en la página de Testigos).

### Testigos

<img src="docs/screenshots/testigos.png" alt="Testigos" width="300">

Los testigos del motor como en un salpicadero, en fila o en columna: presión de aceite y de
gasolina, motor calado, reparación obligatoria y opcional (con el tiempo que falta), temperatura
del agua y del aceite y, si los activas, limitador de boxes y corte de revoluciones. Cada gravedad
tiene su color y su forma; en amarillo avisa cuando el agua o el aceite suben muy por encima de tu
media, antes de que se encienda el testigo del coche. Su página de Ajustes explica qué es cada uno y
qué hacer.

### Delta

<img src="docs/screenshots/delta.png" alt="Delta" width="400">

Barra delta frente a la referencia que elijas, con tendencia, vuelta prevista y cada sector. La
referencia puede ser tu récord personal con ese coche en ese trazado (se guarda en tu equipo y no se
pierde al cambiar de sesión), tu mejor vuelta de la sesión, tu vuelta óptima por sectores, la mejor
de tu clase o la óptima de tu clase, y puede ser distinta en práctica, clasificación y carrera. Solo
cuentan las vueltas limpias, y la referencia solo cambia al empezar una vuelta. Opcional: una fila
con tu última, tu mejor, tu óptima y tu récord.

### Combustible

<img src="docs/screenshots/combustible.png" alt="Combustible" width="320">

Más dibujo que texto: las vueltas que te da el combustible en grande (en verde si llegas a meta),
los litros y las vueltas que quedan; el depósito marcado en vueltas, con una raya donde llega lo que
necesitas; el consumo con una línea de tus últimas vueltas limpias (media, última y la que más
gastó); lo que hay que echar junto a una barra del menú de boxes; la carrera como una línea con tu
posición, la ventana de parada («V17–V33») y las paradas («1 parada»); el ahorro por vuelta que te
quita una parada, como una barra con el recorte; el coche visto desde arriba con el desgaste de cada
neumático en tres franjas (de verde a rojo, o de azul a naranja con la paleta para daltónicos,
medido en tu última parada) y los juegos que quedan; y las reparaciones rápidas si la sesión las
limita. Solo mide vueltas limpias, y el plan no cambia dentro de la vuelta. Por defecto, en práctica
(donde se mide el consumo) y en carrera. Opcionales: cabecera y pie con datos de la sesión.

## Ajustes y personalización

La primera vez, OverLap abre los Ajustes, en el idioma de Windows (español o, si no, inglés), con
una **bienvenida** de tres pasos: idioma y unidades, qué widgets usar (seis marcados de inicio, al
menos uno) y dónde está todo, con **Probar con datos de ejemplo** para ver los widgets en tu
pantalla y colocarlos. Windows avisa de que OverLap queda en la bandeja.

![Ajustes: página del Relativo](docs/screenshots/ajustes-relativo.png)

Se abren desde la bandeja (**Ajustes…**), volviendo a abrir el `.exe` o arrancándolo con
`--settings` (útil para un acceso directo). Todo se aplica **en vivo** y se guarda solo; arriba de
cada página hay una vista previa del widget sobre un fondo de circuito de noche o de día; al bajar
por las opciones se pliega en una franja (o queda fija, o siempre en franja: **Al bajar**, en su
pie). Con la ventana ancha (desde 1100 px) las opciones van a dos columnas: «Personalizar» a la
derecha. Lo que cambias se ve en la vista previa; si no se ve, la opción dice por qué con una
nota corta: **No cabe a 540 px** (el ancho del widget no deja sitio para esa columna o ese dato:
ensánchalo u oculta otro). Una lista que va dentro de un bloque oculto (los datos del coche
en Pedales, los tiempos de vuelta en Delta) lo dice debajo, y al mostrar uno de sus elementos se
muestra también el bloque.
Arriba de la barra lateral, **Buscar ajuste** encuentra cualquier ajuste por sus palabras y te
lleva a él (abre su sección y lo señala); lo que ahora oculta otro ajuste sale marcado «con otro
ajuste». La barra lateral agrupa los widgets en **Pista y rivales**, **Tu vuelta** y **Estado del
coche**, igual que la bandeja. El ojo de cada uno lo muestra u oculta; tenue y con un círculo
discontinuo, está activado pero no se ve ahora: una regla lo oculta o has ocultado el overlay (el
ratón encima dice por qué). En una ventana estrecha (menos de 640 px) la barra lateral se queda
en una columna de iconos, con el ojo de cada widget al lado y su nombre al pasar el ratón, y el
buscador, el chip de estado y **Modo edición** van arriba. El **chip de
estado** de arriba dice qué está oculto y por qué; con un clic abre un panel con qué hacer,
**Copiar diagnóstico** (para un informe de error, sin nombres) y **Abrir registro**.

- **Por widget**: visible, bloqueado, fondo (el global de Apariencia o una opacidad propia; solo el
  panel: el texto sigue nítido y, con poca opacidad, lleva contorno), escala (la misma fila y los
  mismos botones 80/100/125/150 % en los diez; en Relativo, Radar y Delta cambia el tamaño de su
  ventana, como la rueda en modo edición), alto automático o fijo, en qué sesiones se muestra, ocultar en boxes (salvo Avisos, que avisa del limitador y de la
  entrada a boxes).
- **Restablecer y deshacer**: arriba de cada página (los widgets, Apariencia y Atajos),
  **Restablecer…** dice qué devuelve a fábrica, sección por sección (en un widget: Contenido,
  Piloto, Personalizar, Ventana y visibilidad, Posición y tamaño, o todo), y cada sección tiene su
  icono ↺ en la cabecera, que restablece solo esa sección. Es un solo clic: un aviso abajo dice qué
  se ha restablecido (y en qué disposición, si tienes varias) con **Deshacer** (o `Ctrl+Z`)
  durante unos segundos. Lo mismo al restablecer una lista o un atajo, al usar «Global» en todos
  los widgets, al ocultar un widget y al eliminar una disposición. Solo borrar récords personales
  pide un segundo clic: eso no se puede deshacer.
- **Personalizar**: en la página de cada widget, editores para ordenar (arrastrando o con ↑ ↓) y
  mostrar u ocultar cada parte: columnas, cabecera, segunda línea, pie, filas, grupos, avisos…
  Una regla para todas las páginas: **Contenido** es el comportamiento (cuántos, cuánto tiempo,
  umbrales, modos) y **Personalizar** lo que se ve (cada lista con su ojo y, con ella, cómo se
  ven sus elementos; la opción de un elemento, en su fila).
- **Cabecera y pie**: Relativo, Posiciones, Combustible, Tráfico y Batalla tienen los mismos:
  un selector «No / Pequeña / Normal / Grande» y las cajas Izquierda y Derecha con los datos que
  quieras del mismo catálogo (con **+ Añadir dato**, a la izquierda o a la derecha: título, sesión, tiempo restante, hora, SoF, coches, incidentes,
  iRating en juego, SR proyectado, vuelta rápida de clase, vueltas de combustible, pista, agua,
  viento, aire, goma; Combustible no ofrece sus propias vueltas de combustible, que ya dice). Por
  defecto siguen una regla: a la izquierda de la cabecera el título y la sesión, a la derecha tus
  incidentes y el reloj; a la izquierda del pie las condiciones, a la derecha los coches y el
  combustible; y los datos de la sesión, solo en Posiciones. **Copiar a** pasa una cabecera o un
  pie, con su tamaño, al mismo sitio de otro widget. Si no caben, se quitan enteros los menos importantes; el texto nunca se
  encoge. Delta, Pedales, Radar, Testigos y Avisos no tienen: son lecturas compactas, y una barra
  solo les añadiría altura.
- **Estilo** (arriba de Apariencia): **OverLap** (el de serie), **Como iRacing**, **Limpio** o
  **Compacto** ponen de una vez el aspecto entero (fondo, tamaño del texto, filas, licencia,
  número, nombre, logos y banderas), con **Deshacer**; el resto de Apariencia queda como **Ajuste
  fino**, y si lo tocas el estilo pasa a «Personalizado». No cambian el acento, la paleta para
  daltónicos, la etiqueta SIM, el idioma ni las unidades.
- **Apariencia**: idioma, color de acento (te marca a ti y nada más), fondo de los widgets (80 %
  por defecto, el que siguen todos salvo los que tengan uno propio), paleta para daltónicos (azul
  y naranja en lugar de verde y rojo), tamaño y contorno del texto, densidad y filas alternas,
  estilo de la licencia y del número, color del logo (color o monocromo), unidades métricas o
  imperiales (mph, °F, galones en Combustible y pies en el alcance del radar) y el bloque **Piloto** global: formato del nombre, logo de la marca (Auto, Siempre o
  Nunca), bandera del país y banderas de penalización.
- **Bloque «Piloto»**: Relativo, Posiciones, Batalla y Tráfico tienen en su página, justo después
  de Contenido, las mismas cuatro filas (formato de nombre, logo de la marca, bandera del país,
  banderas de penalización), cada una con «Global (…)», lo de Apariencia, o un valor propio.
- **Récords personales**: la lista por coche y trazado, con borrar uno, el actual o todos.

## Modo edición

Entra con `Ctrl+Shift+E`, desde la bandeja o con el botón **Modo edición** de los Ajustes. En la
página de un widget, **Editar posición** (junto a «Visible») entra y señala ese widget sobre el
juego.

- Arrastra un widget para moverlo y usa sus bordes y esquinas para cambiar su tamaño; la rueda del
  ratón lo escala. Se pega a los bordes de los demás widgets y de la pantalla (con `Alt` o `Shift`
  pulsado, no).
- Arrástralo fuera de su pantalla para llevarlo a otra. Si desconectas un monitor, **Traer todos
  los widgets a esta pantalla** (en la bandeja, a la pantalla del ratón, o en **Disposiciones ›
  Pantallas**, a la de los Ajustes) los recupera de una vez. Durante un minuto se deshace desde
  cualquiera de los dos sitios (**Deshacer: …** en la bandeja).
- La etiqueta de cada widget tiene un **ojo** (mostrar u ocultar), un **candado** (bloquear) y un
  **⚙** que abre su página en los Ajustes. Un widget oculto se ve como un hueco discontinuo para
  poder recuperarlo.
- Sal con `Esc`, con el mismo atajo o desde la bandeja. Salir en mitad de un arrastre lo cancela.
- Con iRacing delante y tú en el coche, el simulador oculta el cursor: abre los Ajustes desde la
  bandeja o pulsa `Alt+Tab` para recuperarlo. Lo más cómodo es colocar los widgets en el garaje o en
  los menús.
- Para que la rueda funcione sobre un widget, Windows necesita _Configuración > Bluetooth y
  dispositivos > Mouse > Desplazar ventanas inactivas al mantener el puntero sobre ellas_.

Posición, tamaño y visibilidad se guardan solos. Fuera del modo edición los widgets dejan pasar
todos los clics al juego.

## Disposiciones

![Ajustes: Disposiciones](docs/screenshots/ajustes-disposiciones.png)

Una disposición guarda, con un nombre, dónde está cada widget (en cada pantalla), su tamaño, su
escala, si se ve y si está bloqueado, y también las opciones de cada widget: columnas y su orden,
elementos, barras de información, referencias del delta, estilo del volante, opacidad, en qué
sesiones se ve… Una para el Mazda, otra para el GT3. La apariencia (idioma, unidades, color,
tamaño del texto…), cuándo se ve el overlay y los atajos son siempre los mismos.

- Cada disposición es **Posición y opciones** (de serie) o **Solo posición**: esta solo mueve los
  widgets y usa las **opciones comunes**, compartidas por todas las de solo posición. Lo eliges al
  guardarla o importarla, y lo cambias luego con **Editar**.
- En **Ajustes > Disposiciones** guardas la actual con un nombre y aplicas, editas, duplicas,
  ordenas, exportas a un `.json` (con sus opciones), importas o eliminas.
- **La que está en uso se actualiza sola** al mover, redimensionar, ocultar o bloquear un widget y
  al cambiar sus opciones. En la página de cada widget, bajo la vista previa, pone dónde se guarda
  lo que cambias (**Guardando en:** la disposición, u **Opciones comunes**), con **Copiar estas
  opciones a todas** para llevar las opciones de ese widget a todas las disposiciones.
- Se cambia desde la bandeja (submenú **Disposición**), desde los Ajustes o con el atajo
  **Siguiente disposición**.
- **Ejemplos**: **Ligera** (Relativo con 2 coches delante y 2 detrás, Radar, Delta, Combustible y
  Avisos) y **Completa** (los diez widgets) se añaden a la lista con tus widgets donde están, sin
  aplicarse; con **Siguiente disposición** alternas entre menos y más información en carrera.
- **Según el coche** (desactivado de serie): vincula una disposición al coche en el que estás, a
  uno reciente o a uno de tus récords, y se aplica sola al subirte a ese modelo; vincular un coche
  lo activa (con **Deshacer**, en la página o en la bandeja, que también vuelve a la disposición
  que tenías). Estando en un coche sin disposición, la página y la bandeja ofrecen **Vincular a
  «…»**, y al guardar una nueva puedes vincularla a tu coche (marcado de inicio solo si **Según el
  coche** ya está activado). Cada disposición muestra sus coches como
  etiquetas. Un coche sin vínculo se queda con la última que usaste.

## Atajos de teclado

Son globales: funcionan con iRacing en primer plano. Cada acción puede tener **hasta tres atajos a
la vez**, cada uno una combinación de teclas o un botón del volante, la button box, los pedales o
el cambio (ver [Botones del volante](#botones-del-volante)): por ejemplo `Ctrl+Shift+H` y el
botón 24 del G29, o un botón en cada volante. Cualquiera de ellos ejecuta la acción.

| Atajo (por defecto) | Acción                                                      |
| ------------------- | ----------------------------------------------------------- |
| `Ctrl+Shift+H`      | Mostrar u ocultar todo el overlay de golpe                  |
| `Ctrl+Shift+E`      | Entrar o salir del modo edición                             |
| `Ctrl+Shift+O`      | Abrir los Ajustes (o traerlos al frente)                    |
| (sin asignar)       | Siguiente disposición                                       |
| (sin asignar)       | Cambiar la referencia del delta                             |
| `Esc`               | Salir del modo edición (solo mientras editas; no se cambia) |
| (sin asignar)       | **Más acciones**: mostrar u ocultar cada widget, uno a uno  |

- **Más acciones**, plegado bajo la tabla, tiene una fila por widget («Mostrar u ocultar
  Relativo»…): lo mismo que su ojo en la barra lateral o su casilla en la bandeja (que muestra el
  atajo junto al widget). Ninguna tiene atajo de serie; se despliega solo si alguna lo tiene. Para
  quitar o poner un widget en carrera sin cambiar de disposición; el aviso sobre el juego dice
  «Oculto: Posiciones» o «Visible: Posiciones».
- Ocultar el overlay no detiene la telemetría: al mostrarlo vuelve con los datos al día. Al abrir
  la app, el overlay siempre está visible.
- Se cambian en **Ajustes > Atajos**, una tabla con una fila por acción y una columna por atajo
  (**Atajo 1 · principal**, **Atajo 2**, **Atajo 3**), como la pantalla de controles de un juego.
  Cada casilla es el control: un clic en una casilla con atajo lo cambia por otro, y su **×** (al
  pasar el ratón) o `Supr` lo quitan; la primera casilla libre dice **+ Asignar** y espera una
  combinación o un botón del volante. Al quitar uno, los de la derecha se corren a la izquierda (el
  primero es el que lee la versión 2.1). Sin ninguno, la acción queda desactivada. El icono ↺ de la
  derecha la deja solo con el de fábrica. Mientras grabas, `Esc` cancela y `Retroceso` o `Supr`
  quitan el atajo que estás cambiando.
- Los avisos van en la casilla a la que se refieren (**Desconectado**, **En uso por otra app**), y
  una frase que haga falta (un atajo rechazado, el aviso de `AltGr`) sale debajo de esa misma
  columna.
- Al usarlo (también `Esc` al salir del modo edición), un aviso breve arriba de la pantalla
  donde están tus widgets dice qué ha hecho, o por qué no se ve nada (por ejemplo, «Solo hay una
  disposición»); también confirma **Traer todos…** y **Vincular…** de la bandeja. Se apaga en
  **Confirmar sobre el juego**. La fila de la acción dice «Pulsado hace 3 s», para probarlo desde
  el juego, y si un atajo no se puede
  registrar, la bandeja lo dice bajo el estado.
- Un mismo atajo no puede estar en dos acciones (ni dos veces en la misma): la página dice quién
  lo tiene ya.
- **Una combinación asignada deja de llegar a los demás programas, iRacing incluido**, mientras
  OverLap está abierto: no elijas una que uses en el simulador. Si otra aplicación ya la tiene, la
  página lo dice.
- Necesitan `Ctrl` o `Alt`, salvo `F13`–`F24`, que envían muchas button box y teclados de macros.
  `Ctrl+Alt` equivale a `AltGr` en un teclado español: se permite, pero avisa de que puede impedir
  escribir `@`, `#` o `€`.

### Botones del volante

- En **Ajustes > Atajos**, pulsa **+ Asignar** (o el atajo que quieras cambiar) y luego el botón:
  vale cualquier botón de un volante o su aro, una button box, unos pedales, un cambio o un freno
  de mano que Windows vea como mando de juego, también los de más de 32 botones. Se ve como «Botón
  12 · G29 Driving Force Racing Wheel».
- **Solo se leen**: el botón se comparte con iRacing y no se bloquea nada, así que **iRacing
  también recibe la pulsación**. Elige uno que no tengas asignado en iRacing.
- Mantenerlo pulsado cuenta como una sola pulsación.
- Las crucetas (D-pad) y los hats no se pueden asignar: solo los botones.
- Si la página pide **pulsar el botón otra vez**, es que acaba de empezar a leer ese mando y no
  sabe qué botones estaban ya abajo (un selector giratorio o un interruptor fijo); la segunda
  pulsación es la que se guarda.
- Si el dispositivo está desenchufado, el atajo sigue guardado y su casilla dice **Desconectado**
  (los otros atajos de la acción siguen funcionando); al enchufarlo vuelve a funcionar solo.
- Dos dispositivos idénticos (mismo modelo) comparten los botones: cualquiera de los dos sirve.
- `Esc` para salir del modo edición sigue siendo solo de teclado.
- Los botones solo se leen mientras algún atajo es un botón (o mientras eliges uno): sin ninguno,
  OverLap no lee los mandos.
- Si vuelves a la versión 2.1.1, cada acción conserva solo su primer atajo (los demás se pierden al
  guardar), y si era un botón vuelve a su combinación de fábrica.

## Cuándo se ve el overlay

En **Ajustes > Visibilidad**:

- **Cuándo mostrar el overlay**: solo cuando estás en el coche (por defecto), solo en carrera o
  siempre. Fuera del coche solo se queda Posiciones en la pantalla de sesión, con los resultados.
- **Repeticiones**: ocultas por defecto; con «Seguir al coche en cámara», los widgets siguen al coche
  que miras.
- Se ocultan también con la interfaz de iRacing oculta, en el garaje y en la pantalla de sesión
  (cada widget puede tener su excepción).
- Cada widget tiene además sus propias reglas: en qué sesiones se muestra y si se oculta en boxes.
  Debajo, la tabla **Dónde se ve cada widget** las reúne todas (visible, práctica, clasificación,
  carrera, ocultar en boxes, pantalla de sesión y bloqueado), una fila por widget: cada casilla es
  el mismo ajuste, con el mismo sentido, que en su página (la columna Visible es el ojo de la barra
  lateral), y su nombre lleva a ella.
- El modo edición siempre enseña todos los widgets, con el motivo si alguno está oculto.

Para OBS, usa la captura de ventana «Pantalla N · OverLap» (trae todos los widgets de esa pantalla)
o la captura de pantalla.

## Privacidad y anti-cheat

- OverLap **solo lee** el mapa de memoria compartida del SDK oficial de iRacing, en modo solo
  lectura, igual que cualquier herramienta de telemetría. **No inyecta nada** en el proceso del juego
  (iRacing usa EasyAntiCheat) ni escribe en esa memoria.
- Los widgets son ventanas propias, transparentes, que no cogen el foco ni envían nada al juego. Los
  atajos usan el registro de teclas de Windows: no hay ganchos de teclado. Los botones del volante
  se leen con Raw Input de Windows, como SimHub o Crew Chief: compartidos con iRacing, sin
  bloquear ni abrir el dispositivo, sin ganchos y sin enviarle nada.
- **Sin red**: no se conecta a internet, no tiene cuentas ni envía datos a ningún sitio. Tus ajustes
  y récords se quedan en tu equipo.
- No activa la grabación de telemetría `.ibt` de iRacing.

Los detalles técnicos están en las [notas de desarrollo](docs/README.dev.md#anti-cheat).

## Problemas conocidos

- El `.exe` no está firmado: Windows SmartScreen avisa al abrirlo (ver [Instalación](#instalación)).
- El portable se descomprime en una carpeta temporal en cada arranque, así que tarda unos segundos
  en abrirse.
- Si alguna ventana se ve con fondo negro en lugar de transparente, puede ser la aceleración por
  hardware de la tarjeta gráfica.
- Los nombres con letras que no existen en Windows-1252 (cirílico, chino…) ya llegan de iRacing como
  `?`: se muestran con el nombre del equipo o como «Piloto #7».
- Lo pendiente de confirmar en una sesión real está en el [registro de cambios](CHANGELOG.md).

## Licencia y créditos

© 2026 Jesús Molano. Todos los derechos reservados. OverLap no es software libre: consulta las
condiciones en [LICENSE](LICENSE).

OverLap usa componentes de terceros (como [irsdk-node](https://github.com/bengsfort/irsdk-node)
para leer el SDK de iRacing y las banderas de
[country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons)), cada uno con su propia
licencia; los avisos de terceros están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
[irDashies](https://github.com/tariknz/irdashies) sirvió de referencia para la convención de signo
del relativo.

Los cambios de cada versión están en el [registro de cambios](CHANGELOG.md). Para compilar OverLap o
ver cómo funciona por dentro, lee las [notas de desarrollo](docs/README.dev.md).
