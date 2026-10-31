# Registro de cambios

Aquí se apuntan todos los cambios importantes de OverLap.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- **Acerca de y ayuda › Licencia**: un bloque nuevo al final de la página con el copyright, que
  OverLap es software libre bajo la GNU GPL versión 3 o posterior y que se ofrece sin ninguna
  garantía. Sus botones abren en el navegador el código fuente, la licencia y los avisos de
  terceros. También dice que los logos en color de las marcas son de sus dueños y no están bajo la
  GPL, y que el monocromo usa Simple Icons (CC0) en 18 marcas y dibuja las demás en grises a partir
  de los de color; se elige en Apariencia › Filas y pilotos › Color del logo.
- **Documentación del proyecto abierto**: el README empieza con un resumen en inglés y suma
  «Compilar desde el código», «Code signing policy» (los `.exe` aún no se firman) y «Apoyar
  OverLap». Nuevos [PRIVACY.md](PRIVACY.md) (OverLap no usa la red; el futuro actualizador se podrá
  desactivar), [CONTRIBUTING.md](CONTRIBUTING.md) (con DCO, sin CLA) y [SECURITY.md](SECURITY.md),
  plantillas de issues y de pull requests, y una CI con las cinco comprobaciones en Windows.

### Cambiado

- **Delta: con dos referencias o más, una fila igual para cada una**: al ver más de una referencia
  (las **Filas por referencia**, antes «Barras por referencia», y la que usa el delta), el delta ya
  no muestra un número grande con barras pequeñas debajo. Cada referencia tiene la misma fila: su
  nombre, su delta con ▼/▲, su tendencia (ahora una por referencia) y su barra, todas a la misma
  escala (verde a la izquierda: más rápido) y en el orden de tu lista, use el delta la que use. La
  línea de arriba nombra la referencia que usa el delta, con su tiempo y la vuelta prevista; los
  sectores van con ella. Si la línea de arriba no se ve, los sectores empiezan con el nombre corto
  de esa referencia, y en una ventana estrecha la línea la nombra igual que su fila («ÓPT.»). Una
  vuelta inválida, la de salida o la grúa se dicen siempre en esa línea, aunque hayas ocultado sus
  partes. Con una sola referencia (lo de serie) el delta es el de siempre, igual que en 2.4,
  también al pasar el ratón por la vista previa de Ajustes. Al encender filas desde la página de
  Delta la ventana crece lo justo para no achicar el texto (también si una sesión usa una
  referencia que no está en la lista, o si vuelves a mostrar una parte de la línea de arriba); en
  una ventana más baja se van primero las filas del final (nunca la de la referencia en uso, y la
  página dice «No cabe»), luego la línea de arriba, y con una sola fila vuelve el delta de siempre.
  Si en plena sesión el atajo o la referencia de reserva traen una que no está en la lista, su fila
  ocupa el sitio de la última en vez de añadir otra, así que el texto no cambia de tamaño. Tus
  ajustes se cargan igual; si ya tenías las barras encendidas, verás filas en lugar de barras
  finas.
- **OverLap pasa a ser software libre** bajo la GPL-3.0-or-later: `LICENSE` es ahora el texto de la
  GPL, y `package.json`, las propiedades del `.exe`, el README y las notas de desarrollo lo dicen.
- **Avisos de terceros**: se añade Vue (iba dentro de la app y no salía), irating-rs tiene ya su
  licencia (MIT o Apache-2.0) y la sección de logos explica de dónde sale cada uno y que los de color
  no están bajo la GPL. Se añade la nota de marca del nombre OverLap y del icono «OL» (GPL §7(e)).

## [2.4.0] - 2026-10-31

### Añadido

- **Spotter, un widget nuevo (el undécimo)**: dos barras, una a cada lado, como las de iOverlay,
  aparte del radar (cada uno con su página y su visibilidad: puedes tener uno, otro o los dos).
  **Estilo de barra** elige qué cuentan. **Cercanía** (de serie): el radar en dos barras; cada una
  se llena desde abajo cuanto más cerca está el coche de ese lado (llena a tu lado, vacía a unos
  12 m delante o detrás), del ámbar al rojo, y llena también se marca con el borde rojo. **Dónde
  te cubre**: cada barra es tu coche, de morro (arriba) a cola (abajo), y se llena con lo que te
  cubre el coche de ese lado, desde el extremo en el que va, del gris al rojo, con un tope tenue
  para el que acaba de estar a tu lado y va justo delante o detrás. En los dos, un «2» con dos
  coches en un lado. El lado lo da el spotter de iRacing (solo cuando el coche ya está a tu
  altura) y el cuánto la distancia a lo largo de la pista (también al cruzar la línea de meta),
  con el mismo cálculo que el radar, que sigue funcionando con el radar oculto. iRacing no da la
  distancia lateral: llena no quiere decir golpe. El ancho de la ventana es la separación entre
  las barras; en Contenido, **Estilo de barra**, **Solo con un coche al lado** (de serie) y
  **Grosor de las barras**; en Personalizar, sus dos marcas. Oculto
  de serie, también al actualizar (en un hueco libre cerca de su sitio); tiene su atajo en «Más
  acciones», su casilla en la bandeja y su sitio en Visibilidad y en el buscador.
- **Delta: una barra por referencia**: una línea nueva, **Barras por referencia** (apagada de
  serie), dibuja una barra por cada referencia que elijas, con su nombre corto y su diferencia:
  tu récord, tu mejor vuelta de la sesión, tu óptima, la vuelta rápida de tu clase y la óptima de
  tu clase. Se despliega en su lista, con un ojo para cada una y en el orden que quieras (de serie,
  las tres tuyas). Todas usan la escala de la barra principal y sus colores (verde a la izquierda,
  más rápido; rojo a la derecha, más lento), la que usa el delta lleva «Δ», y cada una compara con
  su propia vuelta toda la vuelta, sin «siguiente si no existe»: la que aún no tiene vuelta marca
  «—» con la barra vacía, sin mover nada. Solo se calculan las que se ven. Al encender la línea o
  una barra desde la página de Delta, la ventana crece lo justo (como con «Completo») para que
  quepan todas sin achicar el texto; en una ventana más baja se dibujan las que caben, siempre con
  la de la referencia en uso, y la página dice «No cabe en 400 por 80 px» en las demás.
- **Batalla: el hueco como en Relativo, y cada frase de la predicción a tu gusto**: en Contenido,
  **Hueco** elige entre **Sin signo** (el hueco medido, «0.6 s», como siempre y de serie) y **Como
  Relativo** (el mismo tiempo que Relativo, tal cual lo dibuja su columna: con su signo, positivo
  delante y negativo detrás, y sin unidad; mientras Relativo no tiene tiempo para ese coche, el
  hueco medido con el signo de su carril). La línea **Predicción de alcance** se despliega en sus
  partes, cada una con su ojo: «Le alcanzas en…», «Te alcanza en…», «Necesitas… s/v» y «No le
  alcanzas · No te alcanza»;
  una frase oculta deja la línea en blanco, sin mover nada. Todo visible de serie.
- **Hora en pista en la cabecera y el pie**: un dato nuevo, **Hora en pista**, en el catálogo de
  las barras de Relativo, Posiciones, Combustible, Tráfico y Batalla: la hora del día en el
  simulador (que corre con la sesión), con el mismo formato que la hora local (24 h, «14:32») y un
  sol delante para distinguirlas (una luna de las 20:00 a las 06:00). Apagado de serie: se añade
  con **+ Añadir dato**.
- **Más coches de las otras clases en Posiciones**: en modo compacto, **Coches de otras clases**
  (de 0 a 10, con el mismo selector que «Primeros puestos» y «Alrededor de ti») sustituye al
  interruptor «Líderes de otras clases». Con 1 (lo de siempre) cada otra clase es la línea de su
  líder; con más, sus primeros coches bajo el nombre de su clase; con 0, ninguna. Al actualizar,
  el interruptor encendido pasa a 1 y el apagado a 0, también en los diseños guardados.
- **La SoF de cada clase junto a su nombre**: la línea de un líder de otra clase en modo compacto
  lleva ahora la SoF de su clase al final (las líneas de clase ya la llevaban en todas las clases).
  Sigue el ojo de «SoF» de la línea de clase: ocúltala ahí y desaparece de las dos.
- **El principio de la fila, en columnas: cada cosa donde quieras**: en Relativo y Posiciones,
  la posición, el número, el logo de la marca, la bandera del país y el nombre dejan de ser un
  bloque fijo y pasan a ser columnas de la misma lista que las demás, junto con **Banderas** (las de
  penalización, que antes iban siempre tras el nombre). Así **Puestos ganados**, **Banderas** o
  cualquier otra columna puede ir entre la posición y el número, entre el número y el logo o
  después del nombre. Relativo tiene ahora también **Puestos ganados**, la misma columna que la de
  Posiciones (el mismo nombre, título «±», ancho, triángulo y colores; solo en carrera, contados
  igual: su puesto de salida en la clase contra el de ahora), oculta de serie tras las banderas.
  Lo que queda pegado al nombre va con él, en su celda: delante, alineado de fila a fila; detrás,
  al final de su celda, también alineado. Separado por otra columna, va en una columna propia (el
  título del número es «#»). **Nombre** se ve siempre (su ayuda dice que su título de columna es
  «PILOTO»). Una regla, la misma en los cuatro widgets del bloque «Piloto»: **la lista dice
  dónde; el bloque «Piloto», si salen y cómo**. El logo, la bandera del país y las banderas no
  tienen ojo en la lista sino un enlace que lleva a su fila de «Piloto» y la señala (su fila dice
  cómo están: «Se muestra u oculta en «Piloto»: Global (Sí)»); en la vista previa se arrastran y,
  al pulsarlos, el aviso dice lo mismo y lleva a esa fila. La posición y el número, que no están
  en el bloque, tienen su ojo (en Posiciones, el de la posición sustituye a su antiguo
  interruptor). En Tráfico, las banderas siguen la misma regla en su lista de partes; Batalla, sin
  columnas, las lleva tras el nombre. Si la ventana se estrecha, el logo y la bandera del país se
  van antes que las columnas de siempre, y las banderas colocadas en otro sitio vuelven tras el
  nombre. «Igualar con Posiciones» e «Igualar con Relativo» lo llevan todo, también «Puestos
  ganados», y en la vista previa se arrastran como las demás columnas,
  las banderas tras el nombre incluidas. Al actualizar, todo se ve como antes: el principio de la
  fila delante en el orden de siempre (la posición, visible u oculta como estaba), las banderas
  tras el nombre (al final de su celda, alineadas, también si tenías encendida su columna). Una lista de columnas guardada vacía o ilegible vuelve a la de serie, como antes.
