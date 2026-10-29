# OverLap

Overlay para iRacing en Windows. OverLap lee la telemetría oficial del simulador y dibuja diez
widgets encima del juego: relativo, radar, clasificación, batalla, pedales, tráfico, avisos,
testigos, delta y combustible. Cada uno se coloca, se escala y se personaliza a tu gusto, y puedes
guardar una disposición distinta para cada coche.

- Solo **lee** los datos del SDK de iRacing: no inyecta nada en el juego ni usa la red (ver
  [Privacidad y anti-cheat](#privacidad-y-anti-cheat)).
- Los widgets van en ventanas transparentes, siempre encima, que nunca cogen el foco y dejan pasar
  los clics al juego.
- En español (por defecto) o en inglés.

![Relativo, delta, radar, testigos y clasificación de OverLap](docs/screenshots/overlap.png)

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

1. Descarga `OverLap-2.1.1-portable.exe` de la última release en GitHub.
2. Ábrelo. No se instala nada: es un ejecutable portable que puedes dejar donde quieras.
3. El `.exe` no está firmado, así que **Windows SmartScreen** avisará la primera vez. Pulsa **Más
   información → Ejecutar de todas formas**.

OverLap se queda en la **bandeja del sistema** (junto al reloj). Desde su icono abres los
**Ajustes…**, muestras u ocultas cada widget, cambias el alcance del radar, cuándo se ve el overlay y
la disposición en uso, entras en modo edición, abres la carpeta de ajustes o sales. Volver a abrir
el `.exe` con OverLap ya en marcha abre los Ajustes.

Si iRacing no está abierto, Relativo y Clasificación muestran «Esperando a iRacing…» unos segundos y
se ocultan; OverLap se conecta solo en cuanto arranca el simulador.

Los ajustes se guardan en `%APPDATA%\iracing-overlay\` (**Ajustes > Abrir carpeta de ajustes**).

## Widgets

Cada widget tiene su página en los Ajustes, con una vista previa en vivo y sus opciones. Todos se
pueden mostrar u ocultar, bloquear, escalar y limitar a ciertas sesiones (práctica, clasificación,
carrera).

### Relativo

<img src="docs/screenshots/relativo.png" alt="Relativo" width="460">

Los coches que tienes delante y detrás en pista (3 y 3 por defecto, hasta 10) con el hueco en
segundos: positivo delante, negativo detrás. Cada fila lleva posición en clase, número con el color
de su clase, marca, bandera del país, nombre, licencia e iRating. En rojo quien te va a doblar, en
azul los doblados y atenuados los que están en boxes. En la cabecera, tus incidentes y el próximo
límite de la sesión («3x · DQ a 17x»).

Opcionales: columnas de neumático y de vueltas del stint, banderas de penalización tras el nombre,
cabeceras de columna y una barra de datos arriba y abajo (sesión, tiempo restante, SoF, iRating y
SR proyectados, condiciones de pista…).

### Radar

<img src="docs/screenshots/radar.png" alt="Radar" width="213">

Vista cenital con los coches a escala alrededor del tuyo, que pasan a rojo según se acercan, y un
aviso en el lateral cuando tienes a alguien al lado. Alcance de 5 a 100 m (20 m por defecto). Un
coche que te acaba de pasar conserva su lado unos segundos aunque iRacing ya no lo diga. Se oculta
solo cuando no hay nadie cerca.

### Clasificación

<img src="docs/screenshots/clasificacion.png" alt="Clasificación" width="540">

Modo compacto (los primeros, tu entorno y los líderes de las otras clases) o completo. Columnas que
se ordenan arrastrando y se esconden solas si la ventana se estrecha: puestos ganados, iRating,
licencia, Δ iRating, hueco al de delante y al líder, última y mejor vuelta (en morado la más rápida
de la clase), boxes, última parada, stint y neumático. Cabecera con lo que queda de sesión, tus
incidentes y tu iRating y SR proyectados; pie con las condiciones de pista (temperatura y su
tendencia, agua y lluvia, viento con un dial que apunta a tu coche, aire y goma).

Antes de la verde muestra la parrilla entera, y al acabar la sesión se queda con los resultados en
la pantalla de sesión.

### Batalla

<img src="docs/screenshots/batalla.png" alt="Batalla" width="380">

Tu rival de clase de delante y el de detrás mientras estén a menos del hueco que elijas (1,5 s por
defecto): el hueco y su tendencia, la predicción («Le alcanzas en ~4 v de 19»), la diferencia por
sector y por vuelta y el iRating en juego. Uno encima del otro o lado a lado. Por defecto, solo en
carrera.

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
te dobla, o te adelanta con bandera azul, sale siempre, en ámbar o rojo según se acerca. Se
desvanece cuando no hay nadie cerca.

### Avisos

<img src="docs/screenshots/avisos.png" alt="Avisos" width="400">

Una banda con lo que te afecta, lo más importante en grande y el resto al lado. Banderas (también
la negra enrollada), limitador y exceso de velocidad en el pit lane, «PON LIMITADOR» antes de
entrar, 10 y 5 vueltas para el final, grúa con cuenta atrás, motor calado, sentido contrario,
presión de aceite, daños con reparación obligatoria, «ENTRA ESTA VUELTA», combustible bajo y cada
incidente al sumarlo («+2x Pérdida de control · V5 · S3 · grava»). Cada caso se activa por
separado, y cada aviso tiene su forma además de su color (se lee con la paleta para daltónicos).

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

Litros y vueltas que te dan (en verde si llegas a meta), vueltas que quedan, el depósito con la
marca de lo que necesitas, consumo (media, última y máximo), lo que falta para meta y lo que hay que
echar junto a lo que tienes en el menú de boxes, la ventana de parada («V17–V33»), el ahorro por
vuelta que te quita una parada, la última lectura de neumáticos y las reparaciones rápidas y juegos
que quedan si la sesión los limita. Solo mide vueltas limpias, y el plan no cambia dentro de la
vuelta. Por defecto, solo en carrera.

## Ajustes y personalización

![Ajustes: página del Relativo](docs/screenshots/ajustes-relativo.png)

Se abren desde la bandeja (**Ajustes…**), volviendo a abrir el `.exe` o arrancándolo con
`--settings` (útil para un acceso directo). Todo se aplica **en vivo** y se guarda solo; arriba de
cada página hay una vista previa del widget sobre un fondo de circuito de noche o de día.

- **Por widget**: visible, bloqueado, opacidad del fondo (solo el panel: el texto sigue nítido y,
  con poca opacidad, lleva contorno), escala, alto automático o fijo, en qué sesiones se muestra,
  ocultar en boxes y restablecer posición u opciones.
- **Personalizar**: en la página de cada widget, editores para ordenar (arrastrando o con ↑ ↓) y
  mostrar u ocultar cada parte: columnas, cabecera, segunda línea, pie, filas, grupos…
- **Apariencia**: idioma, color de acento (te marca a ti y nada más), paleta para daltónicos (azul
  y naranja en lugar de verde y rojo), tamaño y contorno del texto, densidad y filas alternas,
  formato del nombre, estilo de la licencia y del número, logos de marca en color o monocromo y
  unidades métricas o imperiales.
- **Récords personales**: la lista por coche y trazado, con borrar uno, el actual o todos.

## Modo edición

Entra con `Ctrl+Shift+E`, desde la bandeja o con el botón **Modo edición** de los Ajustes.

- Arrastra un widget para moverlo y usa sus bordes y esquinas para cambiar su tamaño; la rueda del
  ratón lo escala. Se pega a los bordes de los demás widgets y de la pantalla (con `Alt` o `Shift`
  pulsado, no).
- Arrástralo fuera de su pantalla para llevarlo a otra.
- La etiqueta de cada widget tiene un **ojo** (mostrar u ocultar) y un **candado** (bloquear). Un
  widget oculto se ve como un hueco discontinuo para poder recuperarlo.
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
- **Según el coche** (desactivado de serie): vincula una disposición al coche en el que estás o a
  uno reciente, y se aplica sola al subirte a ese modelo. Un coche sin vínculo se queda con la
  última que usaste.

## Atajos de teclado

Son globales: funcionan con iRacing en primer plano. Cada acción puede ir en una combinación de
teclas o en un botón del volante, la button box, los pedales o el cambio (ver
[Botones del volante](#botones-del-volante)).

| Atajo (por defecto) | Acción                                                      |
| ------------------- | ----------------------------------------------------------- |
| `Ctrl+Shift+H`      | Mostrar u ocultar todo el overlay de golpe                  |
| `Ctrl+Shift+E`      | Entrar o salir del modo edición                             |
| `Ctrl+Shift+O`      | Abrir los Ajustes (o traerlos al frente)                    |
| (sin asignar)       | Siguiente disposición                                       |
| (sin asignar)       | Cambiar la referencia del delta                             |
| `Esc`               | Salir del modo edición (solo mientras editas; no se cambia) |

- Ocultar el overlay no detiene la telemetría: al mostrarlo vuelve con los datos al día. Al abrir
  la app, el overlay siempre está visible.
- Se cambian en **Ajustes > Atajos**: pulsa **Cambiar** y luego la combinación (o un botón del
  volante). También se pueden desactivar o restablecer.
- **Una combinación asignada deja de llegar a los demás programas, iRacing incluido**, mientras
  OverLap está abierto: no elijas una que uses en el simulador. Si otra aplicación ya la tiene, la
  página lo dice.
- Necesitan `Ctrl` o `Alt`, salvo `F13`–`F24`, que envían muchas button box y teclados de macros.
  `Ctrl+Alt` equivale a `AltGr` en un teclado español: se permite, pero avisa de que puede impedir
  escribir `@`, `#` o `€`.

### Botones del volante

- En **Ajustes > Atajos**, pulsa **Cambiar** y luego el botón: vale cualquier botón de un volante
  o su aro, una button box, unos pedales, un cambio o un freno de mano que Windows vea como mando
  de juego, también los de más de 32 botones. Se ve como «Botón 12 · G29 Driving Force Racing
  Wheel».
- **Solo se leen**: el botón se comparte con iRacing y no se bloquea nada, así que **iRacing
  también recibe la pulsación**. Elige uno que no tengas asignado en iRacing.
- Mantenerlo pulsado cuenta como una sola pulsación.
- Si el dispositivo está desenchufado, el atajo sigue guardado y la página dice **Desconectado**;
  al enchufarlo vuelve a funcionar solo.
- Dos dispositivos idénticos (mismo modelo) comparten los botones: cualquiera de los dos sirve.
- `Esc` para salir del modo edición sigue siendo solo de teclado.
- Los botones solo se leen mientras algún atajo es un botón (o mientras eliges uno): sin ninguno,
  OverLap no lee los mandos.

## Cuándo se ve el overlay

En **Ajustes > Apariencia > Visibilidad**:

- **Mostrar el overlay**: solo cuando estás en el coche (por defecto), solo en carrera o siempre.
  Fuera del coche solo se queda la Clasificación en la pantalla de sesión, con los resultados.
- **Repeticiones**: ocultas por defecto; con «Seguir al coche en cámara», los widgets siguen al coche
  que miras.
- Se ocultan también con la interfaz de iRacing oculta, en el garaje y en la pantalla de sesión
  (cada widget puede tener su excepción).
- Cada widget tiene además sus propias reglas: en qué sesiones se muestra y si se oculta en boxes.
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
