# Revisión 11: canal del líder y sonidos de combate

- El recuadro inferior izquierdo muestra el retrato del líder de la civilización elegida, el total de combatientes y un historial de hasta 20 avisos. Conserva el resumen de trabajos de las tropas. En móvil se accede desde «Tropas y líder».
- Los antiguos carteles del centro pasan al historial del líder, con hora de partida. Detecta tropas hostiles cercanas y las nombra por unidad y civilización. Avisa reservas bajas y especifica lo que falta al intentar colocar una estructura. El balance de cada enfrentamiento cuenta bajas propias y enemigos eliminados por el jugador; excluye batallas entre computadoras.
- Los siete sonidos `disparo_*` se comparten según arma: ácido para zerganos; armas, ametralladora y cañón humanos; arco o fuego élfico; arma o cañón enano; láser mecánico y espectral; lanzas saurianas; fuego infernal; lanzas/fuego orcos y ácido/láser abisales. Los ataques cuerpo a cuerpo no disparan.
- Cada golpe real a una construcción activa `golpe_construccion.mp3` en el edificio afectado. Cada muerte visible activa `muere_personaje.mp3`. Las ráfagas se recortan a un ataque, con fundidos y límites de simultaneidad. Las muertes tienen un canal separado para que las armas no las silencien. Pausar u ocultar la pestaña detiene la mezcla.
- Humanos, elfos y enanos orgánicos dejan sangre roja. Bichos usan tonos de su diseño: quitina violeta, saurianos verdes, orcos oliva y abisales turquesa. Robots, tanques y exotrajes conservan explosión de fuego. La salpicadura tiene 54 gotas y desaparece tras 2,4 segundos.

Los nueve originales se conservan sin modificación en `assets/land/voices/combat/`. Los metadatos registran SHA-256, origen y fragmentos. Preparación:

```sh
node scripts/prepare-land-combat.mjs /ruta/a/SONIDOS
```

Verificación: pruebas de amenazas, recursos, bajas propias frente a combates ajenos, selección de armas, impactos/muertes reales del motor y cancelación al pausar. Prueba de navegador del canal del líder y reproducción de muerte en escritorio y móvil.