- **Relativo: la última vuelta de cada piloto**: una columna nueva, **Última vuelta**, la misma
  que la de Posiciones: el mismo nombre, el mismo formato («1:47.312»), la misma ayuda y los mismos
  colores (la vuelta rápida de su clase en la placa morada, su propio récord de la sesión en verde)
  y, fuera de carrera, su mejor vuelta. Oculta de serie (también al actualizar, tras el hueco) y se
  ordena como las demás; «Igualar con Posiciones» (y «Igualar con Relativo») la lleva con las otras
  columnas que comparten.
- **Posiciones: el orden de las clases**: en Contenido, **Orden de las clases** elige qué bloque va
  arriba con varias clases: **Tu clase primero** (como siempre y de serie: después, las más
  rápidas), **La más rápida primero** (como iRacing, la tuya en su sitio) o **A mano**, con una lista
  de las clases por su nombre corto que se ordena arrastrando o con ↑ ↓, como las columnas. La lista
  se recuerda entre sesiones (una LMP2 es la LMP2 en cualquier carrera); trae siempre las clases de
  la sesión en curso, y las que no están en ella van detrás, la más rápida primero. Tu clase guarda
  sus filas alrededor de ti vaya donde vaya su bloque. En la vista previa, que en esta página tiene
  una tercera clase (GTP), una clase también se mueve arrastrando su línea (o la etiqueta de su
  líder en una línea) encima o debajo de otra, con la misma línea de colocar que las columnas: si
  el orden no era «A mano», pasa a serlo, el aviso lo dice y «Deshacer» devuelve los dos. La lista
  solo guarda lo que ordenas: las clases de la vista previa que quedan al final no se guardan, y
  con más de 32 clases recordadas se olvidan antes las de abajo que no están en la sesión en curso
  (nunca las de la sesión ni la que acabas de mover). Una clase es la misma escrita en mayúsculas o
  en minúsculas, también al arrastrarla.
- **El iRating, con el color de la licencia y entero si quieres**: dos filas nuevas en Apariencia ›
  Filas y pilotos, con su «Global (…)» en el bloque «Piloto» de Relativo, Posiciones, Batalla y
  Tráfico, y en el buscador. **Formato del iRating**: **2.5k** (como siempre y de serie) o el número
  entero, **2.520** (con el separador de miles del idioma: «2,520» en inglés; su ayuda aclara
  que 2.520 es 2520, no un decimal). Vale para el iRating
  de cada piloto (las columnas iR de Relativo y Posiciones y el de Batalla) y para el SoF (el de
  cada clase en Posiciones y el elemento SoF de las barras de información, en todos los widgets que
  lo tienen: los cuatro del bloque usan el suyo, Combustible el de Apariencia). **iRating con el
  color de la licencia** (apagado de serie): el iRating de cada piloto con los colores y el estilo
  de su licencia (Contorno, Suave, Sólida o Solo letra, los mismos que la píldora), así puedes
  ocultar la columna Licencia y seguir viendo su clase. El SoF no tiene licencia y sigue como
  estaba; en Tráfico, que no muestra el iRating de los pilotos, la fila está pero apagada y lo
  dice. La columna iR se ensancha lo justo para el número entero o la placa (y en Relativo la
  ventana lo cuenta como cualquier otra columna). Los estilos y «Completo» no las tocan; al
  actualizar, todo se ve como antes.

### Cambiado

- **Tus referencias, solo con vueltas legales**: además de salirte de pista, pisar el pit lane, la
  grúa, pararte o una amarilla, ahora también invalida tu vuelta una salida de pista que iRacing te
  anote (su 1x) aunque ningún instante de la telemetría la viera. Si llega en el medio segundo
  después de cruzar la línea, es de la vuelta que acabas de cerrar, no de la nueva. Un toque (0x,
  4x) o un trompo (2x) no la invalidan: iRacing también la cuenta. Esa vuelta nunca es tu mejor
  vuelta de la sesión ni entra en tu óptima ni en la de tu clase, ni se guarda como récord; si ya
  lo era por un instante, vuelve la anterior antes de que el delta la use. El aviso «vuelta
  inválida» del delta sigue esta misma regla, también la vuelta recién terminada que se muestra al
  cruzar la línea, y la columna «Mejor» de Posiciones muestra para ti tu mejor vuelta legal aunque
  iRacing cuente como mejor una de esas.

## [2.3.1] - 2026-10-30

### Corregido

- **La opción de una fila de Personalizar va debajo de su nombre**: «iRating en juego de todos» en
  Posiciones ocupaba la fila y dejaba el nombre en una columna de palabras sueltas. Ahora la opción
  de una fila (también «Medido» en Hueco) va en su propia línea, a cualquier ancho.
- **Los atajos de la barra lateral no se parten**: con «Mayús» la tecla es más larga, y la
  explicación pasa entera a la línea de abajo en vez de partirse en palabras sueltas.

## [2.3.0] - 2026-10-30

### Añadido

- **El modo edición sabe a qué widget van las flechas, y deshace**: la etiqueta del widget al que
  se aplican las flechas lleva el borde en el color de edición; `Tab` y `Mayús+Tab` pasan al widget
  siguiente o al anterior (de arriba abajo, sin los ocultos ni los bloqueados), también con el
  cursor oculto por el juego, con un aviso breve «Flechas: Relativo». `Ctrl+Z` deshace el último
  cambio del modo edición (arrastre, tamaño, rueda, flechas, ojo o candado de la etiqueta) y luego
  el anterior, y la bandeja ofrece **Deshacer: mover Relativo** (o «cambiar el tamaño de Relativo»,
  «ocultar Batalla»: lo que hiciste); mantener una flecha o girar la
  rueda cuenta como un solo cambio, y todo se olvida al salir del modo edición. Estas teclas solo
  se toman mientras editas; con los Ajustes delante, funcionan mientras no estés en un campo, un
  deslizador o una lista (ver **Cambiado**).
- **Accesibilidad, en un solo sitio**: al final de **Apariencia**, una sección **Accesibilidad**
  reúne lo que antes estaba suelto o no existía, cada opción apagada de serie (nada cambia si no la
  eliges, y **Buscar ajuste** encuentra cada una por sus palabras):
  - **Paleta para daltónicos** (pasa aquí desde «Color»): ahora también llega a **Pedales**: los
    pedales con sus colores de serie pasan a azul (acelerador) y naranja (freno), el embrague a
    gris, el ABS a blanco, y la traza del freno es más gruesa que la del acelerador, para
    distinguirlas por la forma; un color que hayas elegido se queda.
  - **Texto mínimo de 10 px**: las etiquetas más pequeñas de los diez widgets (títulos de
    columna, pies, cabeceras, chips) pasan de 9 a 10 px. Ningún widget se ensancha: donde no cabe, se
    quita antes un dato o una columna, como al estrecharlos.
  - **Sin parpadeos**: las luces de cambio de Pedales se quedan fijas en azul en vez de parpadear
    unas cinco veces por segundo al pasarte de vueltas, y tampoco parpadean el borde de **Editar
    posición** ni el punto de «Esperando a iRacing». La ayuda de **Luces de cambio** en Pedales
    dice dónde está.
  - **Tamaño de esta ventana**: amplía o reduce la ventana de Ajustes entre el 80 y el 150 %
    (también con `Ctrl` y `+` o `-`, `Ctrl+0` para volver al 100 %, o `Ctrl` y la rueda), y
    se recuerda. Solo cambia esta ventana: los widgets siguen con **Tamaño del texto**.

  Su ↺ y su línea en **Restablecer…** las vuelven a apagar; **Estilo** no las toca.

- **Modo edición más preciso**: las **flechas** mueven 1 px el último widget que has arrastrado,
  escalado, tocado en su etiqueta o señalado con **Editar posición** (con `Mayús`, 10 px), y con
  `Ctrl` cambian su ancho y su alto (el alto no, si se ajusta a su contenido); se guarda al soltar
  la tecla. Solo mientras editas: con la ventana de Ajustes delante, un campo, un deslizador o una
  lista que tenga el foco se queda las flechas, y una combinación que ya uses en Atajos sigue
  siendo tuya. Si aún no
  has tocado ninguno, un aviso sobre el juego lo dice. Al arrastrar, una **línea de ajuste** marca
  el borde de otro widget o de la pantalla al que se pega, y el widget también se pega al **centro
  de la pantalla**. El ojo y el candado de la etiqueta miden 24 × 24 px (antes 20 × 17) y los
  bordes para cambiar el tamaño, 11 px (antes 8); los widgets no cambian de tamaño. La línea de
  teclas del modo edición en los Ajustes y la ayuda sobre cada widget nombran las flechas.

