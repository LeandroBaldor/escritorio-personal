# Optimización del sistema de animaciones (auditoría y mejoras)

Respaldo: rama `punto-antes-optimizacion-animaciones` en los dos repos (MiniJuegos 18497a0, escritorio-personal aa9f366).

## Auditoría (cómo funciona)
- **Esqueleto 2D con cinemática directa**: cada personaje calcula cadera → cuello → hombros → codos → manos y cadera → rodillas → tobillos (vampyium2Motion `vampireRigPose`, vampyium2Chars `hunterPose`, vampyium2Demian). Las piezas pintadas del atlas se colocan entre dos articulaciones con `jointTransform`/`limb` y nunca cambian de largo.
- **Caminata** (vampyium2Gait): ciclo de 8 fases con apoyo fijo (el pie de apoyo no patina: `walkT` avanza con la distancia recorrida), brazos opuestos a las piernas, sube y baja contacto/abajo/paso/arriba.
- **Cinemática inversa**: piernas (pie al piso) y la segunda mano del martillo sobre el mango.
- **Ataques**: tres fases suavizadas (carga, golpe, vuelta) sobre los tiempos de la lógica (`ATTACK[kind].at` y `dur`).

## Problemas detectados
1. Parado ↔ caminando era un **cambio de golpe** (tres cuartos → perfil): hombros, ancho del torso y recorte saltaban de un cuadro al otro.
2. Golpes con **velocidad pareja**: sin anticipación sostenida, sin aceleración hacia el impacto y sin seguimiento.
3. **Drácula dragón**: un único dibujo con alas siempre arriba, apoyado en el piso al bajar; el fuego salía de un punto fijo que no coincidía con la boca.
4. Las 7 piezas del dragón articulado pintaban el cuadro entero (mucha superficie transparente): costo de dibujo.

## Mejoras
- **Mezcla parado/caminando** (`walkK`, ~0,15 s): hombros, torso y recorte pasan de forma continua.
- **Ataques de los vampiros**: QUIETO → ANTICIPACIÓN (la carga se sostiene un instante) → ACELERACIÓN (cada vez más rápido) → IMPACTO exactamente en `at` (el mismo instante en que la lógica aplica el daño) → SEGUIMIENTO (pasa un poco de largo) → RECUPERACIÓN suave → QUIETO. El balanceo se dibuja en 4 cuadros o más.
- **Estocada de Demian**: acelera hasta quedar extendida justo cuando se abre la ventana de daño (0,04 s), seguimiento del brazo con la hoja siempre horizontal, vuelta suave.
- **Drácula dragón**: el dibujo del dragón volando del atlas se cortó en piezas (cuerpo con las patas colgando, cola, cabeza con boca cerrada y abierta, y cada ala partida en la muñeca: `assets/vampyium2/dragon-flight.webp`). Ciclo continuo: alas arriba → bajan → horizontales → completamente abajo (puntas hacia abajo) → suben → horizontales → arriba. El tramo exterior del ala va con retraso (la membrana sigue al brazo), el cuerpo sube con el aletazo y baja al subir las alas, la cola ondula desfasada y el cuello acompaña. Nunca se apoya: al bajar queda flotando y aleteando. El ataque es una capa aparte: la cabeza apunta, junta la energía en la garganta, abre la boca, lanza el fuego y la cierra, sin interrumpir el aleteo. El fuego sale de la boca dibujada.
- Rendimiento: cada pieza se dibuja solo dentro de su contorno; igual o más rápido que antes en escritorio y celular.

## Sin cambios
Daño, colisiones, tiempos de impacto, rostros, armaduras, colores, texturas, proporciones y armas. GSAP no hace falta: las interpolaciones son funciones puras por cuadro (más simples de probar y sin dependencias nuevas).

## Validación
Pruebas nuevas: tiempos del golpe (impacto en `at`, aceleración, seguimiento, sin saltos entre cuadros), ciclo del ala continuo de arriba del todo a abajo del todo, puntas hacia abajo, fuego desde la boca. Hojas: `vampyium2-golpes.png`, `vampyium2-dragon-vuelo.png`, `vampyium2-personajes.png`.
