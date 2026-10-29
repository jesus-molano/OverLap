# Propuesta v2 del overlay de iRacing (24-10-2026)

## 1. Punto de partida

**Qué tenemos (v1)**

- **Relativo** (10 Hz): muestra ±3 coches con posición en clase, número, nombre, licencia, iRating y gap (sale de `CarIdxEstTime`). Marca los coches doblados y los que te doblan, y atenúa los que están en boxes.
- **Radar** (60 Hz): el lateral sale de `CarLeftRight` y la distancia longitudinal de `LapDistPct` × longitud de pista. Dibuja los coches a escala y, cuando está oculto, no envía nada (`SKIP_EMIT`).
- **Base técnica**: la telemetría corre en un proceso aparte, cada widget es una ventana transparente y la lógica pura está en `src/shared` con tests.

**Qué ofrecen RaceLab (gratis y Pro), iRacing de serie y otros gratuitos**

Los datos de iRacing salen de sus notas de versión de 2025 S4 a 2026 S4; no los he comprobado en el simulador. RaceLab no publica qué overlays son gratis y cuáles Pro, y sus propias fuentes se contradicen. "¿" significa que no está verificado.

| Función                                   | iRacing de serie                                                                                            | RaceLab free                                  | RaceLab Pro                                             | Otros gratis                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Relativo                                  | Sí (widget desde S1)                                                                                        | Sí                                            | Sí, y además reordenar columnas                         | irDashies, iOverlay, KSR                              |
| Standings                                 | Sí, con filtro por clase (S4). Una queja de junio de 2026 dice que no se centra en ti (sin verificar en S4) | Sí, "básico". Un usuario lo llama "muy pobre" | Reordenar columnas y Race Briefing                      | irDashies; iOverlay (21 columnas)                     |
| Δ iRating proyectado                      | No                                                                                                          | Columna "iRating gain" (nivel ¿)              | Sí                                                      | irDashies, iOverlay                                   |
| SR proyectado / presupuesto de incidentes | Solo el contador de incidentes (S3)                                                                         | No                                            | No                                                      | Solo Nishizumi-SR, que es una app aparte              |
| Batalla / tendencia                       | No                                                                                                          | Head to Head ¿ (las guías dicen que es Pro)   | H2H. La predicción de adelantamiento está "In Progress" | irDashies Battle (solo el cambio de gap)              |
| Aviso de clase más rápida                 | Spotter visual, solo laterales                                                                              | Overtake Alert ¿                              | Overtake Alert                                          | irDashies (ventana fija de 3 s); iOverlay solo en Pro |
| Coche lento o parado delante              | No                                                                                                          | No encontrado                                 | No encontrado                                           | irDashies                                             |
| Combustible                               | Sí: 5 modos, ventana de boxes, margen GWC, AutoFuel (S3)                                                    | ¿ (el tooltip dice Pro)                       | Varias estrategias y compartir con el equipo            | irDashies, iOverlay, Edge                             |
| Delta                                     | Sí, en Lap Timing (se reinicia cada sesión)                                                                 | Delta bar ¿                                   | Delta Trace ¿                                           | irDashies, benofficial2                               |
| Boxes: dónde sales                        | Pit Summary, sin posición de salida (S4)                                                                    | ¿                                             | Predicción en el mapa (el mapa es Pro según el tooltip) | StintView                                             |
| Mapa                                      | Sí, 4 modos (S3)                                                                                            | ¿ (el tooltip dice Pro)                       | Sí                                                      | irDashies, Edge                                       |
| Inputs                                    | Timeline de acelerador y freno (S2)                                                                         | ¿ (las fuentes se contradicen)                | Sí, con comparativas                                    | irDashies, Track Titan, PaceGhost                     |
| Memoria entre carreras (etiquetas, PB)    | No                                                                                                          | 5 pilotos etiquetados                         | Ilimitado                                               | irDashies, KSR "My races"                             |
| Rendimiento                               | Nativo; funciona en VR y en pantalla completa                                                               | Quejas de tirones y caída de FPS              | Igual, aunque permite limitar los FPS por overlay       | irDashies tiene quejas de FPS                         |

**Conclusión:** iRacing de serie ya cubre combustible, mapa, incidentes, daños y compuesto de neumático. Lo que falta en ambos está en cuatro sitios:

- **Lo que cambia con el tiempo**: tendencias de gap y vueltas que faltan para alcanzar a alguien.
- **Predicciones**: iRating y SR, "si paro ahora" y cuándo te alcanza la clase rápida.
- **Memoria entre sesiones**: etiquetas, mejores vueltas, historial.
- **Consumo bajo**: lo que más se reprocha a RaceLab y a irDashies.

