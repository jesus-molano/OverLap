# OverLap: notas de desarrollo

Documentación técnica de OverLap: cómo se compila, cómo está montado por dentro y el detalle de
cómo calcula cada widget. La guía de uso está en el [README](../README.md).

Stack: Electron 44, electron-vite 6, Vue 3.5 (`<script setup lang="ts">`), TypeScript estricto y
Vitest 5.

## Requisitos de desarrollo

| Requisito     | Detalle                                                                        |
| ------------- | ------------------------------------------------------------------------------ |
| Sistema       | Windows 10/11 x64 (con `dev:mock` también se puede desarrollar en Linux/macOS) |
| Node.js       | 22 (>= 22.13) o 24 (el de la CI y el de desarrollo) y npm                      |
| No hace falta | Visual Studio, Python ni `electron-rebuild`                                    |

## Addon nativo y `postinstall`

`@irsdk-node/native` trae binarios N-API precompilados (`prebuildify --napi --electron-compat`), así
que funcionan tal cual con Node y con Electron sin recompilar nada. `koffi` (FFI con el que se lee el
texto de sesión) también: su binario viene en `@koromix/koffi-win32-x64`, que el empaquetado deja
fuera del asar, y solo se distribuye ese.

- El `postinstall` solo ejecuta `install-electron`: Electron 44 ya no descarga su binario durante
  `npm install`.
- Se quitó `electron-builder install-app-deps` del `postinstall` porque intentaba compilar el addon
  desde el código fuente con node-gyp, lo que exige MSVC. Por lo mismo, `electron-builder.yml` tiene
  `npmRebuild: false`.

## Instalación y scripts

```bash
npm install
npm run dev:mock   # sin iRacing: carrera simulada
npm run dev        # con iRacing abierto
```

