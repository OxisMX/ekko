# Graph Report - ekko  (2026-10-21)

## Corpus Check
- 308 files · ~176,924 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2157 nodes · 4808 edges · 139 communities (101 shown, 38 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.86)
- Token cost: 194,106 input · 0 output

## Community Hubs (Navigation)
- Push y notificaciones (app)
- Auth UI y botones
- Contexto auth panel
- Esquema backend y RPCs
- Sellos, ciclos y ruleta (SQL)
- QR de visita (panel)
- Tests cumpleaños
- Recuperación y perfil inicial
- Escáner de visita
- Detalle de comercio
- Deps app móvil
- E2E admin panel
- Login app
- ADRs de plataforma y riesgos
- Tarjeta de comercio (catálogo)
- Layout administrativo
- Config. de tarjeta (panel)
- Errores y canje
- Mis Tarjetas
- Deps panel
- AuthProvider panel
- Resultado de canje
- Registro y perfil
- Desbloqueo admin PIN
- Banner de verificación
- AppFlow F-01..F-08
- Alta de comercio
- Pipeline de imágenes
- Config móvil
- Esquemas zod auth
- Registro de dispositivo
- Catálogo paginado
- Almacenamiento cifrado
- PanelGate
- tsconfig panel
- Deps scripts
- Paquete shared
- Visita pendiente (deep link)
- StampCard
- ADRs de auth y correo
- Plan de implementación
- Categorías e imágenes de comercio
- Índices SQL
- Detalle y agregar tarjeta
- Comercio inactivo y vencimiento
- ref_node_assert
- tsconfig.node.json
- ADR-07 QR de visita bajo demanda con enl
- package.json
- 13_redemption.test.sql
- [merchantId].tsx
- coupon/[id].tsx
- app/_layout.tsx
- redemptions.tsx
- prizeAnnouncement()
- mobile/src/auth/AuthProvider.tsx
- gate.ts
- dependencies
- AdminPlaceholderPage()
- Clave de idempotencia de campaña push
- 10_claim_visit.test.sql
- CardRow.tsx
- devDependencies
- public.menu_categories
- scripts/tsconfig.json
- 14_wheel.test.sql
- 15_admin_unlock.test.sql
- AdminUnlock.test.tsx
- ADR-03 Resolución perezosa en lugar de p
- ADR-13 Reloj controlable para pruebas
- F-21 Generar QR de visita
- index.tsx
- myCards.ts
- rules.ts
- account.ts
- screens.test.tsx
- appError.ts
- mobile/tsconfig.json
- auth
- ADR-11 Soft delete con anonimización y h
- 20261027000000_wheel_admin_rpc.sql
- devDependencies
- VisitResultScreen()
- AuthProvider.test.tsx
- auth.mfa_amr_claims
- claim_visit RPC
- 20261021002226_rewards_tables.sql
- 08_merchant_detail.test.sql
- 11_my_cards.test.sql
- tsconfig.base.json
- Button.test.tsx
- ADR-04 Expo Push API sin FCM directo
- storage.objects
- 20261021002224_loyalty_tables.sql
- 20261021002228_catalog_tables.sql
- 20261028000000_card_config_storage.sql
- (tabs)/_layout.tsx
- webCrypto.ts
- 20261026000000_redemption_rpc.sql
- 12_card_rules.test.sql
- 16_card_config.test.sql
- 18_birthday.test.sql
- scripts
- app.config.ts
- .oxlintrc.json
- 20261024000000_claim_visit.sql
- 19_profile.test.sql
- mobile/eslint.config.js
- scripts
- ADR-02 Lógica transaccional en RPC de Po
- devDependencies
- 20261021013057_customer_account_rpc.sql
- 20261022000000_catalog_rpc.sql
- 20261022000100_catalog_rls.sql
- 20261025000000_my_cards_rpc.sql
- 07_catalog.test.sql
- CodeField()
- dev-tunnel.sh
- 20261021002237_merchant_session_rpc.sql
- 20261023000000_card_cycle.sql
- tc044_claim_visit.sh
- panel/tsconfig.json
- 03_app_functions.test.sql
- 09_visit_qr.test.sql
- globals.d.ts
- dev-visit-qr.sh
- Mapa de navegación app móvil

