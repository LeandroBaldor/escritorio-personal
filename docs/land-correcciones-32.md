# Correcciones 27: castillos, torres de energía y nombres legibles

Solo cambia Land of Warriors. Los veinte PNG del usuario se incorporan sin modificar, con su transparencia y asignación por civilización, en `assets/land/fortresses/`. Los castillos y las torres avanzadas se agregan a las construcciones disponibles; las bases iniciales y las defensas básicas conservan sus funciones.

## Economía y desbloqueo

| Construcción | Azules | Dorados | Verdes | Piedra | Obra inicial |
|---|---:|---:|---:|---:|---:|
| Castillo | 2.000 | 1.200 | 3.000 | 1.200 | 120 s |
| Torre de energía | 600 | 400 | 1.000 | 400 | 60 s |

Se ajustaron los importes propuestos por el usuario a la escala actual de recolección: una veta verde inicial contiene 800, las vetas exteriores 1.200 y los trabajadores transportan 14 por viaje. Una construcción de 50.000 verdes exigiría agotar numerosas vetas y demoraría mucho más que diez minutos.

Ambas construcciones requieren una base terminada y **no se pueden empezar antes de 10:00**, aunque sobren recursos. El menú informa la cuenta regresiva. Desde ese momento se necesita además reunir el costo completo y asignar trabajadores. El desbloqueo habilita iniciar la obra, no regala los materiales ni termina la construcción. Producción acelera las obras y Fortificación aumenta su resistencia, como en el resto de la aldea.

El castillo tiene 18.000 PV, 120 de daño, 520 de alcance y aporta 60 de población. La torre avanzada tiene 6.000 PV, 55 de daño y 400 de alcance. Ambas disparan ráfagas automáticas del color de la civilización; una obra incompleta no dispara. La IA puede construirlas después de lanzar su primera ofensiva, respetando costos y desbloqueo.

## Menú

Los nombres de los cuarteles y otras construcciones se muestran en botones más grandes, con cinco construcciones y un botón de navegación por página. Se conservan las dimensiones exteriores del HUD. Costos y requisitos completos se consultan al señalar o enfocar cada botón. La ficha de castillos y torres ocupa el área central y muestra diseño, vida, resistencia, daño, alcance, población y estado de la obra.

## Verificación

Pruebas de bloqueo antes de 600 segundos, pagos completos, recursos insuficientes y ataques de las diez civilizaciones. Navegador en escritorio y móvil para navegación, nombres sin cortes, costo visible, construcción real y galería de los veinte originales. Capturas: `land32-fortificaciones.png`, `land32-menu.png` y `land32-castillo.png`.
