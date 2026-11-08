# Revisión 15: excavación y música de partida

- `excavacion.mp3` suena solo al extraer recursos, junto al nodo, con capacidad para cargar y sin caminar. Se mezcla una única excavación visible a volumen moderado. Se corta al cancelar la orden, salir de cámara, cargar recursos, pausar o abandonar la partida. Las voces y los avisos atenúan la excavación.
- `music_game.mp3` se reproduce en bucle durante la partida. El botón musical de la esquina superior derecha silencia únicamente esta música; voces y efectos siguen sonando. También hay control en Pausa. Mute y pausa conservan la posición; salir o iniciar una partida reinicia la pista.
- La música se pausa al ocultar la pestaña y vuelve al regresar si no estaba silenciada. Su volumen base es 0,22 y baja a 0,088 durante voces o avisos. El control mantiene mute al recuperar volumen.

Los originales se guardan en `assets/land/voices/events/dig.mp3` y `assets/land/music-game.mp3`. El preparador de eventos extrae un fragmento de excavación de hasta 900 ms con fundidos, sin modificar el original.

Verificación: pruebas unitarias del bucle, mute, pausa, posición, prioridad de voces y condiciones reales de excavación. Navegador en escritorio y móvil para música, mute con efectos activos, excavación, pausa y regreso al menú.
