# Ekko Rewards: despliegue y entornos

Complementa TRD §5 y §13, Plan §6 y [runbooks](ekko_runbooks.md) §8 (rollback). Workflows: `.github/workflows/`.

| Workflow | Disparador | Qué hace |
|---|---|---|
| `ci.yml` | PR, push | Lint, typecheck, pruebas, pgTAP, build del panel. |
| `deploy-staging.yml` | Push a `develop` o manual (solo desde `develop`) | `db push` → Edge Functions (+ secretos) → panel en Pages → `eas update` canal `staging`. |
| `deploy-production.yml` | Push a `main` o manual (solo desde `main`) | Igual contra `production`, con aprobación del Environment. **Sin OTA automática**: se publica solo con el disparo manual y `publish-ota` marcado. |
| `release.yml` | Tag `vX.Y.Z` | `eas build --no-wait` (iOS y Android) → job aprobado a mano: `eas submit --latest`. |
| `_deploy.yml` | Reutilizable | Lo llaman los dos deploys; no se ejecuta solo. |

Cada workflow empieza verificando que existan los secretos y variables requeridos y falla listando los nombres faltantes.

## Decisiones

- **`runtimeVersion: { policy: "appVersion" }`** (Plan §6.3: OTA ligada a la versión de la app). Una OTA solo llega a binarios con el mismo `version` de `app.config.ts`. **Regla: todo cambio nativo (dependencia con código nativo, plugin, permisos) sube `version`** y sale por tiendas. Fingerprint evitaría olvidos, pero cambia el runtime con cualquier dependencia y rompe el flujo staging → producción.
- **OTA a producción solo manual** y solo de un cambio ya probado en `staging` (Plan §6.3). Rollback: runbooks §8.1.
- Un solo job `deploy` (migrate → functions → panel) para que producción pida **una** aprobación, no tres.
- Migraciones y functions de producción nunca corren sin aprobación; `concurrency` evita despliegues simultáneos del mismo entorno sin cancelar uno a medias.

## Secretos y variables

Los nombres son iguales en `staging` y `production`; solo cambia el valor. Nunca se versionan.

### GitHub (Settings → Environments → `staging`, `production`)

| Nombre | Tipo | Lo crea | Valor |
|---|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | Oxis (Supabase → Account → Access Tokens) | Token personal de CLI |
| `SUPABASE_DB_PASSWORD` | secret | Oxis | Contraseña de la DB al crear el proyecto |
| `CLOUDFLARE_API_TOKEN` | secret | Oxis (Cloudflare → API Tokens) | Permiso *Cloudflare Pages: Edit* |
| `EXPO_ACCESS_TOKEN` | secret, opcional | Oxis (Expo → Access tokens) | Token para `send-push` (sin él, cuota anónima de Expo) |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID` | secrets, opcionales | Oxis (Apple Developer, Sign in with Apple) | Revocación de cuentas Apple en `delete-account`. Sin ellos esa revocación falla cerrada |
| `SUPABASE_PROJECT_REF` | variable | Oxis | Ref del proyecto de ese entorno |
| `SUPABASE_URL` | variable | Oxis | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | variable | Oxis | Anon key (pública; nunca la `service_role`) |
| `PANEL_ORIGINS` | variable | Oxis | Origen del panel: `https://staging.ekko.oxis.mx` / `https://ekko.oxis.mx` (varios, separados por coma) |
| `APP_ORIGINS` | variable | Oxis | Orígenes permitidos para `delete-account` (ver `supabase/functions/delete-account`) |
| `PUBLIC_APP_URL` | variable | Oxis | Origen del QR, sin `/` final (igual al dominio del panel) |
| `SENTRY_DSN_PANEL` | variable, opcional | Oxis | DSN del panel |
| `CLOUDFLARE_ACCOUNT_ID` | variable | Oxis | Cloudflare → Workers & Pages |
| `CF_PAGES_PROJECT` | variable | Oxis | Nombre del proyecto de Pages |
| `EXPO_ASC_APP_ID` | variable, solo `production` | Oxis | ID numérico de la app en App Store Connect (lo lee `eas submit`) |