| Script                 | Qué hace                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`          | Electron + Vite con HMR del renderer y recarga de main (`-w`). Fuente real de iRacing en Windows                                     |
| `npm run dev:mock`     | Igual, con `OVERLAY_SOURCE=mock`: carrera simulada, ~20 coches de 2 clases, coches que se ponen al lado, doblados y paradas en boxes |
| `npm run typecheck`    | Comprobación de tipos de shared + node (main, preload, telemetría) + web (renderer, `vue-tsc`)                                       |
| `npm test`             | Tests con Vitest (`src/**/*.test.ts`); `npm run test:watch` en modo watch                                                            |
| `npm run build`        | `typecheck` + `electron-vite build` a `out/`                                                                                         |
| `npm run build:win`    | `build` + `.exe` portable en `dist/` con electron-builder                                                                            |
| `npm run build:unpack` | `build` + carpeta `dist/win-unpacked` (sin instalar), útil para probar el empaquetado                                                |

También están `npm start` (`electron-vite preview`, arranca lo que haya en `out/`), `npm run lint` y
`npm run format`.

El primer `build:win` descarga una vez las herramientas de NSIS que usa electron-builder. El resultado
es `dist/OverLap-<versión>-portable.exe` (sin firmar). El portable se descomprime en una
carpeta temporal en cada arranque; `dist/win-unpacked/OverLap.exe` arranca más rápido.

Al publicar una release en GitHub, adjunta `LICENSE` y `THIRD_PARTY_NOTICES.md` junto al `.exe` (o
enlázalos en las notas): van dentro del portable, pero quien solo baja el `.exe` no los ve hasta
abrirlo, y la GPL pide que el texto de la licencia acompañe al binario.

## Fuente de datos

| Forma                                | Valores                                       |
| ------------------------------------ | --------------------------------------------- |
| Variable de entorno `OVERLAY_SOURCE` | `iracing` o `mock`                            |
| Por defecto                          | `iracing` en Windows, `mock` fuera de Windows |
| Flag del `.exe` empaquetado          | `--mock` o `--source=mock`                    |
| Abrir Ajustes al arrancar            | `--settings`                                  |

Fuera de Windows se puede desarrollar con `npm run dev:mock` (Linux/macOS).

```bash
./dist/OverLap-2.4.1-portable.exe --mock
```

Si iRacing no está abierto, Relativo y Posiciones muestran **"Esperando a iRacing…"** unos 8 s y
luego se ocultan, para no quedarse sobre el escritorio al cerrar el simulador (en modo edición siguen
para colocarlos; `visibility.showWhileWaiting` los mantiene; un error de telemetría se queda a la
vista). El radar sigue oculto, igual que cuando no hay nadie cerca, y se reintenta la conexión cada
~2 s. Si se corta la conexión, los widgets dejan de pintar el último dato en vez de quedarse
congelados. Si el proceso de telemetría falla, main lo reinicia con espera creciente.

## Archivo de ajustes (`settings.json`)

Se guardan en `%APPDATA%\iracing-overlay\settings.json` (la misma carpeta en desarrollo y en el
portable; `app.setPath('userData', ...)` en `src/main/index.ts` la fija). Junto a él está
`personal-bests.json` con los récords del Delta (el modo mock usa su propia subcarpeta `mock/`).

- Lo normal es cambiarlos desde la ventana de Ajustes; si lo editas a mano, hazlo **con la app
  cerrada**.
- El archivo lleva `version` (ahora 6, `SETTINGS_VERSION` en `src/shared/settings/defaults.ts`); los
  de versiones anteriores se migran solos (`src/shared/settings/migrate.ts`), y antes del primer
  guardado se copian una vez a `settings.json.v5.bak`, para poder volver a esa versión. Los valores por
  defecto y los límites de cada opción están en `src/shared/settingsSchema.ts`, y la normalización en
  `src/shared/settings/normalize.ts`.
- Secciones: `appearance`, `visibility`, `widgets` (posición, tamaño, escala, visibilidad, bloqueo,
  opacidad y reglas de cada widget), una por widget con sus opciones (`relative`, `radar`,
  `standings`, `battle`, `inputs`, `traffic`, `alerts`, `delta`, `fuel`, `lights`, `spotter`),
  `shortcuts`, `shortcutsMore` (el segundo y el tercer atajo de cada acción), `buttonDeviceNames`
  (el último nombre visto de cada mando), `settingsWindow`, `layouts` (`autoSwitch` y `sort`) y
  `savedLayouts` (las disposiciones: lista, la activa, los vínculos con coches, los coches recientes
  y las opciones comunes de las de solo posición; máximo 30). Desde la versión 6 de ajustes cada
  disposición guarda también las opciones de los widgets (`SavedLayout.mode` / `options`).
- Las coordenadas son DIP de la pantalla principal. Si un archivo está dañado se guarda una copia
  `.bak` y se usan los valores por defecto. `personal-bests.json` tiene su propio `.bak`.

## Widgets

| Widget      | Id          | Frecuencia | Tamaño mínimo |
| ----------- | ----------- | ---------- | ------------- |
| Relativo    | `relative`  | 10 Hz      | 300 x 150     |
| Radar       | `radar`     | 60 Hz      | 120 x 140     |
| Posiciones  | `standings` | 4 Hz       | 240 x 60      |
| Batalla     | `battle`    | 4 Hz       | 220 x 60      |
| Pedales     | `inputs`    | 60 Hz      | 120 x 70      |
| Tráfico     | `traffic`   | 4 Hz       | 220 x 60      |
| Avisos      | `alerts`    | 10 Hz      | 200 x 50      |
| Testigos    | `lights`    | 10 Hz      | 40 x 24       |
| Delta       | `delta`     | 30 Hz      | 200 x 48      |
| Combustible | `fuel`      | 2 Hz       | 180 x 40      |
| Spotter     | `spotter`   | 60 Hz      | 60 x 60       |

Las definiciones están en `WIDGET_DEFS` (`src/shared/widgets.ts`).

## Cuándo se ve el overlay (detalle)

En **Ajustes › Visibilidad** (sección `visibility` de `settings.json`; **Cuándo
mostrar el overlay** también está en la bandeja, en el submenú **Cuándo mostrar**):

| Opción                                                   | Por defecto                           | Qué hace                                                                      |
| -------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| Cuándo mostrar el overlay (`showWhen`)                   | Solo cuando estás en el coche (`car`) | `car`: mientras conduces; `race`: además, solo en carreras; `always`: siempre |
| En repeticiones (`replays`)                              | Ocultar (`hide`)                      | `follow`: siguen al coche en cámara; al rebobinar solo queda Posiciones       |
| Ocultar en la pantalla de sesión (`hideOnSessionScreen`) | Sí                                    | Salvo los widgets con «Mostrar en la pantalla de sesión»                      |
| Ocultar con la interfaz de iRacing (`hideWithSimUi`)     | Sí                                    | Si ocultas la interfaz del simulador, se ocultan los widgets                  |
| Ocultar en el garaje (`hideInGarage`)                    | Sí                                    | Mientras está abierta la pantalla del garaje                                  |
| Mantener «Esperando a iRacing» (`showWhileWaiting`)      | No                                    | Sin iRacing, Relativo y Posiciones siguen con el aviso                        |

- **En el coche** es `IsOnTrack` (tú dentro, con la física en marcha). Fuera del coche (garaje,
  pantalla de sesión, mirando la carrera, el turno de un compañero en una carrera por equipos) no se
  ve nada, salvo Posiciones en la pantalla de sesión. Un instante fuera (≤ 1 s: un reset, el
  principio de una grúa) no hace parpadear el overlay; al subir al coche vuelve en el acto.
- **Solo en carrera** oculta también la práctica y la clasificación enteras, dentro del coche.
- **Repeticiones**: por defecto no se ve ningún widget. Con «Seguir al coche en cámara» (`follow`),
  fuera del coche los widgets siguen al coche que miras mientras el sistema de repeticiones está
  activo (en directo o rebobinando). En carreras por equipos es la opción para ver el turno de tu
  compañero.
- Por encima de todo: el **modo edición** enseña siempre todos los widgets (con el motivo:
  _Oculto: fuera del coche_, _Oculto: solo en carrera_...) y `Ctrl+Shift+H` los sigue ocultando a
  mano. Las reglas de cada widget («Mostrar en», «Ocultar en boxes») se aplican además de estas.
- Un archivo de ajustes de antes de esta opción pasa a «Ocultar» repeticiones (su `follow` era el
  valor por defecto de entonces).
- **Pantalla de sesión** (`CamCameraState` 0x1): para no tapar los resultados, el chat ni los
  botones de iRacing. Cada widget tiene su excepción en la sección **Ventana y visibilidad** de
  su página (`showOnSessionScreen`); por defecto solo se queda Posiciones, con los resultados.
  Radar, Spotter, Pedales, Testigos y Delta la tienen desactivada, con el motivo: fuera del coche no tienen
  datos; Combustible también: no muestra nada con el sistema de repeticiones activo, y lo está en
  la pantalla de sesión. Con «Solo cuando estás en el coche» (o «Solo en carrera») y las
  repeticiones ocultas, la pantalla de sesión ya se oculta por estar fuera del coche: Visibilidad no
  ofrece «Ocultar en la pantalla de sesión», y solo cuentan las excepciones de cada widget. Con
  «Seguir al coche en cámara» sí cuenta: la pantalla de sesión es el punto en directo de las
  repeticiones, donde los widgets siguen al coche.
- iRacing marca `IsReplayPlaying` también en la pantalla de sesión **en directo** («Playback: Live»):
  ahí todo sigue en vivo y se cronometra como siempre. Solo es una repetición de verdad si la cinta no
  está en el punto en directo (`ReplayFrameNumEnd` > 0; sin esa variable, si `SessionTime` retrocede
  o salta).
- En directo con la cámara en otro coche, Relativo, Posiciones, Batalla y Tráfico se centran en
  él; Radar, Spotter, Pedales, Avisos, Testigos, Delta y Combustible solo tienen datos de tu coche
  y se ocultan.
- Al rebobinar no se reconstruye la carrera con la cinta: los widgets con datos en directo se ocultan
  y Posiciones (con `follow`) se queda con la carrera en directo tal como estaba. El cronometraje
  no cuenta vueltas, récords ni incidentes de la cinta, y al volver al directo todo sigue (la vuelta
  que la repetición partió no se cronometra). La línea de SR y el contador de incidentes solo salen
  con tu coche.
- Como con "Mostrar en", un widget oculto no se calcula, y en modo edición se ve con el motivo
  (_Oculto en la pantalla de sesión_, _Oculto: cámara en otro coche_...).
- En modo simulación (`dev:mock`) cada sesión lo enseña una vez: interfaz oculta a los 2:00, garaje
  a los 2:20, pantalla de sesión a los 2:30 y a los 2:50 una repetición de 14 s: 7 s en directo con
  la cámara en el coche de delante y 7 s rebobinada (oculta entera por defecto). El piloto simulado
  no se baja del coche.

## Detalle de los widgets

Cómo calcula cada widget lo que muestra, con las variables del SDK que usa y lo que falta confirmar
en una sesión real.

### Relativo

- 3 coches delante y 3 detrás por defecto (`relative.carsAhead` / `carsBehind`); si faltan coches se
  rellena con filas vacías para que tu fila quede centrada.
- Cada fila incluye posición en clase, número, nombre, licencia, iRating y gap.
- **Personalizar** (Ajustes › Relativo, cada zona con su editor: arrastrar o ↑ ↓ para ordenar, el
  ojo para mostrar u ocultar, «Restablecer»):
  - **Columnas** (`relative.columns`, `RELATIVE_COLUMN_IDS`): posición, número, logo de la marca,
    bandera del país, nombre, banderas, puestos ganados, iRating, licencia, hueco, última vuelta,
    boxes, vueltas del stint y neumático, en el orden que quieras (las que van antes del nombre
    quedan a su izquierda). Ocultas de serie: puestos ganados, última vuelta, boxes, neumático y
    stint. Solo el nombre sale siempre (`TABLE_REQUIRED`: nombre, logo, bandera y banderas no
    tienen ojo): la posición y el hueco se pueden ocultar. El logo, la bandera del país y las
    banderas de penalización se colocan en la lista, y si salen lo dice el bloque «Piloto»
    (`brandMarks`, `countryFlags`, `showFlags`: de serie `inherit`, «Global», lo de Apariencia;
    el logo en Auto sale solo si hay más de una marca en la sesión, y la bandera, nada si el
    piloto no eligió ninguna). Debajo: **títulos de columna** (`columnHeads`, «POS», «PILOTO»,
    «SR»…, desactivadas).
  - **Cabecera** (`headerBar` + `headerBarSize`) y **pie** (`footerBar` + `footerBarSize`): barras de
    datos con el mismo catálogo (nombre, sesión, tiempo o vueltas restantes, hora, hora en pista,
    SoF, coches,
    incidentes, iRating en juego, SR proyectado, vuelta rápida de clase, combustible, pista, agua,
    viento, aire, goma); «A la derecha» separa lo que se alinea al otro extremo. Tamaño No /
    Pequeña / Normal / Grande. Por defecto, la cabecera solo con el título y el pie oculto. Si no cabe, se
    quitan primero los datos menos importantes; el texto nunca baja del mínimo.
  - Las barras y los títulos de columna cuentan en el alto: con ellos el texto de las filas
    encoge un poco; los logotipos y banderas cuentan en el ancho.
- **Posición**: la misma que en Posiciones (la del modelo de carrera, no `CarIdxClassPosition`,
  que iRacing solo actualiza en meta). La de parrilla solo en carrera antes de la verde; fuera de
  carrera, sin tiempo no hay posición.
- **Gap**: a partir de `CarIdxEstTime`, normalizado a la clase del jugador y corregido en el cruce de
  meta con el `CarClassEstLapTime` de tu clase.
- **Signo** como irDashies: positivo = delante en pista, negativo = detrás.
- Color de clase en cada fila (franja y fondo del número).
- **Rojo**: coche con vuelta(s) de más que te va a doblar. **Azul**: coche doblado. Solo en carrera.
- Atenuados los coches en boxes (pit road o puesto).
- Excluye pace car, espectadores y coches fuera del mundo.

### Posiciones: parrilla, huecos y lo que queda

- **Antes de la verde**: la parrilla entera (`QualifyResultsInfo`), también los coches que aún
  cargan; sin puestos ganados, iRating en juego con todos de salida y «N coches» = inscritos.
  Reloj, vueltas y margen de SR con la duración programada, no con la cuenta atrás de parrilla.
- **Ritmo** antes de la primera vuelta limpia: tu mejor vuelta, luego los tiempos de clasificación
  (tuyo o el mejor de tu clase); `CarClassEstLapTime` solo como último recurso.
- **Grúa o reset**: el hueco se mide desde donde queda el coche (nunca un «+0.0» falso); sale
  **GRÚA** en boxes mientras dura la cuenta atrás (la tuya, `PlayerCarTowTime`; la de los demás no
  se publica: un minuto) y luego **PIT**, igual en Posiciones y Relativo; no cuenta como parada,
  y la vuelta que iRacing le acredita en el box no suma al stint. Las vueltas que se dan mientras
  OverLap no ve la carrera (una repetición, una reconexión) sí suman. Si no se sabe el intervalo y la columna de hueco al líder ya lo dice, «—» (no «+1L» dos
  veces).
- **Vuelta 1** de una salida parada: cronometrada desde que el semáforo se pone verde, como iRacing
  (un segundo antes de que la sesión pase a carrera).
- **Al final**: un retirado queda a (vueltas del ganador − las suyas); la cabecera dice «Última
  vuelta» hasta que tú cruzas la meta y entonces «Final» (también si te quedas en el box: al acabar
  la sesión).
- **Clasificación y práctica**: sin tiempo no hay puesto ni «LÍDER», y tu ventana sigue anclada en
  ti. Las vueltas que quedan no suben al salir del coche; con límite de vueltas y de tiempo, también
  sale el reloj.

### Posiciones: personalizar

En Ajustes › Posiciones, un editor por zona (arrastra ⠿ o ↑ ↓ para ordenar, el ojo muestra u
oculta, «Restablecer» vuelve a lo de fábrica); la muestra de al lado cambia al momento:

- **Columnas** (`standings.columns`): orden y visibilidad; solo el nombre es fijo (la posición y el
  número tienen su ojo; logo, bandera y banderas, su fila en «Piloto»). Si
  la ventana se estrecha se van primero las columnas añadidas (iRating en juego, stint,
  neumático…), luego la bandera y el logotipo, después las de siempre y, al final, el número queda
  en una franja: un adorno nunca quita una columna que ya había. «Hueco al líder» sigue atado a
  «Hueco: Ambos» y «iRating en juego» a «iRating en juego de todos».
- **Títulos de columna** (`columnHeads`, desactivadas): una fila con «POS», «PILOTO», «iR»,
  «INT.»… en el orden de las columnas; la del hueco dice «LÍDER» o «DIF.» según el modo y la sesión.
- **Logotipo de la marca** (`brandMarks`: Auto, Siempre, Nunca; Auto solo si hay varias marcas) y
  **bandera del país** (`countryFlags`), del bloque «Piloto»: de serie «Global» (`inherit`, lo de
  Apariencia: Auto y activada).
- **Cabecera, segunda línea y pie** son barras de datos (`headerBar`, `subheaderBar`, `footerBar`,
  cada una con su tamaño o «No»): sesión, lo que queda, hora local, SoF, coches, incidentes,
  iRating en juego, SR proyectado, vuelta rápida de clase, combustible y las condiciones. Por
  defecto, la cabecera con el título, la sesión y el SoF a la izquierda y tus incidentes y lo que
  queda a la derecha; la segunda línea (tu iRating en juego, la vuelta rápida de clase y tu SR)
  apagada en una instalación nueva (`subheaderBarSize: 'off'`); el pie de condiciones (pista, agua y
  viento; el aire y la goma, ocultos en la lista) y los coches. Con varias clases el SoF y los coches van en cada línea de clase, no arriba.
- **Línea de clase** (`classLine`): SoF y número de coches, en el orden que elijas.
- **Vuelta rápida**: la mejor vuelta de cada clase va en una placa morada que llena su celda, y su
  fila lleva la etiqueta «VR» junto al nombre.

### Posiciones y relativo: mejor vuelta, stint, neumático y banderas

Lo que el overlay nativo no da, cada cosa como opción propia:

- **Mejor vuelta** también en carrera (`CarIdxBestLapTime`): columna `best` de la clasificación,
  activa por defecto; morada si es la mejor de la clase. Fuera de carrera ya la muestra «Última
  vuelta».
- **Última parada** (`pitLap`, «V12») y **vueltas del stint** (`stint`, «7 v»): las calcula el modelo
  de carrera desde la última salida de boxes o desde la salida. Si OverLap arranca con la carrera
  empezada, cuenta desde la salida (no sabe de paradas anteriores). En la pantalla de sesión y en las
  repeticiones son los de la carrera en directo.
- **Neumático** (`tyre`): la letra del compuesto (`CarIdxTireCompound` + `DriverTires` del YAML,
  H = duro, W = lluvia). iRacing solo nombra los compuestos de tu modelo de coche: el resto sale «—».
  La columna solo aparece cuando alguien no lleva el compuesto habitual (el 0): una «H» en todas
  las filas no dice nada.
- Las tres van ocultas por defecto, al final de la lista de columnas, y son las primeras en
  esconderse si la ventana se estrecha (luego la mejor vuelta).
- **Banderas** tras el nombre: negra, reparación (meatball) y aviso (negra enrollada, dibujada como
  la bandera blanca y negra de aviso). Las muestran Relativo, Posiciones, Batalla y Tráfico, y en los cuatro se
  pueden quitar (`showFlags` del bloque «Piloto»: de serie «Global», `appearance.penaltyFlags`,
  activada). La negra enrollada que iRacing pone a
  un coche que ya terminó no se muestra.
- En el relativo: las columnas `tyre` y `stint` de `relative.columns` (ocultas) y `relative.showFlags`
  (Global). Con más columnas el texto encoge un poco si la ventana es estrecha; las filas no
  cambian de alto.
- En modo mock se ven paradas, stints, duros y algún coche con lluvia, y un aviso al coche de delante
  entre los 2:30 y los 3:15 de cada sesión.

### Radar

- Vista cenital en SVG alrededor de tu coche.
- iRacing no da coordenadas X/Y de los demás coches:
  - **lateral**: `CarLeftRight` (solo válido con el jugador en pista, `IsOnTrack`);
  - **longitudinal**: diferencia de `CarIdxLapDistPct` × longitud de pista (`WeekendInfo.TrackLength`).
- Alcance configurable (`radar.rangeM`), 20 m por defecto.
- Color de verde a rojo según cercanía.
- Los coches se dibujan a escala: un icono mide lo que un coche (4,6 m), así que el hueco que ves es
  el real con cualquier alcance.
- Los coches que se solapan contigo conservan su lado mientras dura el solape (iRacing no dice cuál es
  cuál, solo cuántos hay a cada lado) y lo mantienen hasta 3 s (o 12 m) después, cuando el SDK ya no
  da información lateral: un coche que te acaba de pasar por la izquierda se sigue viendo a la
  izquierda en vez de "en tu carril".
- Un coche de tu carril a menos de un coche de distancia sin lado de iRacing (la salida parada, un
  coche que se reincorpora) está a tu lado sin saber en cuál: se dibuja atenuado y con contorno
  discontinuo a su distancia real, encima de tu coche, nunca pegado a tu parachoques ni encima de otro.
- En las sesiones en solitario (clasificación «Lone Qualify») los demás coches no están en pista
  contigo: el radar solo usa `CarLeftRight` y Tráfico no lista a nadie.
- Capas (`radar.parts`): guías de distancia, avisos laterales y las distancias sobre las guías (estas,
  solo con las guías). Los coches y el tuyo siempre se dibujan.

### Spotter

- `src/shared/spotter.ts`: su propia pasada de `computeRadar` (alcance 12 m, el de la memoria de
  lado), con su propia memoria, así que funciona con el radar oculto o con otro alcance. Un `prev`
  nulo del bucle (sesión nueva, reconexión, una regla que lo ocultó) la reinicia.
- Cada lado lleva lo de los dos estilos (`spotter.barStyle`, de dibujo). **Cercanía** (de serie,
  `closeness`): la proximidad del radar sobre su alcance, 1 con alguien al lado (`CarLeftRight`), y
  para un coche que el radar mantiene en su lado `1 - (|d| - L) / (12 - L)`, cuantizado a 1/50. Se
  dibuja como un bloque a toda altura escalado desde abajo (`closeTransform`), con la rampa
  ámbar→rojo (`color-mix` de `--ov-warn` y `--ov-alert`, así sigue la paleta para daltónicos). Un
  coche que se acerca sin haber estado al lado no tiene lado: no llena nada.
- **Dónde te cubre**: cada barra es tu coche (4,6 m), de morro (0) a cola (1). Un coche al lado a `d` m (positivo,
  delante) cubre `[max(0, -d/L), min(1, 1 - d/L)]`, pegado al extremo en el que va; como mínimo
  `SPOTTER.minCover` (8 %) si iRacing lo cuenta un poco más allá de un coche. Dos coches en un lado:
  sus dos tramos, unidos si se tocan, y la cuenta (2). Un lado que `CarLeftRight` da pero sin coche
  que lo case (fantasma del radar, o sin longitud de pista) es `unknown`: barra entera discontinua.
- Tope de aproximación: un coche que el radar mantiene en su lado (estuvo al lado hace menos de
  3 s) y está a menos de 12 m: `nearFront` / `nearRear`, de 0 a 1 (a un coche de distancia).
- Cuantizado a 1/50 de coche (topes a 1/10) y `SKIP_EMIT` con `spotterEqual`: solo se envía cuando cambia una barra,
  muchos menos mensajes que sus ticks a 60 Hz (la prueba del mock lo comprueba).
- Opciones (`spotter.*`, todas de dibujo): `barStyle` (`closeness` | `cover`), `onlyAlongside`, `barWidth` (px) y `parts`
  (`nearCap`, solo con «Dónde te cubre», y `twoMark`). Oculto de serie (`defaultVisible: false`) y en `HIDDEN_WHEN_ADDED`.
- Un lado sin nadie es un objeto compartido y congelado, como el payload fuera del coche: una pasada tranquila no reserva memoria.
- Dibujo: dos pilares HTML en los extremos de la ventana (`display: flex; justify-content:
space-between`); cada tramo es un bloque a toda altura escalado desde arriba (`transform`, una
  cadena por tramo cuantizado), los topes cambian solo `opacity`. Color con la rampa
  `--ov-prox-N` del radar (paleta para daltónicos incluida).

### Tráfico

- Coches más rápidos que te alcanzan por detrás, más lentos a los que alcanzas y peligros delante.
- Un coche de tu clase con al menos una vuelta de ventaja que viene por detrás sale siempre como
  «Te dobla», aunque la carrera sea de una sola clase (`traffic.onlyMulticlass`) o vaya a tu ritmo; y
  con bandera azul, cualquier coche por detrás que pueda estar adelantándote. Si está a menos de
  3 s o tardaría más de 30 s en alcanzarte, dice a qué distancia va («a 0.3 s») en vez de cuándo
  llega; con bandera azul se pone en ámbar a menos de 2 s y en rojo a menos de 1 s.
- Con una sola clase en la sesión no hay columna de clase.
- Se desvanece cuando no hay nadie cerca ni al lado, con histéresis para que no parpadee en el límite
  del alcance.
- Si la longitud de pista falta o viene rara, solo se muestran los avisos laterales.
- **Personalizar** (Ajustes › Tráfico): grupos (`traffic.groups`: orden y cuáles; uno oculto no se
  busca), columnas de cada línea (`traffic.parts`: icono, clase, piloto, banderas, texto antes del tiempo,
  tiempo y sector; piloto, tiempo y banderas sin ojo), barras de datos (`traffic.headerBar`, el
  título, visible; `traffic.footerBar`, apagado) y rótulos de grupo (`traffic.captions`, activados;
  el antiguo `traffic.header` se migra a estos dos). Sin rótulos, una raya separa los grupos;
  sin el texto «te alcanza en», un peligro conserva su etiqueta («Parado»).

### Batalla: personalizar

En Ajustes › Batalla, un editor por zona (arrastrar, ↑ ↓, ojo):

- **Rivales** (`battle.lanes`): el de delante y el de detrás, en el orden que elijas (arriba o a
  la izquierda el primero); uno oculto no se busca y sin ninguno el widget no sale.
- **Filas** (`battle.rows`): predicción, sectores y vueltas, en orden; las vueltas van ocultas por
  defecto. La línea del rival y la del hueco son fijas.
- **Detalles** (`battle.parts`): iRating y licencia del rival, texto de la tendencia e iRating en
  juego. El iRating no sale lado a lado.
- **Predicción de alcance** (`battle.prediction`): sus cuatro frases («Le alcanzas en…», «Te
  alcanza en…», «Necesitas… s/v», «No le alcanzas · No te alcanza»), cada una con su ojo, en orden
  fijo.
- **Hueco** (`battle.gapStyle`): `plain` («Sin signo», el medido, de serie) o `relative` («Como
  Relativo», positivo delante y negativo detrás). Disposición (`battle.layout`): `stacked` o
  `side`. Cabecera y pie (`battle.headerBar`, `battle.footerBar`): barras de datos, apagadas de
  serie.
- **Logotipo de la marca** (`battle.brandMarks`, Auto: solo con varias marcas en la sesión) y
  **bandera del país** (`battle.countryFlags`), del bloque «Piloto», de serie «Global»
  (Apariencia): delante del nombre; por debajo de
  ~20 em de ancho se ocultan para dejar sitio al nombre.

### Delta

- Barra delta a 30 Hz: segundos arriba o abajo frente a una referencia en tu punto de la vuelta,
  tendencia (ganando / perdiendo), vuelta prevista y cada sector frente a la referencia (el que estás
  corriendo, en vivo).
- Referencia **por tipo de sesión** (`delta.referencePractice`, `referenceQualify`, `referenceRace`):
  por defecto récord en práctica y tu óptima en clasificación y carrera. Un `settings.json` con la
  antigua `delta.reference` en `pb` (la de antes por defecto) pasa a estas; otra se copia a las tres.
- Referencias:
  - **Récord personal** (`pb`): tu mejor vuelta limpia de siempre con ese coche en ese trazado. Se
    guarda en `personal-bests.json`, junto a `settings.json` (el modo mock usa su propia subcarpeta
    `mock/`), y no se pierde al cambiar de sesión, a diferencia del delta de iRacing.
  - **Mejor vuelta de la sesión** (`session`): tu mejor vuelta limpia de esta sesión.
  - **Vuelta óptima** (`optimal`): tus mejores tiempos de cada sector del circuito en tus vueltas
    limpias de esta sesión, unidos en una vuelta. Sin sectores en la sesión es tu mejor vuelta.
  - **Mejor de tu clase** (`class`): la vuelta limpia más rápida de tu clase en la sesión, sea de
    quien sea.
  - **Óptima de tu clase** (`classOptimal`): los mejores tiempos de cada sector en las vueltas
    limpias de tu clase en esta sesión, sean de quien sean (tú incluido), unidos en una vuelta.
- Con `delta.fallback` se usa la siguiente mientras no exista la elegida: pb → session → class,
  session → class, optimal → pb → classOptimal y classOptimal → pb (`class` no tiene ninguna).
- La referencia solo cambia al empezar una vuelta, así el delta nunca salta a mitad de vuelta (un
  sector mejor marcado a mitad de vuelta cuenta desde la siguiente). También al elegir otra en Ajustes
  o con el atajo «Cambiar la referencia del delta» (sin teclas por defecto: pasa a la siguiente en la
  sesión actual): el widget dice unos segundos «Vuelta óptima desde la próxima vuelta» y luego su
  nombre.
- Personalizable (`delta.rows`, `delta.top`, `delta.refBars`, `delta.laps`): el orden de las filas
  (línea superior, barra, **filas por referencia**, sectores y **tiempos de vuelta**; las filas por
  referencia y los tiempos, ocultos de serie), qué referencias llevan fila (`delta.refBars`: récord,
  mejor de la sesión y óptima visibles; las dos de clase, ocultas; desde 2.4.1 cada una es una fila
  igual, con su nombre, su delta, su tendencia y su barra a la misma escala), qué sale en la línea superior (tendencia, vuelta prevista,
  referencia) y, en la fila de tiempos (oculta por defecto), tu última, tu mejor, tu óptima y tu
  récord en el orden que quieras. El tiempo con el que compara el delta va subrayado y con «Δ» (también
  con la referencia de reserva); las de clase no son una vuelta tuya y no marcan ninguno.
- Solo cuentan vueltas limpias conducidas por ti (sin boxes, salidas de pista, paradas ni amarillas).
  La vuelta en curso se marca como inválida en cuanto deja de contar; la vuelta de salida dice
  `vuelta de salida` y la grúa `grúa`. Sin vuelta en curso (parrilla, antes de cruzar meta) no dice
  nada.
- Tras tu bandera a cuadros se queda la última vuelta. Fuera de carrera también: la vuelta empezada
  con la bandera fuera o sin vueltas restantes (la de enfriamiento) no se cronometra.
- El récord se escribe unos segundos después de cruzar meta, cuando llega el tiempo oficial, de forma
  atómica y sin frenar el bucle. Si el archivo está dañado se guarda una copia `.bak`.

### Avisos

- Una banda con lo que te afecta: lo más importante en grande y el resto debajo, en pequeño, cada aviso con sus
  palabras y su marca (se lee también con la paleta daltónica). Un aviso breve sigue en pantalla al
  menos `alerts.holdS` segundos.
- Extras (`alerts.parts`): «qué hacer» tras cada aviso y los demás avisos en chips.
- Cada caso se activa o desactiva en Ajustes › Avisos; todos vienen activados:
  - **Banderas** tuyas y de la sesión, también la **negra enrollada**
    (`ADVERTENCIA · dirección de carrera`, sin motivo: no llega en los datos). Solo dentro del coche.
    La verde y la de cuadros cuentan desde que salen (3 y 10 s, o «Mantener visible» si es más):
    iRacing deja la de cuadros puesta hasta el cambio de sesión. La negra enrollada tras tu bandera
    no sale.
  - **Limitador** en el pit lane: puesto, `LIMITADOR OFF` y por encima del límite del YAML
    (`TrackPitSpeedLimit`) con o sin él: `EXCESO 68 / 60 · LIMITADOR OFF`. No se lee durante la
    grúa ni los 2 s después de aparecer en tu box (el limitador llega un momento después).
  - **Antes de la entrada**: `PON LIMITADOR` al pasar de la pista a la zona de boxes
    (`PlayerTrackSurface`) sin el limitador. Esa zona también cubre el pit lane y la salida, así que
    se calla en cuanto pisas el pit lane y no vuelve al salir.
  - **10 y 5 vueltas** para el final de la carrera (`QUEDAN 5 V`), unos segundos y una sola vez
    cada una: con `SessionLapsRemainEx` (tus vueltas, una menos si te han doblado) y, en carreras a
    tiempo, con la misma estimación que la clasificación.
  - **Grúa** con cuenta atrás hasta poder salir de tu box (`PlayerCarTowTime`), lo primero de
    todo; la reparación (meatball) va al lado y, en tu box, sin «entra en boxes». **Motor calado**
    (solo dentro del coche) y **sentido contrario**: tu `LapDistPct` va hacia atrás mientras avanzas
    en marcha; no cuentan la marcha atrás, el pit lane ni el cruce de meta.
  - **Incidentes**: `+2x Pérdida de control · V5 · S3 · grava` al sumar puntos (ver Incidentes).
  - **Motor**, solo lo crítico (cada uno con su opción): **motor calado**, **presión de aceite**
    (`PRESIÓN ACEITE · baja`) y **daños**: `DAÑO · reparación obligatoria en boxes` mientras esté
    pendiente, hasta que sale la bandera de reparación. Las temperaturas, su tendencia, la gasolina y
    las reparaciones opcionales están en **Testigos**, con las mismas reglas.
  - **Combustible** (ver Combustible): `ENTRA ESTA VUELTA` va justo detrás de la presión de aceite y
    no espera a una bandera; `COMBUSTIBLE · 1.6 V`, detrás de las banderas amarilla y azul, que no se
    quedan en un chip por él. Ninguno durante la grúa ni en el pit lane.
- En un `settings.json` de antes de Testigos, «Testigos del motor» pasa a «Presión de aceite», y lo
  que Avisos tenía apagado sigue apagado en Testigos: «Testigos del motor» (presiones de aceite y
  gasolina, agua y aceite), «Daños» (las dos reparaciones), «Motor calado» y «Temperatura al alza».
- En modo mock cada caso sale al menos una vez: entre los minutos 15 y 22 de la sesión; el
  limitador, en tu parada, y las 10 y 5 vueltas, cuando tocan.

### Pedales

- Traza, barras y datos (marcha, velocidad, volante) en el orden que quieras, cada uno con su ojo
  (`inputs.sections`, `inputs.bars`, `inputs.info`); freno y acelerador siempre.
- Alto automático por defecto (Ventana → Alto): el panel mide lo que su contenido, sin hueco vacío, y
  el texto sigue la escala del widget, no la ventana. Un `settings.json` de antes pasa a alto
  automático una vez.
- Luces de cambio (`inputs.shiftLights`): una tira de 10 LED arriba, verde → amarillo → rojo desde
  `DriverCarSLFirstRPM` hasta `DriverCarSLLastRPM` del YAML; desde `SLShiftRPM` se encienden todas
  en rojo y desde `SLBlinkRPM` parpadean. Un coche sin luces en el YAML las toma de su
  `DriverCarRedLine`.
- Bloque «Coche» (`inputs.sections` → `car`, filas en `inputs.car`): RPM, reparto de frenada (`BB`,
  `dcBrakeBias`), TC (el nivel de `dcTractionControl`: el SDK no dice cuándo actúa) y FFB (el % de
  `SteeringWheelPctTorque`; en rojo un momento cuando llega al 100 %, el clipping). Una fila sin
  dato en ese coche (sin reparto o sin TC) no sale.
- Volante (`inputs.steeringStyle`): barra, minimalista (aro fino), realista (GT con radios) o
  fórmula (rectangular con empuñaduras), dibujados en SVG y girando con `SteeringWheelAngle` los
  grados reales, hasta el tope del coche (`SteeringWheelAngleMax`). Tamaño pequeño, mediano o grande
  (`inputs.wheelSize`), color de la marca (`inputs.wheelColor`: el acento de Apariencia, `accent`, o uno propio) y grados opcionales debajo
  (`inputs.steeringDegrees`). Un volante grande hace el panel un poco más alto.
- Un `settings.json` de antes se ve igual: el volante de antes pasa a «realista» y las luces y el
  bloque «Coche» llegan apagados. En una instalación nueva salen encendidos.
- Mock: revoluciones por marcha (las luces se llenan en cada marcha y parpadean justo antes de
  subir), reparto 54,5 → 54,0 → 53,5, TC 4 → 3 y clipping en las curvas más rápidas.

### Testigos

- Los testigos del motor como en un salpicadero, en fila (si no caben, siguen debajo) o en columna:
  presión de aceite, presión de gasolina, motor calado, reparación obligatoria, reparación opcional,
  temperatura del agua y del aceite y, si los activas, limitador de boxes y corte de revoluciones.
  Pequeño por defecto, visible en todas las sesiones, bajo el Delta.
- Apagados en gris; encendidos, cada gravedad con su color y su forma (se lee sin el color): rojo
  relleno (actúa ya), naranja con borde (el testigo del propio coche, daños leves), amarillo subrayado
  (agua o aceite muy por encima de tu media, antes de su testigo: `+6°`) y azul con raya (limitador).
- Opciones (`lights.*`): cada testigo y su orden (`lights.icons`), en columna los textos a la
  izquierda o a la derecha de los iconos (`lights.labelSide`), `Solo encendidos` (se oculta mientras no hay ninguno),
  rótulos (`AGUA`, `REPARAR`…), la temperatura junto a agua y aceite (`98°`) y el tiempo de
  reparación: `REPARAR · 42 s` (`PitRepairLeft`), `OPC. · 38 s` (`PitOptRepairLeft`), solo si es
  mayor que 0. Su página de Ajustes tiene una leyenda: qué es cada testigo y qué hacer.
- Tiempo de reparación: la cifra de iRacing es el tiempo **del equipo**, que en una parada real
  bajó ~1 s cada varios segundos (OverLap la muestra en ≤ 100 ms). Por eso sale marcada
  `42 s (equipo)` (`42 s eq.` en ventanas estrechas; `lights.repairCrewTag`, activado). Con
  `lights.repairCrewTag` apagado vuelve a `42 s`; un archivo de ajustes de antes de la marca la deja apagada, para que tras actualizar se lea lo mismo.
- `Cuenta atrás real (estimada)` (`lights.repairRealTime`, **apagado** por defecto): parado en tu box
  con el servicio en marcha (`PitstopActive`), mide cuánto baja la cifra en los últimos 3 s (al menos
  2 s seguidos bajando) y muestra los segundos reales que faltan, cifra / ritmo, a menudo más que la del equipo: `42 s (equipo)` puede ser `≈ 95 s (real)`.
  Una pausa (1 s sin bajar) congela la estimación; nunca sube ni baja de 0. Hasta saberlo, remolcado,
  fuera del box o en una repetición, sale la del equipo. Si la cifra solo baja a saltos de más de 1 s,
  no hay estimación (`src/shared/notices/repairClock.ts`).
- Falta confirmar con una grabación real de una parada con daños: si `PitRepairLeft` baja suave o a
  saltos (y cada cuánto), si `PitstopActive` está activo durante toda la reparación, si el ritmo es
  constante con gasolina y neumáticos a la vez, qué pasa con la reparación rápida y si el tiempo de
  la grúa ya incluye la reparación. Avisos no muestra el tiempo (su `DAÑO` sale fuera del box).
- Las reglas son las de Avisos, en un solo sitio (`src/shared/notices/engine.ts`): nada durante la
  grúa, en tu box, con el coche fuera del mundo, los 2 s después de reaparecer ni los 3 s después de
  subir al coche (ahí parpadean con el coche parado); las presiones, solo con el motor en marcha (a
  más de 5 m/s o al 80 % del ralentí, `DriverCarIdleRPM`) y sin calar. Las reparaciones siguen
  encendidas en el box y durante la grúa: ahí se hacen. Un testigo que parpadea se queda 1 s.
- La tendencia: el agua o el aceite 20 s por encima de tu media de vueltas limpias de la sesión; solo
  cuentan vueltas a 1 °C o menos de la anterior, y la media empieza de cero tras una grúa o un salto de
  más de 5 °C (una reparación). Con rótulos dice `¿rebufo?` si ibas pegado a otro coche.
  `WaterTemp` y `OilTemp` dependen del coche: si no los tiene, no hay tendencia ni temperatura.
- En un `settings.json` de antes de este widget, Testigos empieza **visible** en un hueco libre cerca
  de su sitio (oculto si no hay ninguno): se lleva lo que antes salía en Avisos. Empieza oculto si
  Avisos estaba oculto o tenía apagado todo lo que se llevó («Testigos del motor», «Daños» y
  «Temperatura al alza»): no salía nada de eso en pantalla.
- En modo mock cada testigo se enciende al menos una vez entre los minutos 15 y 22 (las reparaciones
  con 42 y 38 s), y el limitador en tu parada.

### Incidentes

- **Contador**: el elemento «Incidentes» de las barras de datos (Relativo, Posiciones, Batalla,
  Tráfico y Combustible), de serie solo en la cabecera de Posiciones, en cualquier tipo de sesión: `3x` (`PlayerCarMyIncidentCount`), en carreras por equipos también el del equipo
  (`3x · eq. 7x`), y el próximo límite de la sesión si lo hay (`11x · pen. a 17x`, `DQ a 25x`). Se
  pone naranja a 4x o menos del límite. Las antiguas `relative.showIncidents` y
  `standings.headerIncidents` se migran a ese elemento.
- **Aviso «+Nx»** en Avisos, al menos 6 s (o «Mantener visible» si es más):
  `+2x Pérdida de control · V5 · S3 · grava`. El tipo sale de `PlayerIncidents`, la vuelta y el
  sector del modelo de carrera y la superficie de `PlayerTrackSurfaceMaterial`. Las subidas a menos
  de 2 s son un solo incidente (iRacing puede subir 2x a 4x); con varios avisos gana el más grave
  (choque con coche, golpe contra el muro, pérdida de control, salida de pista, roce): el byte de
  penalización no son los puntos. Si `PlayerIncidents` no dice nada, solo `+2x` y dónde fue. Opción
  `alerts.showIncidents`.
- No cuenta nada durante una repetición, al conectar ni al cambiar de sesión (iRacing empieza cada
  sesión de cero).
- Límites del YAML: `IncidentLimit` se lee como la DQ e `IncidentWarningInitialLimit` /
  `IncidentWarningSubsequentLimit` como penalizaciones; con «unlimited» no se muestra límite. Falta
  confirmarlo en una carrera oficial.
- Solo los tuyos: iRacing no da incidentes de los demás pilotos.

### Condiciones de pista (barras de información)

- Ya no es un widget aparte ni una línea fija: pista, agua, viento, aire y goma son elementos de las
  barras de información, que van en la cabecera o en el pie del Relativo, Posiciones, Batalla,
  Tráfico o el Combustible (Ajustes › Personalizar; `*.headerBar`, `*.footerBar`). Por defecto el pie está
  **visible en Posiciones**, que crece una línea, y **oculto en el Relativo**, donde quitaría
  alto a las filas; en una instalación nueva muestra pista, agua y viento (el aire y la goma,
  ocultos en su lista). La flecha de la pista y el dial del viento se activan en la fila de su elemento,
  en cualquier barra (`conditionsTrend`, `conditionsWindDirection`).
- Los datos (iRacing no da pronóstico):
  - temperatura de la pista (`TrackTempCrew`, en grados enteros: va en pasos de 1 °F) con una
    flecha si sube o baja en los últimos 5 min (sin contar los primeros 10 s de cada sesión);
  - el agua, solo si la hay: **DECLARADA MOJADA** (`WeatherDeclaredWet`), el medidor de
    `TrackWetness` desde «Casi seco» y la lluvia (`Precipitation`) desde el 1 %;
  - el viento medio del último minuto, con un dial que apunta a tu coche desde donde sopla
    (`WindDir` − `YawNorth`, solo al volante); sin dirección (en calma, fuera del coche) o con el
    dial desactivado, con su rótulo: `VIENTO 14 km/h`;
  - el aire (`AirTemp`) y la goma al empezar la sesión (`SessionTrackRubberState`; un «carry over»
    muestra el último estado real: «Media-alta (heredada)»).
- En una barra estrecha los datos se quitan enteros, primero los menos importantes (la goma), y el
  medidor cambia su palabra por un rótulo corto (`AGUA`); nunca se corta un texto. Grados y velocidad según
  `appearance.units`.
- Se calcula una vez por segundo y solo si alguna barra lo muestra; las tablas lo llevan en sus datos y el
  pie solo se vuelve a dibujar cuando cambia lo que muestra.
- Confirmado en una carrera: `WindDir` es de dónde viene el viento y `YawNorth` gira en sentido
  horario. Falta confirmar la escala de `Precipitation` (se lee 0..1; `src/shared/conditions.ts`).
- Un `settings.json` con el antiguo widget Condiciones se carga sin él: se descartan su posición y
  sus opciones, y lo demás queda igual.
- En modo mock la pista se calienta, se queda estable y se enfría, el viento cambia un poco y a los
  21 min pasa un chubasco que la moja y la declara mojada.

### Combustible

- Para carreras largas; por defecto en práctica (donde se mide el consumo) y en carrera. En grande, los litros (`FuelLevel`) y las
  vueltas que te dan (verde si llegas a meta, rojo con menos de 2 y sin llegar) y, a la derecha, las
  vueltas que quedan (las del modelo de carrera: en carreras a tiempo, con el ritmo del líder).
- El consumo se mide en cada paso por meta, solo en vueltas limpias: sin pit lane, amarilla, grúa,
  reinicio ni salida de pista, ni la primera de la carrera, ni las que no conduces tú. Media de las
  últimas `fuel.avgLaps` (5), la última y la que más gastó; «midiendo…» hasta la primera. Entre
  sesiones del mismo coche y circuito (práctica → carrera) se aprovecha la media anterior hasta tener
  una propia.
- Cabecera y pie opcionales (`fuel.headerBar`, `fuel.footerBar`, ocultos por defecto): barras de
  datos como las del Relativo y Posiciones (nombre, hora, sesión…; sin las vueltas de combustible,
  que ya dice la línea principal), en tamaño pequeño, normal o grande.
- Líneas, cada una con su ojo y en el orden que quieras (`fuel.lines`; la principal siempre): depósito (barra con una marca en lo que necesitas),
  consumo, para meta y repostar (con `fuel.marginLaps` vueltas de margen, 0.5; `LLENO` si una parada
  no basta) junto a lo que tienes en el menú de boxes (`PitSvFuel`, naranja si no llega), ventana
  `V24–V28` y paradas, ahorro por vuelta para quitarte una parada (si es un 10 % o menos), la última
  lectura de neumáticos y las reparaciones rápidas y juegos que quedan si la sesión los limita (estas
  dos, `tyres` y `limits`, ocultas en una instalación nueva).
- El plan cuenta paradas al final de vuelta (la última, en la penúltima vuelta) y relevos de vueltas
  enteras, y parte del combustible con el que empezó la vuelta: no baila dentro de la vuelta. En la
  última ya no hay parada: solo dice si llegas (`SOBRAN`) o no (`FALTAN`). Desde la parrilla o el
  pit lane, el tramo hasta la línea no es una vuelta (como en el modelo de carrera): la primera parada
  posible es al final de la V1.
- Capacidad: `DriverCarFuelMaxLtr` por el menor de `DriverCarMaxFuelPct` y `CarClassMaxFuelPct` (el
  BoP). Litros siempre.
- Neumáticos: iRacing solo mide el desgaste (`LFwearL`… `RRwearR`) con el coche parado en tu box, así
  que en pista no hay desgaste en directo; se muestra la lectura de la última parada (lo que queda de
  la banda más gastada de cada rueda) y la vuelta.
- En Avisos, dos más (activados por defecto): `ENTRA ESTA VUELTA` cuando, en carrera, la ventana se
  cierra en esta vuelta y `COMBUSTIBLE · 1.6 V` con menos de 2 vueltas de gasolina, los dos solo si
  con tu media no llegas a meta (una parada que solo pide el margen no es una alarma). Usan el mismo
  consumo; ninguno en el pit lane ni en una repetición.
- En un `settings.json` de antes de este widget, Combustible empieza **oculto** y en un hueco libre
  cerca de su sitio por defecto, para no tapar lo que ya tenías colocado.
- Sin confirmar en una sesión real: la escala de los `%` de capacidad y desgaste, si `FuelLevel`
  sigue al coche con un compañero al volante y cuándo exactamente se actualiza el desgaste en el box
  (`src/shared/fuel/`).
- En modo mock el coche gasta ~2.95 L por vuelta con un depósito de 85 L, llega justo a su parada
  (los dos avisos salen antes), echa 20 L, cambia neumáticos y termina con margen.

## Arquitectura

```
 iRacing SDK (memoria compartida, solo lectura)        mandos (Raw Input, solo lectura)
        |                                                      |
        v                                                      v
 +--------------------------------------+   +--------------------------------+
 | utilityProcess de telemetría         |   | utilityProcess de entrada      |
 |  TelemetrySource: IRacingSource      |   |  src/input (solo mientras algún|
 |                   MockSource         |   |  atajo es un botón)            |
 |  bucle ~60 Hz -> PROVIDERS (shared)  |   +--------------------------------+
 +--------------------------------------+            |  botones pulsados
        |  status / data / log      ^  config / shutdown
        v                           |                v
 +-------------------------------------------------------------+
 | main (Electron)                                    src/main |
 |  dónde está cada widget, qué ventana lo aloja, ratón,       |
 |  estado, bandeja, atajos, ajustes                           |
 +-------------------------------------------------------------+
        |  IPC: cada payload solo a la ventana que aloja su widget
        +------------------------------+------------------------+
        v                              v                        v
 [ ?view=overlay  pantalla 1 ]  [ ?view=overlay  pantalla 2 ]  [ ?view=osd ]   src/renderer (Vue)
   relativo, radar, ...           posiciones, ...                aviso de un     + src/preload
   (un panel por widget)                                         atajo
