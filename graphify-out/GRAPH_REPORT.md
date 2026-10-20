# Graph Report - ekko  (2026-10-20)

## Corpus Check
- Corpus is ~35,633 words - fits in a single context window. You may not need a graph.

## Summary
- 310 nodes · 700 edges · 13 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.88)
- Token cost: 156,911 input · 0 output

## Community Hubs (Navigation)
- Identidad, privacidad y helpers app
- Registro de visita y tarjeta
- ADRs de infraestructura
- Catálogo de errores E-xx
- Testabilidad, RLS y CI
- Plan, hitos y migraciones
- Auth, verificación y ruleta
- Catálogo y detalle de comercio
- Cupones y canje
- Resolución perezosa (ciclos, cumpleaños, menú)
- Notificaciones push
- QR de visita y Modo Caja
- PIN y sesión administrativa

## God Nodes (most connected - your core abstractions)
1. `Esquema del Backend — Ekko Rewards` - 73 edges
2. `PRD — Ekko Rewards` - 64 edges
3. `AppFlow — Ekko Rewards` - 38 edges
4. `Brief de Diseño UX/UI — Ekko Rewards` - 33 edges
5. `Plan de Implementación — Ekko Rewards` - 29 edges
6. `TRD — Ekko Rewards` - 28 edges
7. `Plan de Pruebas (QA) — Ekko Rewards` - 25 edges
8. `RPC claim_visit` - 20 edges
9. `ADR — Ekko Rewards` - 13 edges
10. `Catálogo de errores E-01 a E-99` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Códigos de canje (6 caracteres, alfabeto de 31, antiadivinación)` --semantically_similar_to--> `RN-62 a RN-65 PIN administrativo (5 fallos, 15 min, 5 min inactividad)`  [INFERRED] [semantically similar]
  docs/ekko_trd.md → docs/ekko_prd.md
- `Edge Function send-push` --semantically_similar_to--> `RR-2 Idempotencia ante reintentos`  [INFERRED] [semantically similar]
  docs/ekko_backend.md → docs/ekko_appflow.md
- `PX-4 Errores que dicen qué hacer` --semantically_similar_to--> `Catálogo de errores E-01 a E-99`  [INFERRED] [semantically similar]
  docs/ekko_brief_ux_ui.md → docs/ekko_appflow.md
- `Definition of Done` --conceptually_related_to--> `Plan de Pruebas (QA) — Ekko Rewards`  [INFERRED]
  docs/ekko_plan_implementacion.md → docs/ekko_plan_qa.md
- `ADR-02 Lógica transaccional en RPC de Postgres` --rationale_for--> `RPC claim_visit`  [INFERRED]
  docs/ekko_adr.md → docs/ekko_backend.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Registro de visita con QR antifraude** — docs_ekko_backend_generate_visit_qr, docs_ekko_backend_claim_visit, docs_ekko_backend_visit_qr_tokens, docs_ekko_backend_realtime_visit_qr, docs_ekko_backend_app_roll_cycle, docs_ekko_backend_app_grant_stamps, docs_ekko_prd_rn_qr60, docs_ekko_prd_rn_17, docs_ekko_adr_adr_07, docs_ekko_appflow_f_08, docs_ekko_appflow_f_21 [EXTRACTED 1.00]
- **Canje de cupones (revelar, validar, confirmar)** — docs_ekko_backend_reveal_coupon_code, docs_ekko_backend_lookup_redemption, docs_ekko_backend_confirm_redemption, docs_ekko_backend_coupons, docs_ekko_backend_merchant_security, docs_ekko_trd_redemption_code_spec, docs_ekko_appflow_f_11, docs_ekko_appflow_f_22 [EXTRACTED 1.00]
- **Eventos de tiempo resueltos de forma perezosa** — docs_ekko_adr_adr_03, docs_ekko_trd_pa_3, docs_ekko_backend_app_roll_cycle, docs_ekko_backend_ensure_birthday_coupons, docs_ekko_prd_rn_56, docs_ekko_adr_adr_13 [INFERRED 0.85]

## Communities (13 total, 0 thin omitted)

### Community 0 - "Identidad, privacidad y helpers app"
Cohesion: 0.07
Nodes (50): ADR-11 Soft delete con anonimización y hashes con pimienta, F-15 Eliminar cuenta, F-20 Inicio de sesión del comercio, F-24 Configuración de tarjeta, Esquema del Backend — Ekko Rewards, RPC interna anonymize_customer, app.current_customer / app.current_merchant, app.grant_stamps (+42 more)

### Community 1 - "Registro de visita y tarjeta"
Cohesion: 0.08
Nodes (39): F-08 Registrar visita, F-10 Tarjeta completada y recompensa, A-13 a A-15 Permiso de cámara, Escáner y Resultado de visita, P-05 Métricas, P-06 Configuración de tarjeta, P-11 Registro de QR, Componente Tarjeta de sellos, DEP-08 Supabase Pro antes del piloto (+31 more)

### Community 2 - "ADRs de infraestructura"
Cohesion: 0.10
Nodes (35): ADR — Ekko Rewards, ADR-01 Supabase como backend único (BaaS), ADR-05 Cloudflare Pages para el panel web, ADR-06 Procesamiento de imágenes en el navegador, ADR-09 Proveedor SMTP externo (Resend o Brevo), ADR-10 Monorepo con pnpm workspaces, ADR-12 Verificación de correo propia, Edge Function email-verification (+27 more)

### Community 3 - "Catálogo de errores E-xx"
Cohesion: 0.09
Nodes (33): AppFlow — Ekko Rewards, E-02/E-03 QR vencido o ya usado, E-04 Límite diario de sellos, E-05 Comercio no disponible, E-06 Correo sin verificar, E-09 Ruleta ya girada, E-12/E-13 Código no encontrado / validador bloqueado, E-14/E-15 PIN incorrecto / bloqueado (+25 more)

### Community 4 - "Testabilidad, RLS y CI"
Cohesion: 0.11
Nodes (23): ADR-02 Lógica transaccional en RPC de Postgres, ADR-13 Reloj controlable para pruebas (app.now), F-02 Registro con correo, app.local_now / app.local_today, Políticas RLS y privilegios por columna, seed.sql (datos de desarrollo y staging), Estrategia de CI/CD (GitHub Actions, EAS, ramas), Definition of Done (+15 more)

### Community 5 - "Plan, hitos y migraciones"
Cohesion: 0.13
Nodes (22): Migraciones 001 a 016, Plan de Implementación — Ekko Rewards, Beta cerrada con comercios piloto, Ruta crítica del plan, DEP-01 Cuenta de Apple Developer adelantada, H1 Primer sello real, H2 Ciclo de recompensa completo, H3 Funcionalidad completa del MVP (+14 more)

### Community 6 - "Auth, verificación y ruleta"
Cohesion: 0.15
Nodes (20): F-03 Login social, F-04 Verificación de correo, F-07 Agregar tarjeta y ruleta de bienvenida, RPC add_card, app.is_email_verified, RPC spin_wheel, Tabla private.wheel_prizes, Tabla wheel_spins (+12 more)

### Community 7 - "Catálogo y detalle de comercio"
Cohesion: 0.12
Nodes (20): F-06 Explorar y abrir un comercio, F-14 Permisos, F-26 Ofertas semanales, RPC get_merchant_detail, RPC list_merchants, Brief de Diseño UX/UI — Ekko Rewards, A-07 Explorar, A-08 a A-11 Detalle de comercio (pestañas) (+12 more)

### Community 8 - "Cupones y canje"
Cohesion: 0.16
Nodes (20): F-11 Canje de cupón o premio, F-22 Validar canje, RR-2 Idempotencia ante reintentos, app.random_code, RPC confirm_redemption, RPC lookup_redemption, RPC reveal_coupon_code, A-19 Código de canje (+12 more)

### Community 9 - "Resolución perezosa (ciclos, cumpleaños, menú)"
Cohesion: 0.20
Nodes (15): ADR-03 Resolución perezosa en lugar de procesos programados, F-12 Cupón de cumpleaños, F-25 Gestión del menú, app.roll_cycle, RPC ensure_birthday_coupons, RPC list_my_cards, P-07/P-08 Menú y formulario de producto, E2E-07 Gestión de menú (+7 more)

### Community 10 - "Notificaciones push"
Cohesion: 0.21
Nodes (12): ADR-04 Expo Push API sin FCM directo, F-27 Enviar notificación push, RPC interna get_push_recipients, RPC interna record_push_result, Edge Function send-push, P-10 Notificaciones push, Persona P3 Lucía (dueña de cafetería), E2E-05 Push con cupón (+4 more)

### Community 11 - "QR de visita y Modo Caja"
Cohesion: 0.26
Nodes (12): ADR-07 QR de visita bajo demanda con enlace universal, F-21 Generar QR de visita, RPC generate_visit_qr, RPC get_qr_status, Realtime sobre visit_qr_tokens, Tabla visit_qr_tokens, P-02 Modo Caja, Persona P4 Kevin (cajero) (+4 more)

### Community 12 - "PIN y sesión administrativa"
Cohesion: 0.42
Nodes (9): ADR-08 Credencial única por comercio con PIN en servidor, F-23 Desbloqueo administrativo y expiración, Tabla private.merchant_admin_sessions, Tabla private.merchant_security, RPC unlock_admin, P-04 Desbloqueo con PIN, E2E-06 Bloqueo de PIN, RN-62 a RN-65 PIN administrativo (5 fallos, 15 min, 5 min inactividad) (+1 more)

## Knowledge Gaps
- **24 isolated node(s):** `Sentry`, `US-04 Multidispositivo`, `US-06 Perfil`, `US-09 Dejar reseña`, `US-12 Ver progreso` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 26 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Esquema del Backend — Ekko Rewards` connect `Identidad, privacidad y helpers app` to `ADRs de infraestructura`, `Catálogo de errores E-xx`, `Testabilidad, RLS y CI`, `Plan, hitos y migraciones`, `Auth, verificación y ruleta`, `Catálogo y detalle de comercio`, `Cupones y canje`, `Resolución perezosa (ciclos, cumpleaños, menú)`, `Notificaciones push`, `QR de visita y Modo Caja`, `PIN y sesión administrativa`?**
  _High betweenness centrality (0.285) - this node is a cross-community bridge._
