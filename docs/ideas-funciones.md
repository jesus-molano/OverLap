# OverLap: qué podemos añadir con datos reales de iRacing

> **Estado a 31-10-2026 (OverLap 2.4.1).** Este informe se conserva como historial: frases como
> «hoy OverLap no muestra nada de daños» describen la app de entonces.
>
> - **Hecho:** del top 10, el 1 (incidentes y aviso «+Nx»), el 2 (los avisos que faltaban), el 3
>   (mejor vuelta, stint, última parada, neumático y banderas en Posiciones y Relativo), el 4 (salud
>   del motor: el widget Testigos), el 5 (ocultar con la interfaz del sim, en el garaje y en las
>   repeticiones: Visibilidad) y el 6 (condiciones de pista, como datos de las barras de
>   información); el 8, en parte (tiempos de reparación en Testigos, «DAÑO» en Avisos, reparaciones
>   rápidas en Combustible). De los candidatos: luces de cambio, juegos de neumáticos restantes,
>   combustible preciso y un spotter visual (el widget Spotter).
> - **Pendiente, sin construir:** el 7 (tira de pista), el 9 (ayuda para reincorporarte), el
>   ayudante de boxes, «Si paro ahora», el delta oficial de iRacing, la media de vueltas limpias de
>   iRacing, el uso de pianos, detectar tirones por paginación de memoria (el «Tirón» de los dos
>   extras), la ayuda de salida lanzada, «¿Reparo o sigo?», «Dónde le gano» (solo está la fila de
>   sectores de Batalla), los incidentes por curva, «Quién cae, quién viene», el ocultado
>   inteligente según el momento de la carrera (hoy solo hay reglas por tipo de sesión y en boxes)
>   y el contador de banderas.
> - **Descartado o fuera de alcance:** lo de la sección 4, que sigue igual; y el mapa, tanto el 10
>   (mapa 2D aprendido) como el mapa exacto desde tu `.ibt` de la sección 1, fuera de alcance por
>   ahora (ver «Notas y limitaciones» en las [notas de desarrollo](README.dev.md)).

Fecha: 25-10-2026. En qué se basa este informe:

- He contrastado cada idea con el SDK que usa OverLap (irsdk-node 4.4.0 y las cabeceras oficiales de iRacing).
- He usado tu grabación real: MX-5 Cup en Okayama, carrera offline contra la IA.
- He repasado unas 20 herramientas de la competencia y los hilos de r/iRacing de 2026.
- No me he conectado a iRacing, no he arrancado la app y no he tocado el proyecto.

**Lo primero que hay que saber.** El rival ya no es RaceLab, es el **iRacing nativo de 2026**. Desde S3/S4 el sim trae de serie:

- un mapa del circuito con 4 modos;
- un calculador de combustible;
- un Incident Tracker;
- el widget Car Damage, que dibuja las piezas dañadas;
- el Pit Summary y un spotter visual.

Por tanto, un overlay solo se gana su sitio si **muestra lo que el sim no enseña, o si lo hace mejor**. Y lo que más valora la gente es lo que ya buscamos: que sea ligero, legible, gratis y sin cuenta.

Esfuerzo:

- **S**: va dentro de un widget que ya existe y usa pocas variables nuevas.
- **M**: un widget nuevo, o un modelo derivado encima del RaceModel.
- **L**: un subsistema nuevo (grabación más persistencia, o un lector de ficheros).

---

## 1. Respuestas directas

### Daños: qué se puede saber de verdad

- **No se puede saber qué pieza está dañada** (alerón, suspensión, dirección…). El SDK no lo exporta: solo lo tiene el widget nativo Car Damage.
- **Sí hay datos reales para todo esto:**

  | Qué                                           | Dato                                                                                                                                        |
  | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
  | Segundos de reparación obligatoria y opcional | `PitRepairLeft`, `PitOptRepairLeft`                                                                                                         |
  | "Reparación obligatoria / opcional pendiente" | Bits 0x80 / 0x100 de `EngineWarnings`. Ya leemos esa variable, pero solo usamos el bit del limitador                                        |
  | Bandera meatball                              | Ya la mostramos en Alertas                                                                                                                  |
  | Fast repairs disponibles y usadas             | `FastRepairAvailable` (255 = ilimitadas) y `FastRepairUsed`. Tu sesión permite 1                                                            |
  | Grúa: segundos que quedan                     | `PlayerCarTowTime`                                                                                                                          |
  | "Boxes: no se puede reparar"                  | `PlayerCarPitSvStatus` = 105                                                                                                                |
  | Avisos de motor                               | Agua, presión de aceite y de combustible, temperatura de aceite y calado, más las temperaturas reales (`WaterTemp`, `OilTemp`, `OilPress`…) |

