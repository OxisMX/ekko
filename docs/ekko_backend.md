# Esquema del Backend — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Documento | Esquema del Backend |
| Versión | 1.1 (resultados de Sprint 0: verificación de correo por ADR-14) |
| Fecha | 20 de octubre de 2026 |
| Estado | Borrador para aprobación |
| Documentos base | ekko_prd.md, ekko_trd.md, ekko_appflow.md (v1.0) |
| Plataforma | Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) |

Convenciones: reglas RN-xx (PRD), errores E-xx (AppFlow, sección 7), spikes SP-xx (TRD, sección 14).

---

## 1. Organización de la base de datos

| Esquema | Expuesto por la API | Contenido |
|---|---|---|
| `public` | Sí | Tablas legibles con RLS y funciones RPC invocables por clientes y comercios. |
| `private` | No | Datos sensibles: seguridad del comercio, sesiones administrativas, pesos de la ruleta, vistas de KPIs. |
| `app` | No | Funciones auxiliares internas (identidad, fechas, hashing, errores). |
| `auth`, `storage` | Gestionados por Supabase | Usuarios y archivos. |

Reglas generales:
- Todas las tablas de `public` tienen RLS habilitado. Las tablas transaccionales no tienen políticas de `INSERT`, `UPDATE` ni `DELETE`: solo se modifican mediante RPC `SECURITY DEFINER`.
- Todas las RPC fijan `search_path = ''` y usan nombres calificados.
- Claves primarias `uuid` generadas con `gen_random_uuid()`.
- Fechas en `timestamptz` (UTC). Los cálculos de día y mes usan `app.local_now()` = `app.now() AT TIME ZONE 'America/Mexico_City'` (ADR-13: ninguna función llama a `now()` directamente).
- `created_at` y `updated_at` en todas las tablas editables; `updated_at` mantenido por trigger.

---

## 2. Modelo de datos

### 2.1 Diagrama entidad-relación

```mermaid
erDiagram
  AUTH_USERS ||--o| CUSTOMERS : "auth_user_id"
  AUTH_USERS ||--o| MERCHANTS : "auth_user_id"
  MERCHANTS ||--|| LOYALTY_PROGRAMS : "tiene"
  MERCHANTS ||--|| MERCHANT_SECURITY : "private"
  MERCHANTS ||--o{ MERCHANT_ADMIN_SESSIONS : "private"
  MERCHANTS ||--o{ WHEEL_PRIZES : "private"
  MERCHANTS ||--o{ MENU_CATEGORIES : "tiene"
  MENU_CATEGORIES ||--o{ PRODUCTS : "agrupa"
  MERCHANTS ||--o{ WEEKLY_OFFERS : "publica"
  MERCHANTS ||--o{ VISIT_QR_TOKENS : "genera"
  MERCHANTS ||--o{ PUSH_CAMPAIGNS : "envía"
  CUSTOMERS ||--o{ CUSTOMER_DEVICES : "usa"
  CUSTOMERS ||--o{ CUSTOMER_MERCHANTS : "relación"
  MERCHANTS ||--o{ CUSTOMER_MERCHANTS : "relación"
  CUSTOMERS ||--o{ CARD_CYCLES : "acumula"
  MERCHANTS ||--o{ CARD_CYCLES : "emite"
  CARD_CYCLES ||--o{ STAMPS : "contiene"
  VISIT_QR_TOKENS ||--o| STAMPS : "origina"
  CUSTOMERS ||--o{ WHEEL_SPINS : "gira"
  WHEEL_PRIZES ||--o{ WHEEL_SPINS : "resulta"
  CUSTOMERS ||--o{ COUPONS : "posee"
  MERCHANTS ||--o{ COUPONS : "honra"
  CARD_CYCLES ||--o| COUPONS : "premio"
  WHEEL_SPINS ||--o| COUPONS : "premio"
  PUSH_CAMPAIGNS ||--o{ COUPONS : "emite"
```

### 2.2 Tipos enumerados

| Tipo | Valores |
|---|---|
| `merchant_category` | `restaurantes`, `cafeterias_postres`, `bares_snacks`, `barberias`, `belleza`, `spas`, `deporte_salud`, `servicios`, `otros` |
| `subscription_status` | `active`, `past_due`, `inactive` |
| `billing_period` | `quarterly`, `annual` |
| `customer_status` | `active`, `deleted` |
| `relation_origin` | `add_card`, `first_stamp` |
| `cycle_status` | `active`, `completed`, `expired` |
| `wheel_prize_type` | `coupon`, `extra_stamp` |
| `coupon_source` | `card_reward`, `wheel`, `push`, `birthday` |
| `coupon_status` | `active`, `redeemed` (el vencimiento se deriva de `expires_at`) |
| `campaign_status` | `pending`, `sending`, `sent`, `failed` |
| `device_platform` | `ios`, `android` |

### 2.3 Tablas del esquema `public`

#### `customers`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | Identificador estable; sobrevive a la eliminación del usuario de Auth. |
| `auth_user_id` | uuid | UNIQUE, FK `auth.users(id)` ON DELETE SET NULL, nullable | Nulo tras eliminar la cuenta. |
| `first_name` | text | nullable, 2–50 caracteres | Nulo hasta completar el perfil y tras anonimizar. |
| `last_name` | text | nullable, 2–50 caracteres | — |
| `birth_date` | date | nullable | Solo se fija una vez (RN-04). |
| `email_verified_at` | timestamptz | nullable | Se fija por trigger al verificar el OTP (ver 6.3). |
| `auth_provider` | text | NOT NULL | `email`, `google` o `apple`. |
| `status` | customer_status | NOT NULL, default `active` | — |
| `deleted_at` | timestamptz | nullable | — |
| `created_at`, `updated_at` | timestamptz | NOT NULL | — |

La mayoría de edad (18+) se valida en `complete_profile` con `app.now()`, no con un `CHECK`: un `CHECK` con `current_date` ignora el reloj controlable (ADR-13) e impide probar TC-002 y TC-003.

