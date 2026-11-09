# Correcciones 25: evolución y marcha de Land of Warriors

Cambios limitados a Land. El trabajo de Claude en Kombat Football se conserva intacto.

## Evolución de personajes

Cada transición tarda 180 segundos, incluso con Producción mejorada. Los recursos se descuentan al iniciar. La mejora se aplica a las unidades existentes y futuras del mismo personaje y conserva la proporción de vida de las existentes.

Los cristales verdes de las transiciones a nivel 3 y 4 cuestan exactamente tres veces el importe anterior de cada rol. La primera transición, antes gratuita en verdes, ahora también los requiere. Todos los recursos de cada transición cuestan más que en la anterior; entrenar unidades mantiene sus costos existentes.

| Rol | A nivel 2 | A nivel 3 | A nivel 4 |
|---|---:|---:|---:|
| Recolector | 30 | 60 | 120 |
| Infantería | 30 | 75 | 180 |
| Tirador | 30 | 75 | 180 |
| Especial | 45 | 90 | 210 |
| Pesado | 45 | 105 | 240 |
| Élite | 45 | 120 | 270 |

Importes de cristales verdes. Los nombres de cada personaje dependen de la civilización.

La capacidad de combate progresa 13 → 26 → 51 → 100. Resistencia, daño, fuerza contra estructuras y curación crecen aproximadamente al doble por nivel. Los puntajes expresan el avance respecto al máximo de **ese tipo de personaje**: todos alcanzan 100 en nivel 4, mientras conservan sus diferencias de estadísticas absolutas. Los detalles de los atributos muestran sus valores reales y máximos. Velocidad, alcance y cadencia conservan sus mejoras graduales.

## Marcha por dirección y nivel

Diez láminas nuevas con 48 recortes cada una: seis personajes, cuatro niveles y dos vistas. Se utilizan frentes y espaldas independientes con las armaduras, equipo y colores del nivel correspondiente. Se mantienen el crecimiento corporal por evolución y las doce poses de marcha. Las parejas se normalizan para conservar la altura visible al girar y evitar cambios de tamaño por la anchura de las armas. El recorte ignora pequeñas manchas aisladas del atlas. El T-Rex y el señor infernal usan movimiento bípedo.

Las imágenes se generaron con la habilidad imagegen usando las láminas originales de evolución como referencia. `land30-generation.json` registra los originales seleccionados. `scripts/prepare-land-evolution-directions.mjs` comprueba transparencia y ocupación de los 48 casilleros y convierte las láminas a WebP.

## Validación

Pruebas de costos, duración exacta sin aceleración, conservación de vida y progresión de las 60 unidades. Pruebas de navegador para los tres ascensos, costos visibles, puntajes máximos y comprobación en píxeles de las 480 vistas. Las capturas `land30-marcha-nivel1.png`, `land30-marcha-nivel4.png` y `land30-puntos.png` muestran el resultado.
