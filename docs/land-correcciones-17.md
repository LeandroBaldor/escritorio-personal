# Land of Warriors: correcciones 17

## Evoluciones de personajes

Los 60 personajes tienen cuatro evoluciones adicionales al diseño original: Blindado, Veterano, Campeón y Ascendido. Se investigan de forma secuencial en el cuartel exclusivo de cada personaje, nunca en el centro de mando. Se aplican a los personajes de ese tipo existentes y futuros, conservando su porcentaje de salud. Dos cuarteles del mismo tipo no pueden investigar simultáneamente la misma evolución.

Cada nivel aumenta daño y curación un 28% del valor base, resistencia un 32%, velocidad un 7%, alcance un 6% y tamaño un 7,5%; mejora también la cadencia. El cuarto nivel llega al 130% del tamaño original. Los costos por nivel son 100/200/300/400 azules, 60/120/180/240 dorados, 16/32/48/64 verdes y 35/70/105/140 piedras. Tiempos: 25/35/45/55 segundos.

Los diez atlas transparentes `src/features/games/assets/land/evolutions-<civilización>.webp` contienen 24 diseños cada uno: seis filas de personajes y cuatro columnas de evolución. Se generaron con la herramienta integrada de imágenes, a partir de las hojas originales. No se usó API alternativa. El conjunto de prompts y rutas finales está en [land17-prompts.json](land17-prompts.json). `scripts/prepare-land-evolutions.mjs` convierte a WebP sin eliminar la transparencia y valida que las 24 celdas contengan arte. Los diseños utilizan el mismo sistema de animación articulada que las unidades originales.

## Piedras y comida

Las piedras son un cuarto recurso mineral, distinto de los cristales azules. Hay vetas junto a todas las bases y en zonas de expansión. Se transportan al centro de mando o depósito; todas las estructuras necesitan piedras.

La reserva inicial de alimento es 500 (100%). La creación de soldados y su mantenimiento la reducen. Los tipos pesados y élite consumen más; las evoluciones aumentan el consumo de mantenimiento. Al llegar a cero los soldados dejan de moverse y combatir. Los trabajadores siguen funcionando para permitir recuperar la economía.

Construí un **Almacén** y parcelas de **Cosecha**, de color verde oscuro. Cada parcela admite un trabajador: tarda 60 segundos en cosechar 30 de alimento, lo lleva físicamente al Almacén y regresa a su parcela. La comida cuenta al entregarse, no al cosecharse. Si falta el Almacén conserva la carga; al construir otro continúa la entrega. La reserva nunca supera 100%. Cada civilización tiene su alimento: cereales, frutos, hongos, biomasa, carne de criadero, frutos de ceniza, biocombustible o algas, según corresponda.

La computadora construye Almacén y cosechas, asigna trabajadores y equilibra minerales y piedras; prioriza una unidad pesada antes de lanzar su ofensiva preparada.

## Panel de selección

La selección y la vista previa de construcción aparecen solamente en el panel inferior central. La base muestra cantidades agrupadas por personaje y tarea, sin describir cada paso del transporte. Hay páginas de actividad para poblaciones grandes, evitando scroll. Los cuarteles muestran sus cuatro diseños, cantidad disponible, cola y evolución actual. Los soldados muestran progreso de 0 a 100% y valores actuales/máximos de resistencia, daño, velocidad, alcance, fuerza contra estructuras y cadencia. Los consejos y requisitos completos también se pueden consultar con el cursor.

## Verificación y sincronización

Pruebas unitarias de las cuatro evoluciones en cada civilización, costos, investigación exclusiva, piedras, cosecha de un minuto, entrega obligatoria, reserva limitada y recuperación de la falta de comida. Pruebas de navegador en escritorio y celular para cuarteles, atributos, panel compacto y construcción sin ventanas adicionales. El sincronizador incluye arte, motor, interfaz, pruebas, documentación y prompts de esta revisión.

Capturas verificadas: [cuartel y evoluciones](land17-cuartel.png), [cosecha y Almacén](land17-cosecha.png) y [todos los personajes con sus cuatro diseños](land17-evoluciones.png).