## God Nodes (most connected - your core abstractions)
1. `Esquema del Backend — Ekko Rewards` - 80 edges
2. `react-native` - 71 edges
3. `PRD — Ekko Rewards` - 64 edges
4. `colors` - 46 edges
5. `Button()` - 45 edges
6. `TRD — Ekko Rewards` - 39 edges
7. `toAppError()` - 37 edges
8. `spacing` - 37 edges
9. `textStyles` - 36 edges
10. `@testing-library/react-native` - 35 edges

## Surprising Connections (you probably didn't know these)
- `README Ekko Rewards` --references--> `Gestión de migraciones (agregar antes de quitar)`  [INFERRED]
  README.md → docs/ekko_plan_implementacion.md
- `Códigos de canje (6 caracteres, alfabeto de 31, antiadivinación)` --semantically_similar_to--> `RN-62 a RN-65 PIN administrativo (5 fallos, 15 min, 5 min inactividad)`  [INFERRED] [semantically similar]
  docs/ekko_trd.md → docs/ekko_prd.md
- `StampCard()` --calls--> `stampGridRows()`  [EXTRACTED]
  apps/mobile/src/components/card/StampCard.tsx → packages/shared/src/stamps.ts
- `isoWeekdayInMexico()` --calls--> `localToday()`  [EXTRACTED]
  apps/mobile/src/components/format.ts → packages/shared/src/auth.ts
- `toMerchantCard()` --calls--> `merchantImageUrl()`  [EXTRACTED]
  apps/mobile/src/features/catalog/catalog.ts → packages/shared/src/catalog.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Canje de cupones (revelar, validar, confirmar)** — docs_ekko_backend_reveal_coupon_code, docs_ekko_backend_lookup_redemption, docs_ekko_backend_confirm_redemption, docs_ekko_backend_coupons, docs_ekko_backend_merchant_security, docs_ekko_trd_redemption_code_spec, docs_ekko_appflow_f_11, docs_ekko_appflow_f_22 [EXTRACTED 1.00]
- **Registro de visita con QR antifraude** — docs_ekko_backend_generate_visit_qr, docs_ekko_backend_claim_visit, docs_ekko_backend_visit_qr_tokens, docs_ekko_backend_realtime_visit_qr, docs_ekko_backend_app_roll_cycle, docs_ekko_backend_app_grant_stamps, docs_ekko_prd_rn_qr60, docs_ekko_prd_rn_17, docs_ekko_adr_adr_07, docs_ekko_appflow_f_08, docs_ekko_appflow_f_21 [EXTRACTED 1.00]
- **Eventos de tiempo resueltos de forma perezosa** — docs_ekko_adr_adr_03, docs_ekko_trd_pa_3, docs_ekko_backend_app_roll_cycle, docs_ekko_backend_ensure_birthday_coupons, docs_ekko_prd_rn_56, docs_ekko_adr_adr_13 [INFERRED 0.85]
- **Flujo de registro de visita con QR** — docs_ekko_backend_generate_visit_qr, docs_ekko_backend_claim_visit, docs_ekko_backend_visit_qr_tokens, docs_ekko_backend_realtime_visit_qr, docs_ekko_backend_app_roll_cycle, docs_ekko_backend_app_grant_stamps [EXTRACTED 1.00]
- **Flujo de canje de cupón** — docs_ekko_backend_reveal_coupon_code, docs_ekko_backend_lookup_redemption, docs_ekko_backend_confirm_redemption, docs_ekko_backend_merchant_security [EXTRACTED 1.00]
- **Verificación de correo OTP nativa** — docs_ekko_adr_adr_14, docs_ekko_spikes_sp_7, docs_ekko_backend_trigger_email_verification, docs_ekko_backend_app_is_email_verified, docs_ekko_adr_adr_09 [EXTRACTED 1.00]
- **Operación en caja: QR de visita y validación de canje** — docs_ekko_appflow_modo_caja, docs_ekko_appflow_f_21, docs_ekko_appflow_f_22, docs_ekko_appflow_claim_visit, docs_ekko_appflow_confirm_redemption, docs_ekko_appflow_rr_2_idempotencia [INFERRED 0.85]
- **Operación Oxis por scripts de comercio** — scripts_onboard_merchant, scripts_set_merchant_status, scripts_reset_pin, docs_ekko_appflow_f_30, docs_ekko_appflow_f_31, docs_ekko_appflow_f_32, docs_ekko_appflow_f_33 [EXTRACTED 1.00]
- **Idempotencia ante reintentos** — docs_ekko_appflow_rr_2_idempotencia, docs_ekko_appflow_clave_idempotencia_push, docs_ekko_plan_qa_tc_168_idempotencia_push, docs_ekko_appflow_rr_1_boton_deshabilitado [INFERRED 0.85]

