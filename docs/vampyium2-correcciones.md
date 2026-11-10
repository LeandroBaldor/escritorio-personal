# Correcciones de Vampyium 2

- Escala 2,25: reducción del 25% respecto de la versión anterior.
- Animación continua del cazador y 59 piezas nuevas en `rig-a.webp` y `rig-b.webp`. La caminata terrestre usa el ciclo original por distancia, con apoyo, rodillas y brazos opuestos. Las poses de impacto y hechizos mantienen sus tiempos.
- Anticipación del salto de 90 ms, extensión y amortiguación. Cabeza mayor, ambos brazos completos delante del torso y guardia más abierta.
- Cartel «En construcción» en tarjeta, menú y partida.
- Vida ilimitada y diez niveles abiertos.
- Derrota con marco oscuro, remaches y botones «Volver a intentar» arriba y «Volver al Menú» debajo. Con vida ilimitada la derrota se verifica además mediante el componente aislado.

Validación: 66 pruebas unitarias del juego y del cartel, pruebas de navegador de escritorio y móvil, 24 fases de caminata en siete enemigos, 221 recortes, acciones originales y revisión de los diez escenarios. Las capturas no sustituyen una partida completa de cada nivel.

Arte generado con la herramienta integrada image_gen. Prompts exactos: [vampyium2-corrections-prompts.json](vampyium2-corrections-prompts.json). Capturas: [caminata](vampyium2-walk-cycle.png), [personajes](vampyium2-realistic-characters.png) y [derrota](vampyium2-defeat-desktop.png).
