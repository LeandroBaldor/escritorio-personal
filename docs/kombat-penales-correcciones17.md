# Kombat Penales · corrección 17

- Música de menú: volumen de 0,225 a 0,3375, un 50 % adicional sobre la versión anterior. Se mantiene el archivo musical existente.
- Árbitro: altura de 2,25 a 3,375 veces FPX, un 50 % más grande con los pies en la misma posición.
- Diseño: se usan sin modificar las dos imágenes originales `arbitroNuevo_1.png` y `arbitroNuevo_2.png`, de 1199 × 1312, como `arbitro-nuevo-1.png` y `arbitro-nuevo-2.png`.
- Animación: se conserva el giro del torso desde la cintura, los brazos y el arma, la orientación al blanco y los tiempos de apuntado y disparo. Se recalibraron el pivote y la boca del arma para el nuevo dibujo.
- Disparo: esfera verde fluorescente con radio de 64 frente a 24, halo de 240 frente a 110 y estela de 112 frente a 46. El recorrido y el momento de impacto se conservan.

Validación: compilaciones TypeScript/Vite en ambos repositorios, 49 pruebas enfocadas de lógica/audio y revisión del nuevo árbitro en escritorio y móvil. La prueba de navegador comprueba las imágenes transparentes originales, el aumento visible de plasma verde respecto al estado de reposo, ambos blancos y seis capturas por dispositivo. Las capturas `kombat-round17-*.png` muestran reposo y disparo hacia pateador y arquero.
