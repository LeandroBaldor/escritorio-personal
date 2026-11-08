# Land of Warriors: correcciones 16

Diez retratos completos reconstruidos desde las referencias del menú, dentro de cuadros cuadrados más grandes. Generados con la herramienta integrada de imágenes; sin API alternativa. Archivos finales: `src/features/games/assets/land/leaders-1.webp` y `leaders-2.webp`. Conversión reproducible con `scripts/prepare-land-portraits.mjs`.

Los hechizos usan `disparo_magia.mp3`; se conservan los sonidos de armas físicas. Los saurianos se agachan al recolectar. El panel a la derecha del minimapa muestra población y tareas al seleccionar la base, cantidades y consejos al seleccionar cuarteles, y niveles actuales/máximos y porcentaje de mejoras al seleccionar unidades. Las mejoras son las reales compartidas por la civilización, hasta nivel 3 por atributo. Las órdenes tienen nombres visibles, costos y explicaciones al pasar el cursor o enfocarlas con teclado, incluidos los requisitos que faltan.

Verificación: pruebas unitarias de población, progreso, magia y recolección; pruebas de navegador para escritorio y celular; lint y compilación de producción. Sincronización con `node scripts/sync-land.mjs ../MiniJuegos --check`.

## Prompts finales de los retratos

### Atlas 1

```text
Use case: identity-preserve. Asset: ONE production RTS game portrait atlas, exactly 3 columns by 2 rows of SQUARE cells, 1536x1024. The five attached images are REFERENCES only: use the large leader head in the TOP LEFT of each reference, NOT the infographic. Reconstruct the SAME five leaders as complete head and upper shoulder portraits with exact face/species, colors, armor, helmet, horns, ears, hair, beard and tentacles preserved. Extend the cropped head parts from the reference naturally. Cell order reading left-to-right top row then bottom row: blue-armored human commander; purple Zerg monster; blond green/gold elf; golden-helmet orange-bearded dwarf; crowned hooded undead skull. Cell 6 (bottom right) is EMPTY navy background. Full head and ALL horn/helmet/ear tips visible and entirely INSIDE each cell, with at least 12 percent EMPTY PADDING on every edge of each cell. The character must NOT touch any cell edge. Consistent centered composition, equal scale, polished realistic high-detail painted RTS art matching the references. Plain dark navy background. Exactly FIVE heads, one per cell, sixth cell empty. No text, no labels, no resources, no infographic, no frames, no grid lines, no other faces. Very important: no cropping. Uniform 3x2 grid, all cells square.
```

### Atlas 2

```text
Use case: identity-preserve. Asset: ONE production RTS game portrait atlas, exactly 3 columns by 2 rows of SQUARE cells, 1536x1024. The five attached images are REFERENCES only: use the large leader head in the TOP LEFT of each reference, NOT the infographic. Reconstruct the SAME five leaders as complete head and upper shoulder portraits with exact face/species, colors, armor, helmet, horns, ears, hair, beard and tentacles preserved. Extend the cropped head parts from the reference naturally. Cell order reading left-to-right top row then bottom row: feather-crested saurian lizard king; red horned infernal demon; silver/yellow robotic commander with orange eyes; green orc with black/red hair and tusks; blue/purple tentacled abyssal king. Cell 6 (bottom right) is EMPTY navy background. Full head and ALL horn/helmet/ear tips visible and entirely INSIDE each cell, with at least 12 percent EMPTY PADDING on every edge of each cell. The character must NOT touch any cell edge. Consistent centered composition, equal scale, polished realistic high-detail painted RTS art matching the references. Plain dark navy background. Exactly FIVE heads, one per cell, sixth cell empty. No text, no labels, no resources, no infographic, no frames, no grid lines, no other faces. Very important: no cropping. Uniform 3x2 grid, all cells square.
```