- **Bienvenida en el primer arranque**: una instalación nueva abre los Ajustes con una bienvenida
  de tres pasos (idioma y unidades; qué widgets usar; dónde está todo: la bandeja, los tres atajos
  y **Probar con datos de ejemplo**, que enseña los widgets en tu pantalla en el modo edición), y
  Windows avisa una vez de que OverLap está en la bandeja. **En una instalación nueva**, todo sale
  en el idioma de Windows (español si es el tuyo; si no, inglés) y la bienvenida empieza con seis
  widgets marcados (Relativo, Posiciones, Delta, Combustible, Avisos y Pedales) en vez de los diez;
  «Siguiente» espera a que haya al menos uno y «Saltar» deja los diez. Si ya tenías ajustes, no la
  ves.
- **Buscar ajuste**: un buscador arriba de la barra lateral (y de la barra de una ventana estrecha)
  encuentra cualquier ajuste de cualquier página por sus palabras, sin importar mayúsculas ni
  tildes: controles, secciones, acordeones y cada dato de las listas («vueltas combustible» da
  «Vueltas de combustible» en el pie de Posiciones, en la cabecera de Relativo…), con su página y
  su sección debajo. Con las flechas y `Intro` o un clic, lleva a la página, abre el acordeón o la
  lista donde está, lo centra y lo señala un momento. Lee las páginas tal como se ven, en el idioma
  de la ventana, y vuelve a leerlas si cambias un ajuste; también encuentra lo que ahora oculta otro
  ajuste («Primeros puestos» con Posiciones en «Completo»), marcado «con otro ajuste»: al elegirlo,
  lleva a su sección y dice por qué no se ve.
- **Página «Visibilidad»**: junto a Apariencia, con **Cuándo se ve el overlay** (que estaba en
  Apariencia; su «Restablecer» va con ella y el de Apariencia ya no lo toca) y una tabla **Dónde se
  ve cada widget**: una fila por widget, agrupados, y columnas Visible (el mismo ojo que la barra
  lateral), Práctica, Clasificación, Carrera, Ocultar en boxes, Pantalla de sesión y Bloqueado,
  marcadas con el mismo sentido que en la página del widget. Cada casilla cambia el mismo ajuste
  que su página y el nombre del widget lleva a ella; una casilla que no se puede cambiar dice por
  qué. Con «Solo en carrera», la tabla avisa de que práctica y clasificación no se ven.
- **Traer todos los widgets a esta pantalla**: en la bandeja (a la pantalla donde está el ratón) y
  en **Disposiciones › Pantallas** (a la de la ventana de Ajustes). Los widgets de otra pantalla,
  o de una que ya no está conectada, vienen al mismo sitio relativo y con su tamaño, sin salirse;
  los que ya estaban no se mueven. La página dice cuántos ha traído y a qué pantalla (la del ratón,
  si fue desde la bandeja), y desde la bandeja también lo dice un aviso sobre esa pantalla. Durante
  un minuto se deshace desde la página o con **Deshacer: …** en la bandeja.
- **«Editar posición» en cada widget, y ⚙ en su etiqueta**: junto a «Visible», un botón entra en
  el modo edición y señala ese widget sobre el juego con un borde que parpadea tres veces (con
  movimiento reducido, fijo durante ese rato) y se va; si ya editas, lo vuelve a señalar. En el modo edición, la etiqueta de cada widget tiene, tras el ojo y el
  candado, un **⚙** que abre su página de ajustes. El aviso del modo edición en los Ajustes es una
  línea de teclas (`Arrastra` mover · `Bordes` ancho · `Rueda` escala · `Alt` sin imán · `Esc`
  salir) con un botón **Salir**, en vez de dos líneas de texto.
- **Saber si un atajo funciona**: al usar un atajo, un aviso breve arriba de la pantalla, sobre el
  juego, dice qué ha hecho («Overlay oculto», «Modo edición», «Disposición: GT3») o por qué no se
  ve nada («Overlay visible · Oculto: fuera del coche», «Solo hay una disposición», «Delta: no hay
  sesión», «Delta oculto»), en la pantalla donde están tus widgets; también al salir del modo
  edición con `Esc`. No toma el foco ni los clics, y se apaga en **Ajustes › Atajos ›
  Confirmar sobre el juego** (encendido de serie, también si ya tenías ajustes: es nuevo). En esa
  página, la fila de cada acción (y la de `Esc`) dice «Pulsado hace 3 s» al usarla y destella con
  cada pulsación, para probar un atajo desde el juego. Si un atajo no se puede registrar, la bandeja lo dice bajo el estado («1 atajo no
  funciona…», que abre Atajos) y en su texto emergente.
- **El estado, fuera de la bandeja**: el chip de estado de los Ajustes dice debajo qué está oculto
  ahora y por qué («Oculto: fuera del coche», «2 widgets ocultos ahora», «Overlay oculto») o qué
  falla («1 atajo no funciona»). Con un clic abre un panel con la línea de estado entera y qué
  hacer, qué widgets oculta una regla y por qué, los atajos que no funcionan (con «Ver Atajos») y
  los botones **Copiar diagnóstico** (versiones, estado, pantallas y atajos, sin nombres ni tu
  usuario, tampoco dentro del texto de un error) y **Abrir registro** (`overlap.log`). Si has
  ocultado tú el overlay, el panel dice «Todos: has ocultado el overlay», y los ojos de la barra
  lateral y la nota de cada página de widget dicen «overlay oculto». Si no se puede cargar el
  módulo nativo del SDK de iRacing, lo dice un aviso en todas las páginas, con los mismos botones;
  el aviso de que no se guarda también abre el registro en vez de explicar dónde está.
- **Marca central del volante con «Global (acento)»**: en Pedales, el color de la marca central
  tiene como primera opción **Global (acento)**, que sigue al color de acento de Apariencia (como
  «Global (…)» en el formato de nombre). Es la opción de serie en una instalación nueva; si ya
  tenías ajustes, la marca conserva su color (el amarillo de antes) hasta que la elijas.
- **Avisos y Testigos, enlazados**: motor calado, presión de aceite, limitador de boxes y daños
  (la reparación obligatoria: «Daños» en Avisos, «Reparación obligatoria» en Testigos) están en
  los dos widgets. En **Personalizar › Avisos**, la fila de cada uno tiene una casilla **Testigo**
  que enciende o apaga su testigo en Testigos, y en la lista de Testigos la casilla **Aviso** hace
  lo mismo con su aviso; bajo cada lista, una línea lo explica con un botón **Ir a Testigos** /
  **Ir a Avisos**. La nota de Avisos sobre temperaturas y reparaciones va en esa misma línea.
- **Unidades imperiales también en Combustible y en el radar**: con **Apariencia › Unidades ›
  Imperiales**, Combustible muestra galones (EE. UU.): lo que queda, el consumo por vuelta
  (`gal/v`), lo que hay que echar, el menú de boxes y el ahorro; el plan y las vueltas no
  cambian. El alcance del radar (en sus marcas, en su página y en la bandeja) se lee en pies; el
  ajuste se sigue guardando en metros. El aviso «COMBUSTIBLE · 1.6 V» sigue en vueltas. Cambio
  visible si ya usabas unidades imperiales: Combustible pasa de litros a galones y el radar, de
  metros a pies.
- **Disposiciones de ejemplo «Ligera» y «Completa»**: en **Disposiciones › Ejemplos**, **Añadir**
  pone al final de la lista una disposición con tus widgets donde están y sus opciones, sin
  aplicarla: «Ligera» muestra Relativo (con 2 coches delante y 2 detrás, o menos si ya tenías
  menos), Radar, Delta, Combustible y Avisos; «Completa», los diez widgets. Al añadirla, la página
  la nombra como ha quedado («Ligera (2)» si ya había una) y recuerda que alternas con el atajo
  **Siguiente disposición** (con sus teclas) o desde la bandeja; si ya no cabe, lo dice.
- **Estilos en Apariencia**: arriba, cuatro estilos con nombre, cada uno distinto a simple vista:
  **OverLap** (todo de serie: el aspecto, fondo al 80 %, filas cómodas, logos y banderas, y también
  lo que muestra cada widget de la disposición en uso: cada columna, elemento, barra y opción que
  **Completo** enciende vuelve a su valor y su orden de serie, la altura automática a la suya, y
  Relativo y Delta a su tamaño de serie, desde la misma esquina, o lo justo más si muestras más
  coches o filas más holgadas, para que el texto no encoja), **Limpio** (sin fondo: solo el texto
  sobre el juego, con su contorno siempre; sin filas alternas, logos ni banderas, número en franja y
  licencia solo letra), **Compacto** (pequeño pero legible: filas compactas, texto al 85 % sin bajar
  del texto mínimo, apellidos, número en franja y licencia solo letra, sin logos ni banderas de
  país) y **Completo** (todo a la vista en los diez widgets de la disposición en uso: cada columna y
  elemento, las barras de información con sus datos, los títulos de columna, las condiciones
  completas, cada aviso y testigo, logos siempre y fondo al 90 %; los widgets que pueden crecen en
  alto, y Relativo y Delta agrandan su ventana lo justo para que el texto no encoja). Limpio y
  Compacto solo cambian el aspecto: al dejar **Completo** por uno de ellos, la ventana de
  confirmación dice que lo que Completo añadió a los widgets se queda y ofrece, sin marcar,
  **Quitar también lo que añadió Completo** (cada widget vuelve a lo que mostraba antes; se recuerda
  en esta ventana al aplicar Completo); con OverLap se va siempre, porque vuelve todo de serie, y su
  ventana lo enumera. Se marca el que coincide con lo que tienes (OverLap, solo si el aspecto y lo
  que muestra cada widget están de serie); si ajustas algo a mano, aquí o en la página de un widget,
  dice «Personalizado». Debajo, los controles de siempre como **Ajuste fino del estilo**. Si un
  estilo va a cambiar algo que pusiste tú (un aspecto ajustado a mano, o lo que muestra cada widget
  con **Completo** y **OverLap**), o deja Completo, antes pregunta: una ventana «¿Aplicar el estilo
  …?» dice qué cambia, de antes a después («Fondo de los widgets: 80 % → 90 %», «Posiciones: se
  muestran 5 columnas más»; con OverLap, «Posiciones: se ocultan 5 columnas», «Relativo: ventana al
  tamaño de serie»), plegado si es largo, y dónde se guarda; **Aplicar** o **Cancelar** (o `Esc`).
  Si no, se aplica al momento. Todo se deshace con **Deshacer**, ventanas incluidas (y, tras
  deshacer OverLap o la casilla, vuelve la oferta de quitar lo de Completo); no tocan el acento, la
  Accesibilidad, la etiqueta SIM, el idioma, las unidades, los sitios ni qué widgets se ven. Quien
  tuviera el aspecto «Como iRacing» (ya no está) lo conserva tal cual, como «Personalizado».
