# Land of Warriors — Correcciones 18

Balance elegido: el nivel 4 es muy fuerte, pero puede caer ante un grupo de nivel 1. Una prueba de combate verifica que cinco reclutas de nivel 1 vencen a uno de nivel 4; la posición, el tipo de unidad y el apoyo siguen influyendo.

## Soldados: cuatro niveles exactos

Todos empiezan en Nivel 1 y evolucionan hasta Nivel 4 desde su cuartel exclusivo. Una investigación beneficia a las unidades de ese tipo existentes y futuras; conserva el porcentaje de vida y no encarece entrenar más unidades.

| Nivel | Resistencia frente a nivel 1 | Daño | Velocidad y alcance | Cadencia |
|---|---:|---:|---:|---:|
| 1 Inicial | ×1 | ×1 | ×1 | ×1 |
| 2 Veterano | ×1,67 | ×1,4 | ×1,06 | ×1,05 |
| 3 Campeón | ×2,58 | ×2 | ×1,12 | ×1,10 |
| 4 Ascendido | ×3,54 | ×2,8 | ×1,18 | ×1,16 |

La vida inicial es 2,4 veces la anterior para prolongar los combates. Nombres y distintivos N1–N4 acompañan a las unidades; la selección muestra el nombre completo y las capacidades actual/máxima. En el cuartel aparecen cuatro diseños y las ganancias del próximo nivel.

| Evolución de primera línea/tirador | Azules | Dorados | Verdes | Piedras | Tiempo |
|---|---:|---:|---:|---:|---:|
| 1 → 2 | 100 | 50 | 0 | 20 | 20 s |
| 2 → 3 | 180 | 100 | 25 | 40 | 30 s |
| 3 → 4 | 300 | 180 | 60 | 70 | 40 s |

Factor de costo por tipo: trabajador ×0,65; primera línea/tirador ×1; apoyo ×1,1; pesado ×1,3; élite ×1,5. Se redondea hacia arriba a múltiplos de cinco. El juego muestra el costo exacto antes de confirmar. Una investigación del mismo tipo por vez.

## Construcciones: dos tecnologías en la base

Producción y Fortificación tienen tres mejoras, independientes de los cuatro niveles de personajes. Se compran con los botones de órdenes de la base; la pestaña Construcciones explica costos y beneficios. No se pueden investigar dos tecnologías de edificios a la vez.

| Mejora | Azules | Dorados | Verdes | Piedras | Beneficio acumulado |
|---|---:|---:|---:|---:|---|
| Producción 1 | 160 | 100 | 0 | 40 | Entrenamiento −20%; obras −10% |
| Producción 2 | 300 | 180 | 25 | 80 | Entrenamiento −35%; obras −20% |
| Producción 3 | 480 | 300 | 60 | 140 | Entrenamiento −50%; obras −30% |
| Fortificación 1 | 100 | 0 | 0 | 140 | Vida ×1,5; daño recibido −10% |
| Fortificación 2 | 200 | 30 | 20 | 260 | Vida ×2,2; daño recibido −18% |
| Fortificación 3 | 340 | 70 | 50 | 400 | Vida ×3; daño recibido −25% |

Cada escalón tarda 25, 35 o 45 segundos. Los beneficios alcanzan edificios existentes y futuros. Fortificación conserva el porcentaje de vida: no repara gratuitamente un edificio dañado. Producción respeta las diferencias propias de cada civilización y dificultad.

## Economía para ejércitos grandes

- Entrenamiento: 60% del costo anterior, redondeado hacia arriba a múltiplos de cinco. Un Recluta cuesta 50 azules en cualquier nivel.
- Inicio: 500 azules, 200 dorados, 350 piedras y reserva de comida de 800.
- Base: 24 plazas; depósito: +20; límite global por civilización: 200 de población.
- Trabajadores transportan 14 minerales por viaje. Cada cosecha produce 60 alimentos tras 60 segundos y exige entrega en el Almacén.
- El consumo aumenta 12% de su valor inicial por nivel; los trabajadores no consumen y pueden recuperar una aldea sin comida.
- La IA forma una fuerza mayor antes de atacar y también investiga tecnologías. La separación usa una cuadrícula espacial para manejar ejércitos grandes.

## Arte e interfaz

Humanos, elfos y enanos tienen tres atlas nuevos de 24 sprites cada uno, con cuatro diseños por personaje: cambian claramente colores, placas, siluetas y armas. Generados con la herramienta integrada de imágenes, sin fallback. Rutas y prompts finales: [land18-prompts.json](land18-prompts.json).

Bichos, demonios, no muertos, robots, saurianos y orcos crecen ×1 / ×1,3 / ×1,7 / ×2,15. También crecen así los árboles y dragones élficos y el gólem enano; humanoides crecen moderadamente para destacar sus armaduras.

El panel central permanece integrado al HUD, con pestañas Aldea, Construcciones y Economía. La flecha superior izquierda de la partida vuelve a elegir civilización, conservando las opciones elegidas.

## Validación

Pruebas de compra y exclusión de investigaciones, costos reales, tiempos efectivos, daño contra fortificación, herencia de mejoras, cuatro niveles, combate nivel 4 contra grupo nivel 1 y separación de 200 soldados. Regresión completa de lógica y comprobación de paneles/navegación en Chrome de escritorio y móvil. `scripts/sync-land.mjs` mantiene código, recursos y pruebas comunes iguales en ambos repositorios.
