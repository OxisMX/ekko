# Ekko Rewards: rendimiento y respaldos

Resultados de Sprint 15 (QA plan §7.1 NF-01 y NF-02; plan de implementación §7.1). Cubre backend, panel y app móvil (medido en local).

## Backend

### Entorno de medición

- Supabase local (Docker) en WSL2, Postgres 17.11, 10 vCPU y 21 GB de RAM compartidos con el resto de la máquina. **No es el hardware de staging ni de producción**: sirve para comparar antes y después y para detectar problemas de plan, no como cifra de capacidad.
- Dataset: `scripts/perf/seed-scale.sql` sobre `seed.sql` (solo local; unos 50 s).

| Tabla | Filas |
|---|---|
| merchants | 60 (59 visibles) |
| customers | 20,004 (204 con usuario de Auth) |
| customer_merchants | 150,360 |
| card_cycles | 183,495 (150,360 activos + 33,135 completados) |
| stamps | 632,304 (12 meses) |
| coupons | 82,644 (premio de tarjeta, ruleta, push y cumpleaños; canjeados, vigentes y vencidos) |
| visit_qr_tokens | 200,015 |
| products | 1,806 |

Base de 372 MB. Simplificación declarada: solo el 27 % de los sellos tiene un QR asociado (para respetar los ~200 mil tokens pedidos con 630 mil sellos); no afecta a las consultas medidas salvo que `get_metrics` cuenta visitas por tokens usados. El comercio medido en panel es el de más tokens (5,189).

### NF-01: tiempo de servidor de `claim_visit` (meta p95 < 300 ms)

Medición: `scripts/perf/bench-rpcs.sql`. Cada RPC se llama como el rol real (`authenticated` con claims JWT) y se cronometra con `clock_timestamp()` (200 iteraciones; en "después" claim_visit hizo 193 y 93 porque se saltan las relaciones ya selladas hoy por las corridas de NF-02). Mide el cuerpo de la función en Postgres, sin red ni PostgREST.

| RPC | p50 antes | p95 antes | p50 después | p95 después |
|---|---|---|---|---|
| **claim_visit** | 0.61 ms | 1.14 ms | 0.62 ms | 1.17 ms |
| claim_visit (sello que completa la tarjeta: cupón + nuevo ciclo) | 0.76 ms | 1.08 ms | 0.85 ms | 1.05 ms |
| list_my_cards | 0.65 ms | 1.19 ms | 0.45 ms | 0.73 ms |
| **get_merchant_detail** | **28.75 ms** | **35.86 ms** | 0.47 ms | 0.72 ms |
| list_merchants (página 1) | 0.31 ms | 0.48 ms | 0.23 ms | 0.36 ms |
| list_merchants (búsqueda "cafeteria") | 0.27 ms | 0.42 ms | 0.21 ms | 0.32 ms |
| list_my_coupons | 0.09 ms | 0.17 ms | 0.07 ms | 0.11 ms |
| lookup_redemption (acierto) | 0.29 ms | 0.51 ms | 0.30 ms | 0.45 ms |
| lookup_redemption (fallo, cuenta intentos) | 0.29 ms | 0.48 ms | 0.28 ms | 0.42 ms |
| get_metrics('all') | 3.53 ms | 5.77 ms | 3.48 ms | 4.59 ms |
| get_metrics('30d') | 3.33 ms | 5.35 ms | 3.35 ms | 4.21 ms |
| list_qr_log (offset 0) | 0.18 ms | 0.38 ms | 0.18 ms | 0.28 ms |
| list_qr_log (offset 5000) | 1.34 ms | 2.17 ms | 1.31 ms | 1.85 ms |

(Las diferencias de décimas de milisegundo en filas sin cambio son ruido de medición.)

**Resultado NF-01: cumple con amplio margen** (p95 1.2 ms contra 300 ms). Los planes de `claim_visit` usan índices en todo: el token se busca por `token_hash` (índice único, 0.04 ms), la relación por clave primaria y el límite diario por `stamps_one_per_day_idx`. Con `EXPLAIN (ANALYZE, BUFFERS)`:

- `get_metrics`: `visit_qr_tokens_merchant_created_idx` (bitmap, 589 buffers, 1.2 ms) para visitas; 4.2 ms para clientes activos 30 d (une con `customers`, hash join sobre 20 mil filas). Crece con los tokens del comercio, no con la tabla; sin acción.
- Vistas KPI de Oxis (`private.kpi_*`): recorren `stamps` o `coupons` completos (64 ms y 38 ms con 630 mil sellos). Son de uso interno y manual; sin acción.