#### `merchants`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `auth_user_id` | uuid | UNIQUE, FK `auth.users(id)` | Credencial única (RN-61). |
| `name` | text | NOT NULL, ≤ 40 caracteres | Incluye sucursal si aplica. |
| `category` | merchant_category | NOT NULL | Una sola (RN-51). |
| `description` | text | NOT NULL, ≤ 140 caracteres | — |
| `address` | text | NOT NULL | Distingue sucursales. |
| `logo_path` | text | NOT NULL | Ruta base en Storage (sin sufijo de ancho). |
| `cover_path` | text | NOT NULL | — |
| `maps_url` | text | NOT NULL | RN-59. |
| `reviews_url` | text | NOT NULL | RN-59. |
| `birthday_benefit` | text | nullable | Nulo = sin cupón de cumpleaños (RN-44). |
| `push_coupon_validity_hours` | smallint | NOT NULL, default 48, CHECK 24–48 | — |
| `is_active` | boolean | NOT NULL, default false | Operación permitida. |
| `is_visible` | boolean | NOT NULL, default false | Visible en catálogo (RN-53). |
| `subscription_status` | subscription_status | NOT NULL | — |
| `billing_period` | billing_period | NOT NULL | — |
| `paid_until` | date | NOT NULL | Base del periodo de gracia (RN-70). |
| `created_at`, `updated_at` | timestamptz | NOT NULL | — |

#### `loyalty_programs`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `merchant_id` | uuid | PK, FK `merchants` | Un programa por comercio (RN-22). |
| `stamps_required` | smallint | NOT NULL, default 6, CHECK 4–10 | RN-23. |
| `cycle_months` | smallint | NOT NULL, default 6, CHECK 3–12 | RN-24. |
| `reward_title` | text | NOT NULL, ≤ 60 | — |
| `reward_description` | text | NOT NULL, ≤ 200 | — |
| `terms` | text | NOT NULL, ≤ 1,000 | Incluye consumo mínimo (RN-18). |
| `card_background_path` | text | nullable | Nulo = plantilla estándar. |
| `updated_at` | timestamptz | NOT NULL | — |

#### `customer_merchants` (relación)
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `customer_id` | uuid | PK compuesta, FK `customers` | — |
| `merchant_id` | uuid | PK compuesta, FK `merchants` | — |
| `origin` | relation_origin | NOT NULL | RN-10. |
| `pending_extra_stamps` | smallint | NOT NULL, default 0, CHECK ≥ 0 | RN-36. |
| `created_at` | timestamptz | NOT NULL | — |

#### `card_cycles`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `customer_id` | uuid | FK `customers` | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `status` | cycle_status | NOT NULL | — |
| `stamps_required` | smallint | NOT NULL | Copia al iniciar (RN-29). |
| `stamps_count` | smallint | NOT NULL, default 0 | Desnormalizado para lectura rápida. |
| `reward_title`, `reward_description`, `terms` | text | NOT NULL | Copia al iniciar (RN-29). |
| `started_at` | timestamptz | NOT NULL | — |
| `expires_at` | timestamptz | NOT NULL | `started_at + cycle_months` (RN-24). |
| `closed_at` | timestamptz | nullable | Al completarse o vencer. |

Índice único parcial: `(customer_id, merchant_id) WHERE status = 'active'` — un ciclo activo por relación.

#### `stamps`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `cycle_id` | uuid | FK `card_cycles` | — |
| `customer_id` | uuid | FK `customers` | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `qr_token_id` | uuid | FK `visit_qr_tokens`, nullable | Nulo en sellos extra. |
| `is_bonus` | boolean | NOT NULL, default false | Sello extra de ruleta. |
| `local_date` | date | NOT NULL | Fecha en `America/Mexico_City`. |
| `granted_at` | timestamptz | NOT NULL | RN-19. |

Índice único parcial: `(customer_id, merchant_id, local_date) WHERE is_bonus = false` — límite de 1 sello por día (RN-17).

#### `visit_qr_tokens`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | Se usa para la suscripción Realtime del panel. |
| `merchant_id` | uuid | FK `merchants` | — |
| `token_hash` | bytea | UNIQUE, NOT NULL | SHA-256 del token; el token en claro nunca se guarda. |
| `created_at` | timestamptz | NOT NULL | — |
| `expires_at` | timestamptz | NOT NULL | `created_at + 60 s` (RN-14). |
| `used_at` | timestamptz | nullable | — |
| `used_by_customer_id` | uuid | FK `customers`, nullable | No se expone al comercio. |
| `invalidated_at` | timestamptz | nullable | Al generar un QR nuevo. |

#### `wheel_spins`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `customer_id` | uuid | FK `customers` | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `prize_id` | uuid | FK `private.wheel_prizes` | — |
| `device_hash` | bytea | NOT NULL | Con pimienta del servidor. |
| `email_hash` | bytea | NOT NULL | Con pimienta del servidor (RN-09). |
| `spun_at` | timestamptz | NOT NULL | — |

Índices únicos: `(customer_id, merchant_id)`, `(device_hash, merchant_id)`, `(email_hash, merchant_id)`.

#### `coupons`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `customer_id` | uuid | FK `customers` | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `source` | coupon_source | NOT NULL | — |
| `cycle_id` | uuid | FK `card_cycles`, nullable, UNIQUE | Origen `card_reward`. |
| `spin_id` | uuid | FK `wheel_spins`, nullable, UNIQUE | Origen `wheel`. |
| `campaign_id` | uuid | FK `push_campaigns`, nullable | Origen `push`. |
| `birthday_year` | smallint | nullable | Origen `birthday`. |
| `title` | text | NOT NULL | — |
| `description` | text | NOT NULL | — |
| `terms` | text | nullable | — |
| `code` | char(6) | NOT NULL | Alfabeto del TRD 6.5. |
| `status` | coupon_status | NOT NULL, default `active` | — |
| `issued_at` | timestamptz | NOT NULL | — |
| `expires_at` | timestamptz | NOT NULL | Según tabla de vigencias (PRD 6.6). |
| `redeemed_at` | timestamptz | nullable | — |

