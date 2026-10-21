# Resultados de spikes — Sprint 0 — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Documento | Resultados de spikes técnicos (TRD §14) |
| Versión | 1.1 (agrega SP-2, SP-3, SP-4, ADR-09 y development build) |
| Fecha | 20 de octubre de 2026 |
| Versiones evaluadas | Expo SDK 58, React Native 0.88, expo-image 58.0.16, Supabase CLI 2.121.0, GoTrue v2.197.0, Playwright 1.64.1 |

| Spike | Resultado | Decisión | Pendiente |
|---|---|---|---|
| SP-1 | Tope nativo solo en iOS | Limpieza propia al iniciar (ambas plataformas) + tope nativo en iOS | Confirmar rutas de caché en dispositivo |
| SP-2 | Diseño cerrado: archivos estáticos con `_headers` | AASA y assetlinks únicos con todas las variantes; `?mode=developer` solo en dev | Team ID (DEP-01) y primer deploy en Cloudflare Pages |
| SP-3 | Supabase no revoca tokens de Apple | Código fresco al borrar + canje, verificación de `sub` y revocación en `delete-account` | Verificación en staging (DEP-01, cuenta Apple) |
| SP-4 | Resuelto por decisión (ADR-15) | Google por `signInWithOAuth` + `expo-web-browser` (PKCE); Apple nativo con nonce | Google Cloud (DEP-02) y Apple Developer (DEP-01) |
| SP-5 | WebP en Chromium; respaldo JPEG validado | Pipeline `createImageVariants` con detección por `blob.type` | WebKit/iPad real (TC-161) |
| SP-6 | Bundle JS medido; binario no medido | — | Build de EAS (requiere cuenta, DEP-05) |
| SP-7 | No existe opción nativa | OTP/enlace nativo de Supabase + trigger (ADR-14) | — |

---

## SP-1 — Tope de 20 MB de caché de `expo-image`

**Pregunta.** ¿`expo-image` permite limitar la caché en disco a 20 MB (RNF-03)?

**Evidencia (código fuente de expo-image 58.0.16).**
- iOS: `Image.configureCache({ maxDiskSize })` (`src/Image.tsx:216-221`, `@platform ios`) fija `SDImageCache.shared.config.maxDiskSize` (`ios/ImageModule.swift:388-390`). SDWebImage lo aplica en su propio ciclo de limpieza.
- Android: `ExpoImageAppGlideModule.kt:26-28` construye `InternalCacheDiskCacheFactory(context)` con el tamaño por defecto de Glide (~250 MB) y sin parámetro configurable; el config plugin no expone opciones de caché.
- `Image.getCachePathAsync` es por clave de imagen, no devuelve el directorio.

**Decisión.** Plan B en ambas plataformas (`apps/mobile/src/lib/imageCache.ts`): al iniciar la app se mide el directorio de caché (`image_manager_disk_cache` en Android, `com.hackemist.SDImageCache` en iOS) y, si supera 20 MB, se ejecuta `Image.clearDiskCache()`. En iOS además se fija el tope nativo. Es una purga completa, no LRU: en Android la caché puede superar 20 MB durante una sesión hasta el siguiente arranque.

**Pendiente.** En emulador y dispositivo: navegar imágenes, listar `Paths.cache` y confirmar los nombres de directorio (provienen de los valores por defecto de Glide y SDWebImage, no de código del repositorio); probar la purga con un límite temporal pequeño.

---

## SP-2 — Universal Links y App Links desde Cloudflare Pages

**Estado.** Diseño cerrado; verificación pendiente de DEP-01 (Team ID) y del primer deploy en Cloudflare Pages.

**Hechos y riesgos.**
- Pages deduce el `Content-Type` por extensión; el AASA no tiene, así que se fija con `_headers`. No hay fuente oficial de que `_headers` sobrescriba el tipo en lugar de duplicarlo: se verifica con `curl -I` [no verificado].
- Riesgo principal: si el archivo no llega al build, Pages responde `index.html` con 200 (fallback SPA) y Apple lo rechaza por JSON inválido.
- Apple no sigue redirects. No agregar reglas `_redirects` sobre `/.well-known/*`.
- Reporte comunitario de 2023 de `.well-known` no servido en Pages, sin resolución clara: verificar en el primer deploy.
- Revisar que Bot Fight Mode/WAF no bloquee al bot de Apple (Cloudflare Radar lo cataloga como verificado, "aasa").
- Los iPhone leen el AASA del CDN de Apple (`app-site-association.cdn-apple.com/a/v1/<dominio>`) al instalar o actualizar la app; el refresco no es inmediato ni forzable [no documentado]. En desarrollo: `?mode=developer` solo en la variante dev, app firmada con perfil de desarrollo y Ajustes → Desarrollador → Associated Domains Development.
- Android: `assetlinks.json` por HTTPS, `application/json`, sin redirect; SHA-256 del keystore EAS de cada perfil y el de Play App Signing para lo que distribuya Play.

