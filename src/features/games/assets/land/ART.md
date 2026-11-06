# Recursos visuales de Land of Warriors

`units-<civilización>.webp` contiene once piezas en una cuadrícula de cuatro columnas por tres filas. La última celda queda vacía. El orden es: trabajador, milicia, tirador, apoyo, unidad pesada, élite, base, cuartel, taller, torre y depósito.

Las diez hojas se generaron para esta revisión con ImageGen. Se pidió una vista de estrategia desde arriba y en tres cuartos, materiales realistas, iluminación desde arriba a la izquierda y las identidades y colores de las civilizaciones existentes. El recorte se calcula a partir del canal alfa, sin coordenadas dependientes de la resolución.

`terrain-materials.webp` contiene diez materiales de suelo en cinco columnas por dos filas, en el mismo orden que `THEMES`. Se combinan con la geografía, la vegetación, las orillas y los detalles procedurales.

Para preparar nuevas hojas PNG llamadas `units-<civilización>.png` y `terrain-materials.png`:

```sh
node scripts/prepare-land-art.mjs /ruta/a/las/hojas-png
```

El proceso usa Chromium de Playwright para generar WebP y normalizar la transparencia. No se necesita ese proceso durante la compilación ni mientras se juega. Las láminas de referencia y la hoja anterior `sprites.webp` se conservan para comparación.