## Communities (139 total, 38 thin omitted)

### Community 0 - "Push y notificaciones (app)"
Cohesion: 0.05
Nodes (42): NotificationsPermissionScreen(), registerDevice(), ensureAndroidChannel(), PushRegistration, readPushRegistration(), requestPushPermission(), PushPermissionState, readState() (+34 more)

### Community 1 - "Auth UI y botones"
Cohesion: 0.08
Nodes (29): ButtonProps, variants, Chip(), ChipProps, CodeFieldProps, DateFieldProps, EmptyStateProps, FormMessageProps (+21 more)

### Community 2 - "Contexto auth panel"
Cohesion: 0.06
Nodes (27): AuthContext, AuthState, renderAt(), { rpc }, coupon, flush(), input(), renderValidator() (+19 more)

### Community 3 - "Esquema backend y RPCs"
Cohesion: 0.07
Nodes (45): F-20 Inicio de sesión del comercio, Esquema del Backend — Ekko Rewards, RPC add_card, app.current_customer / app.current_merchant, app.raise, app.require_admin_session, Trigger de rol en auth.users (customer/merchant), RPC complete_profile (+37 more)

### Community 4 - "Sellos, ciclos y ruleta (SQL)"
Cohesion: 0.07
Nodes (46): app.grant_stamps, app.random_code, Tabla card_cycles, Vistas de KPIs (private), Tabla stamps, Tabla wheel_spins, PRD — Ekko Rewards, KPIs del producto (comercios activos, usuarios, escaneos, canjes) (+38 more)

### Community 5 - "QR de visita (panel)"
Cohesion: 0.09
Nodes (33): ACCESS_ERRORS, BUTTON_LABEL, Countdown(), errorMessage(), Placeholder(), QrStage(), QrSvg(), useVisitQr() (+25 more)

### Community 6 - "Tests cumpleaños"
Cohesion: 0.07
Nodes (30): Harness(), mockAuth, mockRouter, mockSupabase, renderHarness(), ensureBirthdayCoupons(), Greeting, listeners (+22 more)

### Community 7 - "Recuperación y perfil inicial"
Cohesion: 0.12
Nodes (29): RecoverScreen(), CompleteProfileScreen(), ProfileLoadError(), ADR-0014, VerifyEmailScreen(), useAuth(), FormMessage(), MyProfile (+21 more)

### Community 8 - "Escáner de visita"
Cohesion: 0.11
Nodes (24): DevTokenPaste(), ScanScreen(), BellIcon(), CameraIcon(), copy, iconStroke, PermissionExplainer(), PermissionExplainerProps (+16 more)

### Community 9 - "Detalle de comercio"
Cohesion: 0.12
Nodes (23): MerchantScreen(), imageUri(), menuChips(), MerchantDetail, previewExpiry(), productsFor(), mockRouter, mockSupabase (+15 more)

### Community 10 - "Deps app móvil"
Cohesion: 0.06
Nodes (34): dependencies, aes-js, @ekko/shared, expo, expo-application, expo-build-properties, expo-camera, expo-constants (+26 more)

### Community 11 - "E2E admin panel"
Cohesion: 0.07
Nodes (9): cases, revealU4CardRewardCode(), rpc(), signInCustomer(), claimAs(), rpc(), rpcExists(), signInCustomer() (+1 more)

### Community 12 - "Login app"
Cohesion: 0.11
Nodes (18): describeSignInError(), FormError, LoginScreen(), LinkState, NewPasswordForm(), ResetPasswordScreen(), useRecoverySession(), AuthLayout() (+10 more)

### Community 13 - "ADRs de plataforma y riesgos"
Cohesion: 0.10
Nodes (27): seed.sql (datos de desarrollo y staging), R-01 Reenvío de foto del QR dentro de 60 s, R-07 Baja adopción por fricción en el primer registro, Riesgos del producto R-01 a R-07, Requisitos no funcionales RNF-01 a RNF-13, RNF-02/OBJ-4 App < 25 MB de descarga, RNF-03 Caché de imágenes LRU de 20 MB, TRD — Ekko Rewards (+19 more)

### Community 14 - "Tarjeta de comercio (catálogo)"
Cohesion: 0.13
Nodes (19): MerchantCard(), MerchantCardData, MerchantCardProps, MerchantLogo(), PinIcon(), merchant, isoWeekdayInMexico(), initialsOf() (+11 more)

