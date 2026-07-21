# Escritorio Personal

Una aplicación web estática para centralizar notas, diario personal y gastos en un escritorio cálido. Los datos permanecen en el navegador del dispositivo y pueden trasladarse mediante copias JSON.

## Desarrollo

Requiere Node.js 22.

```bash
npm install
npm run dev
```

Verificación:

```bash
npm run lint
npm test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

## Datos y privacidad

No hay usuarios, backend ni sincronización. `localStorage` guarda automáticamente los cambios. **Exportar** descarga una copia completa; **Importar** valida el archivo, muestra un resumen y exige confirmación antes de reemplazar los datos.

No publiques copias de seguridad: pueden contener información personal.

## GitHub Pages

El workflow despliega `main` bajo `/escritorio-personal/`. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente. Si el repositorio usa otro nombre, modifica `base` en `vite.config.ts`.
