# Land of Warriors: animaciones y barra de referencia

Se incorporaron 800 cuadros de imagen con transparencia, distribuidos en 20 atlas WebP para las diez civilizaciones. Cada atlas de recolección contiene cuatro poses para minerales y cuatro para cosecha en cada uno de los cuatro niveles del trabajador. Las rodillas, manos y herramientas cambian de posición; las criaturas y máquinas utilizan sus propias articulaciones.

Cada atlas de batalla contiene cuatro poses de caminata y cuatro de ataque para los seis tipos de unidad de nivel 1. Los niveles superiores conservan sus diseños de evolución y usan el sistema articulado mejorado: 32 fases de caminata y 12 de ataque. No se sustituyen sus armaduras por el diseño de nivel 1. Se reforzaron el balanceo de brazos, codos y muñecas.

Los cuadros comparten anclaje y escala por fila para evitar saltos. La acción se elige según la orden real: caminar, extraer, cosechar o atacar. El trabajador se levanta al transportar la carga. Las hojas de imágenes se cargan por civilización y tienen una alternativa articulada mientras cargan.

Se eliminaron las etiquetas permanentes N1–N4. Al seleccionar una unidad se muestran su nombre y nivel; la selección múltiple los presenta en el panel para evitar texto superpuesto sobre el ejército.

La barra inferior de escritorio utiliza los píxeles originales de MENU.png, conservados en `src/features/games/assets/land/hud-reference.png`, con ventanas para minimapa, unidades, retrato, datos y doce órdenes funcionales. Mantiene la proporción de la referencia de 1672 × 941; el contenido responde a la selección actual. En móvil se conserva una distribución legible adaptada al ancho disponible.

Recursos y prompts finales: [land21-prompts.json](land21-prompts.json). Se usó la herramienta integrada de generación de imágenes con referencias de cada civilización. La conversión y comprobación de transparencia se encuentra en `scripts/prepare-land-animation.mjs`.

Vistas: [barra dentro de la partida](land21-hud.png), [galería de poses](land21-animaciones.png) y [video de las diez civilizaciones](land21-animaciones.webm).

Validación: 580 pruebas unitarias en escritorio-personal y 470 en MiniJuegos; compilación y lint; revisión del HUD en 1672 y 1280 píxeles y móvil; poses distintas en los 60 tipos de unidad; producción, evolución, recolección y selección. La sincronización compara byte a byte código, recursos, pruebas y documentación.
