# Recursos, excavación y centro de mando

Las construcciones terminadas muestran su nombre en tamaño pequeño, por encima de su silueta y de las barras, con el color de su civilización y contorno oscuro para mantener el contraste. No aparecen nombres sobre ruinas.

El audio es el `excavacion.mp3` provisto: su hash coincide con `voices/events/dig.mp3`. Se utiliza un golpe de 280 ms desde 0,140 s, alineado con la tercera pose del ciclo de extracción de 800 ms. Solo suena un trabajador visible por vez, priorizando la selección. Se corta al caminar, cargar recursos, salir de cámara, pausar o cancelar. Se descartan golpes que terminan de cargar tarde. `scripts/prepare-land-dig.mjs` reproduce el análisis del fragmento; se ejecuta desde la raíz después de preparar los audios de eventos.

Los costos y la barra de recursos usan miniaturas del mismo atlas que dibuja los minerales azules, dorados, verdes y las piedras del escenario. El alimento utiliza los frutos de la cosecha. Se incluyen costos de entrenamiento, construcción y mejoras, con texto accesible y cantidades. No se generaron dibujos alternativos para los recursos.

El centro de mando abre un tablero de ocho cuadros: azules, dorados, verdes, piedras, comida, soldados, otros trabajadores y total de personajes. Todos muestran su cantidad en la primera vista, incluidos los ceros. Los recursos cuentan las asignaciones, incluidos quienes transportan la carga. Los rivales y las bajas quedan excluidos. «Otros» reúne trabajadores en espera, construcción, marcha u otras tareas.

Al pulsar un recurso se muestra el desglose de personajes y tareas. El escudo de soldados presenta tipos, cantidades y nivel real de evolución. «Todos» conserva el listado completo por actividad. El detalle se pagina y permite volver al resumen; Aldea también vuelve al tablero. La imagen de la base y los totales permanecen en el recuadro derecho. La agrupación del tablero recorre las unidades una sola vez para admitir poblaciones grandes.

Validación: conteos y estados, niveles de soldados, impacto por fase y cancelación de sonido, imágenes cargadas, etiquetas de construcción, costos accesibles, navegación entre resumen y detalle, ausencia de superposición entre nombres y cantidades, escritorio y móvil.

[Resumen](land23-resumen.png) · [Tipos y niveles de soldados](land23-soldados.png) · [Costos con miniaturas](land23-costos.png).
