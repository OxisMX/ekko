# Auditoría Ekko Rewards — 2026-10-24

Rama auditada: `develop @ 020d0f1`. Solo lectura, no se aplicó nada.

Alcance:
- `/ponytail:ponytail-audit`: sobreingeniería y código que sobra.
- Foco pedido:
  - App: alto rendimiento y ultraligera.
  - Panel: seguridad y acceso.
- Revisión general del resto.

Prioridad: **P0** bloquea producción · **P1** antes de lanzar · **P2** mejora.

Veredicto corto:
- **Panel:** la seguridad de fondo es sólida.
  - El rol de negocio viene de `app_metadata`, que solo escribe Oxis.
  - Hay RLS en todas las tablas, sin grants directos ni funciones para `anon`.
  - Todas las RPC de administración exigen la sesión de PIN.
  - Hay límites anti-adivinanza en el PIN y en los códigos de canje.
  - El Storage solo permite escribir con el admin desbloqueado.

  Los huecos están en la configuración (contraseñas, PIN, cabeceras), no en el diseño.
- **App:** ya es ligera (sin Reanimated ni Lottie, imágenes por variante, caché solo en memoria). Lo que más pesa es el exceso de peticiones de red y los re-renders de listas.

---

## 1. App móvil (`apps/mobile`)

### 1.1 Rendimiento y ligereza (foco)

| # | Prioridad | Hallazgo | Arreglo |
|---|---|---|---|
| A-R1 | P1 | `staleTime` global en 0 (`lib/queryClient.ts`). Cada montaje o vuelta a una pestaña vuelve a pedir datos que se pidieron hace segundos (lista, detalle, perfil, tarjetas, cupones). Es la mayor fuente de tráfico y de batería. | `queries: { retry: 1, staleTime: 30_000 }`. Las pantallas que ya refrescan por foco o pull-to-refresh siguen igual, porque `refetch()` ignora el `staleTime`. |
| A-R2 | P1 | **Mis Tarjetas pide el detalle completo de cada negocio** (`useMerchantDetail` por tarjeta): N consultas pesadas (menú, ofertas, etc.) solo para pintar sellos y premio. Con A-R1 en 0 se repite en cada visita a la pestaña. | Ampliar `list_my_cards` para que devuelva `stamps[]` (fecha y bonus), `reward_title`, `background_path` y `pending_extra_stamps`: una sola consulta. Quitar `useMerchantDetail` de `WalletCard`. |
| A-R3 | P1 | **Explorar re-renderiza toda la lista** al tocar un corazón. `renderItem` depende de `toggleFavorite`, el objeto de `useMutation`, que cambia en cada estado. Además `MerchantCard` no está memoizado y recibe objetos y funciones nuevos en cada render. | Depender de `toggleFavorite.mutate` (estable), envolver `MerchantCard` en `memo` y pasarle `item` más callbacks que reciban el `id` (`onPress(id)`), así sus props quedan estables. |
| A-R4 | P2 | Las fuentes se cargan en tiempo de ejecución con `useFonts`, y el primer render espera por ellas (`app/_layout.tsx`). | Plugin `expo-font` en `app.config.ts` (`fonts: [...]`): quedan incrustadas en el binario y se borran `useFonts`, la espera y `fontAssets`. Requiere dev build nuevo. |
| A-R5 | P2 | `enforceImageCacheLimit` recorre el directorio de caché **de forma síncrona en el hilo JS** justo al arrancar (`lib/imageCache.ts`). Con miles de miniaturas congela la primera interacción. | Diferirlo con `InteractionManager.runAfterInteractions`, o medir solo una vez al día (guardar la fecha en AsyncStorage). |
| A-R6 | P2 | `zod` completo (16 archivos) en un bundle Hermes. Metro no hace tree-shaking. | Migrar a `zod/mini` (misma librería, API funcional, mucho más chica). Solo se usa para validar respuestas de RPC. |
| A-R7 | P2 | `couponStatus` consulta cada 5 s mientras el código está visible. Está bien acotado (solo con foco), pero son 12 peticiones por minuto con la caja ocupada. | Aceptable. Si se quiere menos, subir a 8–10 s; el cliente no nota la diferencia frente al cajero. |
| A-R8 | P2 | `StampCard` mide su ancho con `onLayout` en cada tarjeta. Esto provoca un segundo render por tarjeta, más visible en el apilado. | Calcular el diámetro con `useWindowDimensions()` (ancho de pantalla menos padding conocido) y quitar el `onLayout` y su estado. |

### 1.2 Ponytail (sobreingeniería, de mayor a menor recorte)

