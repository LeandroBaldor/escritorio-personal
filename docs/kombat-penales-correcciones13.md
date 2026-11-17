# Kombat Penales: correcciones 13

La misma corrección se aplica a Escritorio Personal y MiniJuegos.

1. Música del menú de Penales con ganancia **0,225**, un 50% más que la anterior (0,15). Al entrar en otros juegos se conserva su volumen normal.
2. La muerte violeta reproduce `electricidad.mp3` mientras el personaje se achica. Sus huesos salen al 24% del tamaño normal y con sangre.
3. El congelamiento reproduce `congelamiento.mp3`. El material helado usa el alfa del cuerpo real, sin el polígono rectangular anterior ni el halo del luchador. Avanza desde los pies, respeta casco, brazos, dedos y alas, y se rompe en bloques grandes con vetas de sangre y salpicaduras.
4. Todas las explosiones —original, fuego, violeta, hielo y cabeza— mezclan los archivos `explosion_jugador.mp3` y `explosion_sangre.mp3`. Ácido y cenizas conservan sus finales sin estallido.
5. El sonido de cenizas sigue el reloj de la animación, incluido el polvo final. El reproductor usa bucle y no termina por su cuenta antes de que acabe la secuencia. Al pausar se detiene; al reanudar continúa desde la posición de la animación. Al terminar, salir o cambiar de efecto se desvanece y libera la fuente de audio.
6. La desintegración avanza desde **los pies hacia la cabeza**. Tanto la máscara del cuerpo como el nacimiento de las partículas siguen ese orden; el viento continúa hacia la derecha de cámara.
7. Todas las secuencias duran aproximadamente **5,2 segundos desde que empieza la muerte**, contando transformación, estallido si corresponde y restos finales. El resultado del penal y la ejecución del perdedor esperan el final de la secuencia.

Los cuatro MP3 proporcionados se copian sin recodificar. La vista `docs/kombat-penales-muertes-preview.html` permite escuchar individualmente las variantes, cambiar entre pateador, arquero y perdedor de la tanda, pausar y reducir la velocidad.

## Verificación

```powershell
npm run lint
npm test -- --run
npm run build
npx playwright test --config playwright.penales.config.ts
```

Las pruebas de lógica comprueban los cinco segundos de las siete variantes, los huesos pequeños y la sangre de la violeta, la sangre del hielo y el avance ascendente de las cenizas. Las pruebas de audio comprueban la mezcla de ambos archivos, la selección de electricidad/congelamiento, la continuidad y reanudación del sonido y el aumento exacto del volumen. La revisión en navegador recorre los 16 luchadores, los dos roles y las ejecuciones finales, en escritorio y móvil, y decodifica los seis sonidos incorporados en las correcciones 12 y 13.
