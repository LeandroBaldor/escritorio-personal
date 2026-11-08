# Land of Warriors — Correcciones 19

## Opciones de partida

En Civilizaciones se elige el **límite de población por civilización**: 100, 300, 1000 o 3000; valor inicial 300. Se aplica al jugador y a todos los rivales. Los depósitos siguen ampliando las plazas disponibles hasta ese límite. El entrenamiento cuenta las plazas de las unidades en cola y rechaza superar el máximo. Las unidades pesadas conservan su costo de varias plazas.

En Escenarios se elige **Cantidad de minerales**:

| Opción | Reserva por yacimiento |
|---|---:|
| Pocos | 50% |
| Normal | 100% |
| Muchos | 200% |
| Repleto | 400% |

Aplica a cristales azules, dorados, verdes y piedras, tanto junto a las bases como en los depósitos neutrales. Conserva la distribución del escenario y los recursos iniciales de cada civilización. Las opciones se mantienen al volver entre pantallas o desde la partida.

## Animación

Todos los recolectores se agachan al extraer minerales: sin exclusión de civilizaciones. Los humanoides flexionan las rodillas y se inclinan para trabajar; larvas y criaturas de otras anatomías comprimen el cuerpo y bajan sus extremidades respetando su silueta. Se levantan al transportar los recursos o cambiar de orden.

Los brazos contrabalancean los pasos con un arco mayor y más fluido; codos y muñecas tienen movimiento articulado. Durante la extracción las manos hacen un ciclo de trabajo; el ataque tiene más flexión y retroceso. Se reutilizan los sprites actuales mediante deformación de malla, sin generar imágenes nuevas.

## Poblaciones grandes

Un índice espacial temporal reduce la búsqueda de blancos, curación y daño de área a unidades cercanas. Se actualiza al mover cada unidad y descarta bajas. La separación de tropas continúa usando celdas espaciales.

## Verificación

- Límites 100/300/1000/3000 reales, tanto para jugador como rival, incluyendo entrenamiento en cola y plazas liberadas por bajas.
- Las cuatro abundancias modifican exactamente las reservas de todos los nodos sin cambiar sus posiciones.
- Las diez civilizaciones se agachan al extraer y se levantan con la carga.
- Ciclos continuos de brazos y manos, cabeza y pies estables durante la recolección.
- Simulación de 3000 unidades; movimiento entre celdas y exclusión de bajas del índice espacial.
- Navegación, persistencia de opciones, configuración de partida efectiva y poses renderizadas en Chrome de escritorio y móvil.

Código, pruebas y documentación se sincronizan entre ambos repositorios con `scripts/sync-land.mjs`.

Capturas: [población](land19-poblacion.png), [minerales](land19-minerales.png) y [comparación de las diez animaciones](land19-animaciones.png).
