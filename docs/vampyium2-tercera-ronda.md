# Tercera ronda — Demian y caminata

Referencias del usuario: `demian_1.png` (reposo), `demian_2.png` (estocada) y `caminata.mp4` (50,48 segundos). Se revisaron cuadros del video: contacto del talón, carga del peso, paso de la pierna libre y despegue con la punta.

## Demian

Nuevo kit de veinte piezas con armadura blanca/plata, grabados dorados, hombreras de león, capa roja bordada y espada acorde a las imágenes. En reposo la espada queda sobre el hombro, detrás de la cabeza. El ataque pasa por un arco superior a una estocada horizontal, sostiene esa postura en la ventana original de daño y regresa al reposo. Los pies abren la base y el peso avanza. Al moverse, conserva la marcha; saltos, armas alternativas y especiales mantienen sus controles y reglas.

## Vampiros

Ocho cabezas independientes con cráneo, mandíbula, cuello, cabello, capucha o corona completos. El alto y ancho conservan la proporción del recorte original. Incluye al vampiro volador; el dragón conserva su anatomía propia.

Canilla y bota ahora son piezas separadas. La rodilla se resuelve con dos segmentos de longitud constante; el tobillo gira sin arrastrar toda la canilla. Talón, planta y punta apoyan sobre el suelo; el pie de apoyo queda fijo en el mundo mientras avanza el cuerpo. La pelvis oscila sin mover el pie plantado y la rodilla libre flexiona para pasar. Los brazos acompañan la pierna contraria. Se conserva la preparación del ataque y la amortiguación del salto.

Se corrigió también la espera de carga de imágenes: usa los eventos de carga y error para evitar quedar esperando una decodificación ya disponible.

## Revisión

- [Vista animada con pausa, selección de cuadro y velocidad](vampyium2-round3-preview.html)
- [Reposo](vampyium2-round3-idle.png), [estocada](vampyium2-round3-strike.png), [cabezas](vampyium2-round3-heads.png) y [ciclo de pasos](vampyium2-walk-cycle.png).
- La estocada se muestra en cámara lenta en la vista previa; el juego mantiene sus tiempos originales.

Validación: 81 pruebas unitarias del juego y sus animaciones, más pruebas de navegador en escritorio y móvil. Se comprueban el apoyo, la ausencia de deslizamiento, las longitudes de ambas partes de la pierna en 120 fases por especie y la orientación y recuperación de la espada.

Arte generado con la herramienta integrada image_gen. Archivos en `src/features/games/assets/vampyium2/`: `hunter.webp`, `heads.webp` y `enemy-legs.webp`. Los trece atlas suman 268 recortes. [Prompts exactos](vampyium2-round3-prompts.json).

Esta ronda incluye las poses, cabezas y apoyos revisados para ambos proyectos.
