# Kombat Penales · corrección 15

- `ovni.mp3` acompaña el vuelo, y `ovni_dispara.mp3` suena durante el haz. Los bucles se detienen al pausar o salir y reanudan desde el reloj de la secuencia.
- El ovni es un 36 % más ancho y conserva el casco opaco y el render de alta calidad.
- Los brazos del piedra, papel o tijera se balancean desde el codo mediante una animación continua, sin remontar las imágenes en cada golpe.
- Fuego con turbulencia ascendente, bordes rojizos, centro amarillo y núcleos calientes; conserva el esqueleto y la explosión final.
- El congelamiento produce bloques de hielo más grandes con sangre.
- `fuegos_artificiales.mp3` acompaña la pantalla de campeón y se detiene al salir.
- Nueva muerte aleatoria `stomp`: la pierna gigante desciende desde arriba, aplasta verticalmente a quien erró el penal o al arquero que falló, y se retira. El impacto mezcla `paso_gigante.mp3` y el archivo existente `explosion_sangre.mp3`.

## Validación

60 pruebas de lógica y audio; controles de estilo y compilación TypeScript/Vite. Pruebas en navegador de las ocho muertes para todos los luchadores y ambos roles, los diez archivos de audio, el ovni opaco y su ejecución final, y el recorte transparente del pie con capturas antes/durante/después del impacto en escritorio y móvil. También se comprobó el flujo de amistoso, dos jugadores, piedra/papel/tijera y acceso al mundial.

## Recorte de la pierna

Herramienta: imagegen incorporada, modo edición, fondo transparente. Archivo final: `src/features/games/assets/penales/botines-cutout.png` (1024 × 1536). El original del usuario no se sobrescribió.

Prompt utilizado:

> Edit target: the supplied photograph of a soccer player's lower leg and white blue gold cleat. Remove ONLY the black/gray studio background and any external cast shadow, leaving true transparent alpha around the entire leg and boot. Preserve the exact original leg, shin guard, sock, skin, shoe markings, gold sole, orientation, shape, all spikes and photographic detail. No redesign, no added objects, no glow, no shadow, no cropped shoe. Keep the leg extending out of the top edge as in the original, complete shoe at bottom. This is an opaque photoreal game sprite cutout.