Cómo resolver el "¿" de RaceLab: tienes la versión 8.4.4 instalada. Ábrela y mira qué overlays llevan la etiqueta "pro overlay".

## 2. Propuesta v2

**Requisito previo: un motor de cronometraje (esfuerzo M).**

- **El problema hoy:** cada provider recibe solo el frame y su `prev`, a la frecuencia de su widget. Eso no basta para guardar historia de la carrera.
- **La pieza nueva:** un `RaceModel` con estado, alimentado a 60 Hz en el proceso de telemetría antes de los providers.
- **Cómo cronometra:**
  - Usa 100 líneas virtuales más los sectores del YAML (`SplitTimeInfo`).
  - Interpola la hora de cruce de cada coche en cada línea, con unos 10 ms de resolución. Así funciona el cronometraje real, y es más fiel que `CarIdxEstTime`, que se basa en una vuelta estimada fija.
  - El gap entre dos coches es la diferencia de sus horas de cruce en la última línea que han pasado los dos.
- **Qué guarda:** historial de gaps, paradas, salidas de boxes y la parrilla de salida.
- **Coste:** O(64) por tick, menos de 1 ms.
- **Persistencia:** se guarda por `SubSessionID`, para no perder la historia si reinicias la app a mitad de carrera.
- **Número de coches:** no conviene fijar 64, porque `irsdkLogAllCars=1` (2026 S3 P1) permite más.
- **Quién lo usa:** standings, batalla, aviso de clase rápida y boxes leen todos de aquí.

