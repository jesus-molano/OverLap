# Política de seguridad / Security policy

## Versiones con soporte / Supported versions

Solo la última versión publicada en
[Releases](https://github.com/jesus-molano/OverLap/releases) recibe arreglos de seguridad.

Only the latest release receives security fixes.

## Cómo informar de un fallo / Reporting a vulnerability

**No abras un issue público.** Usa el aviso privado de GitHub: en la pestaña **Security** del
repositorio, **Report a vulnerability**
(<https://github.com/jesus-molano/OverLap/security/advisories/new>). Solo lo ve el mantenedor.

**Please do not open a public issue.** Use GitHub's private vulnerability reporting: **Security** tab
→ **Report a vulnerability**. Only the maintainer can see it.

Incluye, si puedes / Please include, if you can:

- la versión de OverLap y de Windows / the OverLap and Windows versions;
- qué pasa y cómo reproducirlo / what happens and how to reproduce it;
- qué podría hacer alguien con ello / what an attacker could do with it.

Si adjuntas el registro (`overlap.log`), revísalo antes y quita cualquier dato personal (rutas con tu
usuario de Windows, nombres de pilotos). / If you attach `overlap.log`, review it first and remove any
personal data.

## Qué esperar / What to expect

OverLap lo mantiene una sola persona en su tiempo libre. La idea es responder en una semana y, si el
fallo se confirma, publicar el arreglo en una versión nueva lo antes posible, citando a quien lo
encontró si quiere.

OverLap is maintained by one person in their spare time. The aim is to answer within a week and, once
confirmed, to ship a fix in a new release as soon as possible, crediting the reporter if they wish.

## Alcance / Scope

Interesa sobre todo / Of most interest:

- los mensajes entre la ventana de ajustes y el proceso principal (IPC) / the IPC between the settings
  window and the main process;
- la lectura de archivos que importa el usuario (copias, disposiciones) / reading user-imported files
  (backups, layouts);
- los addons nativos (`@irsdk-node/native`, `koffi`) / the native addons;
- en el futuro, el actualizador / in the future, the updater.

OverLap solo lee la memoria compartida del SDK de iRacing y no se conecta a internet; no toca el
proceso del juego. / OverLap only reads the iRacing SDK's shared memory and does not connect to the
internet; it never touches the game process.