- **Falta comprobarlo en una sesión** (es decisivo): ¿aparecen los segundos de reparación **en pista** justo después del golpe, o solo en el box? Si solo aparecen en el box, la caja diría "reparación obligatoria pendiente" sin segundos.
- **Hoy OverLap no muestra nada de daños,** salvo la meatball.

### Avisos que nos faltan

| Aviso                                            | Dato real                                                      | Ojo                                                                                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Exceso de velocidad con el limitador OFF**     | `OnPitRoad` + `Speed` + el límite del YAML ("60.00 kph")       | Hoy solo pone "OFF", aunque vayas a 80                                                                                                                                                       |
| **Limitador antes de entrar al pit**             | `PlayerTrackSurface` = 2 (zona de boxes)                       | En tu grabación esa zona también cubre la salida (ibas a 65–85 km/h con ella activa). Solo hay que avisar al pasar de pista a zona de boxes, y callarse en cuanto has pasado por el pit lane |
| **Bandera negra enrollada** (aviso, bit 0x80000) | `SessionFlags` / `CarIdxSessionFlags`                          | Ya está definida en el código pero no se muestra. Texto neutro: "AVISO"                                                                                                                      |
| **10 / 5 vueltas para el final**                 | `SessionLapsRemainEx`                                          | Hay que calcularlo nosotros: probablemente iRacing nunca activa sus propios bits de 10/5                                                                                                     |
| **Grúa con cuenta atrás**                        | `PlayerCarTowTime`                                             | —                                                                                                                                                                                            |
| **Motor calado, agua, aceite, presión**          | Bits 0x8, 0x1, 0x2, 0x4 y 0x40 de `EngineWarnings`             | El de calado, solo con `IsOnTrack`. El MX-5 lleva anticalado, así que será raro                                                                                                              |
| **Sentido contrario**                            | Derivado de `LapDistPct`                                       | Ignorarlo marcha atrás y en el pit lane                                                                                                                                                      |
| **Incidente "+2x"**                              | Ver "Incidentes"                                               | —                                                                                                                                                                                            |
| Boxes cerrados                                   | `PitsOpen`                                                     | En Okayama offline (cautions locales) nunca salta                                                                                                                                            |
| Pista mojada                                     | `WeatherDeclaredWet`, `TrackWetness`, `Precipitation`          | Con tu meteo "clásica" nunca llueve. Sirve con meteo realista                                                                                                                                |
| Semáforo de salida y tiempo de reacción          | Bits de salida de `SessionFlags`                               | Solo en salida parada. Las tuyas son lanzadas (`StandingStart: 0`)                                                                                                                           |
| Conexión inestable                               | `ChanQuality`, `ChanLatency`                                   | Solo online                                                                                                                                                                                  |
| Cambio de compuesto obligatorio pendiente        | YAML `SessionEnforceTireCompoundChange` + `PlayerTireCompound` | Solo si la sesión lo exige                                                                                                                                                                   |

Los cinco primeros son baratos (S) y sirven en todas tus carreras.

### Mapa como el de iRacing: ¿es posible?

**Sí, pero no con coordenadas en vivo, porque no existen.** No hay X/Y de ningún coche. `Lat`/`Lon` solo se graban en el fichero `.ibt` del disco, y solo los de tu coche.

Hay tres formas, de menos a más esfuerzo:

1. **Tira de pista (desde el primer segundo).** Una línea con cada coche situado por su % de vuelta, más los sectores y tu box.
2. **Mapa 2D aprendido de tu propia vuelta limpia.**
   - Se integran la velocidad y el rumbo (`Speed`, `YawNorth`) a 60 Hz.
   - Se cierra el circuito y se guarda el mapa por circuito.
   - Cada coche se coloca por su % de vuelta.
   - Es lo que hacen Slipstream, SimHub y Pitwall.
3. **Mapa exacto desde tu `.ibt`**, con la latitud y la longitud reales.
   - Hay que grabar con Alt+L: en tu `app.ini` la grabación automática está desactivada.
   - Hay que escribir un lector propio pequeño.

Límites:

- **Nunca se verá a dos coches lado a lado**, porque no hay posición lateral.
- Hay que validar una vez la orientación: con el signo cambiado, el mapa sale en espejo pero cierra perfecto.
- **No usaremos los SVG de iRacing.** Son suyos, y la API de datos no da accesos nuevos desde marzo de 2026.

Ojo: el nativo ya tiene mapa. El nuestro solo vale la pena si dibuja lo que ya calculamos y el nativo no:

- peligros en pista;
- tu rival de batalla;
- dónde te alcanza la clase rápida;
- dónde saldrías si paras ahora.

### Incidentes: ¿ya los tenemos?

**A medias.** Leemos tu contador (`PlayerCarMyIncidentCount`), pero solo aparece en la línea de SR de la cabecera de Standings, y solo en carreras **oficiales puntuables**. Por eso, en tu carrera de IA en Okayama llegaste a **11x y OverLap no mostró nada**.