```
delete: dependencia react-dom (sin react-native-web no hay target web; 0 imports). Nada. [apps/mobile/package.json]
delete: formatShortDate, quedó huérfano al borrar CardRow. Nada. [components/format.ts]
delete: ícono Trophy sin uso. Nada. [components/icons/index.tsx]
yagni: useMerchantDetail por tarjeta en WalletCard → ver A-R2; con list_my_cards ampliado se va el hook y WalletCardSkeleton se reduce a la franja. [features/cards/MyCardsScreen.tsx]
native: useFonts + gating de fontsReady. Plugin expo-font incrusta las fuentes (A-R4). [app/_layout.tsx, theme/fonts.ts]
shrink: StampCard onLayout + estado de diámetro → useWindowDimensions (A-R8). [components/card/StampCard.tsx]
```

Revisado y **se queda** porque está justificado:
- `encryptedStorage` (aes-js): SecureStore no admite más de unos 2 KB y la sesión de Supabase pesa más.
- `webCrypto`: Hermes no trae `crypto.subtle` y sin él PKCE se debilita.
- `imageCache`: Android no tiene API para limitar la caché de expo-image.
- `expo-system-ui` y `expo-updates`: se usan por configuración, no por import.

`net app: -≈60 líneas, -1 dep (react-dom); -≈40 líneas más con A-R2/A-R4.`

### 1.3 Otros aspectos

- **Seguridad:**
  - La sesión está cifrada (AES con clave en SecureStore) y se usa PKCE con SHA-256.
  - Sentry va sin PII (`sendDefaultPii: false`) y la cámara sin micrófono.
  - Sin hallazgos.
- **Contraseñas (P1, compartido con el Panel):** la app pide 8 caracteres, pero el servidor acepta 6 (`minimum_password_length = 6`). La validación de la app es UX; la regla real debe estar en Supabase. Ver P-S2.
- **Accesibilidad:** etiquetas, objetivos de 44 pt, estados que no dependen solo del color y reducción de movimiento respetada. Sin hallazgos nuevos.
- **Calidad:** typecheck, lint y 424 pruebas en verde.

---

## 2. Panel B2B (`apps/panel` + RPC/Storage que lo sirven)

### 2.1 Seguridad y acceso (foco)

Lo que ya está bien, verificado en la base de datos local:
- **Identidad:** `app.current_merchant()` exige `app_metadata.role = 'merchant'`, un `merchant_id` que coincida y `auth_user_id = auth.uid()`. Una cuenta de cliente recibe E-19. El registro público solo escribe `user_metadata`, así que nadie puede autoasignarse el rol.
- **RLS y permisos:** RLS activo en todas las tablas `public`. `authenticated` solo tiene SELECT en 4 tablas de catálogo, filtradas por política. `anon` no puede ejecutar ninguna función.
- **Administración:** todas las RPC de administración llaman a `app.require_admin_session()`, que está ligada al `session_id` del JWT. Un PIN desbloqueado en otra pestaña o dispositivo no sirve. Las únicas RPC sin PIN son las de Caja (QR, canje, sesión).
- **Fuerza bruta:**
  - PIN: 5 intentos y luego bloqueo de 15 min, con bcrypt.
  - Códigos de canje: 10 fallos en 5 min y luego bloqueo, sin reinicio por acierto.
  - Login: límites de GoTrue.
- **Storage:** solo se escribe en `merchant-media/merchants/<id>/(card|product|offer|brand)/`, con el admin desbloqueado y el comercio activo. Hay límite de 300 KB y solo admite webp o jpeg.
- **Frontend:**
  - CSP estricta, sin `unsafe-inline` en scripts, con `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff` y referrer policy.
  - Sin `dangerouslySetInnerHTML`.
  - Sentry con `dataCollection` sin PII, y los cuerpos de login nunca se envían.

