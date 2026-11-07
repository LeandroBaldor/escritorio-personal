# Land of Warriors — revisión 10

Cada personaje de las diez civilizaciones tiene un cuartel exclusivo llamado `Cuartel [nombre del personaje]`. Cada cuartel puede entrenar varias unidades de su único tipo; nunca mezcla personajes.

En el Imperio Humano:

| Cuartel | Único personaje producido | Requisito |
| --- | --- | --- |
| Cuartel Ingeniero | Ingeniero | Ninguno |
| Cuartel Recluta | Recluta | Ninguno |
| Cuartel Fusilero Pesado | Fusilero Pesado | Cuartel Recluta |
| Cuartel Médico | Médico | Cuartel Fusilero Pesado |
| Cuartel Tanque Bastión | Tanque Bastión | Cuartel Recluta |
| Cuartel Exoélite | Exoélite | Cuartel Tanque Bastión |

La misma regla usa los nombres de cada civilización. Hay seis cuarteles y cuatro edificios de apoyo: centro de mando, torre, depósito y muro. El centro de mando recibe recursos, proporciona población e investiga mejoras; ya no produce personajes. La partida conserva los cuatro trabajadores iniciales, que pueden construir su cuartel para entrenar más.

La IA construye los seis cuarteles y entrena únicamente al personaje correspondiente en cada uno. Conserva sus condiciones de desarrollo y preparación antes de atacar. La infografía, el resumen, los botones, los requisitos y las vistas ampliadas usan los nuevos nombres. Los cuarteles reutilizan el arte de construcción de su civilización e incorporan un distintivo del personaje producido, también en el escenario.

Las pruebas recorren las diez civilizaciones, verifican las sesenta relaciones cuartel/personaje y rechazan la producción de cualquier otro personaje sin consumir recursos. Las pruebas de navegador verifican los seis menús de producción y dos unidades iguales en cada cola.

Capturas: `land10-cuarteles.png` y `land10-produccion.png`.
