# Registro de Decisiones Arquitectónicas (ADR) — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Documento | Architecture Decision Records |
| Versión | 1.0 |
| Fecha | 20 de octubre de 2026 |
| Documentos base | ekko_prd.md 1.0, ekko_trd.md 1.1, ekko_backend.md 1.0, ekko_plan_qa.md 1.0 |

---

## Índice

| ADR | Título | Estado |
|---|---|---|
| ADR-01 | Supabase como backend único (BaaS) | Aceptado |
| ADR-02 | Lógica transaccional en funciones RPC de Postgres | Aceptado |
| ADR-03 | Resolución perezosa en lugar de procesos programados | Aceptado |
| ADR-04 | Expo Push API sin integración directa con FCM | Aceptado |
| ADR-05 | Cloudflare Pages para el panel web | Aceptado |
| ADR-06 | Procesamiento de imágenes en el navegador | Aceptado |
| ADR-07 | QR de visita bajo demanda con enlace universal | Aceptado |
| ADR-08 | Credencial única por comercio con PIN validado en servidor | Aceptado |
| ADR-09 | Proveedor SMTP externo | Propuesto |
| ADR-10 | Monorepo con pnpm workspaces | Aceptado |
| ADR-11 | Soft delete con anonimización y hashes con pimienta | Aceptado |
| ADR-12 | Verificación de correo propia | Propuesto (sujeto a SP-7) |
| ADR-13 | Reloj controlable para pruebas | Aceptado |

Estados posibles: **Propuesto**, **Aceptado**, **Reemplazado por ADR-xx**, **Obsoleto**.

---

## ADR-01 — Supabase como backend único (BaaS)

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** documento inicial, respuestas 35, 40, 43

**Contexto.** Equipo de 4 personas a tiempo parcial, presupuesto inicial mínimo y un dominio de datos relacional (clientes, comercios, ciclos, sellos, cupones). Se necesitan autenticación con proveedores sociales, almacenamiento de imágenes y notificaciones de cambios en tiempo real para el panel.

**Decisión.** Usar Supabase (Postgres, Auth, Storage, Realtime y Edge Functions) como único backend, sin servidor propio.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Backend propio (Node/NestJS) + Postgres administrado | Más código, más infraestructura y costo de hosting desde el día uno. |
| Firebase (Firestore) | Modelo NoSQL poco adecuado para reglas transaccionales con restricciones únicas y concurrencia. |

**Consecuencias.**
- Positivas: autenticación, archivos y tiempo real listos; Postgres completo con transacciones, índices y RLS; capa gratuita para desarrollo y staging.
- Negativas: dependencia de un proveedor; ciertas funciones (respaldos, transformación de imágenes) requieren plan Pro; límites de la capa gratuita (pausa por inactividad) en staging.
- Mitigación: esquema reproducible por migraciones y lógica en SQL estándar, portable a otro Postgres.

---

## ADR-02 — Lógica transaccional en funciones RPC de Postgres

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 2, B.1

**Contexto.** Las reglas críticas (QR de un solo uso, límite diario, ciclos, ruleta, canjes, PIN, cuotas de push) deben ser atómicas y resistentes a fraude y concurrencia. El documento de rendimiento sugería Edge Functions para todo, y la respuesta 43 las limitaba.

**Decisión.** Implementar toda la lógica transaccional en funciones PL/pgSQL `SECURITY DEFINER` expuestas como RPC, con RLS en todas las tablas y sin escritura directa de los clientes. Las Edge Functions se reservan para integraciones externas.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Edge Functions para toda la lógica | Latencia adicional, transacciones menos directas y más superficie de código. |
| Lógica en el cliente con RLS | Inseguro para reglas antifraude. |

**Consecuencias.**
- Positivas: atomicidad con bloqueos de fila e índices únicos; una sola fuente de verdad; menos viajes de red.
- Negativas: mayor dependencia de habilidades en SQL; depuración menos amigable que TypeScript.
- Mitigación: pruebas pgTAP obligatorias por RPC (Plan de QA); convenciones de `search_path` y contrato de errores E-xx.

