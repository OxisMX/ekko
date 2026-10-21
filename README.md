# Ekko Rewards

Monorepo de Ekko Rewards (Oxis): app móvil (Expo), panel del comercio (React + Vite) y backend en Supabase. La documentación de producto y técnica vive en [`docs/`](docs/).

| Carpeta | Contenido |
|---|---|
| `apps/mobile` | App del cliente (Expo SDK 58, Expo Router) |
| `apps/panel` | Panel web del comercio (Cloudflare Pages) |
| `packages/shared` | Reglas, errores E-xx, tokens de diseño y tipos generados de la base de datos |
| `supabase` | Migraciones, pruebas pgTAP y `seed.sql` (solo local) |

## Requisitos

Node 22, pnpm 12 y Docker (para Supabase local).

## Arranque local

```sh
pnpm install
pnpm db:start           # Supabase local; muestra la URL y la anon key
pnpm db:reset           # aplica migraciones + seed.sql
```

Variables de entorno (archivos `.env` ignorados por git; solo valores públicos, nunca la `service_role`):

| Variable | Dónde | Uso |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | URL de Supabase (local: `http://127.0.0.1:54321`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | `apps/mobile/.env` | Opcional; Sentry se activa solo si existe |
| `VITE_SUPABASE_URL` | `apps/panel/.env.local` | URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | `apps/panel/.env.local` | Anon key |
| `VITE_SENTRY_DSN` | `apps/panel/.env.local` | Opcional |

```sh
pnpm --filter @ekko/panel dev                  # panel en http://localhost:5173
cd apps/mobile && pnpm start --localhost       # app; en emulador Android: adb reverse tcp:8081 tcp:8081 y tcp:54321 tcp:54321
```

Cuentas de prueba locales (`seed.sql`, contraseña `ekko-local-123`, PIN `1234`): comercios `c1@ekko.test` (activo), `c2@ekko.test`, `c3@ekko.test` (inactivo); clientes `u1@ekko.test` … `u4@ekko.test`. El detalle de cada estado está en la cabecera de `supabase/seed.sql`.

## Verificación

```sh
pnpm lint && pnpm typecheck && pnpm test
pnpm db:test                                   # pgTAP (RPC, RLS, triggers)
pnpm db:types                                  # regenera packages/shared/src/database.types.ts tras cambiar el esquema
E2E_SUPABASE_ANON_KEY=<anon key> pnpm --filter @ekko/panel test:e2e   # Playwright; sin la variable se omiten las pruebas contra Supabase
```

Las migraciones se crean con `pnpm supabase migration new <nombre>`; nunca se modifica el esquema desde Supabase Studio en staging o producción.