- **Atajos para mostrar u ocultar cada widget**: en **Atajos**, bajo las acciones de siempre, un
  grupo plegado **Más acciones** tiene una fila por widget («Mostrar u ocultar Relativo»…), con las
  mismas tres casillas, botones del volante incluidos. Hacen lo mismo que el ojo de la barra
  lateral o la casilla de la bandeja (que muestra el atajo al lado del widget), y el aviso sobre el
  juego dice «Oculto: Relativo» o «Visible: Relativo» y, si aun así no se ve, por qué. Ninguna tiene
  atajo de serie; el grupo dice cuántas tienen y se abre solo si alguna lo tiene.
- **Página «Acerca de y ayuda»**, al pie de la barra lateral: la versión, **Guía de uso** e
  **Informar de un problema** (en el navegador), una ayuda rápida con un botón en cada pregunta
  (la página que responde, **Modo edición** o **Buscar ajuste**), **Exportar todo…** (todos los
  ajustes, con todas las disposiciones y sus opciones, y tus récords, incluso el de hace un
  segundo, en un archivo) e **Importar todo…** (pone esos ajustes al momento, con **Deshacer** aquí
  y en la bandeja mientras no cambies nada más, y suma los récords del archivo a los tuyos: gana
  la vuelta más rápida, ninguno de los tuyos se borra y, si la lista está llena, dice cuántos no
  caben; un archivo de una versión más nueva o que no es una copia se rechaza diciendo por qué), **Abrir
  carpeta**, **Abrir registro**, **Copiar diagnóstico**, **Ver la bienvenida** y **Restablecer
  todo** (como recién instalado, en tu idioma, con los widgets centrados en una pantalla
  ultrapanorámica como en el primer arranque; tus récords se quedan; pide confirmación y se
  deshace). El botón de la carpeta de ajustes deja el pie de la barra lateral y el de la ventana
  estrecha; sigue en la bandeja.
- **«No cabe a 540 px»: la vista previa dice lo que el ancho deja fuera**: cuando el ancho del
  widget no deja sitio para algo que tienes visible, su fila lo dice con el mismo icono y las
  mismas palabras en todas las listas: columnas de Posiciones, datos de cabeceras, segundas
  líneas y pies de los seis widgets con barras, y el logo y la bandera del bloque «Piloto» de
  Posiciones (y **Hueco: Ambos**, cuando la columna del hueco al líder no cabe). Al pasar el ratón explica qué hacer (ensanchar el widget u ocultar otro dato). En
  Batalla, **Lado a lado** en una ventana estrecha dice que se dibuja apilada, y en Relativo la
  **Densidad** dice «No se nota a 460 × 252 px» cuando el ancho fija el tamaño del texto (así,
  con las dos densidades se ve igual). Antes el ojo o la opción parecían no hacer nada. No hay
  ajustes nuevos.
- **Una lista dentro de un bloque oculto lo dice, y mostrar algo muestra el bloque**: en Pedales,
  con el bloque «Revoluciones, reparto, TC y FFB» (o el de los datos) oculto en **Bloques**, la
  lista **Coche** (o **Datos**) dice debajo que no se ve y por qué, y al mostrar uno de sus
  elementos se muestra también el bloque, como ya hacían los tiempos de vuelta de Delta, que
  ahora lo dicen con las mismas palabras. Ocultar u ordenar nunca toca el bloque.
- **«No cambia la vista previa» en las opciones que actúan durante la sesión**: cuándo se ve un
  widget (**Mostrar en**, **Ocultar en boxes**, **Mostrar en la pantalla de sesión**),
  **Bloqueado**, **Crece hacia**, el umbral y **Mantener visible** de Batalla y Avisos, **Solo en
  multiclase** de Tráfico, **Usar la siguiente si no existe** de Delta y **Margen** y **Vueltas
  para la media** de Combustible llevan la misma nota, con el mismo icono, en vez de parecer que
  no hacen nada.
- **La vista previa enseña lo que acabas de cambiar**, como ya hacía Delta con la referencia de
  cada sesión (y lo dice debajo de la opción): en **Posiciones**, al cambiar **Primeros puestos**
  o **Alrededor de ti** te pone en P10, así los dos bloques se ven por separado y cada número
  cambia algo; al mostrar u ocultar el SoF o los coches en una cabecera, segunda línea o pie, la
  vista previa enseña solo tu clase (con varias clases van en la línea de clase), y al tocar la
  línea de clase o los líderes de otras clases vuelven todas. En **Tráfico**, la vista previa
  aplica **Mirar atrás**, **Mirar delante** y **Peligros hasta** como en carrera, con coches más
  lejos que se ven al alargarlos, y al cambiar **Entradas por grupo** pone cinco coches cerca en
  cada grupo. En **Testigos**, con **Solo encendidos** la vista previa dibuja los apagados
  translúcidos, así su ojo y su orden se ven. En **Pedales**, la traza de ejemplo va en tiempo
  real: con más segundos se ve la curva anterior, con menos solo el final de esta (antes era la
  misma curva estirada). Sobre el juego, el modo edición sigue enseñando la muestra de siempre.

### Cambiado

- **Vueltas con todas sus letras donde caben, y nunca «L» en inglés**: el número grande de
  **Combustible** y su «Quedan» dicen «17.6 vueltas» y «18.7 vueltas» mientras quepan en la línea, y
  la cabecera de **Posiciones** (y cualquier cabecera con el tiempo restante) dice «≈19 vueltas» o
  «Quedan 12 vueltas» cuando le sobra sitio; si no, «v» como siempre. Ningún widget se ensancha ni
  pierde un dato por ello. En inglés, las vueltas ya no se escriben «L», que es la unidad de los
  litros: «Catching in ~4 laps», «< 1 lap», y la columna de stint «7 lp».
- **Salir del modo edición se llama igual en todas partes**: el botón de la barra lateral, el del
  aviso de los Ajustes, la fila de Atajos y la leyenda de la barra lateral dicen «Salir del modo
  edición» (antes también «Salir de edición», «salir de edición» y «Salir»); sobre cada widget
  sigue «Esc: salir», que es la misma palabra. En inglés, «Exit edit mode» (antes también «Leave
  edit mode» y «leave editing»). El deshacer del modo edición dice lo que hiciste: «cambiar el
  tamaño de Relativo» si cambiaste su tamaño (antes «mover»), «ocultar Batalla» o «mostrar
  Batalla» (antes «mostrar u ocultar»), «desbloquear» y «cambiar la escala de».
- **El primer aviso de las flechas cabe entero**: «Primero elige un widget: arrástralo o pulsa
  Tab» (antes una frase más larga que se cortaba por los lados), y lo mismo con «Nada que mover:
  todos ocultos o bloqueados» y «Overlay oculto: muéstralo con su atajo o la bandeja». Si un nombre
  largo no cabe, el aviso pasa a dos líneas en vez de cortarse. Una prueba mide que cada aviso
  cabe en una línea en los dos idiomas.
- **Las teclas del modo edición funcionan también con los Ajustes delante**: justo después de
  **Editar posición**, las flechas mueven el widget, `Tab` y `Mayús+Tab` eligen otro y `Ctrl+Z`
  deshace, como dice el aviso de los Ajustes, sin tener que ir antes al juego. Las flechas y
  `Ctrl+Z` siguen funcionando mientras el foco no esté en un campo, un deslizador o una lista (que
  se quedan sus teclas), y `Ctrl+Z` es del «Deshacer» de los Ajustes mientras se ve. `Tab` vuelve
  a recorrer la página en cuanto haces clic o algo de la página toma el foco, o con `Esc`.
- **«Mayús» en toda la app**: la tabla de Atajos, el pie de la barra lateral, la bienvenida, el
  aviso de cursor oculto y la ayuda de **Modo edición** escriben `Ctrl+Mayús+E` y `Ctrl+Mayús+H`,
  como ya decían los avisos del modo edición («Mayús+Tab») y como se escriben **Supr** o **Re
  Pág**; mientras grabas una combinación, la tecla pulsada se llama igual. En inglés sigue siendo
  «Shift». Lo guardado no cambia.