| #   | Función               | Qué muestra                                                                                                                                                                                                                                                          | Frente a RaceLab free e iRacing de serie                                                                                                                                                                                                                                           | Datos                                                                                                                                               | Precisión                                                                                                                                                                                                                                                                                  | Esf.            | Coste                                             |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------------------------------------------- |
| 1   | **Standings+**        | Ver 2.1                                                                                                                                                                                                                                                              | De serie no lo centra en ti y no hay iR, posiciones ganadas ni paradas. RaceLab free lo tiene, pero reordenar columnas es Pro. En iR y posiciones ganadas solo igualamos a irDashies e iOverlay. Ganamos en intervalos por líneas de tiempo, tendencia, posición neutra de iR y SR | `CarIdx` Lap, LapDistPct, OnPitRoad, TrackSurface, LastLap/BestLapTime, TireCompound, SessionFlags, F2Time. YAML: `Drivers[]`, `QualifyResultsInfo` | Ver 2.1                                                                                                                                                                                                                                                                                    | L               | 4 Hz, filas fijas                                 |
| 2   | **Batalla**           | Gap con el coche de delante y el de detrás de tu clase y s/vuelta que ganas o pierdes. Te dice "le alcanzas en V12 de 15" o "necesitas −0,18 s/v", en qué sector ganas o pierdes, y las últimas 3 vueltas lado a lado. Solo aparece si hay un coche a menos de 1,5 s | De serie no existe. En RaceLab, H2H tiene nivel sin verificar y la "prediction overtake" sigue "In Progress" en su roadmap (165 votos). Comparar vueltas para alcanzar con vueltas restantes no aparece en ninguna herramienta revisada                                            | RaceModel, `SessionLapsRemainEx`                                                                                                                    | Excluir vueltas con boxes o amarilla. La pendiente es ruidosa con menos de 2 vueltas                                                                                                                                                                                                       | S*              | 2–4 Hz, oculta casi siempre                       |
| 3   | **iRating + SR**      | Δ iR proyectado, "±10 iR/pos", la posición neutra (donde Δ≈0) y cuánto iR te juegas por P−1 o P+1. También el SR proyectado y el **presupuesto de incidentes** (cuántos puedes sumar sin perder SR)                                                                  | iR: solo igualamos. La posición neutra no aparece en ninguna herramienta. SR proyectado: no hay ningún overlay que lo haga                                                                                                                                                         | YAML: IRating, CarClassID, LicLevel/SubLevel, TrackNumTurns. `PlayerCarMyIncidentCount`                                                             | Fórmula de la comunidad (hoja de 2019 → irating-rs → irDashies), sin validación pública. Se calcula por clase (Código Deportivo §13.2.3). Sin verificar: no-starters y rookies. SR con Nishizumi-SR (MIT); su error medio de 0,033 lo declara solo su autor. Se mostrará como "estimación" | S (iR) + M (SR) | iR solo cuando cambia el orden (<1 ms); SR a 1 Hz |
| 4   | **Clase rápida**      | Por ejemplo "GTP a 6 s · te alcanza en T3", con su número e iR. Solo en carreras multiclase                                                                                                                                                                          | De serie solo hay spotter lateral. Overtake Alert de RaceLab tiene nivel sin verificar y no consta que dé ETA. irDashies usa una ventana fija de 3 s sin ritmo de cierre                                                                                                           | `CarIdxLapDistPct`, `CarIdxClass`, ritmo con `CarIdxLastLapTime`                                                                                    | La ETA simple puede fallar ±20 % (estimación del informe, no medida)                                                                                                                                                                                                                       | M               | 4–10 Hz, solo emite si cambia                     |
| 5   | **Peligro delante**   | Coche parado, lento o fuera de pista entre 1 y 8 s por delante                                                                                                                                                                                                       | No encontrado ni de serie ni en RaceLab. Igualamos a irDashies                                                                                                                                                                                                                     | `CarIdxTrackSurface`, `LapDistPct`, `TrackLength`                                                                                                   | Es una heurística: el SDK no tiene señal de choque y fuera de pista no siempre es incidente. Hay que descartar saltos por grúa                                                                                                                                                             | S               | Muestrea a 60 Hz, emite a unos 10 Hz              |
| 6   | **Delta+**            | Barra delta con flecha de ganar o perder. Referencias: tu mejor vuelta histórica por coche y pista, y la mejor de la sesión del más rápido de tu clase. Pérdida por sector                                                                                           | La barra en sí solo iguala. Ganamos con el PB persistente (de serie se reinicia cada sesión) y con la referencia al rival                                                                                                                                                          | `LapDeltaToBestLap/_OK/_DD` y un perfil propio grabado                                                                                              | La referencia exacta de `LapDeltaToSessionBest` no está documentada                                                                                                                                                                                                                        | M               | ~30 Hz, solo `transform`                          |
| 7   | **Combustible**       | Una sola línea de estado: "OK +1,2 L", "AHORRA 0,06 L/v" o "BOX en 3 · +18 L". En carreras por tiempo calcula las vueltas que quedan con el ritmo del líder general. Avisa si el menú de boxes no cuadra                                                             | La de serie ya es buena. Solo ganamos en carreras por tiempo multiclase, en el historial desde prácticas y en el aviso del menú. **Valor bajo en sprints de MX-5**                                                                                                                 | `FuelLevel`, `FuelUsePerHour`, `DriverCarFuelMaxLtr`, `SessionTimeRemain` (32767 = carrera por tiempo), `PitSvFuel`                                 | La regla de fin (el líder cruza meta tras llegar a 0) la cuentan pilotos y no está en el Código Deportivo. Excluir vueltas de boxes, amarilla y la vuelta 1                                                                                                                                | M               | 1 Hz y por vuelta                                 |
| 8   | **"Si paro ahora"**   | Entre qué coches sales y en qué posición de clase                                                                                                                                                                                                                    | De serie no lo predice. En RaceLab está en el mapa, que es Pro según el tooltip                                                                                                                                                                                                    | `CarIdxOnPitRoad` de cualquier coche, `PitstopActive`                                                                                               | ±1–2 s. No prevé coches que paran a la vez. Hay que aprender los tiempos por coche (cambiaron en S4)                                                                                                                                                                                       | M               | 2 Hz, bajo demanda                                |
| 9   | **Banderas y avisos** | Bandera grande, limitador sin activar en pit road, meatball de rivales                                                                                                                                                                                               | Iguala a iRacing de serie en banderas; el resto suma poco                                                                                                                                                                                                                          | `SessionFlags`, `CarIdxSessionFlags`, `EngineWarnings & 0x10`                                                                                       | Bits de irsdk_defines: 0x4000 = caution y 0x10000 = black. irDashies los etiqueta mal                                                                                                                                                                                                      | S               | Por evento                                        |
| 10  | **Inputs**            | Pedales y volante, con traza más larga sin agrandar el widget                                                                                                                                                                                                        | De serie ya hay timeline; el valor es bajo (el MX-5 no tiene ABS)                                                                                                                                                                                                                  | `Throttle`, `Brake`, `SteeringWheelAngle`                                                                                                           | —                                                                                                                                                                                                                                                                                          | S               | 60 Hz; es lo más caro de pintar                   |

\*Con el RaceModel ya hecho.

### 2.1 Standings+ en detalle

**Modos**

- **Compacto** (por defecto, 12–15 filas): de tu clase, los 3 primeros y ±3 a tu alrededor, siempre centrado en ti. Debajo, una fila con el líder de cada otra clase.
- **Completo** (con un atajo): todas las clases, con una cabecera por clase.

