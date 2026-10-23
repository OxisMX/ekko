# Ekko Rewards: runbooks de operación

Guía paso a paso para operadores de Oxis. Cubre los flujos F-30 a F-35 de `docs/ekko_appflow.md` §6 y los procedimientos de plataforma de `docs/ekko_plan_implementacion.md` §7.1 y §7.5. Ejecutar siempre primero en **staging** cuando el cambio no sea urgente.

## 0. Antes de empezar (aplica a todos)

Los scripts viven en `scripts/` y se ejecutan desde la raíz del repo con Node 22+ (`pnpm install` una vez).

| Variable | Qué es | Dónde se obtiene |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) | Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio. **Nunca** en el repo, chat ni tickets | Gestor de secretos de Oxis |
| `SUPABASE_DB_URL` | Cadena de conexión Postgres (contraseña de `postgres`) | Dashboard → Settings → Database |

```bash
# Ejemplo: se exportan en la terminal, no en un archivo versionado
export SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres"
export SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
```

Reglas: confirmar el entorno (staging o producción) leyendo el `<ref>` antes de cada comando; no pegar PIN, contraseñas ni llaves en tickets o chats; cerrar la terminal (o `unset`) al terminar.

---

## 1. Alta de comercio (F-30)

**Cuándo:** contrato firmado y pago del onboarding.

