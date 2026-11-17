# Kombat Penales · corrección 16

- La pierna se precalcula en un canvas con alfa binario: el recorte exterior sigue transparente y los píxeles del cuerpo se dibujan completamente opacos. El PNG fuente se conserva.
- El pisotón produce 780 gotas de sangre frente a las 260 anteriores, salpicaduras más grandes y un charco adicional.
- `grito.mp3` se precarga y suena una sola vez, 0,6 segundos antes del impacto, tanto para pateador como arquero.
- Se conectó `syncPenaltySceneAudio` al bucle real del partido. Antes estaban los archivos y el controlador, pero faltaba invocarlo desde esa pantalla.
- `ovni.mp3` suena durante el vuelo. `ovni_dispara.mp3` comienza al cargar el emisor, a los 0,8 segundos, antes del haz visible y del impacto. El audio se detiene al pausar o abandonar la escena.
- También se conectó el controlador de fuegos artificiales a la pantalla de campeón.

Validación: 63 pruebas enfocadas de lógica y audio, compilación en ambos proyectos y pruebas de navegador de opacidad renderizada y reproducción desde el juego real en escritorio y móvil. La prueba de integración registra fuentes nativas de Web Audio e identifica los archivos decodificados para comprobar vuelo, carga y grito; no se limita a llamar a los helpers.
