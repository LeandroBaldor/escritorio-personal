# Sexta corrección — caminata de perfil y ocultación de brazos completos

Referencia del usuario: Tutorial de Caminata del Caballero y vampiros.png y caminata.mp4. Se revisó una secuencia continua del video, además de los dos contactos alternados del infograma.

Problema corregido: el brazo derecho se dibujaba siempre delante de la coraza. El izquierdo cambiaba únicamente la capa del antebrazo. Aunque la mano se moviera en oposición a la pierna, la hombrera y el bíceps no cambiaban de profundidad. La separación frontal de hombros agravaba la lectura lateral del paso.

Se corrigió también la cadencia a velocidad máxima: en vez de acelerar la caminata hasta más de siete pasos por segundo, se introduce una fase aérea de carrera manteniendo la velocidad del personaje y de los pies apoyados. La caminata lenta conserva apoyo doble y las ocho fases de referencia.

Cambios:
- Orden de dibujo común: brazos completos que retroceden, torso, brazos completos que avanzan. Incluye hombreras, bíceps, antebrazos, manos y objetos sostenidos.
- La pierna derecha adelantada coloca el brazo derecho detrás del torso y el izquierdo delante. En el contacto opuesto se invierte. El personaje completo se refleja al caminar a la izquierda.
- Hombros más próximos en la postura de perfil, amplitud de balanceo más legible y sombra del brazo según su profundidad actual.
- Vista lateral de la coraza mediante encuadre de la pieza existente, evitando mostrar una abertura frontal de la armadura sin brazo. No cambia el diseño de ataque.
- Siguiendo el nuevo infograma para todos los personajes, Demian baja la espada al caminar y alterna AMBOS brazos. En reposo vuelve a llevarla sobre el hombro.
- Aplica a Demian y a las siete clases terrestres de vampiros. Los enemigos voladores conservan su vuelo.

Validación: 87 pruebas unitarias por repositorio. Pruebas de navegador en escritorio y móvil para controles, armas, ataques, niveles y caminata. La nueva prueba registra las llamadas reales de dibujo y comprueba brazo superior + antebrazo ANTES del torso, y el otro brazo completo DESPUÉS, para los siete enemigos, ambos contactos y ambos sentidos. También controla que el dibujo no deje transformaciones del lienzo sin restaurar.

Vista previa con 32 fases, pausa, avance manual y velocidad reducida: [ocho personajes en ambos sentidos](vampyium2-round6-preview.html).

La publicación automática de ambos repositorios está autorizada por el usuario al finalizar las verificaciones.


