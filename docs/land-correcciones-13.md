# Revisión 13: configuración, líder y pasos

- Música del menú: volumen de 0,50 a 0,60, un aumento relativo del 20 %. Continúa la pista `menu_musica_3.mp3` en bucle.
- La civilización se elige en la columna izquierda. Su ficha aparece a la derecha; debajo están «Enemigos» (1–9), sus civilizaciones, dificultad y «Continuar». No se permiten rivales repetidos o iguales al jugador. «Ver infograma» conserva el informe completo y Resumen.
- Se retira el bloque «Tu aldea» y se amplía el Canal del Líder. El resumen de trabajos de tropas se conserva.
- Seleccionar la base propia, incluido el Nido Sauriano, abre la composición de la aldea: población utilizada/capacidad, habitantes vivos y cantidad de cada uno de los seis personajes. La vista se actualiza con nacimientos y bajas. Las unidades pesadas ocupan varias plazas; no se confunden plazas con habitantes.
- `pasos.mp3` sustituye los pasos anteriores en todas las unidades orgánicas con piernas. Un ciclo tiene dos, cuatro o seis apoyos según la anatomía del sprite. Robots, tanques, gólems, exotrajes, criaturas flotantes y serpientes sin piernas no generan pasos. El volumen individual parte de 0,055 y se reduce con la cantidad de patas; como máximo se mezclan tres apoyos. Solo suenan dentro de cámara, al desplazarse realmente; no se acumulan pasos al volver a ver una unidad.

El original se conserva en `assets/land/voices/footsteps/steps.mp3`. Se recortan ocho apoyos de hasta 150 ms, con fundidos y compensación de nivel. Preparación:

```sh
node scripts/prepare-land-steps.mjs /ruta/a/SONIDOS/pasos.mp3
```

Pruebas: conteo de población, anatomía, ritmo y volumen, exclusión de robots, selección y adversarios, líder ampliado y Nido Sauriano con actualización en vivo en escritorio y móvil.