### Community 15 - "Layout administrativo"
Cohesion: 0.16
Nodes (26): ADMIN_IDLE_MS, AdminLayout(), formatCountdown(), AdminSection, ArrowLeftIcon(), BellIcon(), CardIcon(), ChartIcon() (+18 more)

### Community 16 - "Config. de tarjeta (panel)"
Cohesion: 0.13
Nodes (21): CardPreview(), CheckCircleIcon(), useAdminRpc(), CARD_LIMITS, cardConfigSchema, CardField, CardForm, cardFormSchema (+13 more)

### Community 17 - "Errores y canje"
Cohesion: 0.08
Nodes (18): Catálogo de errores E-xx, F-07 Agregar tarjeta y ruleta de bienvenida, F-11 Canje de cupón o premio, Mapa de navegación panel del comercio, Modo Caja (P-02), Brief de Diseño UX/UI — Ekko Rewards, Accesibilidad mínima del MVP, Código de canje (componente) (+10 more)

### Community 18 - "Mis Tarjetas"
Cohesion: 0.12
Nodes (20): Badge(), CardRow(), CardRowProps, StampCardStamp, SegmentedTabs(), Skeleton(), CardsError(), CardsList() (+12 more)

### Community 19 - "Deps panel"
Cohesion: 0.08
Nodes (21): @ekko/shared, @hookform/resolvers, react, react-dom, react-hook-form, @tanstack/react-query, @types/react, vitest (+13 more)

### Community 20 - "AuthProvider panel"
Cohesion: 0.12
Nodes (15): AuthProvider(), signOutNotice(), USER_SIGN_OUT_KEY, AlertIcon(), authNotice(), FieldError(), INVALID_CREDENTIALS, LoginPage() (+7 more)

### Community 21 - "Resultado de canje"
Cohesion: 0.15
Nodes (20): TicketIcon(), initials(), PanelShell(), formatExpiry(), Props, RedemptionResult(), SOURCE_LABEL, Spinner() (+12 more)

### Community 22 - "Registro y perfil"
Cohesion: 0.16
Nodes (19): RegisterScreen(), CompleteProfileForm(), FIELDS, FormProps, DateField(), confirmIos(), handleAndroidChange(), formatCalendarDate() (+11 more)

### Community 23 - "Desbloqueo admin PIN"
Cohesion: 0.13
Nodes (19): RpcResult, parseUnlock(), UnlockNotice, UnlockOutcome, unlockSchema, useAdminUnlock(), useMerchantSessionPatch(), useNow() (+11 more)

### Community 24 - "Banner de verificación"
Cohesion: 0.10
Nodes (14): CIRCLES, EnvelopeIcon(), TextButton(), VerificationBanner(), VerificationBannerProps, corners, ScannerOverlayProps, styles (+6 more)

### Community 25 - "AppFlow F-01..F-08"
Cohesion: 0.09
Nodes (24): AppFlow — Ekko Rewards, F-01 Arranque y sesión, F-02 Registro con correo, F-04 Verificación de correo (OTP nativo), F-06 Explorar y abrir comercio, F-08 Registrar visita, F-09 Enlace universal /v/:token, F-10 Tarjeta completada y recompensa (+16 more)

### Community 26 - "Alta de comercio"
Cohesion: 0.10
Nodes (18): F-30 Alta de comercio, buildOnboardingPlan(), httpsUrl, MerchantInput, merchantInputSchema, OnboardingPlan, parseMerchantInput(), ParseResult (+10 more)

### Community 27 - "Pipeline de imágenes"
Cohesion: 0.13
Nodes (16): errorCode(), Canvas, canvasToBlob(), createCanvas(), createImageVariants(), decode(), encode(), encodeUnderLimit() (+8 more)

### Community 28 - "Config móvil"
Cohesion: 0.10
Nodes (20): jest, preset, react, zod, main, name, private, version (+12 more)

### Community 29 - "Esquemas zod auth"
Cohesion: 0.13
Nodes (14): birthDate, CompleteProfileInput, completeProfileSchema, CompleteProfileValues, email, isAdult(), newPassword, recoverSchema (+6 more)

### Community 30 - "Registro de dispositivo"
Cohesion: 0.13
Nodes (10): deviceIdDigest(), readDeviceId(), signOutDevice(), mockReadPush, mockRpc, sessionStorage, supabaseUrl, expo-application (+2 more)