---

## ADR-03 — Resolución perezosa en lugar de procesos programados

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 23, B.2

**Contexto.** Hay eventos dependientes del tiempo: vencimiento de ciclos, vencimiento de cupones, cupones de cumpleaños, "agotado por hoy", cuota mensual de push. Se decidió evitar procesos en segundo plano.

**Decisión.** Evaluar cada evento cuando se lee u opera el dato: los ciclos se reinician al consultar la tarjeta o registrar visita; los cupones derivan su vigencia de `expires_at`; el cupón de cumpleaños se crea al abrir la app; el agotado se guarda como fecha.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| `pg_cron` o tareas programadas | Más piezas que operar y monitorear; fallas silenciosas. |

**Consecuencias.**
- Positivas: sin infraestructura adicional; resultados siempre consistentes al momento de consultar.
- Negativas: los datos "en reposo" pueden estar desactualizados (un ciclo vencido sigue marcado `active` hasta que alguien lo consulta), lo que obliga a que las métricas y vistas calculen estados derivados; el cupón de cumpleaños no se crea si el cliente no abre la app ese mes.
- Mitigación: métricas calculadas con la misma lógica derivada; aceptado como comportamiento de producto.

---

## ADR-04 — Expo Push API sin integración directa con FCM

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuesta 24

**Contexto.** El documento inicial mencionaba FCM junto con Expo. Expo ya entrega a FCM y APNs.

**Decisión.** Enviar todas las notificaciones mediante Expo Push API desde la Edge Function `send-push`.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| FCM directo (y APNs vía FCM) | Más configuración y código sin beneficio para envíos masivos simples. |

**Consecuencias.**
- Positivas: un solo API y un solo tipo de token para ambas plataformas.
- Negativas: dependencia de Expo como intermediario; sin consulta diferida de receipts en el MVP.
- Mitigación: depuración de tokens con los tickets de cada envío.

---

## ADR-05 — Cloudflare Pages para el panel web

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuesta A.1 (reemplaza la respuesta 42)

**Contexto.** El plan gratuito de Vercel no permite uso comercial. El panel es una SPA estática y el DNS de `oxis.mx` ya está en Cloudflare.

**Decisión.** Publicar el panel, la página `/v/:token` y los archivos `.well-known` en Cloudflare Pages, con `ekko.oxis.mx` (producción) y `staging.ekko.oxis.mx` (staging).

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Vercel Pro | Costo mensual por usuario sin necesidad de SSR. |
| Autoalojamiento | Operación adicional. |

**Consecuencias.**
- Positivas: sin costo, uso comercial permitido, DNS en la misma cuenta, previsualizaciones por rama y reversión inmediata.
- Negativas: los archivos de enlaces universales requieren configurar el tipo de contenido con `_headers` (validado en SP-2).

---

## ADR-06 — Procesamiento de imágenes en el navegador

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuesta A.2

**Contexto.** La transformación de imágenes de Supabase Storage requiere el plan Pro, y la meta de peso de la app exige imágenes ligeras.

**Decisión.** El panel recorta, redimensiona y convierte cada imagen a WebP (respaldo a JPEG) en el navegador, genera 2 variantes por tipo y las sube con nombres inmutables.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Transformación al vuelo de Supabase | Requiere plan Pro. |
| Edge Function de procesamiento | Costo de cómputo y complejidad. |

**Consecuencias.**
- Positivas: sin costo; imágenes optimizadas desde el origen; caché HTTP de larga duración.
- Negativas: la calidad depende del navegador (Safari de iPad, SP-5); más almacenamiento por guardar variantes.
- Mitigación: respaldo a JPEG; script de limpieza de huérfanos.

---

## ADR-07 — QR de visita bajo demanda con enlace universal

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 8, 3.1 (ronda 3), punto 1 y 14 (ronda 4)

