# Controles, formaciones y civilizaciones

## Controles y cámara

Con unidades propias seleccionadas, el puntero muestra una espada al pasar sobre una unidad o construcción rival. La orden utiliza el objeto señalado, incluso al pulsar en la parte superior del personaje. Un clic derecho breve da la orden al soltar; mantenerlo y arrastrar dibuja un rectángulo de selección, sin emitir órdenes durante el arrastre. Shift o Ctrl permiten sumar tropas. No hay un límite artificial de unidades seleccionadas. El arrastre izquierdo sigue explorando el mapa; Shift y arrastre izquierdo conservan la selección anterior.

El encuadre inicial muestra un 20% más de mundo: pasa de 1,6 a 1,333. El límite lejano también se amplía un 20% y el acercamiento máximo continúa en 2,8. El tiempo activo de partida aparece junto al escenario, con formato minutos:segundos; se congela en pausa.

## Formación y movimiento

Las formaciones dejan espacio según el tamaño real y la evolución de las unidades. Se desplazan dentro del mapa para evitar que los destinos se acumulen al pulsar junto a un borde. La separación espacial resuelve también personajes exactamente superpuestos, con dirección determinista y consultas por celdas. Los pasos de recolocación actualizan la animación. El alcance de contacto permite combatir sin encimarse; la distancia de trabajo permite que varios recolectores sigan extrayendo y entregando recursos.

La marcha utiliza doce poses por ciclo para los 60 tipos de personaje y sus cuatro niveles. Los atlas existentes de nivel 1 reciben poses intermedias articuladas; las evoluciones conservan sus propios diseños. Brazos opuestos a las piernas, rodillas, codos y muñecas siguen la distancia recorrida. Hay movimientos distintos para bípedos, criaturas de varias patas, larvas, voladores y vehículos con orugas. Los pasos de audio acompañan la escala de evolución. Respiración y desplazamientos de ataque también se muestran por pasos discretos. No se generaron imágenes nuevas: se reutilizan los atlas y se calculan poses mediante la malla de articulación.

Referencias de diseño: [controles contextuales y formaciones de Age of Empires](https://www.ageofempires.com/learn-to-play/control-resources-aoe2/) y [relación entre animación, desplazamiento y apoyo de los pies en Unity](https://docs.unity.com/en-us/engine/6000.6/manual/animation-section/animation-mecanim/avatar-creationand-setup/root-motion). Los gestos de ratón se adaptaron al pedido del usuario y el render sigue usando Canvas.

## Producción y especialidades

Las diez bases iniciales entrenan al recolector de su civilización. También se conserva su cuartel exclusivo; la evolución del trabajador permanece en ese cuartel. Ningún cuartel militar mezcla tipos de soldados. El entrenamiento inicial de cualquier personaje dura 60 segundos para ambos bandos y todas las dificultades. Producción mantiene sus mejoras: 60, 48, 39 y 30 segundos. Se conservan los cuatro niveles de evolución; los costos propios de cada facción acompañan sus fortalezas y contrapartidas.

Las fortalezas y debilidades aparecen en la selección y el informe de la civilización y corresponden a estadísticas efectivas:

Los radios de daño de área se adaptan al nuevo espacio entre tropas: un hechizo puede seguir golpeando a vecinos de su objetivo. Infernales y abisales conservan un área mayor que el resto. Esta interacción se verifica con enemigos separados, no superpuestos.

| Civilización | Fortaleza | Contrapartida |
|---|---|---|
| Humanos | Tiradores resistentes, apoyo médico y tanques de alcance medio | Reclutas frágiles de cerca y tanques lentos |
| Zerganos | Infantería barata y veloz | Poca vida y menor alcance de tiradores |
| Elfos | Alcance, movilidad y curación | Infantería y arqueras menos resistentes |
| Enanos | Resistencia y artillería | Movilidad reducida |
| No muertos | Curación reforzada y criaturas resistentes | Apoyos lentos y tiradores de menor alcance |
| Saurianos | Bestias de mucha vida y élites fuertes | Pesados de combate cercano y tiradores de alcance limitado |
| Infernales | Daño elevado y área | Unidades frágiles |
| Mecánicos | Alcance extremo y tanques resistentes | Tiradores caros, lentos y de menor cadencia |
| Orcos | Fuerza, vida y costo en combate cercano | Tiradores débiles y de poco alcance |
| Abisales | Área amplia y movilidad | Infantería menos resistente y hechizos lentos |

Validación: entrenamiento sin salida antes del minuto, base de las diez civilizaciones, mejoras de producción, formaciones junto al borde, descongestión, combate cercano, recolección compartida, selección propia, ventajas numéricas y doce poses; controles en navegador, cursor, zoom, pausa del reloj y muestra animada de todas las civilizaciones y niveles.

[Controles y reloj](land24-controles.png) · [Muestra de marcha](land24-marcha.png) · [Video de cuatro niveles](land24-marcha.webm).