**Prerrequisitos:** datos e imágenes del comercio (logo y portada) y un archivo JSON copiado de `scripts/examples/merchant.example.json`, completado. Variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_DB_URL`.

1. Copiar el ejemplo y llenarlo (guardar fuera del repo, p. ej. `~/altas/<comercio>.json`). El JSON lleva la contraseña inicial (`password`) y el `pin`: generar valores nuevos y fuertes, no los del ejemplo. Subir logo y portada a las rutas `logo_path` / `cover_path` indicadas.
2. **Staging:** `node scripts/onboard-merchant.ts ~/altas/<comercio>.json`. Revisar el comercio en la app de staging.
3. **Producción:** cambiar las variables a producción y repetir el mismo comando. Es idempotente: una segunda ejecución con el mismo archivo no crea otro comercio.
4. El script imprime el id del comercio y el correo de acceso (nunca la contraseña ni el PIN). Entregar al dueño, por el canal acordado, la contraseña inicial y el PIN que pusiste en el JSON, y luego **borrar el archivo JSON**.
5. Capacitar. Después marcar visible: `node scripts/set-merchant-status.ts --merchant <correo> --status active --visible true` (ver §2).

**Verificación:** el comercio aparece en el catálogo de la app; el dueño inicia sesión en el panel y genera un QR.

**Reversión:** si el alta falló a medias, el script elimina el usuario de Auth creado. Si el comercio ya quedó creado y se debe retirar: `set-merchant-status.ts --status inactive --visible false` (no se borran datos).

---

## 2. Vencimiento, desactivación y reactivación (F-31, F-32)

**Reglas:** RN-70 (15 días de gracia después de `paid_until`), RN-71 (un comercio inactivo no genera QR ni administra, pero sí valida canjes ya emitidos), RN-72 (al reactivar, datos y progreso siguen intactos).

**Prerrequisito:** `SUPABASE_DB_URL`.

1. Listar comercios por vencer y vencidos (vista privada, desde Studio → SQL editor):
   ```sql
   select name, subscription_status, paid_until, days_to_due, billing_state, grace_days_left
   from private.merchants_billing order by days_to_due;
   ```
2. Contactar a los comercios por cobrar. Esperar los 15 días de gracia.
3. **Desactivar** (sin pago tras la gracia):
   ```bash
   node scripts/set-merchant-status.ts --merchant <correo|uuid> --status inactive
   ```
   El script cierra las sesiones de PIN abiertas.
4. **Reactivar** (pago recibido), con la nueva fecha de vencimiento:
   ```bash
   node scripts/set-merchant-status.ts --merchant <correo|uuid> --status active --paid-until YYYY-MM-DD
   ```
   Opcional `--visible true|false` para el catálogo.

**Verificación:** el script imprime el resumen (`is_active`, `is_visible`, `paid_until`). El panel vuelve a P-02 al recargar o iniciar sesión.

**Reversión:** ejecutar el comando inverso. No se borra nada.

---

## 3. Restablecer PIN del comercio (F-33)

**Prerrequisito:** `SUPABASE_DB_URL`. Verificar la identidad del dueño por el canal acordado antes de continuar.

1. `node scripts/reset-pin.ts --merchant <correo|uuid>` genera un PIN y lo imprime **una sola vez**. Con `--pin NNNN` se fija uno elegido (no se muestra en pantalla).
2. Comunicar el PIN nuevo por el canal acordado. No dejarlo en historial de chat.

**Efecto:** limpia el bloqueo por intentos fallidos y cierra las sesiones de PIN abiertas (RN-65).

**Verificación:** el dueño desbloquea la sección administrativa del panel con el PIN nuevo.

**Reversión:** repetir el comando para asignar otro PIN; el anterior no se recupera (solo se guarda su hash).

---

## 4. Restablecer contraseña del comercio (F-34)

No hay script; se usa Supabase Auth. Verificar identidad del dueño primero.

**Opción A (preferida, el dueño elige su contraseña):** Studio → Authentication → Users → buscar el correo → menú `...` → *Send password recovery*. Requiere que el SMTP del proyecto funcione (ver DEP de SMTP) y que el dueño acceda a ese correo.

**Opción B (Oxis fija una contraseña temporal):**
```bash
# Obtener el id del usuario: Studio → Authentication → Users (columna UID)
curl -sS -X PUT "$SUPABASE_URL/auth/v1/admin/users/<AUTH_USER_ID>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<NUEVA_CONTRASENA_TEMPORAL>"}' -o /dev/null -w "%{http_code}\n"
```
Debe responder `200`. Pedir al dueño que la cambie al primer ingreso. No se debe pegar la contraseña en tickets.

**Verificación:** el dueño inicia sesión en el panel con la contraseña nueva.

**Reversión:** repetir con otra contraseña. Si hubo error de identidad (se cambió la contraseña de otro comercio), cambiarla de nuevo y avisar al dueño real.

---

## 5. Corrección de fecha de nacimiento (F-35, RN-04)

No hay script (es raro y requiere criterio). El cliente no puede editar la fecha (RN-04); solo soporte.

**Prerrequisitos:** `SUPABASE_DB_URL` y `psql`. Verificar la titularidad del correo del cliente (por ejemplo, que escriba desde esa cuenta o pase una verificación acordada). La nueva fecha debe dar 18 años cumplidos o más.

```bash
psql "$SUPABASE_DB_URL" \
  -v email='cliente@correo.com' -v new_birth='2000-05-14' <<'SQL'
begin;
update public.customers c
set birth_date = :'new_birth'::date
from auth.users u
where u.id = c.auth_user_id
  and lower(u.email) = lower(:'email')
  and c.status = 'active'
  and :'new_birth'::date + interval '18 years' <= app.local_today()