Lo que se puede añadir enseguida (S):

- un contador siempre visible;
- un aviso "+Nx" con el **tipo** de incidente, leído de `PlayerIncidents`, y en qué vuelta y sector fue:

  | Tipo                  | Puntos |
  | --------------------- | ------ |
  | Pérdida de control    | 2x     |
  | Salida de pista       | 1x     |
  | Golpe contra el muro  | 2x     |
  | Choque con otro coche | 4x     |
  | Contacto leve         | 0x     |

- el **margen hasta la penalización o la DQ**, cuando la sesión tiene límite. Tu sesión era "unlimited", así que ahí solo saldría "11x".

**Los incidentes de los rivales no existen en los datos.** Todas las IA marcaban 0, y la tabla de resultados ponía 0 incluso para ti con 11x. Lo honesto es contar sus **salidas de pista** medidas por nosotros, con la etiqueta "salidas" y no "incidentes".

### Número de infracciones y penalizaciones

- **iRacing no da un contador de infracciones, ni el tipo de penalización** (drive-through, stop & go, segundos), ni el motivo. Solo da **bits de bandera**, tuyos y de cada coche:

  | Bandera                      | Bit      | Nota                               |
  | ---------------------------- | -------- | ---------------------------------- |
  | Negra                        | 0x10000  |                                    |
  | DQ                           | 0x20000  |                                    |
  | Negra enrollada (aviso)      | 0x80000  |                                    |
  | Meatball                     | 0x100000 |                                    |
  | "DQ por puntuación inválida" | 0x200000 | Aún no está definida en `flags.ts` |

- **Hoy:**
  - Tus banderas negra, DQ y meatball salen en Alertas.
  - Cada coche lleva un distintivo de negra o meatball en Standings.
- **Falta:**
  - el aviso de la negra enrollada;
  - los distintivos también en el Relative;
  - **contarlas**.
- **Lo que sí podemos hacer:**
  - contar nosotros cuántas veces salta cada bandera en la sesión: "Avisos 2 · Negras 1 · Meatball 1";
  - avisar de la "penalización a Nx" por el límite de incidentes. El formato exacto hay que confirmarlo en una carrera oficial.
- **Pendiente de comprobar online:** si se ven las banderas de otros pilotos sin ser admin. Offline eres admin, así que ahí no sirve de prueba.

---

## 2. Top 10 recomendado (de más rentable a menos)

### 1. Incidentes siempre visibles + aviso "+Nx" (esfuerzo S)

- **Qué ves:**
  - un chip fijo `3x`;
  - al sumar un incidente, `+2x Pérdida de control · V5 · S3 · grava`;
  - con límite, `11x · penalización a 17x`.
- **Datos:**
  - `PlayerCarMyIncidentCount`, y `PlayerCarTeamIncidentCount` en carreras por equipos;
  - `PlayerIncidents` (tipo y puntos);
  - `PlayerTrackSurfaceMaterial` (hierba, grava, piano);
  - del YAML, `IncidentLimit`, `IncidentWarningInitialLimit` e `IncidentWarningSubsequentLimit`. Son texto ("unlimited" o un número), y los dos últimos no están tipados.
- **Límites:**
  - iRacing puede "subir" un incidente (de 2x a 4x), así que hay que agrupar en unos 2 s.
  - Falta comprobar si `PlayerIncidents` es un pulso o queda fijo. Si falla, se muestra solo "+Nx".
  - El límite se oculta si es ilimitado, y el contador se reinicia al cambiar de sesión.
- **Quién más lo tiene:** el Incident Tracker nativo, Track Impulse y benofficial2.
- **Cómo lo haríamos mejor:**
  - tipo + dónde + superficie, en cualquier tipo de sesión;
  - alimenta la memoria de incidentes por curva (sección 3).

### 2. Paquete de avisos que faltan (esfuerzo S)

- **Qué ves:** `EXCESO 68/60 · LIMITADOR OFF`, `LIMITADOR` al acercarte a la entrada, `AVISO (negra enrollada)`, `5 VUELTAS`, `GRÚA 0:42`, `CALADO` y `SENTIDO CONTRARIO`.
- **Datos:** `OnPitRoad`, `Speed`, `TrackPitSpeedLimit`, `PlayerTrackSurface`, `SessionFlags`/`CarIdxSessionFlags`, `SessionLapsRemainEx`, `PlayerCarTowTime`, `EngineWarnings`, `LapDistPct` y `Gear`.
- **Límites:**
  - El aviso de limitador solo se activa al pasar de pista a zona de boxes, porque esa zona también cubre la salida.
  - Falta confirmar qué significa exactamente la bandera enrollada.
  - Lo de 10/5 vueltas hay que calcularlo.
