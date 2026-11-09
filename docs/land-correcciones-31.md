# Correcciones 26: ambiente, entrenamiento y cola

Cambios limitados a Land of Warriors.

- Los diez MP3 aportados se copian sin modificar a `assets/land/ambience/map-0.mp3` hasta `map-9.mp3`, en el orden de los escenarios de `landMap.ts`: La Grieta Corrupta, Archipiélago Esmeralda, Tierras de Ceniza, Valle de Yldran, Frontera de Acero, Desierto de Ámbar, Glaciar Eterno, Pantano Sombrío, Bosque de Otoño y Arrecife Abisal.
- Cada ambiente se repite en bucle al 22% de volumen. Se pausa al pausar la partida u ocultar la pestaña; se descarta al salir o cambiar de mapa. Es independiente del mute de música.
- Entrenar cualquiera de los seis personajes de cada civilización cuesta exactamente tres veces su precio anterior, después del redondeo original. Ejemplo: Recluta, 50 → 150 cristales azules. La cancelación devuelve el importe completo. Las mejoras y construcciones conservan sus costos.
- Los tres cuadrados visibles de la cola se colocan pegados desde la izquierda, conservando su barra celeste, tiempo, orden y paginación.
- La IA puede completar su unidad pesada aunque haya llenado antes el grupo con tropas ligeras. Evita bloquear la ofensiva al encarecer el entrenamiento; respeta los mismos precios y requisitos.

Validación: pruebas de los 60 precios, devolución de recursos, ciclo de ambiente de los diez mapas, desarrollo de la IA y navegador en escritorio y móvil.