| # | Prioridad | Hallazgo | Arreglo |
|---|---|---|---|
| P-S1 | P1 | **El PIN de 4 dígitos con bloqueo fijo de 15 min se puede adivinar desde la tableta de Caja.** El atacante realista es un empleado con la sesión del negocio ya abierta: 5 intentos cada 15 min son unos 480 al día, así que recorre los 10 000 PIN en unos 21 días (la mitad en promedio), sin que nadie lo note. | Bloqueo **escalonado** en `unlock_admin`: 15 min, luego 1 h y después 24 h. El contador de bloqueos solo se reinicia con un acierto. Avisar al dueño en el panel ("Hubo N intentos fallidos de PIN") en la siguiente entrada correcta. Opcional: PIN de 6 dígitos. |
| P-S2 | P1 | Política de contraseñas débil en Auth: `minimum_password_length = 6` y `password_requirements = ""`. Afecta a cuentas de negocio y de cliente. | En el proyecto de Supabase (staging y producción) y en `config.toml`: mínimo 10, `letters_digits`. Activar **Leaked password protection** (plan Pro). Para las cuentas de negocio, `onboard-merchant.ts` debe generar contraseñas fuertes. |
| P-S3 | P1 | Faltan cabeceras: **HSTS** y **Permissions-Policy**. | En `public/_headers`: `Strict-Transport-Security: max-age=31536000; includeSubDomains` y `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. |
| P-S4 | P2 | La CSP permite `https://*.supabase.co` en `connect-src` e `img-src`: cualquier proyecto de Supabase, incluido uno de un atacante, si hubiera una inyección. | Fijar el host del proyecto, `https://<ref>.supabase.co` y `wss://<ref>.supabase.co`, por entorno (staging y producción tienen `_headers` generados en el deploy). |
| P-S5 | P2 | La sesión del negocio no caduca nunca (no hay `auth.sessions.timebox`): una tableta robada queda dentro indefinidamente. Hoy solo protege el PIN de administración. | Plan Pro: `inactivity_timeout = "7d"`. Sin Pro: el dueño puede cerrar sesión desde otro dispositivo con `scripts/` (agregar `revoke-sessions.ts` con `auth.admin.signOut(userId, 'global')`). |
| P-S6 | P2 | MFA desactivado para cuentas de negocio. | Cuando haya Pro, TOTP opcional para el dueño. No es bloqueante con el PIN más P-S1. |
| P-S7 | P2 | El token de sesión vive en `localStorage` (default de supabase-js), así que un XSS lo leería. | Mitigado por la CSP estricta y la ausencia de HTML inyectado. Se deja documentado; no conviene migrar a cookies con una SPA estática. |

### 2.2 Ponytail (sobreingeniería, de mayor a menor recorte)

```
delete: AdminPlaceholderPage + campos `title` y `purpose` de ADMIN_SECTIONS (solo los usa el placeholder, ya no hay secciones "próximamente"; 2 tests). Nada. [components/AdminLayout.tsx, components/adminSections.ts]
delete: ArrowLeftIcon sin uso. Nada. [components/Icons.tsx]
shrink: toRedemptionError usado como parser genérico de errores RPC (AdminLayout, adminUnlockContext) duplica parseRpcError de @ekko/shared. Usar parseRpcError en todos lados. [lib/useRedemption.ts, lib/adminUnlockContext.ts]
shrink: extend() en AdminLayout reimplementa el reintento por E-16 que ya hace useAdminRpc. Llamar `adminRpc(() => supabase.rpc('extend_admin_session'))`. [components/AdminLayout.tsx]
yagni: contexto InsideAdminFrame para un booleano con un solo consumidor. Pasar `variant="section"` al fallback de Suspense de las rutas de admin. [lib/insideAdminFrame.ts, components/PanelSkeleton.tsx]
```

`net panel: -≈70 líneas, -1 archivo, 0 deps.`

### 2.3 Otros aspectos

- **Peso:** el login carga unos 750 KB de JS minificado (unos 230 KB gzip): `index`, `useRedemption` (347 KB) y `hooks`. Métricas (Recharts, 396 KB) ya está separado. P2: revisar qué arrastra el chunk `useRedemption`. Probablemente zod y supabase compartidos; es aceptable para una tableta.
- **Accesibilidad:** axe sin violaciones en el e2e y contraste AA corregido en "Eliminar". Encabezado de Administración a 1024 px: el nombre del negocio se trunca con 4 botones. P2: compactar "+5 min" y "Cerrar sesión" en iconos con tooltip por debajo de `xl`.
- **Operación:** `reset-pin.ts`, `set-merchant-status.ts` y `onboard-merchant.ts` existen y tienen pruebas. Confirmar el correo de soporte real (`SUPPORT_EMAIL`, hoy `soporte@oxis.mx`).
- **Calidad:** typecheck, lint, 252 pruebas, pgTAP (873) y e2e en verde.

---

## 3. Orden sugerido

1. **P1 de seguridad (Panel):**
   - P-S1: PIN escalonado más aviso.
   - P-S2: política de contraseñas.
   - P-S3: cabeceras.
2. **P1 de rendimiento (App):**
   - A-R1: `staleTime`.
   - A-R2: `list_my_cards` ampliado.
   - A-R3: memo en Explorar.
3. **Limpieza ponytail:** App y Panel, unas 130 líneas y 1 dependencia.
4. **P2:** al ritmo que convenga (fuentes incrustadas, caché diferida, zod/mini, CSP fijada, caducidad de sesión).
