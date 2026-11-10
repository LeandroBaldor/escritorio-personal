# Vampyium 2 — rediseño de arte

Último ajuste: personajes un 25% más pequeños respecto de la versión anterior (escala visual 2,25). Ambos brazos del cazador se dibujan completos delante de la coraza, la cabeza crece y la guardia abre los pies. Los vampiros terrestres usan 59 piezas nuevas articuladas con el ciclo original por distancia: apoyo de pies, rodillas, codos y balanceo opuesto. El salto del cazador anticipa 90 ms con flexión y extensión; los vampiros anticipan el salto al aproximarse a su destino y amortiguan la caída.

El rediseño utiliza las referencias aportadas por el usuario y el enfoque de recursos rasterizados de Land of Warriors. Se conservan los diez niveles, la física, los controles, la progresión y las doce armas del juego. Vampyrium permanece independiente.

## Arte integrado

Los recursos definitivos están en `src/features/games/assets/vampyium2/`. Son diez atlas con 221 recortes, más una portada independiente. `atlas.json` conserva los límites de cada recorte y la proporción de transparencia comprobada.

- `hunter.webp`: 16 piezas del cazador con anatomía adulta, rostro, grabados, cota de malla, cuero, capa, cascos y variantes de coraza. El esqueleto usa las poses de las acciones originales; el render anima las articulaciones de manera continua y la física mantiene su frecuencia original. Las armas siguen las manos; los pies se anclan al suelo al caminar y la capa responde a la velocidad y al salto. Las variantes de material se almacenan en caché por pieza.
- `enemies-a.webp` y `enemies-b.webp`: 54 poses para los nueve tipos de enemigo, incluyendo los jefes. Caminata, vuelo, salto, preparación y ejecución de ataques se seleccionan a partir del estado del enemigo. Las transiciones de golpe, hechizo, rayo y llamarada respetan los instantes originales de daño. La niebla de Drácula y las reacciones al daño se mantienen.
- `weapons.webp`: las doce armas y reliquias con materiales detallados, tanto en la mano como en el arsenal.
- `props.webp` y `traps.webp`: pisos, plataformas, cadenas, pinches, sierras, bolas, aplastadores, braseros, gárgolas, chorros, cajas, ataúdes y jaulas. La colisión y los tiempos se toman de la geometría original. Las distintas trampas mantienen sus estilos de hierro, hueso, espinas, manos, tumbas y calaveras.
- `effects.webp`: 32 cuadros de llamas, explosión, impacto carmesí y escarcha. Se combinan con luz local, humo y partículas; los pozos de líquido usan reflejos y una paleta más natural.
- `details.webp`: arco abierto y rastrillo independiente que se eleva, esqueletos para las muertes, reliquias, almas y proyectiles.
- `cover.webp`: portada del cazador y el castillo coherente con el nuevo diseño.

Los fondos pintados existentes se conservan porque ya tienen el acabado realista buscado. El terreno interactivo que se dibuja encima se reemplazó con texturas. La interfaz usa una paleta sobria y se retiraron los emojis decorativos. Una pantalla de preparación espera a que se decodifiquen los diez atlas antes de iniciar la partida.

## Validación

`tests/vampyium2-realism.spec.ts` espera a que los diez atlas estén cargados, verifica los 221 recortes, dibuja 396 combinaciones de enemigos/estados/tiempos y 132 combinaciones del cazador/armas/acciones. Incluye retroceso de caminata y los cuatro ataques especiales. También genera una revisión de los diez escenarios. Esto comprueba render y estados; no equivale a una partida completa de principio a fin en cada nivel.

Se mantienen las 64 pruebas de reglas del juego y las pruebas de inicio, salto, ataque y pausa. Las pruebas visuales se ejecutan en escritorio y móvil.

Capturas: `vampyium2-realistic-characters.png`, `vampyium2-realistic-levels.png`, y las capturas actualizadas de menú y partida.

Generación: herramienta integrada `image_gen`, sin CLI ni clave de API. Los prompts exactos están en `vampyium2-art-prompts.json`. El script `scripts/prepare-vampyium2-art.mjs` valida transparencia y convierte a WebP sin repintar; los límites de algunos recortes alargados se ajustaron en el manifiesto tras inspección visual.