Índices únicos:
- `(merchant_id, code)` — un código no se repite dentro del comercio en toda su historia (31^6 ≈ 887 millones de combinaciones; ante colisión se regenera).
- `(campaign_id, customer_id) WHERE source = 'push'`.
- `(customer_id, merchant_id, birthday_year) WHERE source = 'birthday'`.

Restricción: `CHECK` que exige la columna de origen correspondiente a `source`.

#### `customer_devices`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `customer_id` | uuid | FK `customers` | — |
| `device_hash` | bytea | NOT NULL | Con pimienta del servidor. |
| `platform` | device_platform | NOT NULL | — |
| `expo_push_token` | text | nullable | — |
| `push_enabled` | boolean | NOT NULL, default false | — |
| `last_seen_at` | timestamptz | NOT NULL | — |
| `signed_out_at` | timestamptz | nullable | Al cerrar sesión, se borra el token. |

Índice único: `(customer_id, device_hash)`.

#### `menu_categories`
| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `merchant_id` | uuid | FK `merchants` |
| `name` | text | NOT NULL, ≤ 30 |
| `position` | smallint | NOT NULL |

#### `products`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `category_id` | uuid | FK `menu_categories` ON DELETE RESTRICT | — |
| `name` | text | NOT NULL, ≤ 60 | — |
| `description` | text | ≤ 200 | — |
| `price` | numeric(10,2) | NOT NULL, CHECK ≥ 0 | MXN. |
| `image_path` | text | nullable | — |
| `is_featured` | boolean | NOT NULL, default false | "Más pedidos" (RN-57). |
| `sold_out_on` | date | nullable | Agotado si es igual a la fecha local (RN-56). |
| `position` | smallint | NOT NULL | — |
| `created_at`, `updated_at` | timestamptz | NOT NULL | — |

#### `weekly_offers`
| Columna | Tipo | Restricciones |
|---|---|---|
| `id` | uuid | PK |
| `merchant_id` | uuid | FK `merchants` |
| `title` | text | NOT NULL, ≤ 60 |
| `description` | text | NOT NULL, ≤ 200 |
| `weekday` | smallint | NOT NULL, CHECK 1–7 (ISO: 1 = lunes) |
| `image_path` | text | nullable |
| `position` | smallint | NOT NULL |

#### `push_campaigns`
| Columna | Tipo | Restricciones | Notas |
|---|---|---|---|
| `id` | uuid | PK | — |
| `merchant_id` | uuid | FK `merchants` | — |
| `idempotency_key` | uuid | NOT NULL | Generada por el panel. |
| `title` | text | NOT NULL, ≤ 50 | — |
| `body` | text | NOT NULL, ≤ 150 | — |
| `has_coupon` | boolean | NOT NULL | — |
| `coupon_title`, `coupon_description`, `coupon_terms` | text | nullable | Obligatorios si `has_coupon`. |
| `coupon_validity_hours` | smallint | nullable, CHECK 24–48 | — |
| `local_month` | date | NOT NULL | Primer día del mes local (cuota RN-47). |
| `status` | campaign_status | NOT NULL | — |
| `recipients_count`, `sent_count`, `failed_count` | integer | NOT NULL, default 0 | — |
| `created_at` | timestamptz | NOT NULL | — |

Índice único: `(merchant_id, idempotency_key)`.

### 2.4 Tablas del esquema `private`

| Tabla | Columnas principales | Propósito |
|---|---|---|
| `merchant_security` | `merchant_id` PK, `pin_hash` (bcrypt), `pin_failed_count`, `pin_locked_until`, `code_failed_count`, `code_window_started_at`, `validator_locked_until` | PIN (RN-63) y antiadivinación del validador (TRD 6.5). |
| `merchant_admin_sessions` | `id`, `merchant_id`, `auth_session_id` (claim `session_id` del JWT), `expires_at` | Desbloqueo administrativo por dispositivo con expiración deslizante de 5 min. |
| `wheel_prizes` | `id`, `merchant_id`, `label` (≤ 30), `prize_type`, `benefit_title`, `benefit_description`, `weight` (> 0), `position`, `is_active` | Premios y pesos de la ruleta (RN-33). |

### 2.5 Índices adicionales

| Tabla | Índice | Uso |
|---|---|---|
| `merchants` | `(is_visible, category)` | Catálogo filtrado. |
| `merchants` | `gin (name gin_trgm_ops)` con `pg_trgm` | Búsqueda por nombre. |
| `card_cycles` | `(merchant_id, status)` | Métricas. |
| `stamps` | `(merchant_id, granted_at)` | Métricas y clientes activos. |
| `coupons` | `(customer_id, status, expires_at)` | "Mis cupones". |
| `coupons` | `(merchant_id, redeemed_at)` | Métricas de canjes. |
| `visit_qr_tokens` | `(merchant_id, created_at DESC)` | Registro de QR. |
| `customer_merchants` | `(merchant_id)` | Destinatarios de push. |
| `customer_devices` | `(customer_id) WHERE expo_push_token IS NOT NULL AND signed_out_at IS NULL` | Envío de push. |
| `products` | `(merchant_id, category_id, position)` | Menú. |

---

## 3. Funciones auxiliares (`app`)

