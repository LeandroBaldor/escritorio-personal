# Kombat Penales: correcciones 10

Las muertes se eligen al azar entre siete variantes, para quien patea cuando le atajan y para el arquero que se tira al otro lado. Se evita repetir la variante anterior. El resultado del penal y las reglas de la tanda se mantienen.

1. Explosión original, con sus sonidos, sangre y huesos.
2. Fuego: el luchador se vuelve esqueleto, arde y explota. Reutiliza `drawSkeletonK`, `bodyFire`, el sonido de fuego y los sonidos de explosión y huesos de Vampyrium.
3. Violeta: se tiñe de violeta, se achica y explota con chispas violetas y huesos. Usa el teñido y los sonidos de Vampyrium.
4. Ácido: el cuerpo se tiñe de verde, se aplasta y se ensancha hasta quedar en un charco con burbujas que se seca. Usa la curva y los tiempos de Vampyrium y el sonido de ácido de Vampyrium 2.
5. Hielo: se congela, se raja y estalla en fragmentos de hielo, con los sonidos de congelación, explosión y huesos de Vampyrium.
6. Cabeza gigante: crece hasta 3,4 veces su tamaño y estalla con sangre y huesos. El diámetro del cráneo conserva el diámetro máximo de la cabeza, ajustado al tamaño del luchador.
7. Cenizas: el cuerpo se vuelve gris y se desintegra de arriba hacia abajo; las partículas viajan hacia la derecha de la cámara. No produce sangre ni una explosión final.

Cada secuencia termina antes de avanzar al siguiente penal o anunciar al ganador. Los restos se limpian entre tiros. Los cuerpos conservan la pose que tenían al empezar a morir, incluyendo el arquero acostado.

## Revisión

La vista `docs/kombat-penales-muertes-preview.html` permite repetir las siete variantes, cambiar entre arquero y pateador, seleccionar cualquiera de los 16 luchadores, pausar y reducir la velocidad. Se abre a través del servidor de Vite, no directamente como archivo.

```powershell
npm run dev -- --host 127.0.0.1 --port 5181
```

En Escritorio Personal: `http://127.0.0.1:5181/escritorio-personal/docs/kombat-penales-muertes-preview.html`.
En MiniJuegos: `http://127.0.0.1:5181/MiniJuegos/docs/kombat-penales-muertes-preview.html`.

## Validación

```powershell
npm run test -- --run src/features/games/kombatPenalties.test.ts src/features/games/kombatPenDeaths.test.ts src/features/games/vampyrium.test.ts src/features/games/kombat.test.ts
npm run build
npx playwright test --config playwright.penales.config.ts
```

Las pruebas de lógica cubren las siete variantes en ambos roles, la duración de las secuencias, las cenizas hacia la derecha, el tamaño del cráneo, la ausencia de sangre en hielo/ácido/cenizas, la limpieza de restos, la alternancia y el último penal de una tanda. La prueba de navegador recorre ambos roles y los 16 luchadores en escritorio y móvil.

La implementación se preparó en `.worktrees/kombat-penales`, sobre la rama `codex/kombat-penales-muertes`, en cada repositorio. Las carpetas principales conservan sus cambios pendientes de Vampyrium. La publicación se realiza mediante el workflow `Deploy GitHub Pages` al actualizar `main` en cada repositorio.
