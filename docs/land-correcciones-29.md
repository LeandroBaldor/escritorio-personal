# Correcciones 24: Land of Warriors

Cambios limitados a Land. No se modifica Kombat Football.

- Cámara: cada partida nueva empieza en el alejamiento máximo permitido; se conserva el zoom de acercamiento. La vista arranca centrada en la base.
- Tus tropas: encabezados y valores comparten el área desplazable y los anchos de columna. Se elimina el margen heredado de las cantidades y se iguala la tipografía. Comprobado geométricamente en escritorio y teléfono.
- Recursos: el cursor muestra un pico sobre minerales y un fruto verde sobre cosechas cuando hay trabajadores seleccionados. El ataque conserva la espada.
- Cosechas: una orden de movimiento interrumpe la entrega automática de alimento. Sin Almacén, el trabajador conserva su carga y puede moverse; el líder y la ficha explican qué edificio falta. Se conserva el ciclo de 60 segundos y la entrega en Almacén.
- Orientación: se registran frente, espalda y lateral a partir del desplazamiento real. Se agregan 60 vistas traseras generadas a partir de las unidades existentes, con transparencia, recortes individuales y animación de doce poses. Se mantiene el tamaño de cada evolución.

## Dificultades

Todos los niveles construyen su economía y defensas antes de lanzar una ofensiva. Los tiempos son mínimos, no ataques obligatorios si la base o el ejército aún no están listos. Las unidades conservan sus estadísticas y el entrenamiento base de un minuto.

| Dificultad | Primera ofensiva desde | Trabajadores objetivo | Ejército inicial | Evolución máxima | Refuerzos desde |
|---|---|---|---|---|---|
| Muy fácil | 11 min | 8 | 10 | 1 | 7 min |
| Fácil | 10 min | 10 | 16 | 2 | 5 min |
| Normal | 9 min | 14 | 24 | 3 | 3:30 min |
| Difícil | 8 min | 18 | 34 | 4 | 2:30 min |

La recolección, construcción y frecuencia de decisiones también se ajustan progresivamente. Las mejoras se pagan con recursos. El menú explica las diferencias antes de iniciar.

## Comprobaciones

Pruebas de regresión de cosecha y movimiento en las diez civilizaciones; orientación de los seis personajes de cada una; límites y ofensivas de los cuatro niveles de IA. Las simulaciones con economía real comprueban que cada dificultad puede completar su base y preparar una ofensiva. Las pruebas de navegador verifican zoom, alineación, cursores, salida de una cosecha y la galería de 60 unidades.

El atlas `directions-back.webp` se obtuvo con la habilidad imagegen. `scripts/prepare-land-directions.mjs` valida su transparencia y sus 60 casilleros y lo convierte a WebP.
