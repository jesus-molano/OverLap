# Cómo contribuir

_In English: issues and pull requests are welcome in Spanish or English. Every commit needs a
`Signed-off-by` line (DCO, `git commit -s`); there is no CLA. Run the five checks below before you
open a pull request._

Gracias por querer mejorar OverLap. Los informes de errores, las ideas y los pull requests son
bienvenidos, en español o en inglés.

## Antes de empezar

- **Un error**: abre un issue con la plantilla «Informar de un problema». Si adjuntas el registro
  (`overlap.log`), léelo antes: ver [la plantilla](.github/ISSUE_TEMPLATE/bug_report.yml).
- **Una idea o un cambio grande**: abre antes un issue para hablarlo, así nadie trabaja en algo que
  luego no encaja.
- **Un fallo de seguridad**: no abras un issue público; sigue [SECURITY.md](SECURITY.md).

## Preparar el entorno

Necesitas Node.js 22 (22.13 o posterior) o 24 (el de la CI). Para probar con iRacing y para compilar
el `.exe` hace falta Windows 10 u 11 de 64 bits; `npm run dev:mock` (una carrera simulada) también
funciona en Linux y macOS. No hace falta Visual Studio ni Python: los addons nativos vienen
precompilados.

```bash
npm ci
npm run dev:mock   # sin iRacing: una carrera simulada
npm run dev        # con iRacing abierto
```

Las [notas de desarrollo](docs/README.dev.md) explican cómo está montado por dentro y cómo se añade
un widget.

## Las cinco comprobaciones

Un pull request tiene que pasar las cinco, igual que la CI:

```bash
npm run typecheck
npx vitest run
npx eslint . --max-warnings 0
npx prettier --check .
npx electron-vite build
```

- Si cambias algo que se ve, añade o ajusta sus tests y los textos en **los dos idiomas**
  (`src/shared/i18n/messages/`).
- Si el cambio lo nota quien usa OverLap, apúntalo en [CHANGELOG.md](CHANGELOG.md), en
  «[Sin publicar]».
- Un pull request, un cambio: más fácil de revisar.

## Firma de los commits (DCO)

OverLap usa el [Developer Certificate of Origin](https://developercertificate.org/) (DCO), no un CLA.
Con él declaras que tienes derecho a enviar tu código bajo la licencia del proyecto. Basta con firmar
cada commit:

```bash
git commit -s -m "Lo que cambia"
```

Eso añade al final del mensaje una línea como esta, con tu nombre y tu correo:

```
Signed-off-by: Tu Nombre <tu@correo.com>
```

Si se te olvida, `git commit --amend -s` firma el último, y `git rebase --signoff main` todos los
de tu rama.

## Licencia de tus contribuciones

OverLap es software libre bajo la [GPL-3.0-or-later](LICENSE). Lo que aportes se publica con esa misma
licencia: no hay que ceder derechos ni firmar nada más que el DCO.

No añadas código, imágenes ni logos que no puedas publicar bajo la GPL (o bajo una licencia
compatible, citada en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). En particular, no se aceptan
logos de marcas nuevos en color: los que hay no están bajo la GPL y se explican en ese archivo.

## Revisión

El mantenedor revisa cada pull request antes de unirlo. Puede pedirte cambios o, si algo no encaja
con el proyecto, explicarte por qué no se une.
