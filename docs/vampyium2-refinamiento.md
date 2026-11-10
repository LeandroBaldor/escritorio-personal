# Segunda ronda de correcciones — pendiente de deploy

Cambios locales preparados en Escritorio Personal y MiniJuegos. No publicar hasta que el usuario lo indique.

- Guardia del protagonista inspirada en la referencia adjunta: base amplia, pecho abierto, puño libre recogido y espada adelantada.
- Nuevo atlas del cazador, 20 piezas: torso más robusto, brazos y muslos más musculosos, acero grabado y cuero con mayor detalle.
- Hombreras izquierda y derecha independientes, con cúpula arriba y láminas hacia el codo. Guante de agarre independiente, dedos delante de la empuñadura y orientación de muñeca ligada a la espada.
- Renovadas las 59 piezas de vampiros terrestres, con piel, pelo, metal, tela y cuero de mayor contraste y detalle.
- Ataques articulados continuos: carga del peso, flexión, recogida del brazo, descarga y recuperación. La extensión llega al máximo en el instante original de daño; no cambia el alcance ni la frecuencia de ataque. Respiración, inclinación del torso y cabeza acompañan el paso.
- 21 recortes anatómicos nuevos: cráneo, mandíbula, costillas, pelvis, húmero, fémur y vértebras para humanoide, hombre lobo y dragón. Las partículas conservan la especie de origen, escala, giro y trayectoria de la explosión.
- Permanecen vida ilimitada, diez niveles abiertos y cartel En construcción.

Arte integrado en `src/features/games/assets/vampyium2/`: `hunter.webp`, `rig-a.webp`, `rig-b.webp` y `anatomy.webp`. Total: 11 atlas y 246 recortes, más la portada.

Generación con la herramienta integrada image_gen. Prompts exactos en [vampyium2-refinement-prompts.json](vampyium2-refinement-prompts.json). El conversor acepta límites de filas y columnas para evitar cortar piezas que cruzan la cuadrícula nominal.

Revisión local: [guardia y manos](vampyium2-refined-hero.png), [ataques](vampyium2-refined-attacks.png), [huesos](vampyium2-refined-bones.png). Las pruebas verifican los tiempos de carga/impacto/recuperación, procedencia de huesos, controles, niveles, armas y render en escritorio y móvil.