| Función | Retorna | Descripción |
|---|---|---|
| `app.now()` | timestamptz | Hora actual; respeta `app.fake_now` en sesiones SQL directas (pruebas). Definida en la migración 002 (ADR-13). |
| `app.local_now()` | timestamp | Hora local de Ciudad de México, derivada de `app.now()`. |
| `app.local_today()` | date | Fecha local. |
| `app.current_customer()` | `customers` | Cliente del JWT con `status = 'active'`; si no existe, lanza E-18 o E-19. |
| `app.current_merchant()` | `merchants` | Comercio del claim `app_metadata.merchant_id`; si no existe, lanza E-19. |
| `app.require_active_merchant()` | `merchants` | Además exige `is_active`; si no, lanza E-05. |
| `app.require_admin_session()` | void | Verifica y extiende 5 min la sesión administrativa del `session_id` actual; si no existe o venció, lanza E-16. |
| `app.is_email_verified(customer)` | boolean | `auth_provider IN ('google','apple') OR email_verified_at IS NOT NULL`. |
| `app.peppered_hash(text)` | bytea | SHA-256 de `valor || pimienta`; la pimienta se lee de Supabase Vault. |
| `app.random_code()` | char(6) | Código con `gen_random_bytes` sobre el alfabeto de 31 símbolos. |
| `app.raise(code text, detail jsonb)` | void | Lanza `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = code, DETAIL = detail::text`. |
| `app.roll_cycle(customer_id, merchant_id)` | `card_cycles` | Bloquea el ciclo activo; si venció lo cierra como `expired` y abre uno nuevo con la configuración vigente; si no existe, lo crea. |
| `app.grant_stamps(cycle, n, qr_token_id, is_bonus)` | jsonb | Inserta sellos, actualiza `stamps_count` y, si se completa, cierra el ciclo, emite el cupón de premio (30 días) y abre un ciclo nuevo (RN-26). |

### 3.1 Contrato de errores

Las RPC devuelven errores con este formato en la respuesta de PostgREST:

```json
{
  "code": "P0001",
  "message": "E-04",
  "details": "{\"next_available_on\":\"2026-10-21\"}",
  "hint": null
}
```

El cliente lee `message` como código E-xx (AppFlow, sección 7) y `details` como datos opcionales para el texto (intentos restantes, tiempo de bloqueo, fecha de reinicio).

---

## 4. API — Funciones RPC

Invocación: `POST /rest/v1/rpc/<nombre>` con el JWT del usuario (`supabase.rpc('<nombre>', params)`). Todas son `SECURITY DEFINER`, validan el rol y devuelven `jsonb` salvo que se indique.

### 4.1 Cliente — cuenta y dispositivo

#### `complete_profile`
| Parámetro | Tipo |
|---|---|
| `p_first_name` | text |
| `p_last_name` | text |
| `p_birth_date` | date |

Reglas: valida longitudes y 18+ (E-07). `birth_date` solo se escribe si es nula (RN-04); nombre y apellido sí son editables.
Retorna: `{ "profile_complete": true }`.

#### `get_my_profile`
Retorna:
```json
{
  "first_name": "Daniela",
  "last_name": "Ruiz",
  "birth_date": "2004-03-12",
  "email": "daniela@example.com",
  "auth_provider": "email",
  "email_verified": false,
  "profile_complete": true
}
```

#### `register_device`
| Parámetro | Tipo | Notas |
|---|---|---|
| `p_device_id_digest` | text | SHA-256 calculado en la app; el servidor le aplica la pimienta. |
| `p_platform` | device_platform | — |
| `p_expo_push_token` | text, opcional | — |
| `p_push_enabled` | boolean | — |

Reglas: upsert por `(customer_id, device_hash)`; actualiza `last_seen_at` y limpia `signed_out_at`.
Retorna: `{ "ok": true }`.

#### `sign_out_device`
| Parámetro | Tipo |
|---|---|
| `p_device_id_digest` | text |

Reglas: borra `expo_push_token` y fija `signed_out_at` (F-16).

#### `ensure_birthday_coupons`
Sin parámetros. Reglas: si el mes local coincide con el de `birth_date`, crea un cupón por cada relación con comercio activo y `birthday_benefit` no nulo, sin duplicar por año (RN-43 a RN-45). Vence el último día del mes a las 23:59:59 locales.
Retorna: `{ "created": 2 }`.

#### `list_my_redemptions`
| Parámetro | Tipo |
|---|---|
| `p_offset` | integer, default 0 |
| `p_limit` | integer, default 20 (máx. 50) |

Retorna: arreglo de `{ coupon_id, merchant_name, title, source, redeemed_at }`.

### 4.2 Cliente — catálogo y comercio

#### `list_merchants`
| Parámetro | Tipo | Notas |
|---|---|---|
| `p_seed` | text | Semilla de sesión (RN-52). |
| `p_query` | text, opcional | Búsqueda por nombre (trigramas). |
| `p_category` | merchant_category, opcional | — |
| `p_offset` | integer, default 0 | — |
| `p_limit` | integer, default 10 (máx. 20) | — |