**Decisión.** Archivos estáticos en `apps/panel/public/.well-known/` con `apps/panel/public/_headers`. Un solo AASA y un solo assetlinks con las tres variantes, en ambos dominios (cada app solo reclama el dominio de su entitlement). Plan B si `_headers` no fija el tipo o `.well-known` no se sirve: Pages Function `functions/.well-known/[file].ts` que devuelva el JSON con `content-type: application/json`.

`_headers`
```
/.well-known/apple-app-site-association
  Content-Type: application/json
/.well-known/assetlinks.json
  Content-Type: application/json
```

`.well-known/apple-app-site-association` (un solo archivo; `TEAMID` pendiente de DEP-01)
```json
{
  "applinks": {
    "details": [
      { "appIDs": ["TEAMID.mx.oxis.ekko", "TEAMID.mx.oxis.ekko.staging", "TEAMID.mx.oxis.ekko.dev"],
        "components": [{ "/": "/v/*" }] }
    ]
  }
}
```

`.well-known/assetlinks.json`
```json
[
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "mx.oxis.ekko",
      "sha256_cert_fingerprints": ["<PLAY_APP_SIGNING_SHA256>", "<EAS_PROD_UPLOAD_SHA256>"] } },
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "mx.oxis.ekko.staging",
      "sha256_cert_fingerprints": ["<EAS_STAGING_SHA256>"] } },
  { "relation": ["delegate_permission/common.handle_all_urls"],
    "target": { "namespace": "android_app", "package_name": "mx.oxis.ekko.dev",
      "sha256_cert_fingerprints": ["<EAS_DEV_SHA256>"] } }
]
```

`apps/mobile/app.config.ts` (fragmento)
```ts
const VARIANT = process.env.APP_VARIANT ?? 'development'; // development | staging | production
const ID = { development: 'mx.oxis.ekko.dev', staging: 'mx.oxis.ekko.staging', production: 'mx.oxis.ekko' }[VARIANT];
const HOST = VARIANT === 'production' ? 'ekko.oxis.mx' : 'staging.ekko.oxis.mx';
const APPLINK = VARIANT === 'development' ? `applinks:${HOST}?mode=developer` : `applinks:${HOST}`;
// ios: { bundleIdentifier: ID, associatedDomains: [APPLINK] }
// android: { package: ID, intentFilters: [{ action: 'VIEW', autoVerify: true,
//   data: [{ scheme: 'https', host: HOST, pathPrefix: '/v/' }], category: ['BROWSABLE', 'DEFAULT'] }] }
```

**Verificación.**
```sh
curl -sI https://staging.ekko.oxis.mx/.well-known/apple-app-site-association   # 200, application/json, sin Location
curl -s  https://app-site-association.cdn-apple.com/a/v1/staging.ekko.oxis.mx   # lo que ven los iPhone
curl -s 'https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://staging.ekko.oxis.mx&relation=delegate_permission/common.handle_all_urls'
adb shell pm verify-app-links --re-verify mx.oxis.ekko.staging && adb shell pm get-app-links mx.oxis.ekko.staging
```

**Pendiente.**
- `curl -I` del deploy real: tipo correcto y sin redirect.
- Si una build interna de EAS (ad-hoc) acepta `?mode=developer`: la doc exige perfil de desarrollo, quizá solo funcione con `expo run:ios --device`.
- Tiempo real de refresco del CDN de Apple [no documentado].
- Si staging va a Play (prueba cerrada) con paquete propio, agregar su SHA-256 de Play App Signing.