### Cambios realizados (migración `20261103000000_s15_performance.sql`)

1. **`stamps_cycle_idx` sobre `stamps (cycle_id)`.** `get_merchant_detail` lee los sellos de una tarjeta por `cycle_id` y no había índice: recorrido paralelo de las 630 mil filas (plan medido: 8,700 buffers, 14 ms solo esa consulta). Antes p50 28.75 ms / p95 35.86 ms; después 0.47 / 0.72 ms (unas 60 veces más rápido); el plan anterior crecía linealmente con el tamaño de `stamps`. Cubre también la FK `stamps.cycle_id → card_cycles`. Costo: un índice más en escritura de sellos, insignificante (un `claim_visit` sigue en ~0.6 ms). Crear el índice con 630 mil filas tardó 0.18 s.

No se añadió ningún otro índice: ninguna otra consulta medida lo justifica.

### NF-02: 50 `claim_visit` concurrentes sobre 50 tokens distintos (meta: sin errores, p95 < 500 ms)

Script: `scripts/perf/claim-load.ts` (Node, usa `postgres` y `fetch`; sin k6). Inicia sesión con 50 clientes (`perf-u001..050@ekko.test`) por la API de Auth, crea 50 tokens QR distintos por SQL y lanza 50 `POST /rest/v1/rpc/claim_visit` a la vez por PostgREST con el JWT de cada cliente. Tiempos de extremo a extremo (cliente, red local, Kong, PostgREST, Postgres).

| Corrida | Errores | p50 | p95 | máx | Duración total |
|---|---|---|---|---|---|
| 1 | 0 | 152 ms | 207 ms | 211 ms | 217 ms |
| 2 | 0 | 121 ms | 153 ms | 158 ms | 160 ms |

**Resultado NF-02: cumple** (0 errores, p95 207 ms contra 500 ms). La mayor parte es la conexión y el arranque de 50 solicitudes simultáneas (el servidor ejecuta cada una en ~1 ms).

Cómo ejecutarlo:

```bash
pnpm db:reset
docker exec -i supabase_db_ekko psql -U postgres -v ON_ERROR_STOP=1 < scripts/perf/seed-scale.sql
export SUPABASE_ANON_KEY=$(pnpm -s supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"/\1/p')
node scripts/perf/claim-load.ts          # CLAIMS=100 para más usuarios (hasta 200)
docker exec -i supabase_db_ekko psql -U postgres < scripts/perf/bench-rpcs.sql   # latencias de las RPC
```

Notas: el límite de Auth local es 300 inicios de sesión por 5 minutos por IP (`sign_in_sign_ups`), de sobra para 50. Cada corrida consume un par (cliente, comercio) por usuario para el día de hoy (RN-17); tras unas 7 corridas el mismo día, los usuarios se quedan sin comercios libres y el script avisa. Para repetir, `pnpm db:reset` y volver a sembrar. Termina con código 1 si hay errores o p95 ≥ 500 ms.

### Qué re-medir en staging