Reglas: solo `is_visible = true`; orden `md5(id::text || p_seed)`.
Retorna:
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Café Espresso 19",
      "category": "cafeterias_postres",
      "description": "Café de especialidad...",
      "logo_path": "merchants/<id>/logo/<uuid>",
      "cover_path": "merchants/<id>/cover/<uuid>",
      "maps_url": "https://maps.google.com/..."
    }
  ],
  "has_more": true
}
```

#### `get_merchant_detail`
| Parámetro | Tipo |
|---|---|
| `p_merchant_id` | uuid |

Reglas: si el comercio no es visible y el cliente no tiene relación, lanza E-05. Si hay relación, ejecuta `app.roll_cycle` (reinicio perezoso, RN-25). El estado "agotado" se calcula con `sold_out_on = app.local_today()`.
Retorna:
```json
{
  "merchant": {
    "id": "uuid", "name": "...", "category": "...", "description": "...",
    "address": "...", "logo_path": "...", "cover_path": "...",
    "maps_url": "...", "reviews_url": "...", "available": true
  },
  "card": {
    "has_relation": true,
    "stamps_required": 8,
    "stamps": [{ "granted_at": "2026-10-18T17:02:11Z", "is_bonus": false }],
    "cycle_expires_at": "2027-04-18T17:02:11Z",
    "reward_title": "Café americano gratis",
    "reward_description": "...",
    "terms": "Compra mínima de $100 MXN...",
    "background_path": null,
    "pending_extra_stamps": 0,
    "reward_coupon_id": null,
    "stamped_today": true
  },
  "wheel": { "status": "available | spun | device_used | needs_verification | no_relation" },
  "menu": {
    "categories": [{ "id": "uuid", "name": "Cafés", "position": 1 }],
    "products": [{
      "id": "uuid", "category_id": "uuid", "name": "Latte",
      "description": "...", "price": 69.00, "image_path": "...",
      "is_featured": true, "is_sold_out": false
    }]
  },
  "offers": [{ "id": "uuid", "title": "...", "description": "...", "weekday": 1, "image_path": "..." }],
  "coupons": [{ "id": "uuid", "source": "push", "title": "...", "description": "...", "terms": "...", "expires_at": "..." }]
}
```

Si no hay relación, `card` contiene la vista previa del programa con `has_relation = false` y `stamps = []`.

#### `add_card`
| Parámetro | Tipo |
|---|---|
| `p_merchant_id` | uuid |

Reglas: exige comercio activo y visible (E-05). Crea la relación con `origin = 'add_card'` y el primer ciclo. Idempotente.
Retorna: `{ "created": true, "wheel": { "status": "available" } }`.

#### `get_wheel`
| Parámetro | Tipo |
|---|---|
| `p_merchant_id` | uuid |

Retorna los segmentos activos sin pesos: `{ "segments": [{ "index": 0, "label": "Postre gratis" }] }`.

#### `spin_wheel`
| Parámetro | Tipo |
|---|---|
| `p_merchant_id` | uuid |
| `p_device_id_digest` | text |

Reglas: exige relación (E-05 si el comercio está inactivo), correo verificado (E-06) y que no exista giro por cuenta, dispositivo o hash de correo (E-09). Selección ponderada con `gen_random_bytes`. Premio `coupon`: cupón de 48 h. Premio `extra_stamp`: incrementa `pending_extra_stamps`.
Retorna:
```json
{
  "segment_index": 2,
  "prize_type": "coupon",
  "label": "10% de descuento",
  "coupon_id": "uuid"
}
```

### 4.3 Cliente — visitas, tarjetas y cupones

#### `claim_visit`
| Parámetro | Tipo |
|---|---|
| `p_token` | text |
| `p_device_id_digest` | text |

Algoritmo (una transacción):
1. Busca el token por `sha256(p_token)` con `FOR UPDATE`. No existe: E-08.
2. `used_at` no nulo: E-03, salvo que lo haya usado el mismo cliente, en cuyo caso devuelve el resultado original (idempotencia, RR-2). `invalidated_at` no nulo o `expires_at < now()`: E-02.
3. Comercio inactivo: E-05.
4. Crea la relación si no existe (`origin = 'first_stamp'`).
5. `app.roll_cycle` con bloqueo del ciclo.
6. Si ya existe sello no extra con `local_date = app.local_today()`: E-04 (el índice único lo garantiza ante concurrencia).
7. Sellos a otorgar: 1 + `pending_extra_stamps` (el excedente sobre el total se descarta, RN-36); pone `pending_extra_stamps = 0`.
8. `app.grant_stamps`; marca el token como usado.

Retorna:
```json
{
  "merchant_id": "uuid",
  "merchant_name": "Café Espresso 19",
  "stamps_added": 1,
  "stamps_count": 4,
  "stamps_required": 8,
  "cycle_completed": false,
  "reward_coupon_id": null,
  "relation_created": false,
  "wheel_status": "spun"
}
```

#### `list_my_cards`
Retorna arreglo de:
```json
{
  "merchant_id": "uuid", "merchant_name": "...", "logo_path": "...",
  "merchant_available": true, "stamps_count": 3, "stamps_required": 6,
  "cycle_expires_at": "...", "reward_available": true, "wheel_status": "available"
}
```
Aplica reinicio perezoso de ciclos vencidos.

#### `list_my_coupons`
| Parámetro | Tipo |
|---|---|
| `p_merchant_id` | uuid, opcional |

Retorna cupones `active` no vencidos, ordenados por `expires_at`: `{ id, merchant_id, merchant_name, source, title, description, terms, expires_at, merchant_available }`.

#### `reveal_coupon_code`
| Parámetro | Tipo |
|---|---|
| `p_coupon_id` | uuid |

Reglas: cupón del cliente (si no, E-12), correo verificado (E-06), vigente (E-10), no usado (E-11).
Retorna: `{ "code": "K7M4QX", "expires_at": "...", "title": "...", "merchant_name": "..." }`.

### 4.4 Comercio — Modo Caja

#### `get_merchant_session`
Retorna:
```json
{
  "merchant": { "id": "uuid", "name": "...", "logo_path": "..." },
  "is_active": true,
  "admin_unlocked_until": null,
  "pin_locked_until": null,
  "validator_locked_until": null
}
```

#### `generate_visit_qr`
Reglas: `app.require_active_merchant()`. Invalida los tokens pendientes del comercio. Genera 16 bytes aleatorios, guarda el hash.
Retorna:
```json
{
  "qr_id": "uuid",
  "token": "base64url-22-caracteres",
  "expires_at": "2026-10-20T17:30:45Z"
}
```
El panel compone la URL `https://<dominio>/v/<token>` y se suscribe a cambios de `visit_qr_tokens` con `id = qr_id`.

#### `get_qr_status`
| Parámetro | Tipo |
|---|---|
| `p_qr_id` | uuid |

Respaldo por consulta cuando Realtime no está disponible (F-21). Retorna `{ "status": "pending | used | expired | invalidated" }`.

#### `lookup_redemption`
| Parámetro | Tipo |
|---|---|
| `p_code` | text (normalizado a mayúsculas) |

