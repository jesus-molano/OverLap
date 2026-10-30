# Decisión: si OverLap se vende, cómo (R32, 30-10-2026)

Nota de decisión del estudio de UX (R32). **No cambia nada en la app**: OverLap sigue sin cuenta,
sin conexión y sin funciones bloqueadas. Esta nota fija qué hacer _si_ algún día se vende, para que
esa decisión no estropee lo que hoy es una ventaja frente a los demás overlays.

## Por qué

- iOverlay pasó a una suscripción mensual y recibió muchas quejas en r/iRacing (2024–2025, vistas
  solo en extractos de búsqueda); su licencia PRO se pierde al reinstalar Windows.
- RaceLab obliga a iniciar sesión, también para lo gratuito.
- OverLap hoy no pide cuenta, no se conecta a nada (solo lee la memoria del SDK de iRacing en el
  propio equipo) y no tiene niveles: es una diferencia que los usuarios notan.

## Decisión

Si se vende:

1. **Pago único**, no suscripción. Las actualizaciones de la versión mayor comprada van incluidas.
2. **Licencia que funciona sin conexión**: una clave firmada que la app comprueba en local, sin
   llamar a ningún servidor al arrancar ni durante la carrera.
3. **Que no dependa del equipo**: la misma clave sirve tras reinstalar Windows o en otro PC del mismo
   piloto; nada de huellas de hardware.
4. **Sin cuenta**: la clave llega por correo al comprar; la app nunca pide iniciar sesión.
5. **No se bloquea nada que ya exista**: lo que hoy hace la app sigue funcionando igual para todos.
   Si hubiera una edición de pago, sería por funciones nuevas, nunca quitando las actuales.
6. **Las disposiciones se siguen exportando e importando libremente** (y «Exportar todo» de
   _Acerca de y ayuda_), para compartirlas entre pilotos sean de la edición que sean.
7. **Sin telemetría de uso ni anuncios**; el diagnóstico sigue siendo algo que el usuario copia a
   mano.

## Qué no se hace ahora

Nada de esto se implementa en esta fase: ni pantallas de licencia, ni comprobaciones, ni límites.
Si se decide vender, esta nota es el punto de partida, y cualquier cambio que limite la app tendría
que contradecirla de forma explícita.