- **Un ↺ sin nada que hacer se apaga, como los «Restablecer» de las listas**: el ↺ de cada sección
  (Contenido, Piloto, Personalizar, Ventana y visibilidad, las de Apariencia y Visibilidad) y su
  línea en **Restablecer…** salen atenuados cuando esa parte está como viene de serie, y dicen
  «Nada que restablecer: está como viene de serie». «Posición y tamaño» y «Todo» siguen activos: la
  posición de fábrica depende de la pantalla.
- **La misma opción, el mismo control y el mismo nombre**: en **Apariencia › Filas y pilotos**,
  «Bandera del país» y «Banderas de penalización» son un selector «Sí / No», como en cada widget
  (antes eran interruptores). La línea Piloto de **Restablecer…** dice «Formato de nombre, logo,
  bandera del país y banderas de penalización vuelven a «Global»» (antes «sanciones», una palabra
  que no usaba ningún control). En **Testigos › Personalizar**, «Rótulos» es un interruptor, como
  «Temperaturas» y «Tiempo de reparación» debajo; en columna, «Lado de los textos» sale debajo
  mientras haya un texto que colocar (antes «Rótulos» era «No / Derecha / Izquierda»). Lo guardado
  no cambia.
- **Pedales sin «Contenido»**: el estilo del volante, su tamaño y el color de la marca central
  pasan a la fila **Volante** de Personalizar › Datos, que se despliega como la de la Traza y dice
  en su botón cómo es («Realista · Mediano», «Barra»), junto a **Grados del volante**. Así todo lo
  del volante está en su fila, y su ↺ es el de Personalizar.
- **Las columnas que comparten Relativo y Posiciones, en el mismo orden**: en Relativo, el hueco va
  antes de Boxes, Vueltas del stint y Neumático, como en Posiciones (antes Neumático iba antes que
  Vueltas del stint y el hueco al final). Las tres van ocultas de serie, así que nada visible
  cambia; una lista que ya habías tocado se queda como estaba, y un ajuste antiguo con el neumático
  a la vista lo sigue viendo en su sitio. La ayuda de Vueltas del stint es la misma en las dos.
- **Buscar ajuste encuentra también los botones y las opciones**: «exportar» lleva a **Exportar
  todo…** (Acerca de) y a **Exportar…** (Disposiciones), «editar posición» y «mover» al botón de
  cada widget, «restablecer» a **Restablecer…**; y cada opción de un selector sale por su nombre
  («Imperiales» de Unidades, «Apellido» de Formato de nombre, «English» de Idioma), con el selector
  al que pertenece debajo, también por lo que dice su ayuda («galones», «pies»). Entiende más
  palabras de uso diario: «rpm» y «cambio de marcha» llevan a **Luces de cambio**, «tecla»,
  «teclado», «botón del volante» o «button box» a **Atajos**, «sanciones» a **Banderas de
  penalización**, «copia» o «backup» a **Exportar todo…**, «letra grande» o «más grande» a
  **Tamaño del texto** (y después al texto mínimo de 10 px), y «por coche» a **Según el coche**.
  Las palabras que no distinguen nada («por», «de», «el», «the», «by») ya no hacen que falle una
  búsqueda.
- **Las mismas palabras sobre el juego y en los Ajustes**: la ayuda sobre cada widget dice «Rueda:
  escala · Flechas: mover · Alt: sin imán · Esc: salir» (más corta en los estrechos), y el aviso
  de modo edición de los Ajustes usa los mismos pares («Bordes: tamaño», «Flechas: mover (Ctrl:
  tamaño)», «Tab: otro widget», «Ctrl+Z: deshacer»), igual en inglés («Wheel: scale», «Arrows:
  move»).
- **«iRacing oculta el cursor» nombra la tecla**: el aviso dice «Pulsa Ctrl+Shift+O para abrir los
  Ajustes, que liberan el cursor, o Alt+Tab» (con tu atajo de **Abrir los Ajustes**) y que, sin
  cursor, `Tab` elige un widget y las flechas lo mueven.
- **La etiqueta de un widget estrecho dice su tamaño entero**: por debajo de 300 px quita antes la
  escala y escribe el tamaño junto («220×220»), en lugar de cortarlo («220 …»).
- **El texto de segundo plano se lee sobre un cielo claro**: con el contorno del texto puesto (en
  «Auto», con el fondo por debajo del 65 %), el gris de las etiquetas y cifras secundarias (P11,
  iRating, «PISTA», «SoF», «LÍDER») sube hacia el blanco del texto principal. Con el fondo de serie
  (80 %) no hay contorno y nada cambia; ningún widget crece.
- **La cabecera de incidentes, con palabras completas si caben**: en Relativo y Posiciones,
  «equipo 7x» y «penalización a 17x» en lugar de «eq. 7x» y «pen. a 17x» cuando la cabecera tiene
  sitio para ellas (se mide, como en los chips de Avisos); si no, las abreviaturas de siempre.
  Ningún widget se ensancha.
- **Apariencia, en dos grupos sin columnas vacías**: bajo los estilos, **Ajuste fino del estilo**
  (Color y Texto a la izquierda, Filas y pilotos a la derecha) y debajo **General** (Idioma y Otros
  a la izquierda, Accesibilidad a la derecha), cada sección siempre en su columna. Disposiciones
  hace lo mismo: a la izquierda la lista y «Guardar la actual», a la derecha Cambio automático,
  Ejemplos, Pantallas y Archivos, tengas las disposiciones que tengas.
- **Personalizar con la cabecera de las demás secciones**: el título en versalitas con su ↺ en la
  misma línea; la explicación y «Expandir todo» van debajo.
- **Tamaño de esta ventana con los botones de siempre**: 80/100/125/150 %, como Tamaño del texto y
  Escala; el deslizador va de 5 en 5 y `Ctrl` y `+` o `-` siguen de 10 en 10.
- **Accesibilidad lleva al Texto**: al pie, «Para leer mejor los widgets, en Texto:» con dos
  botones, **Tamaño del texto** y **Contorno del texto**, que llevan a cada uno y lo señalan.
- **Buscar ajuste entiende palabras de uso diario**: «zoom», «ampliar» o «lupa» encuentran
  **Tamaño de esta ventana**; «bloquear» o «fijar», **Bloqueado**; «parpadeo» o «destello», **Sin
  parpadeos**; «daltonismo», la paleta para daltónicos (y lo mismo en inglés); y cada estilo se
  encuentra por su nombre («Limpio», «Compacto»).
- **Estilos y disposiciones, cada uno a lo suyo**: la disposición de ejemplo «Completa» pasa a
  llamarse **Los diez** («All ten»), para no confundirse con el estilo **Completo**; Estilo dice
  que qué widgets se ven lo eligen las disposiciones (con «Ir a Disposiciones») y Ejemplos dice que
  el aspecto se elige en Estilo (con «Ir a Apariencia»).
- **Las mismas palabras para el corte**: en inglés, «No flashing» dice «on the rev limiter» (no
  «at the limiter», que en la app es el limitador de boxes), como Testigos; en español, «en el
  corte», como Testigos.
- **Pedales, con la misma regla que los demás widgets**: lo que enciende o apaga una parte del
  widget va en **Personalizar**, y en Contenido quedan solo los modos del volante (estilo, tamaño y
  color). **Luces de cambio** es una fila con su ojo arriba de **Bloques** (la tira de arriba del
  widget); las opciones de la **Traza** (segundos, grosor, embrague) se despliegan en su propia fila,
  con su resumen en el botón («5 s · 2 px»); **Grados del volante** va en la fila **Volante** de
  Datos, y los colores de los pedales, bajo la lista de Bloques. **Buscar ajuste** abre la fila
  plegada donde está lo que buscas. Los valores no cambian.
- **Una línea de ayuda por fila**: en Combustible (Consumo, Repostar y para meta, Ventana de boxes,
  Ahorro, Neumáticos, Reparaciones rápidas, Menú de boxes) y en Testigos (Marcar tiempo del equipo,
  Cuenta atrás real), la ayuda de cada fila cabe en una línea y el resto va tras su ⓘ, como en el
  resto de los Ajustes.
- **Las dos tablas, una sola regla para Posición y Piloto**: en **Relativo** y en **Posiciones**,
  **Posición** y **Piloto** van en el mismo bloque fijo al principio de la lista de columnas, con
  las mismas pistas («siempre al principio de la fila», «siempre tras la posición»): Piloto con su
  candado y Posición con su ojo en las dos, así que ahora también se puede ocultar la posición en
  Posiciones (el líder de otra clase pierde entonces su etiqueta de clase; su número sigue en el
  color de la clase). El recuento «x de n visibles» cuenta lo mismo en las dos, solo las columnas
  que se mueven, e **Igualar con** copia también si se ve la posición. **Si en Relativo habías
  movido Posición o Piloto a otro sitio de la fila, ahora vuelven al principio, como en
  Posiciones**; lo demás de tu orden se queda.
- **«Medido» del Hueco, en su fila**: en Posiciones, el selector «Al de delante / Al líder /
  Ambos» deja Contenido y va dentro de la fila **Hueco** de Columnas, como «iRating en juego de
  todos» en la suya; «Hueco al líder» dice «Se muestra con «Ambos» en la fila Hueco». Lo restablece
  el ↺ de Personalizar, junto con sus columnas.
- **Ventana y visibilidad, las mismas filas en los diez widgets**: en **Avisos**, «Ocultar en
  boxes» ya no desaparece: sale apagada y desactivada con su motivo («No aplica: ocultaría los
  avisos del limitador y de la entrada a boxes»), como «Mostrar en la pantalla de sesión» donde no
  aplica. **Crece hacia** también está siempre: desactivada con «No aplica: solo con «Alto:
  Automático»» o «No aplica: este widget no cambia de alto por sí solo».