- **Quién más lo tiene:** RaceLab Digiflag, Fulcrum DigiFlags, Track Impulse Pro (con voz) e irDashies.
- **Cómo lo haríamos mejor:** ya tenemos la banda de alertas con prioridades, tiempo mínimo en pantalla y modo daltónico. Solo hay que añadir casos.

### 3. Standings y Relative con lo que el nativo no da (esfuerzo S)

- **Qué ves:**
  - la mejor vuelta también en carrera (hoy solo sale la última);
  - `stint 7 v` y `última parada V12`;
  - el compuesto `H` / `W`;
  - los distintivos de negra y meatball también en el Relative.
- **Datos:**
  - `CarIdxBestLapTime`;
  - `stintLaps` y `lastPitLap` del RaceModel, que **ya se calculan pero no se pintan**;
  - `CarIdxTireCompound` + YAML `DriverTires` (0 = Hard, 1 = Wet);
  - `CarIdxSessionFlags`.
- **Límites:**
  - El nombre del compuesto solo se conoce para tu modelo de coche.
  - El número de paradas ya se muestra.
- **Quién más lo tiene:** es la **petición nº 1 contra el nativo** en Reddit. iOverlay muestra penalizaciones y la última parada; benofficial2, el stint en el Relative; Garage 61, un panel de stints (pero en una segunda pantalla).
- **Cómo lo haríamos mejor:** sale casi gratis porque el RaceModel ya lo calcula, y está dentro del propio overlay.

### 4. Salud del motor (esfuerzo S)

- **Qué ves:** iconos `AGUA` / `ACEITE` / `PRESIÓN`, y `Agua 98 °C ↑ +6 vs tu media (¿rebufo?)`.
- **Datos:** los bits 0x1, 0x2, 0x4 y 0x40 de `EngineWarnings`, más `WaterTemp`, `OilTemp`, `OilPress`, `FuelPress` y `Voltage`.
- **Límites:**
  - Son variables por coche: hay que comprobar que existen en el MX-5.
  - La referencia sale de tus vueltas limpias. Ir a rebufo sube la temperatura sin que haya daño.
- **Quién más lo tiene:** irDashies (Car Systems), Fulcrum (Systems), el dash de benofficial2 y los iconos de Car Damage nativo.
- **Cómo lo haríamos mejor:** la tendencia se mide contra tu propia referencia, no solo contra el umbral rojo del sim.

### 5. Ocultar OverLap cuando ocultas la interfaz del sim, abres el garaje o ves una repetición (esfuerzo S)

- **Qué ves:** si ocultas la UI de iRacing o abres el garaje, los widgets desaparecen también. En una repetición siguen al coche que estás mirando.
- **Datos:** `CamCameraState & 0x8` (UI oculta), `IsGarageVisible`, `IsReplayPlaying` y `CamCarIdx`.
- **Límites:** en una repetición el tiempo va hacia atrás. Los modelos tienen que ignorarlo y no deben registrar incidentes de la repetición.
- **Quién más lo tiene:** el nativo tiene un modo de UI mínima, pero manual. irDashies solo cambia según el tipo de sesión.
- **Cómo lo haríamos mejor:** es barato y ataca la queja de "demasiadas cosas en pantalla".

### 6. Condiciones de pista (esfuerzo S)

- **Qué ves:**
  - `Pista 34 °C ↑ · Aire 22 °C · Viento 10 km/h de cara en recta · Goma moderada`;
  - con lluvia, `Mojado 3/7 · Lluvia 40 % · DECLARADA MOJADA`.
- **Datos:**
  - `TrackTempCrew`, `AirTemp`, `WindVel`;
  - `WindDir` (restándole `YawNorth` para que sea relativo a tu coche);
  - `TrackWetness`, `Precipitation`, `WeatherDeclaredWet` y `Skies`;
  - YAML `SessionTrackRubberState`.
- **Límites:**
  - **No hay pronóstico.**
  - Falta comprobar si el viento indica de dónde viene o hacia dónde va.
  - Con meteo clásica nunca llueve.
  - Si `TrackWetness` = 0 significa "desconocido", hay que mostrar "—" y no "seca".
- **Quién más lo tiene:** el widget nativo de meteo (que solo se activa con Alt+K dentro del coche), Edge, benofficial2 (con el estado de la goma), irDashies y Fulcrum Wind.
- **Cómo lo haríamos mejor:** el viento relativo a tu coche y la tendencia de la temperatura de pista, dentro del overlay.

### 7. Tira de pista (esfuerzo S–M)

