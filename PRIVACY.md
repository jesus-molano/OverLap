# Privacidad / Privacy policy

Última actualización / Last updated: 31-10-2026.

## En español

**OverLap no se conecta a internet.** No tiene cuentas, ni anuncios, ni telemetría de uso, ni
informes de errores automáticos, y no envía ningún dato a ningún sitio: ni al autor, ni a GitHub, ni
a terceros.

**Qué lee.** Solo la memoria compartida del SDK oficial de iRacing, en modo solo lectura y en tu
propio equipo, para dibujar los widgets: tiempos, posiciones, nombres de los pilotos de la sesión,
etc. También lee los botones del volante (con Raw Input de Windows) si les asignas un atajo.

**Qué guarda, y dónde.** Todo se queda en tu equipo, en `%APPDATA%\iracing-overlay\`:

- `settings.json`: tus ajustes y disposiciones;
- `personal-bests.json`: tus récords de vuelta (para el delta);
- copias de seguridad de esos dos archivos (`settings.json.bak`, `settings.json.v5.bak`,
  `personal-bests.json.bak`) y, si usas el modo de datos simulados, su propia subcarpeta `mock/`;
- `overlap.log` (y `overlap.old.log`): el registro de la app, para diagnosticar fallos. Puede llevar
  rutas de tu equipo (con tu usuario de Windows) y nombres de pilotos de tus sesiones. Nunca sale de
  tu equipo salvo que tú lo copies;
- las cachés y el almacenamiento propios de Electron/Chromium (sin datos personales).

Puedes borrarlo todo borrando esa carpeta. **Exportar todo…** solo escribe el archivo que tú eliges.

**Lo que tú decides compartir.** **Copiar diagnóstico** copia al portapapeles un texto (versiones,
estado y pantallas, sin nombres) para que lo pegues donde quieras. Los botones de **Acerca de y
ayuda** (guía, informar de un problema, código fuente, licencia, avisos de terceros) abren tu
navegador en GitHub solo cuando los pulsas; a partir de ahí se aplica la política de privacidad de
GitHub.

**En el futuro: el actualizador.** Una versión próxima traerá un actualizador automático. Cuando
llegue:

- consultará solo las versiones publicadas de OverLap en GitHub Releases, para saber si hay una nueva
  y descargarla (GitHub verá tu dirección IP, como en cualquier descarga);
- vendrá **activado de serie y se podrá desactivar** en los ajustes;
- este documento, el README y las notas de la release lo explicarán **antes** de que se publique esa
  versión.

Hasta entonces, OverLap no hace ninguna conexión de red.

**Contacto.** Abre un issue en <https://github.com/jesus-molano/OverLap/issues> o, si es algo
privado, un aviso privado en
<https://github.com/jesus-molano/OverLap/security/advisories/new>.

## In English

**OverLap does not connect to the internet.** It has no accounts, no ads, no usage telemetry and no
automatic crash reports, and it sends no data anywhere: not to the author, not to GitHub, not to
third parties.

**What it reads.** Only the official iRacing SDK shared memory, read-only and on your own computer,
to draw the widgets (lap times, positions, the names of the drivers in the session, and so on). It
also reads your wheel's buttons (through Windows Raw Input) if you bind a shortcut to them.

**What it stores, and where.** Everything stays on your computer, in `%APPDATA%\iracing-overlay\`:
your settings and layouts (`settings.json`), your lap records (`personal-bests.json`, for the
delta), backup copies of both (`.bak`), the simulated mode's own `mock/` subfolder if you use it,
Electron/Chromium's own caches and storage (no personal data), and the app's log
(`overlap.log`, `overlap.old.log`), which can contain paths with your Windows user name and driver
names from your sessions. Nothing leaves your computer unless you copy it. Deleting that folder
removes it all.

**What you choose to share.** **Copy diagnostics** puts a text (versions, status and displays, no
names) on the clipboard for you to paste. The buttons in **About and help** open your browser on
GitHub only when you click them; GitHub's privacy policy applies from there.

**In the future: the updater.** A coming version will add an automatic updater. When it does, it
will only check OverLap's published releases on GitHub (GitHub sees your IP address, as with any
download), it will be **on by default and can be turned off** in the settings, and this document,
the README and the release notes will describe it **before** that version is released. Until then,
OverLap makes no network connections at all.

**Contact.** Open an issue at <https://github.com/jesus-molano/OverLap/issues>, or a private report
at <https://github.com/jesus-molano/OverLap/security/advisories/new>.