- **Un nombre para cada cosa**: en Delta, «Escala de la barra» pasa a **Rango de la barra** («Bar
  range»), porque «Escala» es el tamaño del widget en los diez; en Batalla, «iRating del rival» y
  «Licencia del rival» pasan a **iRating** y **Licencia**, como las columnas de Relativo y
  Posiciones, con «del rival» en su ayuda.
- **Doblado o doblándote, también por la forma**: el número de un coche que te dobla lleva una
  muesca arriba a la derecha y el de un doblado, abajo, además del rojo o el azul que ya tenían (en
  Relativo y Tráfico, el mismo componente). Va dentro del número: no ocupa más sitio.
- **Menos cifras de serie, solo en una instalación nueva**: Posiciones empieza sin su segunda
  línea de cabecera (iRating y SR en juego, margen y vuelta rápida de clase) y sin aire ni goma en
  el pie (que sigue con pista, agua, viento y coches); Combustible, sin las líneas de neumáticos y
  de límites (reparaciones rápidas y juegos); el pie de Relativo, cuando lo enciendes, tampoco
  trae aire ni goma. Todo sigue en sus listas de Personalizar, a un clic. **Si ya tenías ajustes,
  nada cambia**: tus widgets dibujan lo mismo (también un archivo antiguo sin esas listas, que
  recibe lo que dibujaba su versión); solo **Restablecer** lleva a lo nuevo.
- **Palabras completas donde caben**: los chips de Avisos dicen «PRESIÓN ACEITE», «ENTRA ESTA
  VUELTA» o «COMBUSTIBLE · 1.6 V» cuando todos caben en su fila, y la línea de límites de
  Combustible, «Reparaciones rápidas» y «Juegos de neumáticos» cuando caben en su ancho. Si no
  caben, siguen las abreviaturas de siempre («P. ACEITE», «BOX ESTA V.», «REP. RÁPIDAS»): ningún
  widget se ensancha ni gana una fila por ellas.
- **Combustible, más gráfico y con menos texto**: cada línea es una cifra y su dibujo. Arriba, las
  **vueltas de combustible en grande** (en el color del plan), los litros y, tras una bandera a
  cuadros, «QUEDAN» y las vueltas que quedan. El **depósito** va marcado en vueltas de combustible
  (una raya por vuelta, más fuerte cada cinco), con una raya donde llega lo que necesitas hasta meta
  y, si no llegas, ese tramo rayado en rojo. El **consumo** lleva una línea con tus vueltas limpias:
  la media en discontinua, la que más gastó en naranja y la última en blanco (separada y unida a
  trazos si no fue limpia, aunque gastara lo mismo). **Repostar** muestra el **menú de boxes como
  una barra** marcada en lo que hay que echar (verde si llega, naranja si no) y, al final,
  «PARA META» y los litros hasta meta. La **ventana** es la carrera como una línea hasta la
  bandera: lo corrido, tu posición y las vueltas en que puedes parar (verde si está abierta, roja si
  cierra en esta vuelta), y las paradas dichas con palabras («1 parada», «sin parar»). El
  **ahorro** es una barra que acaba en tu media, con el recorte rayado y su porcentaje («−9 %»).
  Los **neumáticos** son el coche visto desde arriba: cada neumático en tres franjas de un borde al
  otro (izquierda, centro y derecha vistas desde arriba, como las da iRacing), coloreadas de verde
  (nuevo) a amarillo, naranja y rojo (gastado), o de azul a gris y naranja con la paleta para
  daltónicos, con el % de su franja más gastada al lado y «última parada · V13». En la lista,
  «Para meta y repostar» pasa a llamarse **«Repostar y para meta»** y «Reparaciones y juegos»,
  **«Reparaciones rápidas»**: los juegos de neumáticos que quedan van ahora con el coche, y esa
  línea los dice solo mientras no se dibuja la de neumáticos. Las líneas, su orden, lo que tenías
  oculto, la edición en la vista previa y los fantasmas siguen igual; no hay ajustes nuevos.
- **La línea de neumáticos de Combustible sale antes de la primera parada** (cambio visible si ya
  usabas el widget): antes no aparecía hasta que una parada medía los neumáticos; ahora, con el
  **alto automático** (el de serie), el coche sale atenuado desde el principio («sin lectura · se
  miden en boxes», o «sin lectura» si el widget es estrecho), así el widget no cambia de alto
  cuando llega la lectura, aunque en carreras sin parada es como tres líneas más alto. Si la
  ocultas en Personalizar › Líneas, desaparece como antes. Con el **alto fijo** sigue como antes:
  la línea espera a la lectura, para no sacar las otras de una ventana hecha a su medida.
- **«+ Añadir dato» en las barras**: en cabeceras, segundas líneas y pies, la lista «Ocultos (n)»
  pasa a ser **+ Añadir dato (n)**: cada dato oculto tiene **← Izquierda** y **Derecha →**, para
  ponerlo al final del lado que elijas (el lado donde estaba, resaltado).
- **Más sitio para los ajustes**: al bajar por las opciones, la vista previa se pliega en una
  franja de unos 120 px (con «Ver entera») y vuelve al subir; al pie de la vista previa, **Al
  bajar: Se pliega / Fija / Franja** lo cambia y se recuerda. La ventana de Ajustes se abre más
  alta (880 × 900 en una pantalla 1080p; en 1440p, 1152 × 1200) y las opciones pasan a dos
  columnas desde 1100 px de ancho (antes 1380). En las páginas de widget a dos columnas,
  «Personalizar» va a la derecha y la izquierda apila «Contenido», las secciones de referencia y
  «Ventana y visibilidad», cada columna con su propio alto: ya no queda un hueco vacío bajo
  Contenido. A una columna, el orden es el mismo: Contenido › Personalizar › referencias › Ventana y
  visibilidad.
- **Vincular un coche enciende «Según el coche»**: al vincular un coche a una disposición (en
  Disposiciones o desde la bandeja), el cambio automático se activa si estaba apagado; la página
  lo dice con «Deshacer» (también en la bandeja, y desde ella un aviso sobre el juego), que lo apaga
  y vuelve a la disposición que tenías si ha aplicado otra; quitar un vínculo no lo toca. Si estás
  en un coche sin disposición y tienes dos o más, la página y el submenú **Disposición** de la
  bandeja ofrecen **Vincular a «…»** (la que está en uso), y **Guardar la actual** ofrece «Vincular
  a <tu coche>», marcada solo si «Según el coche» ya está activado: guardar nunca lo activa sin
  que lo marques. Los coches
  vinculados salen como etiquetas en cada disposición, y la lista de coches que se pueden vincular
  incluye los de tus récords personales, sin tener que subirte a ellos otra vez.
- **El ojo es el símbolo de la visibilidad**: en la barra lateral, cada widget tiene un ojo (como
  en la etiqueta del modo edición) en vez de un punto: abierto si está activado, tachado si no, y
  tenue con un círculo discontinuo si está activado pero una regla lo oculta ahora; al pasar el
  ratón dice por qué («activado, pero ahora no se ve (oculto en práctica)»). La página del widget
  lo dice también bajo su título.

- **Widgets agrupados**: la barra lateral de los Ajustes, su selector en una ventana estrecha y la
  bandeja ordenan los diez widgets en tres grupos: **Pista y rivales** (Relativo, Posiciones,
  Batalla, Tráfico, Radar), **Tu vuelta** (Delta, Combustible, Pedales) y **Estado del coche**
  (Avisos, Testigos). En la bandeja, cada grupo lleva su nombre y una línea lo separa del
  siguiente.

- **Atajos en tabla, una columna por atajo**: cada acción es una fila y cada atajo tiene su
  columna (**Atajo 1 · principal**, **Atajo 2**, **Atajo 3**), como en la pantalla de controles de
  un juego, así que los atajos quedan alineados entre filas. La casilla es el control: clic para
  cambiar, **×** o `Supr` para quitar, **+ Asignar** en la primera libre. Los avisos están en su
  casilla («Desconectado», «En uso por otra app»; en una ventana estrecha, solo su icono) y la
  frase que lo explica sale debajo de esa columna; «Guardado» y «Quitado» ya no empujan la página (los lectores de pantalla los siguen
  oyendo). Restablecer es un icono ↺ en su propia columna (con «Deshacer»), `Esc` es una fila
  más, con el mismo candado que lo fijo en las listas, la nota de que
  las teclas son exclusivas va encima de la tabla y «Cómo funcionan» queda plegado debajo. Ayudas
  más cortas para cada acción.
- **Contenido para el comportamiento, Personalizar para lo que se ve**: Avisos elige sus avisos
  con una sola lista con ojo, con subtítulos por grupo (Banderas, Boxes, Durante la carrera, Motor,
  Combustible), un solo «Restablecer» y una sola ayuda, como Testigos y Radar, en vez de 15
  casillas en Contenido; un clic en un aviso de la vista previa lo oculta, como su ojo; las banderas azul y enrollada dependen de
  las banderas, y el exceso del limitador. En Testigos, rótulos, temperaturas y tiempos de
  reparación pasan junto a la lista de testigos, con «Temperatura al alza». En Posiciones, «iRating
  en juego de todos» está en la fila de su columna. Lo guardado no cambia.
- **Cabecera y pie con una sola regla**: en una instalación nueva, la cabecera lleva a la izquierda
  el título (y la sesión) y a la derecha los incidentes y el reloj; el pie, a la izquierda las
  condiciones y a la derecha los coches y el combustible. Los datos de la sesión (sesión, tiempo
  restante, SoF, incidentes) salen por defecto solo en Posiciones, que ahora también tiene título y
  lleva el número de coches al pie; Relativo deja de repetir los incidentes. Cada cabecera y pie
  tiene **«Copiar a»** para pasarlo, con su tamaño, a otro widget (con «Deshacer»), y Combustible ya
  no ofrece «Vueltas de combustible» en sus barras, porque las dice en grande (si la tenías, se
  quita). Si ya tenías ajustes, tus barras no cambian (un archivo sin versión cuenta como
  anterior). En Posiciones, el SoF y los coches de la cabecera y el pie dicen que, con varias
  clases, van en la línea de clase.