A nivel de **repositorio** (Settings → Secrets and variables → Actions): `EXPO_TOKEN` (secret; Expo → Access tokens, token de robot con permisos sobre el proyecto). Lo usan `release.yml` y el job `ota`.

### EAS (expo.dev → proyecto → Environment variables; entornos `development`, `staging`, `production`)

| Nombre | Visibilidad | Valor |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | plain text | URL de Supabase del entorno (`development`: la local o la de staging) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | sensitive | Anon key del entorno |
| `EXPO_PUBLIC_APP_URL` | plain text | Origen del QR del entorno |
| `EXPO_PUBLIC_SENTRY_DSN` | plain text, opcional | DSN de la app |
| `SENTRY_AUTH_TOKEN` | secret, opcional | Solo cuando se active la subida de source maps (ver `app.config.ts`) |

Las `EXPO_PUBLIC_*` las inyecta EAS en builds y en `eas update --environment`; el `.env` local sigue funcionando para desarrollo. Además, en `eas credentials`: llave de App Store Connect API (iOS) y service account de Google Play (Android) para `eas submit`.

### Cloudflare Pages y Supabase

| Dónde | Nombre | Nota |
|---|---|---|
| Cloudflare Pages | (ninguna) | El build se hace en GitHub y se sube `dist/`; no hay variables en Pages. |
| Supabase secrets | `PANEL_ORIGINS`, `APP_ORIGINS`, `EXPO_ACCESS_TOKEN`, `APPLE_*` | Los fija el workflow con `supabase secrets set`; no se capturan a mano. |
| Supabase Vault | `hash_pepper` | A mano, una vez por proyecto (paso 3). |

### Inicio de sesión social (F-03, ADR-15)

| Proveedor | Qué crear | Dónde va cada secreto |
|---|---|---|
| Google | Google Cloud → APIs y servicios → Credenciales → ID de cliente OAuth, tipo **Aplicación web**. URIs de redirección autorizados: `https://<ref>.supabase.co/auth/v1/callback` (uno por entorno) y, solo para pruebas locales, `http://127.0.0.1:54321/auth/v1/callback`. Pantalla de consentimiento con alcances `email` y `profile`. | Hosted: Supabase → Authentication → Providers → Google (Client ID y Secret). Local: variables `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`. |
| Apple | Apple Developer → Identifiers: App ID `mx.oxis.ekko` con *Sign in with Apple*, y una llave (Key) con ese servicio. Flujo nativo: no hace falta Services ID ni redirect. | Hosted: Supabase → Providers → Apple, *Client IDs* = bundle id(s) separados por coma (el secret no se usa en nativo). Las llaves `APPLE_*` de arriba son solo para revocar en `delete-account`. |

La verificación de nonce queda activa en ambos. La app usa la redirección `ekko://auth/callback`; debe figurar en Supabase → Authentication → URL Configuration → Redirect URLs (en `config.toml` ya está `ekko://**` y los patrones `exp://`).

#### Probar Google en local

1. Crear un cliente OAuth web en Google Cloud con el redirect `http://127.0.0.1:54321/auth/v1/callback`.
2. `export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=... SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...`
3. `pnpm supabase stop && pnpm db:start` (sin las variables Supabase arranca igual; solo falla el inicio de sesión con Google).
4. Abrir la app en Expo Go y pulsar "Continuar con Google". Apple solo se prueba en un build de desarrollo iOS.

## Primera vez, en orden

