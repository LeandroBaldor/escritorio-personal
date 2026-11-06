# Land of Warriors — correcciones 8

Implementación compartida en escritorio-personal y MiniJuegos.

1. Muertes: estallido de sangre verde para humanos y elfos; color de su civilización para las demás especies. Robots, tanques y exotrajes mecánicos explotan con fuego, chispas y humo. Los efectos desaparecen y se limpian del estado del juego.
2. Construcción: el solar permanece vacío, con perímetro y barra porcentual. El edificio aparece completo al llegar al 100%.
3. Botones: se usa un golpe sintetizado sin la voz «Let's go» del sonido anterior.
4. Infograma: ocupa todo el ancho disponible; se desplaza verticalmente para poder leerlo completo. Los controles permanecen visibles al pie.
5. La opción de abrir la información de unidades se llama «Resumen»; «Infograma» permite regresar a la imagen.
6. El resumen de cada unidad explica si ataca cuerpo a cuerpo o a distancia, su tipo de proyectil, alcance y función de curación cuando corresponde. Se calcula con los valores reales de la civilización.
7. Música del menú: las dos grabaciones proporcionadas se reproducen en orden 1, 1, 2, 2, repetido indefinidamente. Cambiar entre pantallas del menú conserva la pista; iniciar una partida o salir del juego detiene la música. El navegador puede requerir el primer clic para habilitar audio.
8. Muros: seis construcciones por civilización. Cada tramo de muro cuesta 35 minerales, tarda 8 segundos con un trabajador y tiene 1400 de vida. Se alinean a una cuadrícula para unirlos. Los clics consecutivos añaden tramos a la cola del constructor; Escape termina la colocación. Bloquean tropas terrestres de ambos bandos; dejá una abertura de entrada. Las unidades voladoras pasan por encima y los ataques a distancia pueden disparar sobre ellos. Un muro destruido vuelve a abrir el camino. Los atacantes cuerpo a cuerpo golpean la muralla que protege al objetivo.

Los diez diseños de muros tienen materiales propios de cada civilización: acero humano azul, quitina zergana, raíces élficas, piedra rúnica enana, piedra espectral, huesos saurianos, obsidiana infernal, blindaje mecánico, empalizada orca y coral abisal.

## Arte y preparación

`src/features/games/assets/land/walls.webp` es un atlas de 2 columnas y 5 filas, generado con la herramienta integrada ImageGen. Prompt: «Diez tramos de muro RTS prerenderizados, perspectiva elevada en tres cuartos, iluminación superior izquierda, materiales realistas y fondo transparente; en orden humano, zergano, elfo, enano, no muerto, sauriano, infernal, mecánico, orco y abisal; sin texto ni fondo».

Se prepara con `node scripts/prepare-land-walls.mjs <atlas.png>`. El renderizador recorta cada celda por su transparencia. Los dos MP3 provienen de los archivos indicados por el usuario y se conservan completos.
