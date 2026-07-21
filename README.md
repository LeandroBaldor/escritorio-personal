# Escritorio Personal

Una aplicación web para centralizar notas, diario personal y gastos en un escritorio cálido. Supabase aporta cuentas y sincronización privada entre dispositivos; GitHub Pages publica el frontend.

## Desarrollo

Requiere Node.js 22.

```bash
npm install
cp .env.example .env.local
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

## Configuración de Supabase

1. Ejecutá `supabase/schema.sql` en el SQL Editor del proyecto.
2. Configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local` y como secrets de GitHub Actions.
3. Habilitá Email signup y confirmación de correo; agregá la URL de GitHub Pages a Redirect URLs.

Nunca uses una clave `sb_secret` o `service_role` en esta aplicación.

## Datos y privacidad

Cada fila pertenece al usuario autenticado y las políticas RLS limitan lectura/escritura a `auth.uid()`. El navegador conserva una caché separada por usuario para recuperación offline; cerrar sesión no borra automáticamente esa copia. **Exportar** descarga una copia completa y **Importar** exige confirmación.

No publiques copias de seguridad: pueden contener información personal.

## GitHub Pages

El workflow valida la configuración y despliega `main` bajo `/escritorio-personal/`. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como fuente. Si el repositorio usa otro nombre, modifica `base` en `vite.config.ts`.
