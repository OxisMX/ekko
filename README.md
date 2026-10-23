# Ekko Rewards

Monorepo de Ekko Rewards (Oxis): app móvil (Expo), panel del comercio (React + Vite) y backend en Supabase. La documentación de producto y técnica vive en [`docs/`](docs/). Rendimiento y respaldos: [`docs/ekko_rendimiento.md`](docs/ekko_rendimiento.md); runbooks de operación: [`docs/ekko_runbooks.md`](docs/ekko_runbooks.md).

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

Variables de entorno: copia `apps/mobile/.env.example` a `apps/mobile/.env` y `apps/panel/.env.example` a `apps/panel/.env.local`, y pon la anon key que muestra `pnpm supabase status` (ambos ignorados por git; solo valores públicos, nunca la `service_role`):

| Variable | Dónde | Uso |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `apps/mobile/.env` | URL de Supabase (local: `http://127.0.0.1:54321`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/mobile/.env` | Anon key |
| `EXPO_PUBLIC_SENTRY_DSN` | `apps/mobile/.env` | Opcional; Sentry se activa solo si existe |
| `VITE_SUPABASE_URL` | `apps/panel/.env.local` | URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | `apps/panel/.env.local` | Anon key |
| `VITE_SENTRY_DSN` | `apps/panel/.env.local` | Opcional |
| `VITE_PUBLIC_APP_URL` | `apps/panel/.env.local` | Origen del QR de visita, sin `/` final (local: `http://localhost:5173`; staging: `https://staging.ekko.oxis.mx`; producción: `https://ekko.oxis.mx`) |

```sh
pnpm --filter @ekko/panel dev                  # panel en http://localhost:5173
cd apps/mobile && pnpm start --localhost       # app; en emulador Android: adb reverse tcp:8081 tcp:8081 y tcp:54321 tcp:54321
```

En un teléfono físico (cualquier red, con Expo Go): `scripts/dev-tunnel.sh` abre túneles temporales de Cloudflare para la API local y Metro, y muestra el QR. Requiere `cloudflared`; usa `METRO_PORT=8082` si el Metro del emulador ocupa 8081. Mientras corre, la API local es pública en una URL aleatoria: ciérralo al terminar.

Cuentas de prueba locales (`seed.sql`, contraseña `ekko-local-123`, PIN `1234`): comercios `c1@ekko.test` (activo), `c2@ekko.test`, `c3@ekko.test` (inactivo); clientes `u1@ekko.test` … `u4@ekko.test`. El detalle de cada estado está en la cabecera de `supabase/seed.sql`.

## Verificación

```sh
pnpm lint && pnpm typecheck && pnpm test
pnpm db:test                                   # pgTAP (RPC, RLS, triggers)
pnpm db:types                                  # regenera packages/shared/src/database.types.ts tras cambiar el esquema
E2E_SUPABASE_ANON_KEY=<anon key> pnpm --filter @ekko/panel test:e2e   # Playwright; sin la variable se omiten las pruebas contra Supabase
```

Las migraciones se crean con `pnpm supabase migration new <nombre>`; nunca se modifica el esquema desde Supabase Studio en staging o producción.

## Alta de comercio

Script de operación de Oxis (US-27, F-30). Copia `scripts/examples/merchant.example.json`, llénalo con los datos del onboarding (`{merchant_id}` en `logo_path`/`cover_path` se sustituye por el id generado) y ejecuta:

```sh
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SUPABASE_DB_URL=… node scripts/onboard-merchant.ts ruta/al/comercio.json
```

Las tres variables se pasan solo en ese comando (local: `API_URL`, `SERVICE_ROLE_KEY` y `DB_URL` de `pnpm supabase status -o json`); nunca se guardan en el repositorio. El script crea el usuario de Auth con rol `merchant` y, en una sola transacción, el comercio, su tarjeta, el PIN (bcrypt) y los premios de la ruleta; si la transacción falla, borra el usuario. Rechaza el alta si el correo o el mismo nombre + dirección ya existen. El comercio queda con `is_visible = false` hasta terminar la capacitación (F-30, paso 6). El archivo JSON contiene la contraseña y el PIN: no lo subas al repositorio y bórralo tras entregar las credenciales.

Vencimiento y PIN (F-31..F-33), solo con `SUPABASE_DB_URL`; `--merchant` acepta correo del panel o id:

```sh
node scripts/set-merchant-status.ts --merchant correo --status inactive            # oculta del catálogo y cierra sesiones admin; no borra datos
node scripts/set-merchant-status.ts --merchant correo --status active --paid-until 2027-01-31 [--visible false]
node scripts/reset-pin.ts --merchant correo [--pin 1234]                           # sin --pin genera uno y lo imprime una sola vez
```

`inactive` pone `is_visible = false` (el catálogo filtra por `is_visible`, RN-71); `active` lo vuelve a mostrar en el catálogo salvo `--visible false` (F-32). `reset-pin` reinicia contador y bloqueo y cierra sesiones administrativas; entrega el PIN generado por el canal acordado y no lo guardes.

Limpieza mensual de huérfanos de Storage (`merchant-media`), con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL`:

```sh
node scripts/clean-orphan-media.ts            # simulacro: imprime cantidad y lista
node scripts/clean-orphan-media.ts --apply    # borra
```

Huérfano = objeto sin referencia en `merchants`, `loyalty_programs`, `products` ni `weekly_offers` y con más de 24 h (una subida en curso aún no está guardada).