### Community 31 - "Catálogo paginado"
Cohesion: 0.13
Nodes (13): fetchMerchantsPage(), Filters, MerchantListItem, MerchantsPage, nextPageParam(), PAGE_SIZE, SESSION_SEED, useMerchants() (+5 more)

### Community 32 - "Almacenamiento cifrado"
Cohesion: 0.16
Nodes (15): createEncryptedStorage(), decrypt(), getItem(), removeItem(), setItem(), ctr(), EncryptedStorageDeps, KeyValueStore (+7 more)

### Community 33 - "PanelGate"
Cohesion: 0.19
Nodes (14): useAuth(), PanelGate(), PanelSkeleton(), SessionError(), PanelOutletContext, isAdminPath(), isMerchant(), MerchantSession (+6 more)

### Community 34 - "tsconfig panel"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 35 - "Deps scripts"
Cohesion: 0.10
Nodes (19): dependencies, postgres, @supabase/supabase-js, zod, devDependencies, @types/node, typescript, @supabase/supabase-js (+11 more)

### Community 36 - "Paquete shared"
Cohesion: 0.11
Nodes (17): eslint, dependencies, zod, exports, vitest, zod, main, name (+9 more)

### Community 37 - "Visita pendiente (deep link)"
Cohesion: 0.19
Nodes (15): VisitLinkScreen(), getPendingVisit(), listeners, PENDING_VISIT_TTL_MS, PendingVisit, setPendingVisit(), subscribePendingVisit(), takePendingVisit() (+7 more)

### Community 38 - "StampCard"
Cohesion: 0.18
Nodes (13): dateText, EASE_OUT, GiftIcon(), NewStampEntrance(), SlotProps, StampCard(), StampCardProps, StampSlot() (+5 more)

### Community 39 - "ADRs de auth y correo"
Cohesion: 0.19
Nodes (8): Registro de ADR — Ekko Rewards, Bucket merchant-media, Edge Function email-verification, Bucket de Storage merchant-media, Resultados de spikes Sprint 0, Variantes de imagen WebP generadas en el panel, SP-5 Spike: codificación WebP en Safari de iPad, SP-7 Spike: sesión con correo sin confirmar en Supabase Auth

### Community 40 - "Plan de implementación"
Cohesion: 0.13
Nodes (19): F-05 Recuperar contraseña, Plan de Implementación — Ekko Rewards, Definition of Done, Definition of Ready, DEP-08 Supabase Pro, DEP-09 Development build EAS, Estrategia CI/CD (GitHub Actions), Fases e hitos H0–H5 (20 sprints) (+11 more)

### Community 41 - "Categorías e imágenes de comercio"
Cohesion: 0.12
Nodes (15): MERCHANT_CATEGORIES, MerchantCategory, merchantCategoryLabel, MerchantImageKind, WIDTHS, CompositeTypes, Constants, Database (+7 more)

### Community 42 - "Índices SQL"
Cohesion: 0.12
Nodes (10): card_cycles_merchant_status_idx, coupons_customer_status_expires_idx, coupons_merchant_redeemed_idx, customer_devices_push_idx, customer_merchants_merchant_idx, merchants_name_trgm_idx, merchants_visible_category_idx, products_menu_idx (+2 more)

### Community 43 - "Detalle y agregar tarjeta"
Cohesion: 0.16
Nodes (16): myCardsKey, addCardSchema, callRpc(), detailSchema, FEATURED_CHIP, MenuProduct, merchantDetailKey(), UntypedRpc (+8 more)

### Community 44 - "Comercio inactivo y vencimiento"
Cohesion: 0.18
Nodes (14): F-28 Comercio inactivo, F-31 Vencimiento, RN-71 Comercio inactivo oculto del catálogo, Casos estado del comercio TC-180..TC-184, postgres, fail(), findMerchant(), requireDbUrl() (+6 more)

### Community 45 - "ref_node_assert"
Cohesion: 0.16
Nodes (11): flag, generatePin(), merchantRef, parse(), Parsed, parseResetPinArgs(), parseStatusArgs(), resetPinArgs (+3 more)

### Community 46 - "tsconfig.node.json"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 47 - "ADR-07 QR de visita bajo demanda con enl"
Cohesion: 0.20
Nodes (16): app.require_active_merchant, RPC claim_visit, RPC generate_visit_qr, RPC get_qr_status, Realtime sobre visit_qr_tokens, Tabla visit_qr_tokens, RN-17 Límite de 1 sello diario por cliente y comercio, RN-36 Sello extra exento del límite diario (+8 more)

