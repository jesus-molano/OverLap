# Registro de cambios

Aquí se apuntan todos los cambios importantes de OverLap.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

### Añadido

- **Bienvenida en el primer arranque**: una instalación nueva abre los Ajustes con una bienvenida
  de tres pasos (idioma y unidades; qué widgets usar; dónde está todo: la bandeja, los tres atajos
  y **Probar con datos de ejemplo**, que enseña los widgets en tu pantalla en el modo edición), y
  Windows avisa una vez de que OverLap está en la bandeja. **En una instalación nueva**, la
  bienvenida empieza con seis widgets marcados (Relativo, Posiciones, Delta, Combustible, Avisos y
  Pedales) en vez de los diez; «Saltar» deja los diez. Si ya tenías ajustes, no la ves.
- **Buscar ajuste**: un buscador arriba de la barra lateral (y de la barra de una ventana estrecha)
  encuentra cualquier ajuste de cualquier página por sus palabras, sin importar mayúsculas ni
  tildes: controles, secciones, acordeones y cada dato de las listas («vueltas combustible» da
  «Vueltas de combustible» en el pie de Posiciones, en la cabecera de Relativo…), con su página y
  su sección debajo. Con las flechas y `Intro` o un clic, lleva a la página, abre el acordeón o la
  lista donde está, lo centra y lo señala un momento. Lee las páginas tal como se ven, en el idioma
  de la ventana.
- **Página «Visibilidad»**: junto a Apariencia, con **Cuándo se ve el overlay** (que estaba en
  Apariencia; su «Restablecer» va con ella y el de Apariencia ya no lo toca) y una tabla **Dónde se
  ve cada widget**: una fila por widget, agrupados, y columnas Visible, Práctica, Clasificación,
  Carrera, Boxes, Pantalla de sesión y Bloqueado. Cada casilla cambia el mismo ajuste que su página
  y el nombre del widget lleva a ella; una casilla que no se puede cambiar dice por qué. Con «Solo
  en carrera», la tabla avisa de que práctica y clasificación no se ven.
- **Traer todos los widgets a esta pantalla**: en la bandeja (a la pantalla donde está el ratón) y
  en **Disposiciones › Pantallas** (a la de la ventana de Ajustes). Los widgets de otra pantalla,
  o de una que ya no está conectada, vienen al mismo sitio relativo y con su tamaño, sin salirse;
  los que ya estaban no se mueven. La página dice cuántos ha traído, con «Deshacer».
- **«Editar posición» en cada widget, y ⚙ en su etiqueta**: junto a «Visible», un botón entra en
  el modo edición y señala ese widget sobre el juego con un borde que parpadea; si ya editas, lo
  vuelve a señalar. En el modo edición, la etiqueta de cada widget tiene, tras el ojo y el
  candado, un **⚙** que abre su página de ajustes. El aviso del modo edición en los Ajustes es una
  línea de teclas (`Arrastra` mover · `Bordes` ancho · `Rueda` escala · `Alt` sin imán · `Esc`
  salir) con un botón **Salir**, en vez de dos líneas de texto.
- **Saber si un atajo funciona**: al usar un atajo, un aviso breve arriba de la pantalla, sobre el
  juego, dice qué ha hecho («Overlay oculto», «Modo edición», «Disposición: GT3») o por qué no se
  ve nada («Overlay visible · Oculto: fuera del coche», «Solo hay una disposición», «Delta: no hay
  sesión», «Delta oculto»). No toma el foco ni los clics, y se apaga en **Ajustes › Atajos ›
  Confirmar sobre el juego** (encendido de serie, también si ya tenías ajustes: es nuevo). En esa
  página, la fila de cada acción dice «Pulsado hace 3 s» al usarla, para probar un atajo desde el
  juego. Si un atajo no se puede registrar, la bandeja lo dice bajo el estado («1 atajo no
  funciona…», que abre Atajos) y en su texto emergente.
- **El estado, fuera de la bandeja**: el chip de estado de los Ajustes dice debajo qué está oculto
  ahora y por qué («Oculto: fuera del coche», «2 widgets ocultos ahora», «Overlay oculto») o qué
  falla («1 atajo no funciona»). Con un clic abre un panel con la línea de estado entera y qué
  hacer, qué widgets oculta una regla y por qué, los atajos que no funcionan (con «Ver Atajos») y
  los botones **Copiar diagnóstico** (versiones, estado, pantallas y atajos, sin nombres ni tu
  usuario) y **Abrir registro** (`overlap.log`). Si no se puede cargar el módulo nativo del SDK de
  iRacing, lo dice un aviso en todas las páginas, con los mismos botones; el aviso de que no se
  guarda también abre el registro en vez de explicar dónde está.

### Cambiado

- **«+ Añadir dato» en las barras**: en cabeceras, segundas líneas y pies, la lista «Ocultos (n)»
  pasa a ser **+ Añadir dato (n)**: cada dato oculto tiene **← Izquierda** y **Derecha →**, para
  ponerlo al final del lado que elijas (el lado donde estaba, resaltado).
- **Más sitio para los ajustes**: al bajar por las opciones, la vista previa se pliega en una
  franja de unos 120 px (con «Ver entera») y vuelve al subir; al pie de la vista previa, **Al
  bajar: Se pliega / Fija / Franja** lo cambia y se recuerda. La ventana de Ajustes se abre más
  alta (880 × 900 en una pantalla 1080p; en 1440p, 1152 × 1200) y las opciones pasan a dos
  columnas desde 1100 px de ancho (antes 1380). En las páginas de widget a dos columnas,
  «Personalizar» va a la derecha y la izquierda apila «Contenido», «Ventana y visibilidad» y las
  secciones de referencia, cada columna con su propio alto: ya no queda un hueco vacío bajo
  Contenido. A una columna, el orden sigue siendo Contenido › Personalizar › Ventana y visibilidad.
- **Vincular un coche enciende «Según el coche»**: al vincular un coche a una disposición (en
  Disposiciones o desde la bandeja), el cambio automático se activa si estaba apagado, y la página
  lo dice con «Deshacer»; quitar un vínculo no lo toca. Si estás en un coche sin disposición y
  tienes dos o más, la página y el submenú **Disposición** de la bandeja ofrecen **Vincular a «…»**
  (la que está en uso), y **Guardar la actual** trae marcada «Vincular a <tu coche>». Los coches
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
  (Avisos, Testigos). En la bandeja, una línea separa cada grupo.

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

### Corregido

- **Texto legible sobre fondos claros**: con «Contorno del texto» en «Auto», el contorno se pone
  por debajo del 65 % de opacidad (antes, del 35 %), así que un panel al 50 % sobre un cielo
  blanco ya se lee. El gris tenue (unidades, títulos de columna) es un poco más claro. Con la vista
  previa en «Día» y el fondo por debajo del 60 %, el control del fondo avisa de que se leerá mal.
- **La ayuda de «Tamaño del texto»** (Apariencia) dice exactamente a qué widgets cambia (Posiciones,
  Batalla, Pedales, Tráfico, Avisos, Testigos y Combustible) y cuáles ajustan el texto a su ventana
  (Relativo, Radar y Delta). Antes solo nombraba Clasificación y Batalla.
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

[2.2.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.2.0
[2.1.1]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.1
[2.1.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.1.0
[2.0.0]: https://github.com/jesus-molano/OverLap/releases/tag/v2.0.0
