# Vampyium 2

Versión independiente de Vampyrium en `#/juegos/vampyium2`, disponible en la lista de juegos de Escritorio Personal y MiniJuegos. El original conserva su ruta, sus diseños y sus partidas. El nuevo juego utiliza claves propias de progreso y récord (`vampyium2-nivel`, `vampyium2-record`).

Se conservan los diez niveles, doce armas, armaduras, enemigos, jefes, trampas, sonidos y controles. La lógica está clonada para que futuras modificaciones de la secuela no alteren las reglas del original. Los recursos de fondo y sonido existentes se comparten.

La dirección visual sigue siendo ilustración 2D con animación articulada: cabeza más pequeña, rostro adulto con párpados y cicatriz, hombros menos anchos, extremidades menos exageradas, botas más estrechas, hombreras facetadas, reflejos contenidos, marcas fijas de desgaste y paleta de acero, cuero y carmesí apagado. Los vampiros tienen proporciones menos caricaturescas, contornos más finos y superficies marcadas. Se sumaron niebla baja y una interfaz de tonos oscuros, marfil y bronce.

No se necesita stop motion: las poses existentes responden a caminar, correr, saltar, doble salto, caída, aterrizaje, daño, apuntado, ataques con cada arma, giro aéreo, estocada, torbellino y espada bumerán. Se mantiene esta animación para preservar la respuesta a las acciones del jugador. Esto no constituye una conversión a gráficos 3D ni a personajes fotorrealistas.

Validación: 63 pruebas de lógica y cuatro pruebas de navegador (escritorio y móvil). El navegador verifica la entrada independiente, inicio, salto, ataque y pausa; además dibuja 172 combinaciones de personajes, armas y estados sin excepciones. Capturas en `docs/vampyium2-menu-desktop.png`, `docs/vampyium2-partida-desktop.png` y sus variantes móviles.

Comandos: `npm run build`, `npx vitest run src/features/games/vampyium2.test.ts`, `npx playwright test tests/vampyium2.spec.ts --workers=1`.
