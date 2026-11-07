# Sonidos de los personajes de Land of Warriors

Se incorporan los 72 MP3 indicados por el usuario. Están representadas las diez civilizaciones y los 60 personajes actuales, incluido **Tanque Bastión**, del Imperio Humano. Su sonido se reproduce al seleccionarlo, recibir órdenes o completar su entrenamiento. `oron.mp3` se asocia al **Dron** del Sindicato Mecánico. `acido.mp3` es un efecto adicional para el ataque del Escupidor Ácido zergano.

## Reproducción

- Los humanos usan recortes cortos de impactos para los pasos. Cada apoyo alternado del pie dispara un fragmento al alcanzar la misma fase de la animación. La fase depende de distancia realmente recorrida; quedarse quieto o bloqueado no genera pasos. Se conservan las variantes cortas para respuestas al seleccionar o dar órdenes. El exoélite usa su variante de marcha.
- Los elfos responden con frases de hasta cuatro segundos, recortadas usando pausas y mínimos de energía, sin acelerar ni cambiar el tono. Se descartan las colas melódicas demasiado cortas y se aplican fundidos de entrada y salida.
- Los personajes de las demás civilizaciones usan sus grabaciones al seleccionarlos, recibir una orden o completar su entrenamiento. Las variantes disponibles se alternan. Los clips largos se reproducen por fragmentos con fundidos.
- Desde la revisión 11 los ataques usan los siete archivos compartidos `disparo_*`, según el arma; se conservan los efectos originales en el archivo de personajes. Los impactos en construcciones y las muertes usan las grabaciones específicas entregadas por el usuario.
- Los pasos solo suenan dentro del área de cámara. Se limita la mezcla a tres pasos, una voz, cuatro efectos y dos muertes simultáneas. Pausar, salir o esconder la pestaña detiene los sonidos; los fragmentos pendientes no se reproducen después de salir.
- Las grabaciones idénticas comparten el buffer de audio por SHA-256. Solo se precarga la civilización elegida; los demás sonidos se cargan cuando hacen falta. Los niveles se compensan por RMS y la salida tiene limitador.

## Archivos y preparación

Los MP3 completos se guardan en `src/features/games/assets/land/voices/<civilización>/`. `cues.json` contiene sus rutas originales, hashes, duración y los recortes de reproducción. No se modifican las grabaciones de origen. La reproducción usa Web Audio con límites de tiempo y envolventes de volumen.

```sh
node scripts/prepare-land-sounds.mjs /ruta/a/CIVILIZACIONES
```

El script valida y decodifica los 72 audios con Chromium, prepara los recortes y genera dos muestras WAV:

- [Pasos humanos](land-sonidos-pasos.wav).
- [Frases élficas](land-sonidos-elfos.wav).

Las pruebas verifican cobertura y recortes, sincronización por apoyo, silencio al detenerse, descarte de voces pendientes al pausar y funcionamiento en navegadores de escritorio y móvil.