Reglas: validador bloqueado: E-13. Busca `(merchant_id, code)`. No encontrado: incrementa contador de fallos (10 en 5 min bloquean 5 min) y lanza E-12 con intentos restantes. Vencido: E-10. Usado: E-11. Permitido con comercio inactivo (RN-71).
Retorna:
```json
{
  "coupon_id": "uuid",
  "customer_full_name": "Daniela Ruiz",
  "title": "Café americano gratis",
  "description": "...",
  "terms": "...",
  "source": "card_reward",
  "expires_at": "..."
}
```

#### `confirm_redemption`
| Parámetro | Tipo |
|---|---|
| `p_coupon_id` | uuid |

Reglas: bloquea el cupón; valida comercio, vigencia y estado. Marca `redeemed`. Idempotente si ya fue canjeado por este mismo comercio en los últimos 60 s.
Retorna: `{ "redeemed_at": "..." }`.

### 4.5 Comercio — administración (requieren sesión administrativa)

#### `unlock_admin`
| Parámetro | Tipo |
|---|---|
| `p_pin` | text (4 dígitos) |

Reglas: bloqueado: E-15 con `locked_until`. PIN incorrecto: incrementa fallos; al quinto fija bloqueo de 15 min; lanza E-14 con `remaining`. Correcto: reinicia contador y crea o extiende la sesión del `session_id` actual.
Retorna: `{ "admin_unlocked_until": "..." }`.

#### `lock_admin`
Cierra la sesión administrativa del dispositivo actual.

#### `get_card_config` / `update_card_config`
| Parámetro (`update`) | Tipo | Validación |
|---|---|---|
| `p_stamps_required` | smallint | 4–10 |
| `p_cycle_months` | smallint | 3–12 |
| `p_reward_title` | text | ≤ 60 |
| `p_reward_description` | text | ≤ 200 |
| `p_terms` | text | ≤ 1,000 |
| `p_card_background_path` | text, nullable | Debe pertenecer a la carpeta del comercio. |
| `p_push_coupon_validity_hours` | smallint | 24–48 |

Reglas: los ciclos activos conservan su copia (RN-29).

#### Menú
| RPC | Parámetros | Reglas |
|---|---|---|
| `upsert_menu_category` | `p_id` (opcional), `p_name`, `p_position` | — |
| `delete_menu_category` | `p_id` | Falla si tiene productos. |
| `upsert_product` | `p_id` (opcional), `p_category_id`, `p_name`, `p_description`, `p_price`, `p_image_path`, `p_position` | La categoría y la imagen deben ser del comercio. |
| `delete_product` | `p_id` | — |
| `set_product_flags` | `p_id`, `p_sold_out_today` (boolean), `p_is_featured` (boolean) | `p_sold_out_today = true` fija `sold_out_on = app.local_today()`; `false` lo limpia. |

#### Ofertas
| RPC | Parámetros |
|---|---|
| `upsert_offer` | `p_id` (opcional), `p_title`, `p_description`, `p_weekday`, `p_image_path`, `p_position` |
| `delete_offer` | `p_id` |

#### `get_metrics`
| Parámetro | Tipo |
|---|---|
| `p_range` | text: `30d` o `all` |

Retorna:
```json
{
  "visits": 412,
  "redemptions": 57,
  "active_customers": 96,
  "push_remaining_this_month": 3
}
```
`active_customers` siempre usa la ventana de 30 días (RN-67).

#### `list_qr_log`
| Parámetro | Tipo |
|---|---|
| `p_offset`, `p_limit` | integer |

Retorna `{ created_at, expires_at, status, used_at }` sin datos del cliente.

#### `list_push_campaigns`
Retorna el historial del comercio: `{ id, title, has_coupon, status, recipients_count, sent_count, failed_count, created_at }`.

### 4.6 RPC internas (solo `service_role`)

| RPC | Invocada por | Propósito |
|---|---|---|
| `create_push_campaign(p_merchant_id, p_auth_session_id, p_payload jsonb)` | Edge Function `send-push` | Verifica sesión administrativa del dispositivo, comercio activo, cuota mensual (E-17) e idempotencia; crea la campaña y los cupones en una transacción. |
| `get_push_recipients(p_campaign_id)` | `send-push` | Tokens activos de los clientes con relación. |
| `record_push_result(p_campaign_id, p_sent, p_failed, p_invalid_tokens text[])` | `send-push` | Cierra la campaña y desactiva tokens inválidos. |
| `anonymize_customer(p_customer_id)` | `delete-account` | Anonimización (6.4). |

Los scripts de operación (`onboard-merchant.ts`, `set-merchant-status.ts`, `reset-pin.ts`) usan la `service_role key` y SQL directo en una transacción.

---

## 5. Edge Functions

| Función | Método | Autenticación | Propósito |
|---|---|---|---|
| `send-push` | POST | JWT de comercio | Envío de campañas (TRD 7.4). |
| `delete-account` | POST | JWT de cliente | Eliminación de cuenta (F-15). |

### 5.1 `send-push`

Solicitud:
```json
{
  "idempotency_key": "uuid",
  "title": "¡Lunes de 2x1!",
  "body": "Hoy todas las bebidas iguales al 2x1.",
  "coupon": {
    "title": "2x1 en bebidas",
    "description": "Válido en bebidas iguales.",
    "terms": "Solo consumo en sucursal.",
    "validity_hours": 24
  }
}
```
`coupon` es opcional.

Proceso: validar esquema → `create_push_campaign` → `get_push_recipients` → envío a Expo en lotes de 100 con datos `{ "merchant_id": "...", "coupon_id": "..." }` → `record_push_result`.

Respuesta:
```json
{
  "campaign_id": "uuid",
  "recipients": 128,
  "sent": 121,
  "failed": 7,
  "push_remaining_this_month": 2
}
```

Errores: E-16, E-17, E-05, E-99. Si la `idempotency_key` ya existe, devuelve el resultado de la campaña original sin reenviar.

### 5.2 `delete-account`

Solicitud:
```json
{
  "confirmation": "ELIMINAR",
  "apple_authorization_code": "opcional"
}
```