Fuentes: https://developers.cloudflare.com/pages/configuration/headers/ · https://developers.cloudflare.com/pages/configuration/serving-pages/ · https://community.cloudflare.com/t/allow-to-serve-from-well-known/507153 · https://radar.cloudflare.com/bots/directory/aasa · https://docs.expo.dev/linking/ios-universal-links/ · https://docs.expo.dev/linking/android-app-links/ · https://developer.apple.com/forums/thread/651595

---

## SP-3 — Revocación de token de Apple al borrar la cuenta

**Estado.** Diseño cerrado; verificación en staging pendiente de DEP-01 (cuenta Apple).

**Hechos.**
- Supabase Auth no revoca tokens de Apple al borrar el usuario (`supabase/auth#1308`, cerrado como *not planned*). Con `signInWithIdToken` nunca canjea el `authorizationCode`, así que no tiene refresh token que revocar.
- El `authorizationCode` es de un solo uso y vale 5 minutos.
- Guía 5.1.1(v): la app debe permitir borrar la cuenta dentro de la app y, con Sign in with Apple, revocar los tokens con la REST API de Apple.
- `client_secret`: JWT ES256 con `kid` = Key ID, `iss` = Team ID, `aud` = `https://appleid.apple.com`, `sub` = client_id, `exp` corto. En flujo nativo `client_id` = bundle ID de la variante. Generado por solicitud, no hay rotación semestral.
- `/auth/token` y `/auth/revoke` reciben `application/x-www-form-urlencoded`; revoke responde 200 con cuerpo vacío.

**Decisión (flujo sin guardar refresh tokens).**
1. En "Eliminar cuenta" (iOS) la app vuelve a pedir `AppleAuthentication.signInAsync()` para obtener un código fresco.
2. La app llama a `delete-account` con su JWT y `{ authorizationCode }`.
3. La función valida al usuario, canjea el código, verifica que el `sub` del `id_token` sea igual al `provider_id` de la identidad Apple del usuario (evita IDOR), revoca el `refresh_token`, y ejecuta el borrado/anonimización (ADR-11) y `auth.admin.deleteUser`.
4. Si Apple falla: registrar el error y borrar de todos modos; indicar al usuario cómo revocar desde Ajustes → Apple ID. No reintentar el canje (código de un solo uso).
5. `client_id` sale de una allowlist (`mx.oxis.ekko`, `.staging`, `.dev`) según el entorno, nunca tal cual del cliente. No hace falta verificar la firma del `id_token`: llega de Apple por TLS como respuesta a nuestro canje.
6. Secrets: `supabase secrets set APPLE_TEAM_ID=… APPLE_KEY_ID=… APPLE_P8_KEY="$(cat AuthKey.p8)"`.

Si Apple se ofreciera algún día en Android/web vía OAuth de Supabase, la app no recibe el código y habrá que revisar el diseño.

Esbozo (`supabase/functions/delete-account/apple.ts`)
```ts
import { SignJWT, importPKCS8 } from 'npm:jose@5';

const TEAM_ID = Deno.env.get('APPLE_TEAM_ID')!;
const KEY_ID = Deno.env.get('APPLE_KEY_ID')!;
const P8 = Deno.env.get('APPLE_P8_KEY')!;

async function clientSecret(clientId: string): Promise<string> {
  const key = await importPKCS8(P8, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID })
    .setIssuer(TEAM_ID).setIssuedAt().setExpirationTime('5m')
    .setAudience('https://appleid.apple.com').setSubject(clientId)
    .sign(key);
}

async function post(path: string, body: Record<string, string>) {
  const res = await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(`apple ${path} ${res.status}: ${await res.text()}`);
  return path === 'revoke' ? null : res.json();
}

// Devuelve el sub de Apple para que el caller lo compare con la identidad del usuario.
export async function revokeAppleWithCode(code: string, clientId: string): Promise<string> {
  const secret = await clientSecret(clientId);
  const tok = await post('token', { client_id: clientId, client_secret: secret, code, grant_type: 'authorization_code' });
  const sub = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
  await post('revoke', { client_id: clientId, client_secret: secret, token: tok.refresh_token, token_type_hint: 'refresh_token' });
  return sub;
}
```

**Pendiente.**
- Crear en Apple Developer una Key con "Sign in with Apple" asociada al App ID primario; confirmar que sirve para las 3 variantes (App IDs agrupados).
- En staging: confirmar que `/auth/token` acepta el código con `client_id` = bundle ID y que revoke devuelve 200; comprobar en Ajustes → Apple ID que la app desaparece.
- Provider Apple en Supabase: *Client IDs* = bundle IDs de las variantes de ese proyecto.