### Community 48 - "package.json"
Cohesion: 0.12
Nodes (16): devDependencies, supabase, engines, node, name, packageManager, private, scripts (+8 more)

### Community 49 - "13_redemption.test.sql"
Cohesion: 0.14
Nodes (9): ctx, fx, lk, pg_temp.at(), pg_temp.counter(), pg_temp.mk(), pg_temp.seed_code(), pg_temp.stored() (+1 more)

### Community 50 - "[merchantId].tsx"
Cohesion: 0.20
Nodes (6): polar(), shortLabel(), WheelDisc(), WheelDiscProps, centerAfter(), winningRotation()

### Community 51 - "coupon/[id].tsx"
Cohesion: 0.23
Nodes (9): CodeView(), CouponCodeScreen(), EmptyState(), ErrorState(), ErrorStateProps, revealCouponCode(), RevealedCoupon, revealedCouponSchema (+1 more)

### Community 52 - "app/_layout.tsx"
Cohesion: 0.19
Nodes (7): RootLayout(), RootNavigator(), AuthProvider(), useJustSignedUp(), useRegisterDeviceOnce(), decideGate(), queryClient

### Community 53 - "redemptions.tsx"
Cohesion: 0.26
Nodes (10): CouponCard(), CouponCardProps, CouponSource, couponSourceLabel, relativeExpiry(), now, formatTime(), LoadError() (+2 more)

### Community 54 - "prizeAnnouncement()"
Cohesion: 0.15
Nodes (10): prizeAnnouncement(), PrizeView(), WheelScreen(), useSpinWheel(), mockExplainer, mockParams, mockRouter, mockSupabase (+2 more)

### Community 55 - "mobile/src/auth/AuthProvider.tsx"
Cohesion: 0.17
Nodes (5): AuthContext, AuthContextValue, AuthErrorCode, AuthStatus, isCustomerSession()

### Community 56 - "gate.ts"
Cohesion: 0.21
Nodes (10): GateInput, GateRoute, GatedStack(), GatedStackProps, HOME, Layout(), listeners, page() (+2 more)

### Community 57 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @ekko/shared, @fontsource-variable/dm-sans, @hookform/resolvers, react, react-dom, react-hook-form, react-router (+7 more)

### Community 58 - "AdminPlaceholderPage()"
Cohesion: 0.18
Nodes (8): AdminPlaceholderPage(), renderAdmin(), ADMIN_SECTIONS, queryClient, initSentry(), router, @fontsource-variable/dm-sans, @sentry/react

### Community 59 - "Clave de idempotencia de campaña push"
Cohesion: 0.16
Nodes (13): Beta cerrada con comercios piloto, Plan de Pruebas (QA) — Ekko Rewards, Estrategia de pruebas (pirámide), Maestro E2E app, Metas de cobertura, pgTAP (pruebas de base de datos), Playwright E2E panel, Prueba de humo de 15 minutos (+5 more)

### Community 60 - "10_claim_visit.test.sql"
Cohesion: 0.17
Nodes (10): ctx, ids, pg_temp.at(), pg_temp.claim(), pg_temp.claim_error(), pg_temp.id(), pg_temp.qr(), pg_temp.token() (+2 more)

### Community 61 - "CardRow.tsx"
Cohesion: 0.20
Nodes (8): formatMXN(), formatShortDate(), mxn, ADR-0013, Pill(), ProductCard(), ProductCardProps, TIMEZONE

### Community 62 - "devDependencies"
Cohesion: 0.14
Nodes (14): devDependencies, jsdom, oxlint, @playwright/test, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node (+6 more)

### Community 63 - "public.menu_categories"
Cohesion: 0.15
Nodes (3): app.wheel_status(), public.add_card(), public.get_merchant_detail()

### Community 64 - "scripts/tsconfig.json"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck (+5 more)

### Community 65 - "14_wheel.test.sql"
Cohesion: 0.15
Nodes (5): ctx, pg_temp.cid(), pg_temp.cp(), pg_temp.pending(), res

### Community 66 - "15_admin_unlock.test.sql"
Cohesion: 0.16
Nodes (6): ctx, lk, pg_temp.at(), pg_temp.counter(), pg_temp.session_until(), pg_temp.sessions()

### Community 67 - "AdminUnlock.test.tsx"
Cohesion: 0.19
Nodes (9): baseSession, flush(), FormSection(), Gate(), NOW, renderApp(), { rpc }, signOut (+1 more)