- **Qué ves:** una línea con todos los coches por su % de vuelta, los sectores y tu box. Encima: los peligros (coche parado o fuera de pista), tu rival de batalla resaltado y la clase rápida acercándose.
- **Datos:**
  - `CarIdxLapDistPct` (-1 = fuera del mundo);
  - `SplitTimeInfo` (en Okayama: 0 / 0,26 / 0,51 / 0,69);
  - `DriverPitTrkPct` (tu box está en 0,977);
  - `CarIdxTrackSurface` y el RaceModel.
- **Límites:**
  - Hay que excluir el coche de seguridad (CarIdx 64, aparcado en el pit lane) salvo bajo caution.
  - En Okayama el pit lane cruza la línea de meta, así que el % tiene que dar la vuelta por 0.
- **Quién más lo tiene:** Track Impulse.
- **Cómo lo haríamos mejor:** funciona desde el primer segundo y es la base del mapa 2D.

### 8. Caja de reparaciones (esfuerzo M)

- **Qué ves:**
  - `REPARACIÓN oblig. 14 s · opc. 38 s · FR 1/1`;
  - en el box, la cuenta atrás;
  - al salir, `sales con 20 s de opcional sin reparar`;
  - `Boxes: no se puede reparar`.
- **Datos:**
  - `PitRepairLeft`, `PitOptRepairLeft` y los bits 0x80/0x100 de `EngineWarnings`;
  - `FastRepairAvailable` y `FastRepairUsed`;
  - `PitstopActive`, `PlayerCarInPitStall`, `PlayerCarPitSvStatus` (105) y `PlayerCarTowTime`;
  - YAML `FastRepairsLimit`.
- **Límites:**
  - **Hay que comprobar si los segundos aparecen en pista.**
  - Si salen 0 con el bit activo, la caja dice "Reparación obligatoria pendiente" sin segundos. Nunca debe mostrar "0 s".
  - Con FR = 255 (ilimitadas) se muestra "FR ∞" o nada.
  - No dice qué pieza está dañada.
- **Quién más lo tiene:**
  - El nativo enseña dónde está el daño (Car Damage) y el resumen de la parada (Pit Summary).
  - El spotter nativo dice los tiempos de reparación cuando usas la grúa.
  - **Ninguna herramienta de terceros tiene una caja de reparaciones clara.**
- **Cómo lo haríamos mejor:** es el tema más caliente de 2026 (hilos de 195, 210 y 100 puntos sobre no entender las reparaciones). Además es la base de "¿Reparo o sigo?".

### 9. Ayuda para reincorporarte a pista (esfuerzo M)

- **Qué ves:** si estás fuera de pista o parado, `ESPERA · coche a 2,1 s` o `LIBRE 6 s`, con los coches que vienen por detrás.
- **Datos:** `PlayerTrackSurface` / `CarIdxTrackSurface` (3 = en pista), `CarIdxLapDistPct`, `CarIdxOnPitRoad`, el ritmo del RaceModel y `Speed`.
- **Límites:**
  - No hay posición lateral: el aviso dice "por detrás", nunca "libre por la izquierda".
  - `CarLeftRight` no sirve aquí: en tu grabación marcó "libre" las 956 muestras.
  - Hay que excluir el coche de seguridad.
- **Quién más lo tiene:**
  - benofficial2 (Rejoin Helper), irDashies (Rejoin Indicator) y Fulcrum (Rejoin Assistant);
  - el spotter nativo, pero solo por voz y con la locuacidad del spotter al máximo.
- **Cómo lo haríamos mejor:** reutiliza la lógica "por detrás" del widget Tráfico. Las reincorporaciones peligrosas están entre las quejas más votadas del año.

### 10. Mapa 2D aprendido de tu vuelta (esfuerzo L)

- **Qué ves:**
  - el dibujo del circuito con todos los coches;
  - mientras graba, `grabando mapa · 63 %`;
  - si la vuelta no cierra, `vuelta descartada, sigue rodando`;
  - encima, lo que el nativo no pinta: peligros, rival y dónde saldrías si paras.
- **Datos:**
  - `Speed`, `YawNorth`/`Yaw`, `LapDistPct` y `SessionTime`, en **cada** tick de 60 Hz;
  - del YAML, `TrackID`, `TrackConfigName`, `TrackLength` (3,6547 km) y `TrackNorthOffset`;
  - como alternativa exacta, el `.ibt`.
- **Límites:**
  - Hay que validar la orientación una vez.
  - Solo valen vueltas limpias, sin grúa ni saltos.
  - Dos coches lado a lado se ven como un solo punto.
- **Quién más lo tiene:**
  - el nativo, con 4 modos;
  - RaceLab Pro, con la salida de boxes prevista;
  - iOverlay, con nombres de curva (PRO);
  - irDashies, con los SVG de iRacing;
  - Slipstream, SimHub y Pitwall, con mapa aprendido.
- **Cómo lo haríamos mejor:** sin material de iRacing, y como capa de lo que ya calculamos (tráfico, batalla, reparación, salida de boxes).