**Columnas**

| Columna                                   | Contenido                                                                                                                           | Compacto     | Completo |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| Pos                                       | Posición en clase, en una pastilla amarilla si está fuera de pista                                                                  | ✓            | ✓        |
| ▲▼                                        | Posiciones ganadas desde la salida. Parrilla de `QualifyResultsInfo` (empieza en 0, sumar 1) o una foto al pasar `SessionState` a 4 | ✓            | ✓        |
| Nº                                        | Franja con el color de clase y el número                                                                                            | ✓            | ✓        |
| Piloto                                    | Nombre corto                                                                                                                        | ✓            | ✓        |
| iR · Lic                                  | Por ejemplo "1.8k · B3.4"                                                                                                           | ✓            | ✓        |
| Intervalo                                 | Al de delante de la clase, o gap al líder (se alterna); "+1V" si hay vuelta de diferencia                                           | ✓            | Los dos  |
| Última                                    | 3 decimales. Morado = la más rápida de la clase, verde = mejor vuelta del piloto                                                    | ✓            | ✓        |
| Boxes                                     | PIT, OUT o "2 · V12" (número de paradas y vuelta de la última)                                                                      | ✓            | ✓        |
| Mejor vuelta, compuesto, vueltas de stint | —                                                                                                                                   | –            | ✓        |
| Δ iR por piloto                           | —                                                                                                                                   | Solo tu fila | ✓        |
| Tendencia                                 | s/vuelta frente al de delante                                                                                                       | –            | ✓        |
| Estado                                    | Meatball, negra, desconectado (en gris), fast repairs                                                                               | Icono        | ✓        |

**Cabecera de cada clase:** clase, SoF, número de coches y vueltas o tiempo restante. Debajo, "tu Δ iR +23 · ±10/pos · neutro P9" y "5x/17 · SR 3,12→3,05".

**Práctica y clasificación:** el intervalo pasa a ser la mejor vuelta y la diferencia con la mejor. El iR se oculta salvo que actives un modo "qué pasaría si".

**Reglas de cálculo**

- **Orden en vivo:** por `Lap + LapDistPct` dentro de la clase. Un cambio de orden tiene que mantenerse 0,5 s para aplicarse; así las filas no parpadean en meta. Se suele decir que `CarIdxPosition` solo se actualiza en las líneas de tiempo, pero no lo he verificado.
- **Intervalos:** salen del RaceModel; si aún no hay datos, de `F2Time`. Se suavizan con una media móvil exponencial y se redondean a 0,1 s, para que `SKIP_EMIT` descarte los envíos repetidos.
- **Paradas:**
  - Cada vez que un coche entra en pit road (`OnPitRoad`) durante la carrera cuenta como parada.
  - Salir desde el pit lane no cuenta.
  - La grúa no se detecta así, porque te lleva al box sin pasar por pit road.
- **Exclusiones:** pace car, espectadores y pilotos con iR de 0 o menos.
- **Neumáticos y fast repairs:** el nombre del compuesto solo es seguro para tu modelo de coche. `CarIdxFastRepairsUsed` solo se rellena en sesiones con límite de reparaciones.

**Pintado**

- Filas fijas indexadas: no se reordena el DOM ni hay animaciones.
- Números con `tabular-nums`, para que no bailen.
- El color siempre va acompañado de una forma (▲▼, iconos), por los daltónicos.
- Fondo con opacidad de 0,65 a 0,75 solo detrás del texto.
- Ventana ajustada al contenido.

## 3. Fuera de alcance o difícil

- **Mapa con posiciones reales:**
  - El SDK no da posiciones de los coches en directo: `Lat`, `Lon` y `Alt` solo se graban en el archivo .ibt.
  - Los SVG que usa irDashies son propiedad de iRacing.
  - La Data API tiene parada la creación de clientes OAuth nuevos desde marzo de 2026.
  - Se podría grabar el trazado a partir de tu propia vuelta, pero no compensa: iRacing de serie ya trae un mapa con 4 modos.
- **Radar con distancia lateral real:** el SDK solo da `CarLeftRight`.
- **Temperatura y desgaste de neumáticos:** solo se actualizan con el coche parado en el box, según cuenta la comunidad.
- **Inputs y telemetría de rivales:** iRacing no los envía.
- **Incidentes de otros pilotos en directo:** no he confirmado que estén disponibles.
- **VR y pantalla completa exclusiva:** las ventanas transparentes no se ven ahí. Los widgets de serie sí funcionan.
- **Daños:** ya está el widget Car Damage de S4, que incluye el MX-5.
- **Previsión meteorológica:** el SDK no tiene ningún campo de previsión.
- **SR oficial:** la fórmula no es pública, así que solo podemos estimarlo.