Proceso:
1. Valida la confirmación.
2. Si el proveedor es Apple, la app vuelve a solicitar Apple Sign-In antes de llamar y envía el `authorization_code`; la función lo canjea por un token y lo revoca en la API de Apple (SP-3; diseño en docs/ekko_spikes.md).
3. `anonymize_customer`.
4. Elimina el usuario de Supabase Auth.

Respuesta: `{ "deleted": true }`.

La verificación de correo no usa Edge Function: ver 6.3 y ADR-14.

---

## 6. Autenticación y seguridad

### 6.1 Proveedores y roles

| Aspecto | Configuración |
|---|---|
| Proveedores | Correo y contraseña, Google, Apple. |
| Registro público | Habilitado; solo crea clientes. |
| Rol | Trigger `BEFORE INSERT ON auth.users` (`app.assign_user_role`): si `raw_app_meta_data` no trae `role = 'merchant'` (solo posible vía API administrativa), fija `role = 'customer'` y quita cualquier `merchant_id`; así el rol ya viaja en el primer token del registro. Un trigger `AFTER INSERT` crea la fila en `customers`. |
| Claims usados | `sub`, `session_id`, `email`, `app_metadata.role`, `app_metadata.merchant_id`. |
| Política de contraseña | Mínimo 8 caracteres. |
| SMTP | Resend (ADR-09) para recuperación de contraseña y verificación. |

### 6.2 Políticas RLS

| Tabla | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `customers` | Cliente: su fila. | Ninguna (RPC). |
| `merchants` | Todos los autenticados: filas con `is_visible`, o con relación del cliente; comercio: su fila. | Ninguna (scripts). |
| `loyalty_programs` | Igual que `merchants`. | Ninguna (RPC). |
| `customer_merchants` | Cliente: sus filas. | Ninguna. |
| `card_cycles`, `stamps` | Cliente: sus filas. | Ninguna. |
| `visit_qr_tokens` | Comercio: sus filas (necesario para Realtime). Columna `used_by_customer_id` sin privilegio de lectura para `authenticated` (privilegios por columna). | Ninguna. |
| `wheel_spins` | Cliente: sus filas, sin columnas de hash. | Ninguna. |
| `coupons` | Cliente: sus filas, sin la columna `code` (privilegios por columna; el código solo sale por `reveal_coupon_code`). | Ninguna. |
| `customer_devices` | Ninguna. | Ninguna. |
| `menu_categories`, `products`, `weekly_offers` | Autenticados: del comercio visible o con relación; comercio: las suyas. | Ninguna (RPC con sesión administrativa). |
| `push_campaigns` | Comercio: las suyas. | Ninguna. |
| Esquema `private` | Sin acceso para `anon` ni `authenticated`. | — |

El rol `anon` no tiene acceso a ninguna tabla: la app exige sesión para todo, incluido el catálogo.

### 6.3 Verificación de correo

Mecanismo de ADR-14 (resultado de SP-7):

1. Autoconfirmación activa en Supabase Auth: el registro devuelve sesión y el cliente puede recibir sellos (RN-05).
2. La app verifica con `signInWithOtp({ email, shouldCreateUser: false })` y `verifyOtp`. El correo es el nativo de Supabase, con plantilla en español (código de 6 dígitos y enlace), enviado por el SMTP de ADR-09.
3. Trigger `AFTER INSERT ON auth.mfa_amr_claims` (`SECURITY DEFINER`, migración 009): si `authentication_method = 'otp'`, fija `customers.email_verified_at` del usuario de la sesión. El login con contraseña no la fija.
4. `app.is_email_verified` controla ruleta y canjes.
5. Vigencia del OTP = `otp_expiry` de Auth (1 h). Reenvío limitado por el rate limit de Auth; ajustar en Authentication → Rate Limits antes del lanzamiento (30 correos/h por defecto con SMTP propio, compartido con la recuperación de contraseña).
6. Riesgo: `auth.mfa_amr_claims` es una tabla interna de GoTrue; una prueba pgTAP de contrato verifica sus columnas `session_id` y `authentication_method`.

### 6.4 Anonimización (RN-08)

`anonymize_customer`, en una transacción:
1. `customers`: `first_name`, `last_name`, `birth_date` a nulo; `status = 'deleted'`; `deleted_at = now()`.
2. `customer_devices`: borra `expo_push_token`; conserva `device_hash`.
3. `coupons` activos: se eliminan (no son canjeables).
4. `card_cycles` activos: se cierran como `expired`.
5. `customer_merchants`: se eliminan (deja de recibir push).
6. `stamps`, `wheel_spins` (con `email_hash` y `device_hash`) y cupones canjeados se conservan ligados al `customer_id` anónimo.

Tras eliminar el usuario de Auth, `auth_user_id` queda nulo. Un registro nuevo con el mismo correo crea un `customer` nuevo, y `spin_wheel` lo bloquea por `email_hash` (RN-09).

### 6.5 Secretos

| Secreto | Ubicación |
|---|---|
| Pimienta de hashes | Supabase Vault (lectura solo desde funciones `app`). |
| `service_role key` | Secretos de Edge Functions, GitHub Actions y equipo de Oxis. |
| Llave de Apple Sign-In (revocación) | Secretos de Edge Functions. |
| API key de Resend (SMTP) | Configuración de SMTP de Auth. |
| Access token de Expo (si se habilita seguridad de push) | Secretos de Edge Functions. |

---

## 7. Storage

| Bucket | Acceso | Estructura |
|---|---|---|
| `merchant-media` | Lectura pública; escritura autenticada restringida | `merchants/{merchant_id}/{logo|cover|card|product|offer}/{uuid}_{ancho}.{webp|jpg}` |

Políticas de `storage.objects` para `merchant-media`:

| Operación | Regla |
|---|---|
| SELECT | Pública. |
| INSERT | Rol `merchant`, primer segmento de carpeta igual a su `merchant_id`, carpeta `card`, `product` u `offer`, y sesión administrativa vigente. Tipos `image/webp` o `image/jpeg`; tamaño ≤ 300 KB. |
| UPDATE | No permitida (archivos inmutables; cada cambio sube un UUID nuevo). |
| DELETE | Mismo criterio que INSERT. |

Logos y portadas los sube Oxis con `service_role`. La app construye la URL pública como `<storage_url>/merchant-media/<path>_<ancho>.webp`; si la variante WebP no existe, el registro guarda la extensión real en la ruta.

Limpieza de huérfanos: script de operación mensual que elimina archivos sin referencia en la base de datos.

---

## 8. Realtime

| Elemento | Configuración |
|---|---|
| Publicación | `supabase_realtime` incluye solo `visit_qr_tokens`. |
| Suscripción | Panel: `postgres_changes`, evento `UPDATE`, filtro `id=eq.<qr_id>`. |
| Seguridad | RLS limita los eventos a las filas del comercio; el hash del token y el cliente no se exponen. |
| Respaldo | `get_qr_status` cada 3 s si el canal se desconecta. |

---

## 9. Vistas de KPIs (`private`)

| Vista | Contenido | KPI del PRD |
|---|---|---|
| `kpi_merchants` | Comercios activos y visibles por mes. | Comercios activos |
| `kpi_customers` | Clientes con `status = 'active'`. | Usuarios registrados |
| `kpi_weekly_stamps` | Sellos por semana ISO local. | Escaneos semanales |
| `kpi_reward_redemption` | Cupones `card_reward` canjeados / emitidos (excluye vigentes). | Canje de premios |
| `kpi_coupon_redemption` | Cupones `wheel`, `push`, `birthday` canjeados / emitidos (excluye vigentes). | Canje de cupones |
| `merchants_billing` | Comercios por vencer (15 días) y vencidos, con días de gracia restantes. | Operación F-31 |

---

## 10. Migraciones

Orden inicial de migraciones versionadas (Supabase CLI):

| # | Migración | Contenido |
|---|---|---|
| 001 | `extensions` | `pgcrypto`, `pg_trgm`, Vault. |
| 002 | `schemas_and_types` | Esquemas `private` y `app`, tipos enumerados, `app.now()` y trigger de `updated_at`. |
| 003 | `core_tables` | `customers`, `merchants`, `loyalty_programs`, tablas `private`. |
| 004 | `loyalty_tables` | `customer_merchants`, `card_cycles`, `stamps`, `visit_qr_tokens`. |
| 005 | `rewards_tables` | `wheel_spins`, `coupons`, `push_campaigns`. |
| 006 | `catalog_tables` | `menu_categories`, `products`, `weekly_offers`, `customer_devices`. |
| 007 | `indexes` | Índices de la sección 2.5. |
| 008 | `app_functions` | Funciones auxiliares de la sección 3. |
| 009 | `auth_trigger` | Trigger de alta de clientes y asignación de rol, y trigger de verificación de correo (ADR-14). |
| 010 | `customer_rpc` | RPC 4.1 a 4.3. |
| 011 | `merchant_rpc` | RPC 4.4 y 4.5. |
| 012 | `internal_rpc` | RPC 4.6. |
| 013 | `rls_policies` | Políticas y privilegios por columna. |
| 014 | `storage_policies` | Bucket y políticas. |
| 015 | `realtime` | Publicación. |
| 016 | `kpi_views` | Vistas de la sección 9. |

`seed.sql` (solo desarrollo local; staging se llena con los scripts de alta de comercios): datos deterministas del Plan de QA 4.2 — comercios C1, C2 y C3 (inactivo) con menú, ofertas, premios de ruleta y beneficio de cumpleaños, y clientes U1 a U4. Contiene contraseñas conocidas: nunca se ejecuta contra staging ni producción.

Notas de Sprint 1:
- La migración 008 incluye solo `local_now`, `local_today`, `raise`, `current_customer`, `current_merchant`, `require_active_merchant`, `is_email_verified`, `peppered_hash` y `random_code`. `require_admin_session`, `roll_cycle` y `grant_stamps` llegan con sus RPC (S4, S5 y S8).
- `get_merchant_session` (4.4) se adelantó a S1 en su propia migración (`merchant_session_rpc`) para el login del panel (F-20).
- La 009 asigna el rol con un trigger `BEFORE INSERT ON auth.users` (el rol ya viaja en el primer token del registro, verificado contra Auth local) y crea la fila de `customers` con un trigger `AFTER INSERT`; no se usa Custom Access Token Hook.

---

## 11. Trazabilidad

| Regla | Mecanismo principal |
|---|---|
| RN-05 | `app.is_email_verified` en `spin_wheel` y `reveal_coupon_code`; `customers.email_verified_at` la fija el trigger sobre `auth.mfa_amr_claims` (ADR-14). |
| RN-07, RN-09 | Índices únicos de `wheel_spins` por dispositivo y hash de correo. |
| RN-13 a RN-17 | `generate_visit_qr`, `claim_visit`, índice único diario de `stamps`. |
| RN-24 a RN-29 | `app.roll_cycle`, `app.grant_stamps`, copia de configuración en `card_cycles`. |
| RN-31 a RN-36 | `spin_wheel`, `private.wheel_prizes`, `pending_extra_stamps`. |
| RN-38 a RN-40 | `app.random_code`, `reveal_coupon_code`, `lookup_redemption`, `merchant_security`. |
| RN-43 a RN-45 | `ensure_birthday_coupons`, índice único por año. |
| RN-46 a RN-48 | `send-push`, `create_push_campaign`, `local_month`. |
| RN-56 | `products.sold_out_on`. |
| RN-62 a RN-65 | `unlock_admin`, `merchant_admin_sessions`, `merchant_security`. |
| RN-66 | Privilegios por columna; solo `lookup_redemption` devuelve el nombre. |
| RN-71 | `app.require_active_merchant` en todas las RPC excepto `lookup_redemption` y `confirm_redemption`. |