### Siguientes candidatos (fuera del top 10)

| Idea                                       | Esfuerzo           | Datos / nota                                                                                                                     |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Ayudante de boxes                          | M                  | Distancia a tu box, colocación en el box (`PlayerCarPitSvStatus` 100–104) y tráfico a la salida                                  |
| "Si paro ahora"                            | M–L                | Posición en la que saldrías de boxes. Solo lo hacen bien StintView, Crew Chief (por voz) y RaceLab Pro                           |
| Delta oficial de iRacing                   | S                  | Contra el mejor de la sesión o la vuelta óptima (`LapDeltaToSessionBestLap`, `…OptimalLap`). En clasificación, "vs pole" en vivo |
| Media de vueltas limpias de iRacing        | S                  | `LapLastNLapTime`. Offline parece inactiva                                                                                       |
| Luces de cambio                            | S                  | `PlayerCarSL*RPM` + `RPM`. En el MX-5, cambiar a 7200                                                                            |
| Juegos de neumáticos restantes             | S                  | Solo en series con límite                                                                                                        |
| Uso de pianos por curva                    | S–M, por comprobar | `Tire*_RumblePitch`                                                                                                              |
| Detectar tirones por paginación de memoria | S                  | `MemPageFaultSec` + `FrameRate`                                                                                                  |
| Ayuda de salida lanzada y reinicios        | S–M                | `PaceMode`, `CarIdxPaceLine/Row`                                                                                                 |
| Combustible preciso                        | S–M                | Poco útil en los sprints del MX-5                                                                                                |

### Antes de construir: una sesión de prueba tuya (unos 20 min offline)

1. **Golpe contra el muro en práctica con daños activados.** ¿Salen `PitRepairLeft`/`PitOptRepairLeft` en pista? ¿Se activan los bits 0x80/0x100? ¿`PlayerIncidents` es un pulso o se queda fijo? ¿Se sube algún incidente (2x → 4x)?
2. **Entrar y salir del pit en Okayama.** ¿Dónde empieza y dónde acaba la zona de boxes respecto al pit lane? ¿Se activa si pasas por delante de la entrada sin entrar?
3. **Trompo y grúa.** La cuenta atrás de `PlayerCarTowTime`.
4. **Una recta y una vuelta cerrada.** Signos del volante y del rumbo, para que el mapa no salga en espejo.
5. **Online, en una carrera oficial.** El formato de los límites de incidentes, si se ven las banderas de los demás, y `CarIdxFastRepairsUsed` de los rivales.

### Trampas técnicas detectadas (para quien lo implemente)

- **Comprobar variables con `índice >= 0`, nunca `!== null`.** Una variable que no existe devuelve -1, y leerla tumba el proceso. Además, irsdk-node también se cae si le pides por nombre una variable que el coche no tiene.
- **Los bits llegan como Int32 con signo.** El bit de salida (0x80000000) hace que `SessionFlags` sea negativo. Hay que normalizar con `>>> 0` antes de comparar.
- **El YAML viene en Latin-1** (`Encoding: ISO_8859_1`). Si se decodifica como UTF-8, los nombres con ñ o tildes salen rotos online.
- **El coche de seguridad (CarIdx 64) está en los arrays,** aparcado en el pit lane. Hay que excluirlo de tráfico, reincorporación y tiempos de boxes.
- **No usar `CarClassEstLapTime` como ritmo de reserva.** Decía 99,6 s y la media real fue 112,7 s, un 13 % de error. Mejor mostrar "midiendo…".
- **Hay variables que no hacen falta:** `PitRepairNeeded`/`PitOptRepairNeeded` no están en los tipos, y lo mismo dicen ya los bits de `EngineWarnings`.
- **No mostrar deltas de iR/SR cuando `Official` = 0.** Y offline `SubSessionID` = 0: para guardar historiales hay que usar `SessionUniqueID` más la hora de inicio.

---

## 3. Lo que nadie hace bien (ideas diferenciales)

### "¿Reparo o sigo?" (esfuerzo M–L; necesita la caja de reparaciones)

- **Qué ves:** `Daño: −0,9 s/v (S3 +0,6) · punta −4 km/h · volante torcido 3,5° → quedan 9 v, pierdes ~8 s · parar cuesta 38 s → SIGUE`.
- **Cómo se calcula:**
  - ritmo por sector antes y después del golpe;
  - velocidad punta en la recta más larga, sin rebufo;
  - **volante torcido en recta**, medido con `SteeringWheelAngle` cuando `YawRate` y `LatAccel` son casi cero, comparando los mismos tramos de pista;
  - frente al coste de parar: segundos de reparación más el tiempo perdido en el pit lane.
