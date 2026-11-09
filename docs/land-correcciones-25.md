# Land of Warriors — pedido 23: voces, producción y escenarios

- Todas las confirmaciones élficas usan `voz_elfos.mp3`: 16 fragmentos de 0,7–1,6 s, cortes en zonas de menor energía y fundidos. Reverberación estéreo suave de 0,55 s, mezcla húmeda del 16%. Se comparte la descarga entre personajes.
- La música de partida mantiene su volumen constante (22%). Las voces bajan de 72% a 45%, con bus al 80%. Se conservan límites de simultaneidad, sonidos según cámara y comunicador de los humanos.
- Se elimina el letrero verde del Almacén. Mantiene la construcción propia de su civilización. Los nombres de todos los edificios usan 11 px de mundo en vez de 8, con rectángulo negro y color de facción, separados del diseño y las barras.
- Cada clic de entrenamiento agrega un encargo, limitado por recursos y población disponible; se elimina el tope de cinco encargos. Se paga y reserva población al agregarlo. Salen de a uno, con un minuto base por personaje. Las mejoras de Producción previamente existentes conservan sus tiempos 60/48/39/30 s. Cancelar devuelve el último encargo sin reiniciar el actual.
- La ficha muestra cantidad en fila, tiempo del próximo y progreso; en cuarteles también los primeros puestos. El botón muestra el total acumulado. El centro de mando mantiene su resumen de recursos visible.
- El Canal del Líder usa terminal negra, texto verde monoespaciado, escritura progresiva y `lider_radio.mp3` mientras escribe. El retrato pasa de 65 a 108 px en escritorio y 96 px en móvil. Los mensajes previos permanecen completos; el chat desplaza el contenido sin cortar el retrato.
- Se revisan los diez paisajes contra sus imágenes de selección: suelo fracturado y burbujas ácidas; costa tropical; basalto, costras de lava y calor; valle verde; arenisca del cañón; estrías de dunas y cactus con nervaduras; ventisqueros, hielo y coníferas frías; barro húmedo y vegetación apagada; hojarasca y copa otoñal dorada; arena submarina, coral y caústicas. Agua, rocas y vegetación reciben paletas por bioma. Puentes con vetas, juntas, pernos y nieve o musgo según el mapa.
- Los detalles del suelo se calculan con coordenadas y semilla, compartidos entre vista general y primer plano. Los objetos coloreados se almacenan en una caché limitada a 40 recortes; el agua animada solo se dibuja en la zona visible. No se cambian colisiones ni caminos al agregar detalles visuales.

## Comprobación

Pruebas de cola de nueve encargos, reserva y devolución de recursos/población, salida secuencial por minuto, fragmentos élficos y radio durante escritura. Pruebas de navegador de escritorio y móvil: ocho clics, creación de una unidad y continuidad de la fila, música estable durante voces, reverberación real, tamaño del retrato y contraste del chat. Se revisan nombres de edificios, resumen, cuarteles, excavación, mute y una galería de los diez biomas junto a las referencias.

Capturas: `land25-lider-cola.png` y `land25-biomas.png`.
