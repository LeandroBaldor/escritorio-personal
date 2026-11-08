# Revisión 14: navegación, radio y acciones

- La flecha de la partida vuelve al menú principal de Land of Warriors. Solo «Juegos» en el menú inicial sale a la galería. Las otras flechas y Escape vuelven a la pantalla anterior: escenarios recuerda si se llegó desde la selección o desde el informe.
- La selección muestra retratos de los líderes en la lista y una cara de 180–200 px en la ficha elegida, con recorte más amplio. «Ver infograma» pasa a llamarse «¡VER!».
- Solo humanos y elfos orgánicos reproducen `pasos.mp3`. Volumen base 0,032, máximo dos apoyos simultáneos, filtrados entre 100 y 1700 Hz para suavizar el ruido. Se conservan sincronización y culling por cámara.
- Las voces suben de 0,45 a 0,72. Solo habla un personaje a la vez y las voces de enemigos visibles tienen pausas de ocho segundos. Pasos, disparos e incendios bajan al 28 % mientras habla un personaje o suena un aviso. El sonido de radio humano se refuerza con banda 400–2800 Hz, saturación, compresión, ganancia y estática tenue limitada a la duración de la voz.
- Los edificios terminados dañados por un rival arden por debajo del 45 % de vida: llamas, humo y `fire.mp3`. Se mezcla un único incendio visible. Sale de la mezcla al apartar la cámara, reparar o destruir la construcción; se detiene al pausar o salir.
- Al terminar una construcción suena `construcción.mp3`; al salir una unidad, `personaje_creado.mp3`. Canal de aviso limitado a una reproducción; no se apilan notificaciones sonoras.
- Humanos, elfos, demonios, enanos y orcos se arrodillan y extienden los brazos al recolectar junto al recurso. La pose entra gradualmente y se retira al caminar, llevar la carga o cancelar la orden. Usa la malla continua para mantener unidas las extremidades.

Los tres originales nuevos quedan en `assets/land/voices/events/`. Preparación:

```sh
node scripts/prepare-land-events.mjs /ruta/a/SONIDOS
```

Verificación: rutas de regreso, retratos, sonidos de creación, condiciones de incendio y descarte al salir de cámara, voces, pasos restringidos y transición de recolección. Pruebas de navegador en escritorio y móvil, con capturas de fuego y poses de las cinco civilizaciones.