- **Por qué no lo tiene nadie:** el nativo dice dónde está el daño, pero nadie dice **cuánto te cuesta** ni si la parada compensa. Se mostraría con una banda de confianza.

### "Dónde le gano" (esfuerzo M)

- **Qué ves:** `Le ganas 0,21 s en T5–T7 · él te gana 0,15 s en la recta trasera`. Y lo mismo con el coche de detrás: `te gana en la frenada de T1`.
- **Cómo se calcula:** el RaceModel ya cronometra a **todos** los coches en 100 puntos por vuelta (unos 36 m en Okayama). Se agrupan en zonas usando las últimas 3 vueltas limpias de los dos.
- **Por qué no lo tiene nadie:** en una monomarca como el MX-5 decide dónde preparar el adelantamiento. La predicción de adelantamiento es lo más votado del roadmap de RaceLab, y está sin terminar.

### Memoria de incidentes por curva entre sesiones (esfuerzo M)

- **Qué ves:** `Okayama T1 en V1: 3 de tus últimos 5 incidentes`, `T7: 2 salidas hoy en práctica`.
- **Por qué no lo tiene nadie:** el tracker nativo lo olvida todo al acabar la sesión, y Garage 61 guarda vueltas, no incidentes.

### "Quién cae, quién viene" (esfuerzo S–M)

- **Qué ves:** en Standings, una flecha de tendencia por rival: `▲ −0,4 s/v` o `▼ +0,3 s/v`. Si además lleva meatball o ha usado la fast repair, eso explica la caída.
- **Cómo se calcula:** con la pendiente de sus últimas 3 a 5 vueltas limpias. En sprints de 12 vueltas, se oculta si hay menos de 3.

### Ocultado inteligente según el momento de la carrera (esfuerzo M)

- **Qué ves:** cada widget aparece solo cuando importa:
  - Standings, en recta o bajo caution;
  - el ayudante de boxes, en el pit lane;
  - la caja de reparaciones, solo si hay daño.
- **Además ahorra CPU y GPU,** porque en OverLap un widget oculto no se calcula, y el rendimiento es la queja nº 1 contra los overlays.
- **Por qué no lo tiene nadie:** el nativo es manual, e irDashies solo cambia por tipo de sesión.

### Dos extras pequeños

- **Contador de banderas por sesión:** "Avisos 2 · Negras 1". Es lo más parecido a "número de infracciones" que permiten los datos reales.
- **"Tirón: paginación de memoria":** para distinguir si el que da tirones es OverLap o tu PC.

---

## 4. Descartado y por qué

| Idea                                                           | Por qué no                                                                                                      | Qué hacer en su lugar                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Dibujo del coche con daño por pieza                            | El SDK no lo exporta                                                                                            | Caja de reparaciones y "¿Reparo o sigo?". Para ver dónde está el daño, el widget nativo                           |
| Radar lateral "de verdad", o dos coches lado a lado en el mapa | No hay posición lateral de los demás. Solo `CarLeftRight` (izquierda/derecha, y solo para ti)                   | El radar actual: barras de lado + distancia longitudinal                                                          |
| Temperaturas, desgaste y presiones de neumáticos en vivo       | Solo se actualizan en el box. Las presiones en caliente y la temperatura de superficie solo existen en el disco | Como mucho, una tarjeta tras la parada con los datos del YAML (`LastHotPressure`, `LastTemps*`, `TreadRemaining`) |
| Puntos de incidente de los rivales                             | No están en los datos: IA a 0 y resultados a 0. Online, sin verificar                                           | Contar sus salidas de pista, etiquetadas como "salidas"                                                           |
| Tipo de penalización, segundos o motivo                        | Solo hay bits de bandera                                                                                        | Distintivos por coche + aviso de negra enrollada + contador de banderas                                           |
| Pronóstico del tiempo                                          | No existe en el SDK                                                                                             | Tendencias de temperatura y humedad                                                                               |
| Mapa con coordenadas en vivo                                   | `Lat`/`Lon` solo en el `.ibt` del disco, y solo de tu coche                                                     | Mapa aprendido de tu vuelta, o leído del `.ibt`                                                                   |
| Usar los mapas SVG de iRacing                                  | Son propiedad de iRacing y la API no da accesos nuevos                                                          | Mapa propio                                                                                                       |
| Poner combustible o reparaciones automáticamente               | El SDK lo permite, pero OverLap es de solo lectura por diseño                                                   | Indicarlo como texto: "pon 14 L", "marca FR"                                                                      |
| Pedales, combustible o neumáticos de los rivales               | Solo hay su marcha, sus RPM y su volante                                                                        | No hace falta                                                                                                     |
| Spotter por voz                                                | Crew Chief ya lo hace gratis y bien                                                                             | Avisos visuales, quizá un pitido opcional                                                                         |
| iR/SR en carreras offline                                      | `Official` = 0 y tu iRating offline es 1                                                                        | Mostrar solo en oficiales (como ahora)                                                                            |