### Community 68 - "ADR-03 Resolución perezosa en lugar de p"
Cohesion: 0.23
Nodes (10): app.roll_cycle, RPC ensure_birthday_coupons, RPC get_merchant_detail, RPC list_my_cards, RN-56 Agotado por hoy se restablece al día siguiente, RN-43 a RN-45 Cupón de cumpleaños, RN-51 a RN-60 Catálogo, menú y ofertas, US-18 Cupón de cumpleaños (+2 more)

### Community 69 - "ADR-13 Reloj controlable para pruebas"
Cohesion: 0.22
Nodes (12): app.is_email_verified, app.local_now / app.local_today, app.now(), RPC confirm_redemption, Tabla coupons, RPC lookup_redemption, RPC reveal_coupon_code, Esquema app (funciones auxiliares) (+4 more)

### Community 70 - "F-21 Generar QR de visita"
Cohesion: 0.15
Nodes (13): F-21 Generar QR de visita, generate_visit_qr RPC, QR de visita con vencimiento de 60 s y Realtime, Gestión de migraciones (agregar antes de quitar), Secretos por entorno, Datos semilla C1–C4 / U1–U4, README Ekko Rewards, apps/mobile (Expo SDK 58, Expo Router) (+5 more)

### Community 71 - "index.tsx"
Cohesion: 0.29
Nodes (8): CatalogError(), ExploreScreen(), ListFooter(), ListFooterProps, MerchantCardSkeleton(), BirthdayGreeting(), toMerchantCard(), useDebouncedValue()

### Community 72 - "myCards.ts"
Cohesion: 0.20
Nodes (7): fetchMyCards(), MyCard, myCardsSchema, useMyCards(), mockParams, mockRouter, mockSupabase

### Community 73 - "rules.ts"
Cohesion: 0.20
Nodes (8): COUPON_VALIDITY, CYCLE_MONTHS, MIN_AGE, PUSH_COUPON_VALIDITY_HOURS, PUSH_MONTHLY_LIMIT, QR_TTL_SECONDS, STAMPS, stampGridRows()

### Community 74 - "account.ts"
Cohesion: 0.20
Nodes (6): completeProfile(), MY_PROFILE_KEY, REGISTER_MUTATION_KEY, ADR-0014, useRegister(), useRegisterDraft()

### Community 75 - "screens.test.tsx"
Cohesion: 0.20
Nodes (7): fillRegister(), mockAuth, mockParams, mockPickedDate, mockRouter, mockSupabase, pickBirthDate()

### Community 76 - "appError.ts"
Cohesion: 0.27
Nodes (5): ERRORS, isErrorCode(), parseDetails(), parseRpcError(), RpcError

### Community 77 - "mobile/tsconfig.json"
Cohesion: 0.18
Nodes (9): compilerOptions, noEmit, types, extends, include, ../../tsconfig.base.json, extends, include (+1 more)

### Community 78 - "auth"
Cohesion: 0.36
Nodes (8): auth, private.merchant_admin_sessions, private.merchant_security, private.wheel_prizes, public.customers, public.loyalty_programs, public.merchants, set_updated_at

### Community 79 - "ADR-11 Soft delete con anonimización y h"
Cohesion: 0.27
Nodes (9): RPC anonymize_customer, app.peppered_hash, Edge Function delete-account, Pimienta de hashes en Supabase Vault, Pimienta en Supabase Vault, Tareas pendientes legales y de publicación en tiendas, RN-08 Eliminación de cuenta con anonimización, US-05 Eliminar cuenta (+1 more)

### Community 81 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-expo, jest, jest-expo, @testing-library/react-native, @types/aes-js, @types/jest (+2 more)

### Community 82 - "VisitResultScreen()"
Cohesion: 0.22
Nodes (8): VisitResultScreen(), visitErrorKind(), mockEndSession, mockRouter, mockSupabase, networkError, renderScreen(), success

### Community 83 - "AuthProvider.test.tsx"
Cohesion: 0.22
Nodes (5): Listener, mockAuth, mockSignOutDevice, Probe(), renderProvider()

### Community 84 - "auth.mfa_amr_claims"
Cohesion: 0.29
Nodes (6): app.assign_user_role(), app.create_customer_for_user(), app.mark_email_verified(), assign_user_role, create_customer_for_user, mark_email_verified

### Community 85 - "claim_visit RPC"
Cohesion: 0.20
Nodes (8): claim_visit RPC, confirm_redemption RPC, F-03 Login social, F-22 Validar canje, lookup_redemption RPC, DEP-01 Cuenta de Apple Developer, Ruta crítica, Flujos críticos E2E-01..E2E-10