**Contexto.** Un QR que rota continuamente y queda visible permite sellos sin compra. Además, conviene que un cliente sin la app pueda descargarla al escanear.

**Decisión.** El cajero genera el QR después de cobrar. El QR vence a los 60 s o al primer uso, se guarda solo su hash y contiene `https://ekko.oxis.mx/v/<token>`. El escáner de la app es global.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| QR rotativo permanente | Permite sellos sin compra. |
| QR estático por comercio | Sin control antifraude. |
| Cliente muestra QR y cajero escanea | Requiere cámara en caja y cambia el flujo aprobado. |
| Validación de distancia GPS | Descartada (respuesta B.9). |

**Consecuencias.**
- Positivas: el cajero controla cuándo se otorga un sello; un QR fotografiado pierde valor en 60 s; la cámara nativa sirve como canal de descarga.
- Negativas: un paso más para el cajero; riesgo residual de reenvío dentro de los 60 s (aceptado, R-01).

---

## ADR-08 — Credencial única por comercio con PIN validado en servidor

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 2, B.7, 5 (ronda 3)

**Contexto.** Se decidió no tener roles múltiples; el personal de caja comparte la credencial, pero no debe editar el menú ni enviar push.

**Decisión.** Una sola cuenta por comercio. El Modo Caja es la vista por defecto; las secciones administrativas requieren un PIN de 4 dígitos con hash bcrypt, bloqueo de 15 min tras 5 fallos y una sesión administrativa por dispositivo con expiración deslizante de 5 min, todo validado en el servidor.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Roles dueño, gerente, cajero | Fuera de alcance del MVP. |
| PIN validado solo en el cliente | Trivial de eludir. |

**Consecuencias.**
- Positivas: separación práctica de funciones sin gestión de usuarios.
- Negativas: el personal puede generar QR fuera del local con la contraseña; sin trazabilidad por persona.
- Mitigación: registro de QR visible al dueño; la contraseña puede cambiarse por Oxis.

---

## ADR-09 — Proveedor SMTP externo

**Estado:** Propuesto · **Fecha:** 20/10/2026 · **Origen:** respuesta A.4

**Contexto.** El servicio de correo integrado de Supabase está limitado a unos pocos correos por hora para todo el proyecto, insuficiente para verificación y recuperación de contraseña.

**Decisión propuesta.** Configurar un proveedor SMTP con capa gratuita, a elegir entre Resend y Brevo en el Sprint 0, con el dominio `oxis.mx` y registros SPF, DKIM y DMARC en Cloudflare.

**Criterios de elección.**
| Criterio | Peso |
|---|---|
| Límite diario y mensual de la capa gratuita vigente | Alto |
| API HTTP para la Edge Function `email-verification` además de SMTP | Alto |
| Facilidad de verificación del dominio en Cloudflare | Medio |
| Entregabilidad a Gmail y Outlook | Alto |
| Plantillas en español | Bajo |

**Consecuencias.** Dependencia de un proveedor adicional y de la configuración de DNS; desbloquea la recuperación de contraseña y la verificación propia (ADR-12).

---

## ADR-10 — Monorepo con pnpm workspaces

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 40, B.14

**Contexto.** App, panel, backend y scripts comparten tipos, esquemas de validación y constantes de reglas.

**Decisión.** Un solo repositorio independiente con `apps/mobile`, `apps/panel`, `packages/shared`, `supabase/` y `scripts/`, gestionado con pnpm workspaces. Los tipos de la base de datos se generan con Supabase CLI y se publican en `packages/shared`.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Repositorios separados | Duplicación de tipos y versiones desalineadas. |
| Turborepo o Nx | Se agrega solo si los tiempos de CI lo justifican. |

**Consecuencias.**
- Positivas: cambios de esquema, RPC, app y panel en un solo PR; CI unificado.
- Negativas: configuración de Metro (React Native) para resolver paquetes del monorepo.

---

## ADR-11 — Soft delete con anonimización y hashes con pimienta

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** respuestas 38, B.6