---

## 5. Fuentes

**iRacing (nativo y notas de versión)**

- https://support.iracing.com/support/solutions/articles/31000179517-2026-season-4-initial-release-notes-2026-09-09-01-
- https://boxthislap.org/iracing-2026-season-3-release-notes/
- https://boxthislap.org/iracing-2026-season-2-release-notes/
- https://boxthislap.org/iracing-2025-season-4-release-notes/
- https://boxthislap.org/iracing-do-we-need-detailed-pit-repair-information/
- https://support.iracing.com/support/solutions/articles/31000170136-competition-spotter-and-crew-chief-messages
- https://www.explosion.com/game-guides/iracing-patch-notes/ (fuente secundaria)

**Overlays**

- RaceLab:
  - https://racelab.app/
  - https://racelab.app/iracing
  - https://garage.racelab.app/news/2026/03/18/2026/trackmap-rewrite
  - https://roadmap.racelab.app/feedback
- iOverlay: https://ioverlay.app, https://ioverlay.app/help
- Kapps: https://kapps.kutu.ru/
- irDashies:
  - https://github.com/tariknz/irdashies
  - https://github.com/tariknz/irdashies/releases
  - https://raw.githubusercontent.com/tariknz/irdashies/main/src/app/services/incidentDetector.ts
- Edge Overlays: https://edgeoverlays.com
- Track Impulse: https://track-impulse.com/overlays
- KSR Overlays: https://kimbosimracing.com/en
- Slipstream: https://github.com/antonholovko-cloud/Slipstream
- Fulcrum Suite: https://github.com/fulcrumttv/Fulcrum-Suite
- StintView: https://www.reddit.com/r/iRacing/comments/1x5smsf/
- Pitwall: https://www.reddit.com/r/iRacing/comments/1t06sfs/
- GO Setups: https://support.gosetups.gg/hc/en-gb/articles/23224288679570-Free-vs-Paid-What-Is-Included-Without-a-Subscription

**SimHub**

- https://www.simhubdash.com/get-a-license/
- https://github.com/fixfactory/bo2-official-overlays (benofficial2)
- https://www.simhubdash.com/community-2/dashboard-templates/romainrobs-collection/
- https://danielnewmanracing.com/products/overlays

**Telemetría, spotter y live timing**

- Garage 61:
  - https://iracerhub.com/garage-61-now-has-live-timing-what-it-does-and-why-endurance-racers-should-know/
  - https://www.reddit.com/r/iRacing/comments/1szadi1/
- Crew Chief: https://mr_belowski.gitlab.io/CrewChiefV4/index.html
- Simulator Controller: https://github.com/SeriousOldMan/Simulator-Controller
- SDK Gaming: https://www.sdk-gaming.co.uk/article-categories/overlay-components/
- Track Titan: https://www.tracktitan.io/rto
- Trophi: https://www.trophi.ai/pricing
- Comparativas:
  - https://iracerhub.com/best-iracing-overlays-2026-2/
  - https://coachdaveacademy.com/tutorials/10-must-have-free-apps-for-iracing/

**Hilos de r/iRacing** (leídos a través del archivo Arctic Shift)

- Qué le falta al nativo:
  - https://www.reddit.com/r/iRacing/comments/1u3do88/
  - https://www.reddit.com/r/iRacing/comments/1xax78h/
  - https://www.reddit.com/r/iRacing/comments/1vjmj17/
- Daños y reparaciones:
  - https://www.reddit.com/r/iRacing/comments/1w14xqn/
  - https://www.reddit.com/r/iRacing/comments/1s7e9kw/
  - https://www.reddit.com/r/iRacing/comments/1shfz2z/
  - https://www.reddit.com/r/iRacing/comments/1uudru4/
- Reincorporaciones:
  - https://www.reddit.com/r/iRacing/comments/1x6i2mh/
  - https://www.reddit.com/r/iRacing/comments/1swtbd4/
  - https://www.reddit.com/r/iRacing/comments/1u1412y/
- Radar sin datos laterales: https://www.reddit.com/r/iRacing/comments/1trfc53/
- Neumáticos (no hay temperaturas en vivo): https://www.reddit.com/r/iRacing/comments/1sroxqn/
- Penalizaciones: https://www.reddit.com/r/iRacing/comments/1tbnri2/, https://www.reddit.com/r/iRacing/comments/1u2x4gp/
- Overlays y rendimiento:
  - https://www.reddit.com/r/iRacing/comments/1x279xl/
  - https://www.reddit.com/r/iRacing/comments/1rltdrl/
  - https://www.reddit.com/r/iRacing/comments/1sixsq7/
  - https://www.reddit.com/r/iRacing/comments/1wt0rvr/