- NF-01 y NF-02 contra el proyecto de staging (hardware y red reales, pooler de Supavisor/PgBouncer, región). El p95 de extremo a extremo de NF-02 incluye latencia de red; la meta de 500 ms hay que validarla ahí con el script apuntando a la URL de staging (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`).
- Confirmar que el tamaño de instancia contratado (Pro) soporta las conexiones concurrentes de PostgREST; revisar la gráfica de CPU durante la corrida.
- Repetir `bench-rpcs.sql` (necesita acceso SQL como `postgres`); el índice `stamps_cycle_idx` debe estar aplicado por la migración.
- Sembrar el dataset de escala solo si el entorno es desechable. **Nunca en producción.**

## Respaldo y restauración (ensayo local)

Procedimiento y resultado completos en `docs/ekko_runbooks.md` §7. Resumen del ensayo del 2026-10-22 sobre el dataset de escala (1.3 M filas):

| Paso | Resultado |
|---|---|
| Volcado de esquema (`auth, storage, public, app, private, rls`) y de datos con `supabase db dump --use-copy` | Datos: 274 MB en 10 s |
| Restauración en un contenedor nuevo (`public.ecr.aws/supabase/postgres:17.11.0.004`) | Esquema: 0 errores (tras crear las extensiones). Datos: 17 s; solo 2 errores de `supabase_functions` (esquema de webhooks, irrelevante) |
| Conteos de `auth.users`, `auth.identities`, `customers`, `merchants`, `customer_merchants`, `card_cycles`, `stamps`, `coupons`, `visit_qr_tokens`, `products`, `wheel_spins`, `merchant_security` | Idénticos |
| Invariantes: ciclos con `stamps_count` distinto a sus sellos; relaciones con 2 ciclos activos; dos sellos de visita el mismo día | 0, 0, 0 en origen y destino |
| Suma md5 del contenido de `stamps` y de `coupons` | Idéntica |
| Prueba funcional en el destino: `app.peppered_hash` tras recrear el secreto | Correcto |

Hallazgos que cambian la operación:

1. **Vault no viaja en el volcado** (excluido por la CLI). La pimienta de hashes debe guardarse fuera de Supabase y recargarse tras restaurar; sin ella se rompen los controles de la ruleta (RN-07, RN-09).
2. **Las extensiones no viajan.** Antes de cargar el esquema: `pgcrypto`, `pg_trgm` (migración de extensiones) y `unaccent`.
3. **Los archivos de Storage no están en la base de datos**; el volcado trae solo sus metadatos.
4. En un contenedor local hay que reemplazar el esquema `auth` base de la imagen por el del volcado; en un proyecto Supabase nuevo ya lo trae GoTrue.

Pendiente del proyecto Pro (DEP-08): verificar respaldos diarios reales, restaurar uno en un proyecto temporal y medir el tiempo (RTO) con el tamaño real de datos. Los pasos ya están en `docs/ekko_runbooks.md` §7.2.

## Móvil y panel

### Panel (NF-05: Modo Caja usable < 3 s)

- Code splitting por ruta: `AdminLayout` y las 8 páginas administrativas se cargan con `React.lazy`; login, Modo Caja e Inactiva siguen en la carga inicial.
- Carga inicial: ~754 kB raw / ~226 kB gzip (antes 822 kB / 237 kB en un solo chunk). El peso está en dependencias (supabase-js, Sentry, react-dom, router), no en las páginas.
- Lighthouse 13.4.1 sobre `vite preview`, `/login`, emulación móvil con 4G lento simulado (3 corridas): score 90–93, LCP 2.5–2.6 s, TBT 50–210 ms, CLS 0.013, peso 267 KiB.
- Modo Caja (Playwright, 1024×768, 5 corridas, mediana) de abrir `/login` a "Generar QR" habilitado tras iniciar sesión: 205 ms sin throttling; **2.56 s** con 4G rápido (1.6 Mbps, 150 ms) y CPU 4×. Cumple.
- `public/_headers`: caché inmutable de un año en `/assets/*`, `no-cache` en `index.html`; el CSP ahora permite `blob:` en `img-src` (las vistas previas de imagen usan `URL.createObjectURL`).

### App móvil (SP-6, SP-1, NF-04, NF-10..12)

- Bundle Hermes: 5.6 MB en Android y en iOS (JS minificado 4.6 MB). Mayores paquetes: Sentry ~1.5 MB en total (incluye `replay` y `feedback`, que no se usan), react-native 673 KB, zod 525 KB, expo-router 476 KB, código propio 168 KB.
- Bloque A (deploy-prep): `metro.config.js` con `getSentryExpoConfig` sin Web Replay ni Feedback → bundle Hermes Android **5.22 MB** (antes 5.64 MB, −417 KB). Lo restante de Sentry son dependencias duras del SDK.
- Reducciones posibles, no aplicadas: `zod/mini` exigiría reescribir los esquemas compartidos con el panel.
- Binario (NF-10, meta < 25 MB): pendiente del build de EAS (DEP-05).
- SP-1: limpieza de caché al iniciar y tope nativo en iOS ya implementados (`src/lib/imageCache.ts`); falta confirmar en dispositivo los nombres de directorio.
- NF-04 Explorar: `FlatList` con `initialNumToRender=4` y `windowSize=7` para no decodificar 10 portadas a la vez; sin medición en dispositivo.
- Manual en dispositivo (release build): NF-04 cronometrar de abrir la app a la primera tarjeta de Explorar con datos limpios; NF-11/NF-12 navegar 30 comercios, revisar el tamaño de `Paths.cache` y que tras reiniciar quede ≤ 20 MB.
