# Land of Warriors — Panel legible y cosechas de frutos

El panel central inferior duplica la tipografía anterior: título de 16 a 32 px en escritorio y de 11 a 22 px en celular; atributos de 11 a 22 px y de 9 a 18 px, respectivamente. Texto principal de 13 a 26 px y de 10 a 20 px. Costos, tablas, porcentajes y etiquetas acompañan el aumento.

El HUD mide 440 px; el panel central gana ancho, reduce repeticiones y usa una fuente clara. El área visible del mapa, la cámara, los sonidos y los controles consideran el nuevo alto. Estado y Mejoras se consultan dentro del mismo recuadro. En pantallas angostas, Producción y Fortificación expanden su información al tocarlas; la lista de actividades se pagina para mantener letras grandes. Los cuatro diseños se identifican como Nivel 1–4 y conservan la descripción completa en su ayuda.

Las cosechas muestran frutos verdes detallados con hojas, raíces, luces y volumen, sobre fondo transparente. Se eliminan el cuadrado de tierra, los surcos y la bandera. El sprite se dibuja debajo de los personajes para que puedan pasar visualmente por encima. No bloquea la navegación; el ciclo de cosecha, entrega al Almacén y alimento conserva su funcionamiento.

Recurso: `src/features/games/assets/land/harvest-fruits.webp`. Creado con la herramienta integrada de imágenes, sin fallback CLI. El prompt final y su ruta están en [land20-prompt.json](land20-prompt.json). La conversión reproducible con transparencia está en `scripts/prepare-land-fruits.mjs`.

Validación: tamaños calculados de fuente; paneles sin scroll en escritorio y celular; navegación entre Estado y Mejoras; transparencia real del recurso; desplazamiento de soldados sobre la cosecha; regresiones de recolección y entrega de alimentos, economía y evolución. La sincronización automática incluye código, imagen, pruebas y documentación de ambos repositorios.

[Captura del panel y los frutos dentro de la partida](land20-panel-frutos.png).
