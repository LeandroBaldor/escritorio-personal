# Land of Warriors — revisión 9

La revisión se aplica en escritorio-personal y MiniJuegos.

- Se elimina la llamada a `playStart` en la tarjeta de Land of Warriors de la galería. Era el origen de la voz «Let's go» que todavía se escuchaba al abrir el juego.
- La infografía se reconstruye con componentes y las ilustraciones existentes: líder, seis unidades, seis construcciones, recursos, poder y mejoras. Se elimina la vista de ejemplo de la partida y se amplían las ilustraciones y sus nombres. El contenido se puede desplazar sin perder los botones inferiores.
- Se quitan los huesos de las decoraciones de todos los terrenos y su código de dibujo.
- La columna izquierda muestra exclusivamente la civilización del jugador: retrato del líder tomado de su infografía, descripción, estado de la aldea, población y poder propio.
- Al elegir una construcción o seleccionar un edificio propio aparece una tarjeta superior ampliada con su imagen, nombre, utilidad, costo y tiempo de construcción.
- La parte inferior izquierda contiene «Tus tropas», según la última indicación del usuario. Muestra retratos, vida y actividad actual de las unidades propias: espera, marcha, combate, búsqueda, recolección, transporte y construcción. Incluye el recurso o edificio objetivo y el porcentaje de obra. Los filtros separan ejército y trabajadores. Seleccionar una fila elige esa unidad y centra la cámara. En pantallas pequeñas se abre con «Tropas y líder».

La lista usa el estado real de la partida y excluye a las unidades enemigas y muertas. No incluye un chat ni un campo para escribir órdenes.

Capturas: `land9-informe.png`, `land9-tropas.png` y `land9-construccion.png`.