Fuentes: https://github.com/supabase/auth/issues/1308 · https://supabase.com/docs/guides/auth/social-login/auth-apple · https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens · https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret · https://developer.apple.com/support/offering-account-deletion-in-your-app/ · https://developer.apple.com/app-store/review/guidelines/#5.1.1 · https://docs.expo.dev/versions/latest/sdk/apple-authentication/

---

## SP-4 — Google Sign-In en Expo con Supabase

**Estado.** Resuelto por decisión del PO (21/10/2026, ADR-15): para no desactivar la verificación de nonce ni pagar la licencia Universal, Google usa el plan B (`signInWithOAuth` + `expo-web-browser`, PKCE) y Apple el flujo nativo con nonce. El análisis original se conserva abajo.

| Opción | Nonce | Expo Go | Costo | Notas |
|---|---|---|---|---|
| `@react-native-google-signin/google-signin` Original | No se puede pasar (el parámetro `nonce` es solo de la versión de pago, y solo iOS) | No | Gratis | Android usa el SDK legacy de Google Sign-In (deprecado, "sigue funcionando"); iOS usa GoogleSignIn SDK |
| `@react-native-google-signin` Universal | Sí, en todas las plataformas | No | Licencia de pago; registro npm privado, requiere token en CI/EAS | Android con Credential Manager |
| `signInWithOAuth` + `expo-web-browser` (PKCE) | Lo resuelve Supabase | Sí | Gratis | 100% JS; el consentimiento muestra `<ref>.supabase.co` salvo dominio personalizado (de pago); navegador in-app |
| `expo-auth-session` con Google | Manual | Parcial | Gratis | Proveedor desaconsejado por Expo [no verificado en SDK 58]; redirects frágiles |

**Decisión.** Spike con la librería Original + `signInWithIdToken` (`response.data.idToken`). Plan B: `signInWithOAuth` + `expo-web-browser` (PKCE), no `expo-auth-session`. Pasar a Universal solo si (a) seguridad no acepta "Skip nonce check", (b) Google retira el SDK legacy de Android o (c) la Original no compila con SDK 58.

**Decisión pendiente (PO/seguridad): "Skip nonce check".** Supabase valida el nonce por defecto; con la Original no se puede enviar, y la guía oficial indica activar *Skip nonce check* para iOS (Dashboard → Authentication → Providers → Google; local: `skip_nonce_check = true` en `[auth.external.google]`). En Android el token no trae nonce. Costo: se pierde la protección contra replay de un `id_token` robado (vigencia ~1 h); firma, `aud` y `exp` siguen validándose. Hasta que se decida, no se activa en producción.

**Configuración en Google Cloud (un proyecto GCP para los 3 entornos).**
1. Pantalla de consentimiento: Externo, scopes `openid`, `email`, `profile`; publicar "En producción" antes de tener usuarios externos.
2. Client ID Web (1): es el `webClientId` y el `aud` del idToken en Android. Redirect URI: `https://<ref>.supabase.co/auth/v1/callback` de staging y producción, y `http://127.0.0.1:54321/auth/v1/callback` en local. Su secret va a Supabase.
3. Client ID iOS (3), uno por bundle (`mx.oxis.ekko.dev`, `.staging`, `mx.oxis.ekko`); es el `aud` en iOS. `iosUrlScheme` = *reversed client ID* de cada variante.
4. Client ID Android por par paquete + SHA-1 (no se usa en código, pero sin él falla con `DEVELOPER_ERROR`): dev (keystore EAS `development` y `~/.android/debug.keystore` si hay build local), staging (keystore EAS; más SHA-1 de Play App Signing si pasa por Play), producción (SHA-1 de Play App Signing y de la clave de subida/EAS). SHA-1 con `eas credentials -p android`.
5. Supabase por entorno: *Client IDs* = lista separada por comas, Web primero y luego los iOS de las variantes que apuntan a ese proyecto (staging: web, ios.staging, ios.dev; prod: web, ios.prod).
6. `app.config.ts`: `plugins: [['@react-native-google-signin/google-signin', { iosUrlScheme: IOS_URL_SCHEME[APP_VARIANT] }]]`.

**Riesgo.** La documentación de la librería lista compatibilidad solo hasta Expo SDK 57 / RN 0.87 y estamos en SDK 58 / RN 0.88: verificar en la primera development build.