- **Delta en una sola lista**: Personalizar tiene solo «Líneas»; la línea superior y los tiempos
  de vuelta se despliegan en su propia fila para mostrar sus partes («3 de 3 partes»), en vez de
  tres acordeones que dependían entre sí. Las referencias se llaman por su nombre completo
  («Récord personal», «Mejor vuelta de la sesión», «Vuelta óptima»…), con lo que es cada una, y
  la vista previa dibuja la de la sesión que acabas de cambiar y lo dice debajo («La vista previa
  usa la de Carrera: Vuelta óptima»). La cadena «Si no existe: …» y las partes de los tiempos de
  vuelta usan esos mismos nombres.
- **Lo oculto se ve igual en todas las vistas previas**: con el ratón sobre la vista previa, lo
  que tengas oculto en cualquier lista (columnas, capas, testigos, avisos, líneas…) se dibuja
  translúcido donde iría, y un clic lo vuelve a mostrar; antes solo pasaba con las barras de datos
  y algunas listas, y en el resto había que buscarlo debajo. La ayuda de encima de la vista previa
  solo promete lo que la página permite: «Arrastra… para ordenar» donde una lista se puede
  ordenar, y en Avisos dice que un aviso oculto vuelve desde su lista.
- **Las columnas de Relativo y Posiciones se llaman y editan igual**: «Posición» (en tu clase) y
  «Piloto», con el número del coche, en las dos (Posiciones decía «Nombre» y tenía una fila
  «Número» aparte; Relativo decía «Posición en clase»), el mismo candado, en el sitio del ojo, para
  lo que siempre se ve (Posiciones ponía «Fijo»), «Hueco» se puede ocultar en las dos, iRating
  antes que la licencia en las dos y una columna «Boxes» también en Relativo (oculta, la etiqueta
  PIT sigue tras el nombre, como en Posiciones sin la suya). Cada tabla tiene **«Igualar con
  Posiciones / Relativo»**, que copia el orden y el ojo de las columnas que comparten, con
  «Deshacer». **En una instalación nueva**, y si nunca habías tocado las columnas de Relativo,
  iRating va antes que la licencia; una lista cambiada por ti no se toca.
- **Un bloque «Piloto» igual en Relativo, Posiciones, Batalla y Tráfico**: justo después de
  Contenido, las mismas cuatro filas en el mismo orden (formato de nombre, logo de la marca,
  bandera del país, banderas de penalización), cada una con «Global (…)», que es lo que diga
  Apariencia › Filas y pilotos, donde están ahora sus valores globales (el formato de nombre pasa
  allí desde Texto). Quitar las banderas de todos es un cambio en Apariencia. Batalla gana las
  banderas de penalización del rival y Tráfico el logo, la bandera y la penalización de cada coche.
  «Logotipo de la marca» se llama ya «Logo de la marca» y, en Apariencia, «Logos de marca» pasa a
  «Color del logo». **En una instalación nueva** los cuatro siguen el global (Batalla enseña ahora
  la bandera del país, antes apagada, y Tráfico los logos y las banderas); **si ya tenías
  ajustes**, cada widget dibuja lo mismo que antes (lo que nunca dibujaba queda apagado) y
  Apariencia ofrece «Usar «Global» en todos» (con «Deshacer»). Si vuelves a una versión anterior, lo que esté en
  «Global» toma el valor por defecto de esa versión.
- **El mismo bloque «Ventana y visibilidad» en los diez widgets**: Relativo, Radar y Delta tienen
  ya «Escala», con los mismos botones 80/100/125/150 %: es el tamaño de su ventana respecto al de
  fábrica (lo mismo que hace la rueda en modo edición, que ahora significa «escala» en todos), y
  el chip del modo edición muestra ese mismo porcentaje; restablecer «Ventana y visibilidad» la
  vuelve al 100 %. La fila «Alto» sale en todos, apagada con
  su motivo donde no se aplica, así que las filas están en el mismo sitio en cada página.
- **Deshacer también los cambios grandes**: restablecer (una lista, una sección de un widget, su
  posición, una sección de Apariencia o toda, todos los atajos o los de una acción), «Usar «Global»
  en todos», ocultar un widget y eliminar una disposición
  se hacen con un clic y muestran el mismo aviso que ocultar un elemento, con **Deshacer** (o
  `Ctrl+Z`). Ya no piden «Pulsa otra vez»; solo borrar récords personales lo sigue pidiendo,
  porque no se puede deshacer.
- **Restablecer dice qué y dónde**: en cada página, un menú **Restablecer…** arriba con lo que
  devuelve cada opción, y un icono ↺ en la cabecera de cada sección que restablece solo esa
  sección: en un widget, Contenido, Piloto, Personalizar y Ventana y visibilidad (más Posición y
  tamaño, o todo el widget, en el menú); en Apariencia, Color, Texto, Filas y pilotos, Visibilidad
  y Otros (o toda la página, que ahora incluye Visibilidad; el idioma no cambia); en Atajos, todos
  (cada fila tiene su ↺). Antes eran botones al final de la página, y «Restablecer opciones»
  tocaba también la escala, el fondo y las reglas. Con dos disposiciones o más, el aviso nombra
  la disposición («Restablecido: Ventana y visibilidad de Relativo · en «Principal»»), y los
  avisos se leen bien con cualquier widget («Ocultado: Posiciones», «Posiciones (todo)»).
- **Un solo formato de números en Ajustes**: sin «,0» de sobra («1 s», no «1.0 s» en Batalla y
  Avisos) y con coma decimal en español («1,5 s», «0,5 v», «1,5 px»); los widgets mantienen el
  punto del simulador, como los tiempos de vuelta. **Una sola escalera de botones rápidos** para
  los tamaños: «Tamaño del texto» (Apariencia) usa 80/100/125/150 %, como «Escala». Los segundos
  de la traza de Pedales tienen botones rápidos, como los demás deslizadores de tiempo.

- **«Clasificación» pasa a llamarse «Posiciones»** en español (barra lateral, bandeja, título del
  widget y ajustes), para no confundirla con la sesión de clasificación, que conserva su nombre. En
  inglés sigue siendo «Standings». Los ajustes guardados no cambian.
- **Relativo sigue la densidad**, como ya decía Apariencia, y tiene en su página el mismo selector
  «Global / Cómoda / Compacta» que Posiciones. «Cómoda» (la de siempre) lo dibuja igual que antes;
  «Compacta» junta las filas y agranda el texto en la misma ventana. Si ya tenías la densidad global
  en «Compacta», Relativo queda en «Cómoda» para verse como antes.
- **Personalizar en el mismo orden en todos los widgets**: primero la lista principal (Columnas,
  Rivales, Grupos, Líneas…), que es la que se abre en una instalación nueva, luego las demás listas
  del contenido y al final Cabecera, Segunda línea y Pie. Batalla, Tráfico y Combustible ya no se
  abren en una cabecera apagada. Las «Filas» de Batalla y Delta se llaman «Líneas», como en
  Combustible. Las secciones que tenías abiertas siguen abiertas.
- **Lo del widget primero** en cada página: Contenido, Personalizar y, al final, «Ventana y
  visibilidad» (tamaño, fondo, cuándo se muestra y bloqueo, en ese orden) antes de los botones de
  restablecer. Antes la ventana ocupaba hasta diez filas por encima de lo que hace el widget. La
  referencia por sesión de Delta, el cálculo de Combustible y los colores de Pedales están ahora en
  su Contenido.
- **Un fondo para todos los widgets**: en Apariencia, «Fondo de los widgets» (80 % por defecto)
  con botones rápidos de 25, 50, 80 y 100 %. En la página de cada widget, «Fondo» sigue el global
  («Global (80 %)») o usa una opacidad propia, con los mismos botones. En una instalación nueva
  todos usan el global; si ya tenías ajustes, cada widget conserva su opacidad (antes había 75, 78,
  80 y 85 % sin motivo), y Apariencia lo dice con un botón, «Usar el global en todos», que los
  pasa a «Global» de una vez. La vista previa de Apariencia usa el fondo global. La ayuda ya no
  habla de «coches» en widgets sin coches. Si vuelves a una versión anterior, los widgets en
  «Global» toman la opacidad que tenían por defecto en ella.
- **Pantalla de sesión, en un solo sitio**: cada página de widget tiene el mismo interruptor
  «Mostrar en la pantalla de sesión»; en Radar, Pedales, Testigos, Delta y Combustible sale
  desactivado con el motivo. Apariencia ya no repite el de Posiciones y solo ofrece «Ocultar en la
  pantalla de sesión» cuando cambia algo (con «Siempre» o siguiendo las repeticiones).
- **Un nombre para cada cosa**: «Vuelta rápida de clase» (antes también «Mejor de clase» en Delta),
  «iRating en juego» (antes también «Δ iRating» e «iRating proyectado»), «Orientación» en Batalla y
  Testigos (no confunde con las disposiciones), «Óptima de clase» en Delta, «Títulos de columna»
  (no confunde con la cabecera), «Banderas de carrera» en Avisos y su grupo «Durante la carrera».
  En inglés, el lado de los textos de Testigos es «Text side» (antes, dos controles se llamaban
  «Captions»).