returning c.id, c.first_name, c.birth_date as new_birth_date;
-- Debe devolver exactamente 1 fila. Si devuelve 0 filas, no se cambió nada: ROLLBACK.
commit;
SQL
```

Antes de ejecutar, anotar el valor anterior (`select birth_date from public.customers c join auth.users u on u.id = c.auth_user_id where lower(u.email) = lower('<correo>');`) en el ticket de soporte: no existe tabla de auditoría.

Si el `returning` mostró 0 filas (correo inexistente, cuenta eliminada o menor de 18), el `commit` no hace daño porque no hubo cambios. Si la fila no es la esperada, ejecutar `rollback;` en lugar de `commit;` (usar sesión interactiva de `psql` en vez del bloque anterior).

**Efecto lateral:** el beneficio de cumpleaños sigue el mes de `birth_date`. Un cambio de mes puede permitir un cupón de cumpleaños más en el año (el índice único es por cliente, comercio y año). Es aceptable.

**Verificación:** repetir el `select` de `birth_date`; el cliente ve el valor correcto en su perfil.

**Reversión:** el mismo `update` con la fecha anterior anotada en el ticket.

---

## 6. Limpieza de imágenes huérfanas

**Cuándo:** mensual (backend §7). Borra archivos de `merchant-media` que ninguna fila referencia y con más de 24 h.

**Prerrequisitos:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.

1. Simulación (no borra nada): `node scripts/clean-orphan-media.ts`. Revisar la lista y el conteo; si hay un número inesperadamente alto, parar y escalar.
2. Ejecución: `node scripts/clean-orphan-media.ts --apply`.

**Verificación:** repetir la simulación: debe listar 0.

**Reversión:** un archivo borrado no se recupera desde Ekko; el comercio puede subir la imagen de nuevo. Por eso siempre se hace la simulación antes.

---

## 7. Restaurar un respaldo

Hay tres niveles. El ensayo local (§7.1) está **hecho**; lo que depende del proyecto Pro (DEP-08) está marcado **PENDIENTE DE PRO**.

**Principio:** nunca restaurar encima de producción sin antes haber verificado el respaldo en un proyecto temporal. Restaurar solo ante pérdida o corrupción de datos; un error de código se corrige con una migración hacia adelante (§8).

### 7.1 Ensayo local (ejecutado, sirve de guía exacta)

Resultado del ensayo del 2026-10-22: base local con 1.3 M filas (dataset de rendimiento) restaurada en un contenedor Postgres nuevo (imagen `public.ecr.aws/supabase/postgres:17.11.0.004`, igual que Supabase local). Conteos de 12 tablas, 3 invariantes y sumas de verificación de `stamps` y `coupons` **idénticos** a los de origen. Única diferencia: Vault (la pimienta), que el volcado **no incluye**.

1. Volcar (3 archivos; contienen datos personales y hashes de contraseñas: guardarlos cifrados y no en el repo):
   ```bash
   # Esquemas (incluye auth y storage para respetar las FK a auth.users)
   pnpm supabase db dump --db-url "$SUPABASE_DB_URL_ENC" -s auth,storage,public,app,private,rls -f schema.sql
   # Datos (COPY es mucho más rápido que INSERT)
   pnpm supabase db dump --db-url "$SUPABASE_DB_URL_ENC" --data-only --use-copy -f data.sql
   ```
   (`--local` en lugar de `--db-url` para la base local; `SUPABASE_DB_URL_ENC` es la URL con la contraseña codificada como porcentaje.) El volcado de datos incluye `auth` y `storage` (metadatos), pero excluye `vault`, `extensions`, `realtime` y `supabase_migrations`.
2. Crear el destino limpio (local: contenedor desechable; en la nube: proyecto temporal, ver §7.2):
   ```bash
   docker run -d --name ekko-restore-drill -e POSTGRES_PASSWORD=drill -p 127.0.0.1:54999:5432 public.ecr.aws/supabase/postgres:17.11.0.004
   ```
3. Preparar y cargar (como `supabase_admin`, porque `auth` y `storage` pertenecen a roles de plataforma):
   ```bash
   P="docker exec -i ekko-restore-drill psql -U supabase_admin -d postgres -q"
   echo "drop schema auth cascade; drop schema storage cascade;" | $P     # solo el contenedor: trae un auth base incompleto
   cat supabase/migrations/20261020192150_extensions.sql | $P            # extensiones
   echo "create extension if not exists unaccent with schema extensions;" | $P
   $P < schema.sql        # 0 errores esperados
   $P < data.sql          # solo errores de supabase_functions (esquema de webhooks, irrelevante)
   ```
4. Restaurar la **pimienta** (Vault no viaja en el volcado): `select vault.create_secret('<PIMIENTA>', 'hash_pepper');` con el valor guardado en el gestor de secretos de Oxis. Sin la pimienta original, los `device_hash` y `email_hash` de la ruleta (RN-07, RN-09) dejan de coincidir. **Guardar la pimienta de producción fuera de Supabase** (gestor de secretos).
5. Verificar (conteos, invariantes y sumas): `docs/ekko_rendimiento.md` §Respaldo lista las consultas; las principales:
   ```sql
   -- debe dar 0: ciclos cuyo stamps_count no coincide con sus sellos reales
   select count(*) from public.card_cycles c
   where c.stamps_count <> (select count(*) from public.stamps s where s.cycle_id = c.id);
   -- debe dar 0: más de un ciclo activo por relación
   select count(*) from (select 1 from public.card_cycles where status = 'active' group by customer_id, merchant_id having count(*) > 1) x;
   ```
   Comparar además `count(*)` de `auth.users`, `customers`, `merchants`, `customer_merchants`, `card_cycles`, `stamps`, `coupons`, `visit_qr_tokens` contra el origen.
6. Limpiar: `docker rm -f ekko-restore-drill` y borrar los archivos del volcado.

### 7.2 Producción con respaldos de Supabase Pro (PENDIENTE DE PRO, DEP-08)

No ensayado: requiere el proyecto Pro. Hacer el ensayo antes del lanzamiento (checklist §7.1 del plan) y completar aquí lo que difiera.

Prerrequisito: Supabase Pro con respaldos diarios (y PITR si se contrata). Confirmar en Dashboard → Database → Backups que hay respaldos recientes.

1. **Declarar el incidente:** anotar hora, alcance (qué tablas, qué comercios) y último momento conocido bueno.
2. **Proyecto temporal:** crear un proyecto Supabase nuevo (mismo plan/región). Restaurar ahí el respaldo del día que corresponda (Dashboard → Backups; si la opción *restore to new project* no está disponible en el plan, usar el volcado lógico de §7.1 tomado con `--db-url` desde producción, o el archivo de respaldo descargable).
3. **Verificar** en el temporal con las consultas de §7.1 paso 5; confirmar que los datos faltantes o corruptos están ahí en su estado bueno. Cargar la pimienta de Vault.
4. **Elegir cutover:**
   - *Copia selectiva (preferida para pérdida parcial):* exportar solo las filas afectadas del temporal (`COPY (select ...) TO` / `\copy`) e importarlas en producción dentro de una transacción. No tocar `auth.users` salvo que sea el dato perdido.
   - *Cutover completo (pérdida total):* restaurar el respaldo sobre producción desde el Dashboard (hay interrupción del servicio), o apuntar apps y panel al proyecto temporal cambiando URL y llaves (requiere publicar una actualización OTA y redeploy del panel; los dominios y secretos de Edge Functions también cambian). Es la opción de último recurso.
5. **Después del cutover:** regenerar tipos solo si cambió el esquema; probar un flujo completo (alta de tarjeta, QR, sello, canje); revisar Sentry; anotar el postmortem.
6. **Storage:** los respaldos de base de datos **no incluyen los archivos** de los buckets (`merchant-media`, imágenes de menú), solo sus metadatos. Si se pierden, el comercio vuelve a subir sus imágenes. Valorar una copia periódica del bucket (S3 de Supabase Storage compatible con rclone) cuando haya comercios reales.

**Reversión del propio procedimiento:** el proyecto original no se borra hasta cerrar el incidente y confirmar al menos 7 días.

---

## 8. Revertir una versión

### 8.1 App móvil, JavaScript (EAS Update)

**Prerrequisito:** sesión de Expo con permisos del proyecto (`eas login`).

1. Ver las actualizaciones del canal: `eas update:list --branch production`.
2. Republicar la anterior sana: `eas update:republish --branch production --group <ID_GRUPO_ANTERIOR>` (o `eas update:rollback` para volver al binario embebido, solo si se entiende que ignora todas las actualizaciones OTA).
3. **Verificar:** abrir la app dos veces (la primera descarga, la segunda aplica) y comprobar la versión/hash en Ajustes o en Sentry.

**Límite:** un defecto en código nativo no se revierte por OTA; requiere una nueva versión en las tiendas.

### 8.2 Panel (Cloudflare Pages)

1. Cloudflare → Workers & Pages → proyecto del panel → *Deployments*.
2. En el despliegue anterior sano: `...` → *Rollback to this deployment* (inmediato).
3. **Verificar:** el hash de commit en el pie del panel corresponde al despliegue anterior; iniciar sesión y generar un QR.

### 8.3 Base de datos

Las migraciones ya fusionadas **nunca se editan ni se borran**. La corrección es una **migración nueva hacia adelante**:

1. Crear `supabase/migrations/<timestamp>_fix_<tema>.sql` que deshaga o corrija el cambio (por ejemplo `drop index ...`, `create or replace function ...` con la versión anterior).
2. Probar en local (`pnpm db:reset && pnpm db:test`), luego PR, staging y producción por el flujo normal.
3. Solo ante pérdida de datos se usa §7.

### 8.4 Edge Functions

Redesplegar la versión anterior desde Git: `git checkout <tag-o-commit-anterior> -- supabase/functions/<funcion>` en una rama, luego `pnpm supabase functions deploy <funcion> --project-ref <ref>`.

---

## 9. Incidentes de push

Las campañas las envía la Edge Function `send-push` (Expo Push API, lotes). Cada comercio tiene **5 campañas por mes** (mes local).

### 9.1 El comercio dice que se agotó la cuota

1. Consultar el uso del mes en Studio → SQL:
   ```sql
   select status, title, recipients_count, sent_count, failed_count, created_at
   from public.push_campaigns where merchant_id = '<MERCHANT_UUID>'
     and local_month = date_trunc('month', timezone('America/Mexico_City', now()))::date
   order by created_at;
   ```
2. La cuota se reinicia el primer día del mes. No se amplía por SQL: es una regla de negocio (RN). Si por error del sistema una campaña quedó en `failed` sin enviarse, se escala a desarrollo (no borrar filas a mano: la cuenta de la cuota se calcula sobre ellas).

### 9.2 Muchos envíos fallidos o tokens inválidos

Expo responde `DeviceNotRegistered` para dispositivos que desinstalaron la app; `send-push` ya los limpia (`record_push_result` pone `expo_push_token = null`). Qué revisar:

1. Un `failed_count` alto en una campaña reciente es normal si hay muchos tokens viejos; no se reintenta.
2. Si `sent_count = 0` y `failed_count = recipients_count`: probable fallo de Expo o credenciales. Revisar los logs de la función (Dashboard → Edge Functions → `send-push` → Logs), el estado de Expo (status.expo.dev) y que el secreto `EXPO_ACCESS_TOKEN` siga vigente (`supabase secrets list` muestra solo nombres).
3. Si Expo está caído: informar al comercio; la campaña **no se reenvía automáticamente**. El comercio puede enviar otra solo si le queda cuota.
4. Credenciales APNs vencidas (iOS sin entregas): renovar con `eas credentials` y verificar con un dispositivo propio.

**Verificación:** enviar una campaña de prueba desde un comercio de pruebas con un dispositivo propio registrado.

---

## 10. Consultar KPIs

Vistas del esquema `private` (backend §9). No tienen acceso desde la API; se leen desde Studio → SQL editor o `psql "$SUPABASE_DB_URL"`.

| Vista | Qué responde |
|---|---|
| `private.kpi_merchants` | Comercios activos y visibles por mes de alta |
| `private.kpi_customers` | Clientes registrados activos |
| `private.kpi_weekly_stamps` | Sellos de visita por semana (lunes) |
| `private.kpi_reward_redemption` | Canje de premios de tarjeta (`redeemed`, `issued_closed`, `redemption_pct`) |
| `private.kpi_coupon_redemption` | Canje de cupones de ruleta, push y cumpleaños |
| `private.merchants_billing` | Comercios por vencer o vencidos y días de gracia (F-31) |

```sql
select * from private.kpi_weekly_stamps order by week_start desc limit 12;
select * from private.kpi_reward_redemption;
```

Son consultas de lectura completa (con 600 mil sellos tardan decenas de ms); correrlas a demanda, no en bucle. Revisión semanal durante la beta (plan §7.4).