**Pendiente.**
- Decisión PO/seguridad sobre "Skip nonce check".
- Confirmar compilación y login con SDK 58 (Android e iOS, dev client).
- Probar en iOS si el error de nonce aparece con "Skip nonce check" apagado.
- Precio de la licencia Universal, si se necesita; fecha de retiro del SDK legacy de Android [no verificado].

Fuentes: https://supabase.com/docs/guides/auth/social-login/auth-google · https://react-native-google-signin.github.io/docs/install · https://react-native-google-signin.github.io/docs/original · https://react-native-google-signin.github.io/docs/security · https://react-native-google-signin.github.io/docs/setting-up/expo · https://github.com/supabase/auth/issues/1205 · https://github.com/orgs/supabase/discussions/33057

---

## SP-5 — Codificación WebP en el navegador (Safari de iPad)

**Implementación.** `apps/panel/src/lib/imageVariants.ts`: recorte centrado, 2 variantes por tipo (TRD §8.1), WebP con detección real por `blob.type` (Safari devuelve PNG en silencio si no codifica WebP), respaldo a JPEG, reducción de calidad en pasos de 0.1 hasta 0.5 para respetar 300 KB y errores tipificados que mapean a E-22.

**Resultados (Playwright, imagen de ruido 3000×2000, el peor caso de compresión).**

| Navegador | Tipo | Variantes | Formato | Tamaño máximo |
|---|---|---|---|---|
| Chromium | card | 540, 1080 | WebP | 288 KB |
| Chromium | product | 360, 720 | WebP | 269 KB |
| Chromium sin codificador WebP (simulado) | card | 540, 1080 | JPEG | 279 KB |

Errores de origen verificados: archivo que no es imagen → `NOT_AN_IMAGE`; más de 10 MB → `SOURCE_TOO_LARGE`.

**Pendiente.**
- WebKit de Playwright no arranca en este equipo por librerías del sistema faltantes; se resuelve con `sudo pnpm --filter @ekko/panel exec playwright install-deps webkit`.
- Aun con WebKit, Playwright en Linux no es Safari de iPad: TC-161 en un iPad real sigue siendo obligatorio. El respaldo a JPEG ya cubre el caso en que Safari no codifique WebP.

---

## SP-6 — Tamaño base de la app

**Medido.** Bundle JavaScript de Android (Hermes) con las dependencias actuales: 2.6 MB.

**No medido.** El tamaño de descarga real depende del binario nativo. No hay JDK ni NDK en el entorno de desarrollo y la build local descargaría varios GB de SDK, así que la medición se hace con `eas build --profile production` en cuanto exista la cuenta de Expo (DEP-05), leyendo el tamaño reportado por las tiendas (RNF-02).

---

## SP-7 — Sesión con correo sin confirmar en Supabase Auth

**Pregunta.** ¿Supabase Auth permite iniciar sesión con correo sin confirmar y confirmarlo después (RN-05)?

**Experimentos (GoTrue v2.197.0 local).**

| Configuración | Registro devuelve sesión | Login con contraseña |
|---|---|---|
| Confirmación obligatoria (`MAILER_AUTOCONFIRM=false`) | No | Rechazado: `email_not_confirmed` |
| Confirmación obligatoria + `MAILER_ALLOW_UNVERIFIED_EMAIL_SIGN_INS=true` | No | Rechazado: `email_not_confirmed` (la opción aplica a correos no verificados de proveedores OAuth) |
| Autoconfirmación (`enable_confirmations = false`) | Sí | Aceptado; `email_confirmed_at` se fija al registrarse |

Con autoconfirmación, `signInWithOtp({ email, shouldCreateUser: false })` envía el correo nativo de Supabase; al verificar el código o el enlace (`verifyOtp`), la sesión nueva registra `authentication_method = 'otp'` en `auth.mfa_amr_claims` (y `amr: [{ method: 'otp' }]` en el JWT). Un trigger prototipo `AFTER INSERT ON auth.mfa_amr_claims` (`SECURITY DEFINER`) marcó `customers.email_verified_at` solo tras el OTP; el login con contraseña no lo marcó.