- **Menos notas repetidas**: «Guardando en» solo aparece con dos disposiciones o más (o con una de
  «Solo posición» en uso); la nota «Sin cabecera ni pie» ya no sale; cómo arrastrar y el ojo se
  explica una vez por página, en Personalizar, y no en cada lista; y se quitan las ayudas que
  repetían lo que ya dice la opción (el ejemplo del formato de nombre en cada widget, la del modo de
  Posiciones y la de «Filas alternas»).
- **Un control donde había dos**: cada cabecera, segunda línea y pie tiene un solo selector «No /
  Pequeña / Normal / Grande» en vez de un interruptor y un tamaño (con «No» se sigue ocultando, y
  sus datos no se muestran en gris: vuelven como estaban al elegir un tamaño).
  En Testigos, «Rótulos: No / Derecha / Izquierda» (en fila, «No / Sí»). Y lo que no se aplica se
  oculta en vez de quedarse en gris: el modo compacto de Posiciones en modo completo, el tamaño y
  el color del volante con el estilo Barra, «Crece hacia» con alto fijo, las opciones de un grupo
  oculto en Tráfico, etc. Lo guardado no cambia.
- **Avisos ya no se oculta en boxes**: su página no ofrece «Ocultar en boxes», porque ocultaba
  también los avisos del limitador, del exceso de velocidad y de la entrada a boxes. Si lo tenías
  activado, se ignora (el valor se conserva).
- **Bandeja más clara**: la casilla «Ocultar overlay» pasa a ser «Mostrar el overlay», marcada
  cuando se ve, como las de los widgets; el submenú de cuándo se ve se llama «Cuándo mostrar» y el
  del radar «Alcance del radar». En Apariencia, el control con esas opciones se llama «Cuándo
  mostrar el overlay».
- **Ayudas de una línea** en Apariencia, Atajos y Disposiciones: cada ayuda cabe en una línea (unos
  90 caracteres) y el resto está tras su ⓘ, que la despliega debajo. Los subtítulos de Atajos y
  Disposiciones y las notas de «Cómo funcionan» pasan de párrafos a una línea.
- **Combustible también en práctica** en una instalación nueva: sale en práctica (donde se mide el
  consumo por vuelta) y en carrera; en clasificación sigue oculto. Si ya tenías ajustes, Combustible
  sigue donde lo tenías.
- **Una sola forma de explicar las repeticiones**: la nota de «Ventana» de cada widget se forma
  con los mismos datos (de quién son los datos, dónde se oculta, si al rebobinar mantiene la
  carrera en directo y si lo decide Visibilidad), así que dos widgets que se comportan igual dicen
  lo mismo y solo cambia el texto cuando cambia el comportamiento: «Sigue al coche que miras: se
  oculta al rebobinar una repetición», «Solo tiene datos de tu coche: se oculta en repeticiones, en
  la pantalla de sesión y si miras otro coche»…
- **Ventana estrecha con barra de iconos**: por debajo de 640 px, la barra lateral se queda en una
  columna de iconos en vez de un desplegable: cada página a un clic, el ojo de cada widget al lado
  de su icono (se sigue viendo y cambiando qué está oculto), una raya entre grupos y el nombre al
  pasar el ratón (y para lectores de pantalla). El buscador, el chip de estado y **Modo edición**
  van en la barra de arriba.
- **Ajustes más ordenados a la vista**: seis tamaños de letra en vez de catorce (pies y etiquetas,
  ayudas, controles, texto, títulos de sección y de página), los espacios en una escala de 4 px
  (4, 8, 12, 16, 24 y 32) y todos los símbolos como iconos del mismo juego: las flechas para
  ordenar, el asa de arrastre, el ⓘ de las ayudas, los − y + de los contadores, la × del aviso de
  deshacer y la marca de los avisos de Atajos, con el mismo grosor y color que los demás iconos.
  Los Ajustes siguen solo en tema oscuro.
- **Controles que se distinguen del fondo**: campos de texto, contadores, selectores, interruptores,
  botones y las casillas de Atajos llevan el mismo borde claro que las casillas de verificación
  (3,3:1 sobre la tarjeta, antes 1,4:1); el borde tenue queda solo para separadores y tarjetas.
- **Un solo botón para abrir o cerrar todas las listas** de Personalizar: dice «Expandir todo»
  mientras alguna está cerrada y «Contraer todo» cuando están todas abiertas, en vez de dos
  botones de los que uno siempre se veía apagado. Un botón apagado dice por qué al pasar el ratón:
  «Restablecer» de una lista que está como viene de serie («Nada que restablecer…») y **Guardar**,
  **Duplicar**, **Añadir** e **Importar** de Disposiciones cuando ya no caben más.
- **Nombres para lectores de pantalla**: el interruptor «Visible» de cada página se anuncia como
  «Mostrar Relativo», «Mostrar Radar»…; el consejo de la vista previa añade «Con el teclado, desde
  las listas de Personalizar», y la vista previa se describe (qué widget es y que se edita con el
  teclado en esas listas).
- **Vista previa legible en una ventana estrecha**: donde la vista previa tendría que dibujarse a
  menos del 75 % (Posiciones en una ventana de 760 px, o un widget alto en una ventana baja), se
  dibuja a su tamaño real y se recorta: las primeras filas, con un degradado abajo, y si no cabe
  de ancho, el resto con la barra o la rueda con Mayús. Antes encogía tanto que el texto más
  pequeño quedaba en 6–7 px y era difícil hacer clic en él. Plegada en franja sigue entera.

### Corregido

- **El motivo de una fila desactivada se lee bien**: en una fila que no se puede cambiar ahora
  («Ocultar en boxes» en Avisos, «Crece hacia» sin altura automática), solo se atenúan su nombre y
  su control; la ayuda que dice por qué mantiene el gris de siempre, con su contraste completo
  (antes se atenuaba también y quedaba en unos 2,8:1).
- **Un solo punto del color elegido**: con un color predefinido elegido, el selector de color libre
  se ve como una rueda de colores (para elegir otro) y no como un segundo punto del mismo color;
  se pinta con el color en cuanto es uno tuyo. En los dos diálogos de **Estilo**, «Guardando en»
  va apilado (el título y debajo dónde), como en las páginas de los widgets.
- **Disposiciones, más ordenada**: al editar una disposición, **Guardar** y **Cancelar** van juntos
  al final de la línea y es el campo del nombre el que se estrecha (antes «Cancelar» caía solo a
  otra línea). Con una sola disposición ya no salen las flechas para ordenarla, que no hacían
  nada; con varias miden 24 × 24 px, como el resto de botones de icono (antes 22 × 18). La ayuda de
  **Archivos** dice dónde se exporta: con **Exportar…** en la fila de cada disposición.
- **Delta › Líneas: la fila «Tiempos de vuelta» en una sola línea**: el asa, el ojo, el nombre con
  su ayuda, «3 de 4 partes» y las flechas ya no se reparten en tres renglones (a cualquier ancho y
  en los dos idiomas); la ayuda larga se parte dentro de su sitio, como en las demás filas.
- **Texto legible sobre fondos claros**: con «Contorno del texto» en «Auto», el contorno se pone
  por debajo del 65 % de opacidad (antes, del 35 %), así que un panel al 50 % sobre un cielo
  blanco ya se lee. El gris tenue (unidades, títulos de columna) es un poco más claro. Con la vista
  previa en «Día» y el fondo por debajo del 60 %, el control del fondo avisa de que se leerá mal.
- **«Tamaño del texto» cambia los diez widgets** (Apariencia): multiplica la «Escala» de cada uno.
  Relativo, Radar y Delta, que llenan su ventana con el texto y no cambiaban, ahora agrandan o
  encogen su ventana en la misma proporción (desde su centro), en la disposición en uso y en las
  demás; su «Escala» sigue diciendo lo mismo (100 % es su tamaño de fábrica por el tamaño del
  texto), y «Posición y tamaño» los devuelve a ese tamaño. Para leer mejor en 4K basta con subir el
  tamaño del texto, sin tocar después la escala de tres páginas. Antes la ayuda decía que esos tres
  no cambiaban; ahora dice «Cambia los diez widgets» y, tras su ⓘ, cómo crece su ventana.
- **Opciones que vuelves a activar ya no dejan una línea congelada**, ni en la vista previa ni
  sobre el juego. Al ocultar y volver a mostrar una parte de Delta (tiempos de vuelta, referencia,
  estado), de Avisos (la banda de bandera, los otros avisos en chips), de Combustible (cualquier
  línea) o los títulos de columna de Relativo, esa parte podía quedarse con los datos de antes, no
  dejar volver a otros avisos (Daños, Presión de aceite) o romper la vista previa hasta cerrar la
  ventana de ajustes.
- **Cabecera y pie del tamaño elegido**: al pasar de «Grande» a «Pequeña» (o cambiar la escala),
  la barra seguía calculando el sitio con la letra anterior y quitaba datos que sí cabían (por
  ejemplo la vuelta rápida de clase o «SIM»).
- **Ocultar con el ojo se ve al momento**: en las listas de Cabecera, Pie, Líneas de Combustible y
  Líneas de Batalla, el elemento que ocultas desaparece de la vista previa aunque sigas con el
  puntero en la lista. Antes se quedaba dibujado en gris hasta salir de la fila y parecía que no
  había pasado nada; vuelve a verse en gris (dónde iría) si pasas otra vez por su fila.

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

[Sin publicar]: https://github.com/jesus-molano/OverLap/compare/v2.4.0...HEAD
[2.4.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.4.0
[2.3.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.1
[2.3.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.3.0
[2.2.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.2.0
[2.1.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.1
[2.1.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.0
[2.0.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.0.0
