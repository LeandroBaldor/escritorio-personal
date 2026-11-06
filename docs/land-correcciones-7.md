# Land of Warriors — correcciones 7

La misma implementación se comparte entre escritorio-personal y MiniJuegos mediante `scripts/sync-land.mjs`.

- Cámara: permite alejarse un 10% adicional, conservando el encuadre inicial y el acercamiento anterior.
- Caminata: articulación procedural de piernas, brazos y torso; movimiento específico para criaturas y máquinas.
- Interfaz: composición de la referencia con paneles laterales, recursos superiores, minimapa, selección, retrato y comandos. Marcos vectoriales dorados, fondo azul y luces cian. Es una recreación funcional; las ilustraciones originales de la referencia no son los retratos del juego.
- Cristales: nuevos diseños azules, dorados y verdes, con facetas, brillo y reflejos.
- Naturaleza: árboles, rocas, ruinas y vegetación con nuevas imágenes; materiales de agua y pantano con ondas y reflejos animados.
- Energía verde: se recolecta y deposita como los demás recursos. Las investigaciones requieren 16 de energía por nivel base y las unidades élite agregan 40 de energía a su costo.
- Disparos: ráfagas visuales de tres trazadoras con el color de la civilización; conservan el daño de un ataque.
- Civilizaciones: cantidad total de 2 a 10, seguida de un selector por rival, apilados. Cada rival tiene economía, ejército e IA independientes. Victoria al destruir todos los centros enemigos.
- Escenarios: diez fotografías de paisaje generadas para cada ambiente, en lugar de vistas cenitales.
- IA: primero desarrolla trabajadores, depósitos, cuartel, taller y defensa. La primera ofensiva requiere infraestructura y ejército preparados, además de al menos 11/10/9/8 minutos según dificultad muy fácil/fácil/normal/difícil. Puede defender su base antes sin perseguir lejos a los enemigos.
- Tipografía: Orbitron en toda la interfaz del juego.

La animación actual conserva Canvas y no requiere una biblioteca adicional. Para una futura animación con hojas de fotogramas existe [Phaser](https://www.phaser.io/oss/docs/phaser/concepts/animations); para esqueletos 2D y herramientas de autor, [Spine con Pixi](https://en.esotericsoftware.com/spine-pixi). Spine no está instalado en esta revisión.

Las imágenes nuevas se preparan con `scripts/prepare-land-world.mjs`. Las capturas de revisión están en `land7-menu.png` y `land7-paisajes.png`.