## 4. Orden recomendado

- **v2.0 "Carrera":** RaceModel, Standings+, Batalla e iRating/SR.
- **v2.1 "Tráfico":**
  - Peligro delante, clase rápida, y banderas y limitador.
  - **Auto-ocultado según el momento de la carrera:** la batalla solo con un coche a menos de 1,5 s y los boxes solo en pit road. Una ventana oculta no se repinta, así que ahorra GPU.
- **v2.2 "Ritmo y estrategia":**
  - Delta+, combustible por tiempo y "si paro ahora".
  - **Memoria local:** etiquetas y notas de pilotos sin límite, y un diario de carrera con iR y SR antes y después, regularidad y % de vueltas limpias.
  - Inputs, si los echas en falta.

**Los tres primeros que construiría:**

1. RaceModel con Standings+. Es la base de casi todo lo demás.
2. Batalla. Es lo que más diferencia y lo que más pesa en el MX-5.
3. iRating con SR y el presupuesto de incidentes. El esfuerzo es bajo y el SR no lo tiene nadie.

**Antes de empezar, conviene medir en una sesión real:**

- Cada cuánto se actualiza `CarIdxPosition`.
- La granularidad de `F2Time`.
- La regla de fin de las carreras por tiempo.
- Qué significan exactamente `PlayerIncidents` y `LapDeltaToSession*`.

**Presupuesto de rendimiento:**

- Tablas a 2–4 Hz, avisos a unos 10 Hz, delta a 30 Hz y radar a 60 Hz.
- Nada de blur, `backdrop-filter` ni sombras grandes en lo que se repinta.
- Reutilizar buffers al leer la telemetría: irDashies midió lecturas unas 9 veces más rápidas así (issue #803).

## Fuentes

- **RaceLab:**
  - Planes y tooltips: https://racelab.app/ y https://racelab.app/locales/en/home.json
  - Página de iRacing: https://racelab.app/iracing
  - Roadmap: https://roadmap.racelab.app/feedback
  - Guía de rendimiento: https://garage.racelab.app/docs/faq/performance_guide
  - Guía de usuario de 2025: https://note.com/gordon042/n/nf3bcdfca7c56
  - Textos de la app instalada: los ficheros de traducción en inglés que trae la app instalada (RaceLab 8.4.4)
- **iRacing:**
  - 2025 S4: https://boxthislap.org/iracing-2025-season-4-release-notes/
  - 2026 S1: https://boxthislap.org/iracing-2026-season-1-release-notes/
  - 2026 S2: https://boxthislap.org/iracing-2026-season-2-release-notes/
  - 2026 S3: https://boxthislap.org/iracing-2026-season-3-release-notes/
  - 2026 S3 Patch 1: https://support.iracing.com/support/solutions/articles/31000179039-2026-season-3-patch-1-release-notes-2026-06-12-02-
  - 2026 S4: https://support.iracing.com/support/solutions/articles/31000179517-2026-season-4-initial-release-notes-2026-09-09-01-
  - Safety Rating: https://support.iracing.com/support/solutions/articles/31000156960
  - Código Deportivo: https://ir-core-sites.iracing.com/members/pdfs/20260310-official_sporting_code_dated_Mar_10_2026.pdf
- **SDK:**
  - Documentación de variables: https://sajax.github.io/irsdkdocs/telemetry/
  - Constantes de banderas: https://github.com/kutu/pyirsdk/blob/master/irsdk.py
  - Variables por coche: https://github.com/mpapenbr/goirsdk/blob/v0.6.0/variables.md
- **Fórmulas:**
  - Hoja de iRating original: https://github.com/SIMRacingApps/SIMRacingApps/issues/209
  - irating-rs: https://github.com/Turbo87/irating-rs
  - Nishizumi-SR: https://github.com/nishizumi-maho/Nishizumi-SR
- **Otras herramientas:**
  - irDashies: https://github.com/tariknz/irdashies (y sus issues #803 y #804)
  - iOverlay: https://ioverlay.app/
  - Blind Spot / spotter de benofficial2: https://github.com/fixfactory/bo2-official-overlays
- **Opiniones de usuarios:**
  - Standings gratis "muy pobre": https://www.reddit.com/r/iRacing/comments/1x279xl/
  - Paywalls y tirones: https://www.reddit.com/r/iRacing/comments/1rc8hd3/
  - Standings de serie no centrados: https://www.reddit.com/r/iRacing/comments/1u6cub0/
  - Reddit se leyó a través del archivo Arctic Shift.