1. **Supabase:** crear los proyectos staging (gratuito) y producción (Pro). Anotar ref, URL, anon key y contraseña de la DB.
2. **Enlazar y migrar el primer esquema:** el primer `db push` lo hace el workflow; antes, en local `pnpm supabase link --project-ref <ref>` solo si se quiere probar a mano.
3. **Pimienta (Vault):** en el SQL editor de cada proyecto, `select vault.create_secret('<PIMIENTA>', 'hash_pepper');`. Vault no viaja en los respaldos ([runbooks](ekko_runbooks.md) §7.1 paso 4): **guardar la pimienta de producción en el gestor de secretos de Oxis**. Hacerlo antes de que entren usuarios.
4. **Cloudflare Pages:** crear un proyecto (*Direct Upload*, sin conectar Git). Dominios: `ekko.oxis.mx` (rama de producción `main`) y `staging.ekko.oxis.mx` como CNAME a `develop.<proyecto>.pages.dev`. Crear el token de API.
5. **EAS:** `cd apps/mobile && eas init`; poner el `projectId` en `EAS_PROJECT_ID` de `app.config.ts` y hacer commit (activa `updates.url`). Crear los tres entornos y sus variables en expo.dev y el token de robot.
6. **GitHub:** crear los Environments `staging` y `production` con sus secretos y variables. En `production` → *Required reviewers* (PO y R4) y limitar *Deployment branches* a `main`. Ramas `main` y `develop` protegidas (Plan §6.1).
7. **Tiendas:** registrar `mx.oxis.ekko` en App Store Connect y Google Play (la primera subida a Play es manual). Copiar el Apple ID numérico a `EXPO_ASC_APP_ID`. Configurar las credenciales de submit en EAS. Notas y cuenta demo para App Review: [ekko_app_review.md](ekko_app_review.md).
8. **Enlaces universales (DEP-01, SP-2):** con el Team ID, agregar `apps/panel/public/.well-known/apple-app-site-association` y `assetlinks.json` (SHA-256 de cada keystore EAS y de Play App Signing), según [spikes](ekko_spikes.md) SP-2.
9. **Activar los despliegues:** en GitHub → Settings → Variables (repositorio) crear `DEPLOY_ENABLED = true`. Mientras no exista, los workflows de staging y producción se omiten sin fallar.
10. Primer `git push` a `develop`, luego PR a `main`, y aprobar el despliegue de producción.

## Verificación del primer despliegue

- [ ] Los tres workflows pasan; si falta algo, el primer paso lista los nombres.
- [ ] `supabase db push` aplicó todas las migraciones; `supabase migration list --linked` sin diferencias.
- [ ] `select count(*) from vault.decrypted_secrets where name = 'hash_pepper'` devuelve 1.
- [ ] `send-push` y `delete-account` aparecen en Supabase → Edge Functions y responden 401 sin sesión.
- [ ] El panel abre en su dominio con HTTPS, el login funciona y el pie muestra el hash del commit.
- [ ] `curl -I https://<dominio>/v/abc` devuelve la página estática (no el panel React) y `curl -I https://<dominio>/.well-known/apple-app-site-association` devuelve `application/json` sin redirect.
- [ ] Un QR generado en el panel apunta a `PUBLIC_APP_URL`.
- [ ] La consola del navegador no muestra bloqueos de CSP (Supabase y Sentry permitidos en `apps/panel/public/_headers`).
- [ ] Un build `staging` instala, muestra "Ekko (Staging)" y recibe el `eas update` del canal `staging`.
- [ ] Tras `eas build` y `submit` de producción, el build aparece en TestFlight y en la pista cerrada de Play.
- [ ] Probado un rollback del panel (runbooks §8.2) y de una OTA (§8.1) en staging.
- [ ] `EXPO_PUBLIC_APP_URL` está definida en el entorno `production` de EAS (si falta, la app usa `http://localhost:5173`, `visitToken.ts`).
- [ ] Publicadas `https://ekko.oxis.mx/privacidad` y `/terminos` (con la sección `#ruleta` con las bases de la ruleta) y el buzón `soporte@oxis.mx` recibe correo.
- [ ] Comercio de revisión oculto y cliente demo preparados ([ekko_app_review.md](ekko_app_review.md)).
