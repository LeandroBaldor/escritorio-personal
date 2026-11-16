# Kombat Penales: correcciones 11

La misma actualización se aplica a Escritorio Personal y MiniJuegos.

- Cráneo anatómico basado en Vampyrium: bóveda, pómulos, órbitas profundas, maxilar, mandíbula, dientes y suturas. Sin ojos luminosos ni los círculos planos de la versión anterior. La variante humana usa trazos más finos y conserva el diámetro máximo de la cabeza.
- Costillas con esternón, huesos largos con articulaciones y sombreado, pelvis perforada y fragmentos orgánicos con fibras. Se reutilizan las piezas anatómicas de Vampyrium; las apariencias existentes de los vampiros se conservan.
- Sangre más oscura, de distintos tamaños, con volumen, estelas según la velocidad y charcos de borde irregular. Las manchas en la cámara son salpicaduras semitransparentes y chorreados, en lugar de grandes gotas redondas.
- Muertes más exageradas: 260 gotas por estallido, más restos, 70 fragmentos de hielo, cabeza que crece hasta 4,2 veces, brasas, cintas de fuego, humo, vapor y ondas expansivas. Se amplió la anticipación y el tiempo de lectura de las animaciones.
- Ácido vertical: el personaje pierde altura hacia sus pies y se estrecha ligeramente, sin ensancharse. Los chorros caen hacia abajo y alimentan un charco oscuro con burbujas y vapor. El arquero pasa de su pose de caída al colapso vertical.
- Cenizas más densas, con fragmentos irregulares y humo arrastrado hacia la derecha de cámara.

Las siete variantes siguen siendo aleatorias y no se repiten consecutivamente. Los sonidos, los resultados de los penales y las reglas de la tanda se mantienen. El siguiente tiro espera a que termine la secuencia y limpia los efectos.

La vista `docs/kombat-penales-muertes-preview.html` permite seleccionar arquero o pateador, cualquiera de los 16 luchadores, pausar y reducir la velocidad. Las capturas `kombat-round11-*.png` muestran los cuadros de revisión de ambos roles.

## Verificación

```powershell
npm run lint
npm test -- --run
npm run build
npx playwright test --config playwright.penales.config.ts
```

Las pruebas cubren las siete variantes en ambos roles, la limpieza de restos, la secuencia completa antes de anunciar al ganador, el cráneo del tamaño máximo de la cabeza, el derretimiento sin expansión horizontal y la disipación de humo y ondas después de la explosión. La revisión de navegador recorre todos los luchadores en escritorio y móvil.