**Contexto.** Apple y Google exigen eliminar la cuenta desde la app; la legislación de datos personales exige cancelar datos; el negocio necesita evitar que alguien elimine y recree cuentas para repetir la ruleta.

**Decisión.** Al eliminar: borrar datos personales, tokens y cupones activos; eliminar el usuario de Auth; conservar historial anónimo y hashes SHA-256 con pimienta (guardada en Vault) del correo y del dispositivo para bloquear giros repetidos.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Borrado físico total | Permite abuso de la ruleta. |
| Desactivar sin anonimizar | Incumple la eliminación de datos personales. |
| Hash sin pimienta | Un correo conocido se podría verificar contra la base. |

**Consecuencias.**
- Positivas: cumplimiento de tiendas, control antiabuso, métricas históricas intactas.
- Negativas: la conservación de hashes debe declararse en el aviso de privacidad y validarse con asesoría legal (tarea pendiente del PRD 12.1); la revocación de Apple requiere reautenticación previa.

---

## ADR-12 — Verificación de correo propia

**Estado:** Propuesto (sujeto al spike SP-7) · **Fecha:** 20/10/2026 · **Origen:** Esquema del Backend 6.3

**Contexto.** La regla RN-05 permite registrar sellos antes de verificar el correo, pero exige verificación para ruleta y canjes. Si la confirmación obligatoria de Supabase Auth impide iniciar sesión hasta verificar, el primer sello en caja sería imposible.

**Decisión propuesta.** Desactivar la confirmación obligatoria de Supabase Auth y verificar el correo con la Edge Function `email-verification` y la columna `customers.email_verified_at`. Las cuentas de Google y Apple se consideran verificadas.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|
| Confirmación nativa obligatoria | Bloquea el primer sello en caja. |
| Sin verificación | Debilita el control de cuentas falsas (respuesta 4, ronda 3). |
| Opción nativa con sesión previa a la confirmación | Se adopta si SP-7 confirma que existe; en ese caso este ADR pasa a Obsoleto. |

**Consecuencias.**
- Positivas: cumple RN-05 sin fricción en caja.
- Negativas: una Edge Function y una tabla adicionales; la plantilla de correo de verificación se mantiene fuera de Supabase Auth.

---

## ADR-13 — Reloj controlable para pruebas

**Estado:** Aceptado · **Fecha:** 20/10/2026 · **Origen:** Plan de QA, requisito RQ-1

**Contexto.** Gran parte de las reglas dependen del tiempo (60 s, 48 h, 30 días, 3 a 12 meses, cambio de día y de mes en `America/Mexico_City`). Sin control del reloj, esas pruebas serían lentas o imposibles.

**Decisión.** Todas las funciones usan `app.now()` en lugar de `now()`. En los entornos local y de prueba, `app.now()` respeta el ajuste de sesión `app.fake_now`; en staging y producción lo ignora.

**Consecuencias.**
- Positivas: pruebas deterministas y rápidas de todas las reglas de tiempo.
- Negativas: disciplina de código; un uso directo de `now()` rompe la testabilidad.
- Mitigación: prueba de inventario en CI que falla si una función de los esquemas `public` o `app` llama a `now()` directamente.

---

## Plantilla para nuevos ADR

```markdown
## ADR-XX — Título

**Estado:** Propuesto · **Fecha:** dd/mm/aaaa · **Origen:** documento o conversación

**Contexto.** Problema y restricciones.

**Decisión.** Qué se decide, en una o dos frases.

**Alternativas consideradas.**
| Alternativa | Motivo de descarte |
|---|---|

**Consecuencias.**
- Positivas:
- Negativas:
- Mitigación:
```

Reglas del registro:
- Un ADR aceptado no se edita; si la decisión cambia, se crea uno nuevo y el anterior pasa a "Reemplazado por ADR-xx".
- Los ADR viven en `docs/adr/` del repositorio, un archivo por decisión, con este documento como índice.