- **Why does `PRD — Ekko Rewards` connect `Registro de visita y tarjeta` to `Identidad, privacidad y helpers app`, `ADRs de infraestructura`, `Catálogo de errores E-xx`, `Auth, verificación y ruleta`, `Catálogo y detalle de comercio`, `Cupones y canje`, `Resolución perezosa (ciclos, cumpleaños, menú)`, `Notificaciones push`, `QR de visita y Modo Caja`, `PIN y sesión administrativa`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `AppFlow — Ekko Rewards` connect `Catálogo de errores E-xx` to `Identidad, privacidad y helpers app`, `Registro de visita y tarjeta`, `Testabilidad, RLS y CI`, `Auth, verificación y ruleta`, `Catálogo y detalle de comercio`, `Cupones y canje`, `Resolución perezosa (ciclos, cumpleaños, menú)`, `Notificaciones push`, `QR de visita y Modo Caja`, `PIN y sesión administrativa`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `Sentry`, `US-04 Multidispositivo`, `US-06 Perfil` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Identidad, privacidad y helpers app` be split into smaller, more focused modules?**
  _Cohesion score 0.06693877551020408 - nodes in this community are weakly interconnected._
- **Should `Registro de visita y tarjeta` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `ADRs de infraestructura` be split into smaller, more focused modules?**
  _Cohesion score 0.10084033613445378 - nodes in this community are weakly interconnected._