**Decisión (ADR-14, reemplaza la propuesta de ADR-12).**
- Autoconfirmación activa en todos los entornos: el cliente obtiene sesión al registrarse y puede recibir sellos (RN-05).
- La verificación usa el OTP de correo nativo de Supabase (plantilla en español con código de 6 dígitos y enlace), enviado con el SMTP externo (ADR-09).
- El trigger de la migración 009 fija `customers.email_verified_at` cuando se inserta un `amr` `otp`. `app.is_email_verified` no cambia.
- Se eliminan la Edge Function `email-verification`, la tabla `private.email_verification_tokens` y las RPC `create_email_verification` / `consume_email_verification`.

**Riesgo y mitigación.** `auth.mfa_amr_claims` es una tabla interna de GoTrue. Una prueba pgTAP de contrato verificará que existan las columnas `session_id` y `authentication_method`, para que una actualización de Supabase que la cambie rompa el CI y no la producción.

---

## ADR-09 — Proveedor SMTP

**Decisión.** Resend (ver ADR-09).

| Criterio | Resend Free | Brevo Free |
|---|---|---|
| Límite | 100/día, 3 000/mes | 300/día, compartido con campañas |
| API HTTP + SMTP | Sí | Sí |
| Dominios en Free | 3 (según precios; antes 1, verificar) | Sin límite claro [no verificado] |
| DNS en Cloudflare | Botón "Sign in to Cloudflare" (Domain Connect) crea los registros | Manual: TXT de código + DKIM + DMARC |
| Entregabilidad | Infraestructura AWS SES; recomienda subdominio de envío | 99% declarado; reseñas con problemas en plan gratuito (IPs compartidas) |
| Marca | Sin footer | Posible footer en Free [no verificado para transaccional] |

**Razones.** Mejor verificación en Cloudflare (minutos), entregabilidad sin footer de marca y aparece primero en la documentación de Supabase. El límite de 100/día alcanza para el piloto (verificación y recuperación de unos pocos comercios y sus clientes).

**Disparador de cambio.** Más de ~70 correos/día sostenidos o una campaña de lanzamiento: Resend Pro (~20 USD/mes, verificar precio) o Brevo Free (300/día).

**Configuración en Supabase Auth** (Authentication → Emails → SMTP Settings): host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = API key de Resend, remitente verificado (p. ej. `no-reply@oxis.mx`). Las plantillas viven en Supabase Auth. Con SMTP propio, Supabase limita por defecto a 30 correos/hora (Authentication → Rate Limits); el SMTP integrado solo envía a miembros del equipo, 2/h.

**DNS en Cloudflare.** Subdominio de envío (p. ej. `send.oxis.mx`) para aislar reputación; SPF/DKIM en *DNS only*; `_dmarc.oxis.mx TXT "v=DMARC1; p=none; rua=mailto:dmarc@oxis.mx"`, subir a `p=quarantine` tras 2–4 semanas limpias.

**Pendiente.** Confirmar en `resend.com/pricing` el número de dominios y la región elegible en Free; enviar una prueba a Gmail y Outlook y revisar `spf=pass dkim=pass dmarc=pass`.

Fuentes: https://resend.com/pricing · https://resend.com/docs/send-with-supabase-smtp · https://resend.com/docs/knowledge-base/cloudflare · https://resend.com/docs/dashboard/domains/introduction · https://www.brevo.com/free-smtp-server/ · https://developers.brevo.com/docs/supabase-smtp-integration · https://supabase.com/docs/guides/auth/auth-smtp

---

## Development build

El equipo debe pasar a development build (`expo-dev-client`) en cuanto exista la cuenta de EAS (DEP-05). Es obligatorio para SP-2 (`associatedDomains`, `intentFilters`), SP-3 (el `aud` del token de Apple en Expo Go es el de Expo Go y Supabase lo rechaza), SP-4 (código nativo) y push remoto en Android (no disponible en Expo Go desde SDK 53).

Pasos: perfiles EAS `development`/`staging`/`production` con `APP_VARIANT`; instalar `expo-dev-client`; una build dev por plataforma compartida con el equipo; registrar los UDID de los iPhone con `eas device:create`. Expo Go queda solo para maquetar UI sin auth. Pendiente: revisar la política de Expo Go en las notas de SDK 58 estable.

Fuentes: https://docs.expo.dev/develop/development-builds/introduction/ · https://docs.expo.dev/versions/latest/sdk/notifications/ · https://docs.expo.dev/versions/latest/sdk/apple-authentication/
