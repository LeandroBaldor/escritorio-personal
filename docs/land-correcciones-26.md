# Cuarteles: ficha separada y cola con casillas

La ficha de un cuartel terminado se divide en dos ventanas del HUD. A la izquierda se muestran una ilustración mayor de la construcción, su vida, el nombre de la unidad producida, la cantidad disponible, su nivel y porcentaje de evolución. Los atributos muestran resistencia (vida de cada personaje), poder (daño a unidades), fuerza (daño a construcciones) y velocidad. «Ver mejoras» permite consultar las cuatro evoluciones sin mezclar esas miniaturas con la cola de entrenamiento.

A la derecha, cada encargo tiene su propio cuadrado con imagen, número de puesto, tiempo hasta su salida y barra celeste. La primera barra avanza durante el entrenamiento; las siguientes permanecen vacías hasta que les toca. El tiempo de cada casilla incluye los turnos anteriores: con entrenamiento base de un minuto, si al primero le faltan 48 s, al segundo le faltan 1:48. Se mantienen las mejoras de Producción existentes que aceleran el entrenamiento.

Se muestran seis casillas por página, con navegación para recorrer toda la cola. Al salir un personaje, se actualizan los puestos y la cantidad disponible. El centro de mando conserva su resumen compacto.

El HUD gana altura solamente al seleccionar un cuartel, y el marco omite el antiguo recuadro de retrato que cruzaba la cola. El componente está aislado de las reglas anteriores de las fichas de soldados. Se aplica a todos los tipos de cuartel y civilizaciones, incluidas las larvas obreras.

Validación: ficha de Larva Obrera con ocho personajes y nueve encargos; barras de 60 s, paginación, salida de una unidad y reinicio de la siguiente barra; separación y casillas cuadradas en escritorio, móvil, 1102 px y 1920 px. Se comprueban también los seis cuarteles humanos y las cuatro evoluciones. Captura: `land26-cuartel-larva.png`.