```

Una sola ventana por pantalla: Chromium presenta más o menos una ventana por refresco, así que ocho
ventanas que se actualizan a la vez se reparten los ~60 fps (unos 7 fps cada una); en un solo
documento todos los paneles van a la tasa de refresco.

- **Telemetría** (`src/telemetry`, un `utilityProcess`): bucle a ~60 Hz que cede el event loop con
  `setImmediate`. Lee solo las variables de `TELEMETRY_VARS` (`src/shared/telemetry.ts`) con
  `getTelemetryVariable`, reparsea el YAML de sesión solo cuando cambia `getSessionVersionNum` y
  calcula cada payload con los providers de `src/shared/providers.ts`, cada uno a la frecuencia de su
  widget. Solo calcula los widgets activos que le indica main (`TelemetryConfig`).
- **Main** (`src/main`): decide dónde está cada widget (coordenadas de pantalla en DIP, las de
  `settings.json`), a qué pantalla pertenece (la que contiene su centro; si su monitor no está, cae en
  la principal sin guardar ese cambio) y qué ventana lo aloja (`overlayWindows.ts`,
  `overlayWindow.ts`, reglas puras en `overlayLayout.ts`). Cada ventana cubre su pantalla, es
  transparente, no coge el foco (`focusable: false`, solo `showInactive()`), está siempre encima y
  deja pasar los clics. Main reenvía cada payload solo a la ventana que aloja su widget, decide cuándo
  una ventana coge el ratón (`mouseMode.ts`), guarda lo que el renderer confirma y la oculta en
  cuanto su superficie puede quedar mal (fallo o cuelgue del renderer, pérdida de la GPU, suspensión,
  cambio de pantalla) hasta recuperarla.
- **Renderer** (`src/renderer`): la misma app Vue con `?view=overlay` (las ventanas del overlay),
  `?view=settings` (Ajustes) o `?view=osd` (el aviso sobre el juego al usar un atajo,
  `src/main/osdWindow.ts`: transparente, sin foco y sin ratón; se apaga con
  `settingsWindow.shortcutToasts`). En el overlay, `overlay/OverlayApp.vue` pinta un panel con posición
  absoluta por widget (`WidgetSlot.vue`, `contain: strict`), ajusta los de alto automático a su
  contenido y hace las interacciones del modo edición (`EditFrame.vue`, `dragSession.ts`); lo que
  cambian vuelve a main como `BoundsCommit`. Preload tipado con `contextBridge` (`window.overlay`,
  tipo `OverlayApi`) y sandbox.
- **Lógica pura** en `src/shared`: sin Electron, Node ni DOM, y con tests.

Canales IPC (`src/shared/ipc.ts`):

| Canal                      | Sentido          | Contenido                                                                     |
| -------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `overlay:init`             | renderer -> main | devuelve `InitialState` (invoke), con el `OverlayLayout`                      |
| `overlay:layout`           | main -> overlay  | `OverlayLayout`: qué widgets aloja la ventana y dónde                         |
| `overlay:data`             | main -> overlay  | `WidgetDataMessage`, solo de los widgets que aloja                            |
| `overlay:auto-hidden`      | main -> overlay  | `AutoHiddenMessage` (una regla oculta o muestra uno)                          |
| `overlay:status`           | main -> renderer | `OverlayStatus`                                                               |
| `overlay:edit-mode`        | main -> renderer | `boolean`                                                                     |
| `overlay:settings`         | main -> renderer | `OverlaySettings` al cambiar                                                  |
| `overlay:commit-bounds`    | overlay -> main  | `BoundsCommit` (arrastre, rueda, alto ajustado, soltar en otra pantalla)      |
| `overlay:scale-step`       | overlay -> main  | `ScaleStepMessage` (rueda sobre un widget de alto automático)                 |
| `overlay:drag-state`       | overlay -> main  | `DragStateMessage` (hay un arrastre en curso)                                 |
| `overlay:widget-toggle`    | overlay -> main  | `WidgetToggleMessage`: el ojo o el candado de una etiqueta del modo edición   |
| `overlay:edit-chips`       | overlay -> main  | `EditChipsMessage`: dónde están sus etiquetas (modo edición)                  |
| `overlay:open-widget-page` | overlay -> main  | `OpenWidgetPageMessage`: el ⚙ de una etiqueta                                 |
| `overlay:cursor-hidden`    | main -> overlay  | `boolean`: el juego oculta el cursor mientras editas                          |
| `overlay:edit-focus`       | main -> overlay  | `WidgetId`: se entró con «Editar posición» desde su página                    |
| `overlay:update-settings`  | Ajustes -> main  | `SettingsPatch` validado (invoke)                                             |
| `overlay:command`          | Ajustes -> main  | `SettingsCommand` (`src/shared/ipc.ts`): modo edición, atajos, restablecer, … |
| `overlay:personal-bests`   | main -> Ajustes  | `PersonalBestList`                                                            |
| `overlay:overlay-hidden`   | main -> Ajustes  | `boolean`: el overlay está oculto                                             |
| `overlay:shortcut-status`  | main -> Ajustes  | `ShortcutStatusReport`: atajo registrado, desactivado o en uso por otra app   |
| `overlay:shortcut-used`    | main -> Ajustes  | `UsedShortcut`: un atajo se ha usado («Pulsado hace 3 s»)                     |
| `overlay:controller-press` | main -> Ajustes  | `ControllerPress`: un botón de un mando mientras se graba un atajo            |
| `overlay:current-car`      | main -> Ajustes  | `CarRef \| null`: el coche en el que estás (vínculos de disposiciones)        |
| `overlay:session-classes`  | main -> Ajustes  | `string[]`: las clases de la sesión multiclase                                |
| `overlay:layout-notice`    | main -> Ajustes  | `LayoutNotice`: cómo fue una exportación, una importación o «Traer todos…»    |
| `overlay:settings-page`    | main -> Ajustes  | `SettingsWindowPage`: abrir esta página (el «Más…» de la bandeja)             |
| `overlay:save-failing`     | main -> Ajustes  | `boolean`: los ajustes dejaron de guardarse (o vuelven a guardarse)           |
| `overlay:osd`              | main -> aviso    | `OsdMessage`: el aviso sobre el juego al usar un atajo                        |

## Anti-cheat

La app nunca toca el proceso del juego: solo lee el mapa de memoria del iRacing SDK (en el
`utilityProcess` de telemetría; abierto con `FILE_MAP_READ`, tanto por irsdk-node como por el lector
del texto de sesión) y dibuja ventanas propias, transparentes, que no cogen el foco y dejan
pasar los clics, encima del juego. **Solo en modo edición**, el reenvío de ratón de Electron
(`setIgnoreMouseEvents(true, { forward: true })`, para los resaltados al pasar por encima) instala un
gancho de ratón de bajo nivel (`WH_MOUSE_LL`) en este proceso: observa movimientos del ratón, nunca
inyecta entrada, y se quita al salir del modo edición. `FORWARD_IN_EDIT = false`
(`src/main/mouseMode.ts`) lo elimina del todo sin perder nada más que esos resaltados. La única
ventana normal, que sí coge el foco, es la de Ajustes, y solo cuando la abres tú. Los atajos de
teclado son `RegisterHotKey` de Windows (vía `globalShortcut` de Electron): Windows avisa a la app
cuando se pulsa la combinación; no hay ganchos de teclado ni nada que llegue al juego.

Los atajos en un botón de un mando (volante, button box, pedales) se leen en otro `utilityProcess`
(`src/input`, arrancado por `src/main/inputHost.ts` solo mientras algún atajo es un botón o la
página de atajos está grabando uno) con **Raw Input**: una ventana solo de mensajes de ese proceso
se registra para los usos joystick, gamepad y multieje (`RIDEV_INPUTSINK | RIDEV_DEVNOTIFY`) y
Windows le da su propia copia de cada informe HID, que `hid.dll` (`HidP_GetUsages`) traduce en
botones pulsados. Es lectura pasiva y compartida: nada se adquiere en exclusiva, no hay ganchos,
ningún handle a otro proceso, no se escribe al dispositivo ni hay force feedback; el dispositivo
solo se abre, sin derechos de acceso, para leer su nombre (`HidD_GetProductString`). iRacing
(DirectInput) sigue recibiendo todo. Ver `src/input/rawInput.ts`.

## Cómo añadir un widget nuevo

1. **Registro**: añade la entrada en `WIDGET_DEFS` (`src/shared/widgets.ts`) con `id`, `hz`,
   `defaultBounds`, `minSize`, `defaultVisible`, `sizeModel` (`'auto-height'` o `'free'`) y
   `defaultShowIn`, y las marcas que le toquen (`followsCamera`, `keepsLiveInReplay`,
   `defaultOnSessionScreen`, `inCarOnly`, `noSessionScreen`, `showsInPits`). Ponlo en uno de los
   grupos de `WIDGET_GROUPS` (el mismo archivo; `widgets.test.ts` comprueba que cada widget está
   en uno) y su nombre en `widgetTitles` de cada idioma (`src/shared/i18n/messages/core.ts`);
   `WIDGET_DEFS` no lleva textos.
2. **Tipo del payload**: añádelo a `WidgetPayloads` (`src/shared/types.ts`) con la misma clave que el
   `id`. `WidgetDataMessage` se deriva solo.
3. **Variables**: si necesitas variables nuevas, añádelas a `TELEMETRY_VARS`
   (`src/shared/telemetry.ts`; los nombres se comprueban contra los tipos de irsdk-node, así que una
   errata no compila) y al mock (`src/telemetry/mock/simulation.ts`) para poder desarrollarlo sin
   iRacing (los `makeFrame` de los tests parten de `TELEMETRY_VAR_NAMES` y no hay que tocarlos).
   Las variables propias de cada coche (`dcBrakeBias`, `dcABS`…) no existen en todos: la
   fuente real solo pide las que hay en la sesión y las demás llegan como array vacío, así que el
   provider debe tratarlas como "sin dato".
   - Si necesitas datos nuevos del YAML de sesión, añádelos a `SessionMeta` (`src/shared/types.ts`),
     a `parseSessionMeta` y `EMPTY_SESSION` (`src/shared/session.ts`, con su test) y a
     `buildSessionInfo()` del mock (`src/telemetry/mock/sessionInfo.ts`).
4. **Cálculo**: función pura en `src/shared/<widget>.ts` con sus tests (`<widget>.test.ts` al lado) y
   regístrala en `PROVIDERS` (`src/shared/providers.ts`). Recibe `{ frame, session, config, race,
bests }` (`ProviderContext`: `race` es la vista del `RaceModel` y `bests`, los récords
   personales) y el payload anterior (`prev`) por si necesitas suavizado.
5. **Vista**: componente en `src/renderer/src/widgets/<widget>/<Name>Widget.vue` que use
   `useWidgetData('<id>')` y regístralo en `src/renderer/src/widgets/index.ts`. Ningún texto va en el
   código: todos salen de `useI18n()`, de los diccionarios de `src/shared/i18n/messages/` (el español
   es la referencia y el inglés tiene que tener las mismas claves, o no compila). Los payloads llevan
   códigos, nunca frases.
6. **Opciones** (si las tiene): decláralas en `OPTION_SCHEMA` (`src/shared/settingsSchema.ts`), de
   donde salen los valores por defecto y los límites; añade su sección a `OverlaySettings` y
   `TelemetryConfig` (`types.ts`), a `createDefaultSettings` (`src/shared/settings/defaults.ts`) y
   a `src/shared/settings/config.ts` (lo que llega al proceso de telemetría), y una migración en
   `src/shared/settings/migrate.ts` si cambia algo de un archivo de antes. Si quieres tocarlas desde
   la bandeja, a `src/main/tray.ts`.
7. **Ajustes**: su página en `WIDGET_OPTIONS` (`src/renderer/src/settings/options/index.ts`), su
   icono en `NAV_ICONS` (`src/renderer/src/settings/layout/navIcons.ts`; sin él no compila), una
   muestra para la vista previa (`src/renderer/src/settings/samples/`) y su atajo
   `toggle<Name>` («Más acciones»: `shortcuts` en `settingsSchema.ts` y `WIDGET_SHORTCUT_ACTIONS`
   en `src/shared/shortcuts.ts`).

Main, la bandeja, la barra lateral de los Ajustes y el proceso de telemetría recogen el widget a
partir de `WIDGET_DEFS` y `WIDGET_GROUPS` (ventanas, visibilidad, reglas, menú); lo de los pasos 6 y
7 no es automático.

Consejos:

- `useWidgetData` devuelve un `shallowRef`: cada mensaje es un objeto nuevo y se sustituye entero.
  **No mutes nunca los payloads**; el provider devuelve un objeto nuevo en cada frame.
- Si el widget pasa mucho tiempo sin nada que pintar, añade una regla a `SKIP_EMIT`
  (`src/shared/providers.ts`) para no enviar payloads repetidos (el radar oculto no envía nada).
- Nada de animaciones infinitas, filtros SVG/CSS ni sombras grandes en lo que se repinta a 60 Hz: las
  ventanas son transparentes y cada repintado cuesta GPU mientras juegas.
- Usa las variables CSS de `src/renderer/src/styles/theme.css` para colores y tipografía.

## Notas y limitaciones

- No se activa `autoEnableTelemetry` de irsdk-node: ese broadcast enciende la grabación de `.ibt` en
  disco y los datos en vivo no lo necesitan.
- Fuera de alcance por ahora: temperatura de neumáticos, minimapa y VR.
- **Nombres con acentos**: iRacing escribe el YAML de sesión en Windows-1252 y `irsdk-node` lo lee
  como UTF-8, así que cada acento llegaba como `�`. El proceso de telemetría lee ese texto él mismo
  de la memoria compartida del SDK, **solo lectura** como el propio SDK (`OpenFileMappingW` +
  `MapViewOfFile` con `FILE_MAP_READ`, vía `koffi`; `src/telemetry/sessionString`), y lo decodifica
  bien (si el texto es UTF-8 válido, como UTF-8). Si `koffi` no carga o la lectura falla, lo anota una
  vez en el log y vuelve al texto de `irsdk-node`.
- Los caracteres que **no existen en Windows-1252** (cirílico, chino, la `ł` polaca...) ya llegan de
  iRacing como `?` y no se pueden recuperar: un nombre sin ninguna letra ni cifra se muestra como el
  nombre del equipo, o si tampoco lo hay como «Piloto #7» atenuado.
- Si el nombre de algún piloto rompe el parseo del YAML de sesión, la app recurre a un parser tolerante.
- Si alguna ventana se ve con fondo negro en lugar de transparente, puede ser la aceleración por
  hardware (Electron issue #40515).
- **OBS**: ya no hay una ventana por widget. Con captura de ventana, elige "Pantalla N · OverLap"
  ("Display N · OverLap" en inglés), que trae todos los widgets de esa pantalla; o usa la captura de
  pantalla.
- Con widgets en dos o más pantallas hay una ventana por pantalla, y esas ventanas sí se reparten el
  refresco entre ellas.

## Licencia

OverLap es software libre bajo la GNU GPL versión 3 o posterior (`GPL-3.0-or-later`), © 2026 Jesús
Molano: ver [LICENSE](../LICENSE) y «Licencia y créditos» en el
[README](../README.md#licencia-y-créditos). Las dependencias y el material de terceros conservan sus
licencias, que se recogen en [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

No hacen falta cabeceras de licencia en cada archivo. Los comentarios de atribución que ya hay
(`irating.ts`, `safetyRating.ts`, `brandLogos.ts`, `flags.ts`) se quedan: las licencias MIT de
origen los piden.