### Community 86 - "20261021002226_rewards_tables.sql"
Cohesion: 0.36
Nodes (5): coupons_birthday_once_idx, coupons_push_once_idx, public.coupons, public.push_campaigns, public.wheel_spins

### Community 88 - "08_merchant_detail.test.sql"
Cohesion: 0.20
Nodes (3): pg_temp.cid(), r, u4_coupons

### Community 90 - "tsconfig.base.json"
Cohesion: 0.20
Nodes (9): compilerOptions, isolatedModules, module, moduleResolution, noEmit, noUncheckedIndexedAccess, skipLibCheck, strict (+1 more)

### Community 92 - "ADR-04 Expo Push API sin FCM directo"
Cohesion: 0.28
Nodes (8): RPC create_push_campaign, Edge Function send-push, RPC interna get_push_recipients, Tabla push_campaigns, RPC interna record_push_result, RN-47 Tope de 5 push por comercio por mes, RN-46 a RN-50 Notificaciones push, US-25 Enviar push

### Community 94 - "20261021002224_loyalty_tables.sql"
Cohesion: 0.50
Nodes (6): card_cycles_one_active_idx, public.card_cycles, public.customer_merchants, public.stamps, public.visit_qr_tokens, stamps_one_per_day_idx

### Community 95 - "20261021002228_catalog_tables.sql"
Cohesion: 0.33
Nodes (5): public.customer_devices, public.menu_categories, public.products, public.weekly_offers, set_updated_at

### Community 97 - "(tabs)/_layout.tsx"
Cohesion: 0.39
Nodes (4): icon(), TabsLayout(), TabIcon(), TabIconName

### Community 98 - "webCrypto.ts"
Cohesion: 0.29
Nodes (4): Digest, installWebCrypto(), RandomValues, ADR-0015

### Community 99 - "20261026000000_redemption_rpc.sql"
Cohesion: 0.32
Nodes (4): public.confirm_redemption(), public.list_my_coupons(), public.lookup_redemption(), public.reveal_coupon_code()

### Community 103 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, test, test:e2e, typecheck

### Community 104 - "app.config.ts"
Cohesion: 0.33
Nodes (3): config, VARIANTS, expo

### Community 105 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 108 - "mobile/eslint.config.js"
Cohesion: 0.40
Nodes (3): { defineConfig }, expoConfig, eslint-config-expo

### Community 109 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, lint, start, test, typecheck

### Community 111 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, eslint, typescript, typescript-eslint, vitest

### Community 121 - "tc044_claim_visit.sh"
Cohesion: 1.00
Nodes (3): claim(), tc044_claim_visit.sh script, sql()

## Ambiguous Edges - Review These
- `RR-1 Deshabilitar botón mientras espera respuesta` → `PX-2 Una acción principal por pantalla`  [AMBIGUOUS]
  docs/ekko_appflow.md · relation: conceptually_related_to
- `H1 Primer sello real` → `Datos semilla C1–C4 / U1–U4`  [AMBIGUOUS]
  docs/ekko_plan_qa.md · relation: conceptually_related_to

## Knowledge Gaps
- **83 isolated node(s):** `app.current_customer / app.current_merchant`, `RPC get_merchant_session`, `RPC get_my_profile`, `RPC get_wheel`, `RPC list_my_coupons` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 907 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppFlow — Ekko Rewards` connect `AppFlow F-01..F-08` to `Esquema backend y RPCs`, `F-21 Generar QR de visita`, `Plan de implementación`, `Comercio inactivo y vencimiento`, `Errores y canje`, `claim_visit RPC`, `Alta de comercio`, `Clave de idempotencia de campaña push`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **What connects `app.current_customer / app.current_merchant`, `RPC get_merchant_session`, `RPC get_my_profile` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Push y notificaciones (app)` be split into smaller, more focused modules?**
  _Cohesion score 0.053555750658472345 - nodes in this community are weakly interconnected._
- **Why does `F-30 Alta de comercio` connect `Alta de comercio` to `Plan de implementación`, `AppFlow F-01..F-08`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Should `Auth UI y botones` be split into smaller, more focused modules?**
  _Cohesion score 0.08085317460317461 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `RR-1 Deshabilitar botón mientras espera respuesta` and `PX-2 Una acción principal por pantalla`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `H1 Primer sello real` and `Datos semilla C1–C4 / U1–U4`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._