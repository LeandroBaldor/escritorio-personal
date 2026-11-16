# Kombat Penales: correcciones 12

Los mismos cambios se aplican en Escritorio Personal y MiniJuegos.

1. **Árbitro:** ahora castiga todos los goles no atajados, incluyendo los tiros al mismo lado pero a distinta altura. La condición anterior descartaba esos casos. El proyectil mantiene su destino al iniciarse la muerte del arquero.
2. **Ácido:** primero el personaje se vuelve verde progresivamente, luego colapsa en vertical hacia sus pies sin ensancharse. Deja un charco de ácido verde de más de dos veces la altura del cuerpo en ancho, con burbujas volumétricas, ondas y vapor. El charco sigue visible después de desaparecer el cuerpo hasta la transición al siguiente penal.
3. **Fuego:** el esqueleto usa las articulaciones reales de la pose del luchador, su orientación y su rotación. Incluye cráneo, mandíbula, costillas, columna, pelvis y extremidades de perfil; no reemplaza al personaje por un esqueleto frontal genérico.
4. **Hielo:** la congelación avanza desde los pies hasta cubrir la cabeza. Después de quedar completamente congelado y agrietarse, estalla en bloques grandes con caras y reflejos, junto con fragmentos menores.
5. **Cabeza:** al crecer se dibuja delante de los brazos y las manos. El cráneo de la explosión conserva el tamaño máximo y usa un nuevo dibujo anatómico de perfil, con órbita, arco cigomático, apertura nasal, mandíbula, suturas y dientes individuales. Se reproduce el archivo original `cabeza.mp3`, completo y sin modificar su velocidad, durante los 5,184 segundos del crecimiento.
6. **Cenizas:** se reproduce el archivo original `cenizas.mp3`, completo y sin modificar su velocidad. La desintegración dura los mismos 7,008 segundos; las cenizas siguen viajando a la derecha de cámara.
7. **Perdedor de la tanda:** después del penal decisivo hay una ejecución final. El ganador festeja y el árbitro dispara al perdedor, que muere con una de las siete variantes aleatorias. El resultado, el récord y la siguiente ronda esperan a que termine esa muerte.

Los MP3 se incorporan como `src/features/games/assets/sonidos/pen-cabeza.mp3` y `pen-cenizas.mp3`. Se precargan al iniciar el juego y conservan exactamente los bytes de los archivos proporcionados.

## Revisión

La vista `docs/kombat-penales-muertes-preview.html` permite elegir pateador, arquero o perdedor de la tanda; cualquiera de los 16 luchadores; pausa y cámara lenta. El selector de sonido permite escuchar la muerte de cabeza o de cenizas sin reproducir las siete tarjetas simultáneamente.

Las capturas `kombat-round12-*.png` muestran el ácido, el esqueleto de perfil, el hielo parcial y sus bloques, la cabeza, el cráneo y las cenizas en los tres roles.

## Verificación

```powershell
npm run lint
npm test -- --run
npm run build
npx playwright test --config playwright.penales.config.ts
```

Se prueban las 36 combinaciones de tiro y arquero, las siete muertes en ambos roles, la ejecución con cualquiera de los dos ganadores y con gol o atajada como penal decisivo, el orden de los eventos finales, la congelación progresiva, el tamaño de los bloques y el derretimiento vertical. En navegador se recorren los 16 luchadores en escritorio y móvil, se completan las siete ejecuciones finales y se descargan y decodifican los dos MP3.
