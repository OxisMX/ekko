# AppFlow — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Documento | AppFlow (Flujo de la Aplicación) |
| Versión | 1.1 (verificación de correo propia en F-04; reautenticación con Apple en F-15) |
| Fecha | 20 de octubre de 2026 |
| Estado | Borrador para aprobación |
| Documentos base | ekko_prd.md v1.0, ekko_trd.md v1.0, ekko_brief_ux_ui.md v1.0 |
| Supuesto de diseño | Se adoptan las propuestas de las decisiones abiertas del brief: pestañas dentro del comercio (DA-2) y encabezado compacto (DA-4). |

Convenciones: los identificadores de pantalla (A-xx, P-xx, W-xx) corresponden al inventario del brief; las reglas (RN-xx) y user stories (US-xx), al PRD; los códigos de error (E-xx), a la sección 7 de este documento.

---

## 1. Mapa de navegación

### 1.1 App móvil

```mermaid
flowchart TD
  SPLASH[A-01 Splash] --> SES{¿Sesión válida?}
  SES -- No --> LOGIN[A-02 Iniciar sesión]
  SES -- Sí --> PERF{¿Perfil completo?}
  LOGIN --> REG[A-03 Crear cuenta]
  LOGIN --> REC[A-06 Recuperar contraseña]
  LOGIN --> PERF
  REG --> VER[A-05 Verifica tu correo]
  VER --> TABS
  PERF -- No --> COMP[A-04 Completar perfil]
  COMP --> TABS
  PERF -- Sí --> TABS

  subgraph TABS[Barra inferior]
    EXP[A-07 Explorar]
    MIS[A-17 / A-18 Mis Tarjetas]
    PRO[A-20 Perfil]
  end

  EXP --> DET[Detalle de comercio]
  MIS --> DET
  subgraph DET[Detalle de comercio — pestañas]
    T1[A-08 Tarjeta]
    T2[A-09 Menú]
    T3[A-10 Promociones y cupones]
    T4[A-11 Reseña]
  end

  T1 --> SCAN[A-14 Escáner]
  MIS --> SCAN
  SCAN --> RES[A-15 Resultado de visita]
  T1 --> RUL[A-12 Ruleta]
  T1 --> COD[A-19 Código de canje]
  T3 --> COD
  MIS --> COD
  PRO --> HIS[A-21 Historial de canjes]
  PRO --> DEL[A-22 Eliminar cuenta]
  PRO --> LEG[A-23 Aviso y términos]
```

### 1.2 Panel del comercio

```mermaid
flowchart TD
  PL[P-01 Iniciar sesión] --> ACT{¿Comercio activo?}
  ACT -- No --> INA[P-12 Comercio inactivo]
  INA --> VAL[P-03 Resultado de validación]
  ACT -- Sí --> CAJA[P-02 Modo Caja]
  CAJA --> VAL
  CAJA --> PIN[P-04 Desbloqueo con PIN]
  PIN --> ADM

  subgraph ADM[Secciones administrativas]
    MET[P-05 Métricas]
    CFG[P-06 Configuración de tarjeta]
    MEN[P-07 Menú] --> PRF[P-08 Formulario de producto]
    OFE[P-09 Ofertas semanales]
    PUSH[P-10 Notificaciones push]
    LOG[P-11 Registro de QR]
  end

  ADM -- "Inactividad 5 min o sesión administrativa vencida" --> CAJA
```

---

## 2. Puntos de entrada y salida

### 2.1 Entradas

| ID | Entrada | Destino | Flujo |
|---|---|---|---|
| EN-01 | Abrir la app desde el ícono | A-01 Splash | F-01 |
| EN-02 | QR escaneado con la cámara nativa (`/v/:token`), app instalada | Procesamiento de visita | F-09 |
| EN-03 | QR escaneado con la cámara nativa, app no instalada | W-01 Página de descarga | F-09 |
| EN-04 | Toque en notificación push | A-10 Promociones y cupones del comercio emisor | F-13 |
| EN-05 | Enlace de verificación de correo | Confirmación y regreso a la app | F-04 |
| EN-06 | Enlace de recuperación de contraseña | Pantalla para nueva contraseña | F-05 |
| EN-07 | Abrir `ekko.oxis.mx` | P-01 o P-02 según sesión | F-20 |

### 2.2 Salidas

| ID | Salida | Origen | Comportamiento |
|---|---|---|---|
| SA-01 | Google Maps (ubicación) | Tarjeta del catálogo, encabezado del comercio | Abre la app de Maps o el navegador; al volver, la app conserva el estado. |
| SA-02 | Google Maps (reseñas) | A-11 | Igual que SA-01. |
| SA-03 | Aviso de privacidad y términos | A-03, A-04, A-23 | Vista web externa. |
| SA-04 | Ajustes del sistema | Permiso denegado de cámara o notificaciones | Abre los ajustes de la app. |
| SA-05 | Cerrar sesión | A-20 | Regresa a A-02; elimina el token push de ese dispositivo. |
| SA-06 | Eliminar cuenta | A-22 | Regresa a A-02 sin sesión. |
| SA-07 | App Store / Google Play | W-01 | Descarga de la app. |

---

## 3. Flujos de autenticación (cliente)

### F-01 Arranque y sesión

```mermaid
flowchart TD
  A[Abrir app] --> B{¿Hay sesión guardada?}
  B -- No --> L[A-02 Iniciar sesión]
  B -- Sí --> C{¿Token renovable?}
  C -- No --> L
  C -- Sí --> D{¿Rol cliente?}
  D -- No --> E[E-19 Cuenta de comercio] --> L
  D -- Sí --> F{¿Nombre y fecha de nacimiento completos?}
  F -- No --> G[A-04 Completar perfil]
  F -- Sí --> H[register_device + ensure_birthday_coupons]
  G --> H
  H --> I{¿Hay token de visita pendiente?}
  I -- Sí --> J[F-08 Procesar visita]
  I -- No --> K[A-07 Explorar]
```

- `register_device` actualiza el hash del dispositivo y, si hay permiso, el Expo Push Token.
- `ensure_birthday_coupons` es idempotente y no bloquea la navegación; si falla se reintenta en la siguiente apertura.

### F-02 Registro con correo (US-01)

```mermaid
flowchart TD
  A[A-03 Crear cuenta] --> B[Captura nombre, apellido, correo, contraseña, fecha]
  B --> C{¿Validación local correcta?}
  C -- No --> B
  C -- Sí --> D{¿18 años o más?}
  D -- No --> E[E-07 Menor de edad] --> B
  D -- Sí --> F[Supabase Auth signUp]
  F --> G{Resultado}
  G -- "Correo ya registrado" --> H[E-20 Correo existente: ofrecer iniciar sesión o recuperar]
  G -- "Error de red" --> I[E-01 Sin conexión: reintentar]
  G -- Éxito --> J[complete_profile]
  J --> K[A-05 Verifica tu correo]
  K --> L[Continuar a la app sin verificar]
  L --> M[A-07 Explorar con banner de verificación]
```

Validaciones locales: nombre y apellido de 2 a 50 caracteres, correo con formato válido, contraseña de 8 caracteres como mínimo, fecha de nacimiento obligatoria, aceptación del aviso de privacidad.

### F-03 Login social (US-02)

```mermaid
flowchart TD
  A[A-02 Toque en Google o Apple] --> B[Hoja nativa del proveedor]
  B --> C{Resultado}
  C -- Cancelado --> A
  C -- Error --> D[E-21 Error del proveedor: reintentar] --> A
  C -- Éxito --> E[Intercambio de ID token con Supabase]
  E --> F{¿Rol cliente?}
  F -- No --> G[E-19 Cuenta de comercio] --> A
  F -- Sí --> H{¿Perfil completo?}
  H -- Sí --> I[F-01 desde register_device]
  H -- No --> J[A-04 Completar perfil]
  J --> K{¿18 años o más?}
  K -- No --> L[E-07 Menor de edad: cerrar sesión]
  K -- Sí --> M[complete_profile] --> I
```

Las cuentas de Google y Apple se consideran verificadas: no muestran A-05 ni el banner.

### F-04 Verificación de correo (RN-05)

| Paso | Acción | Resultado |
|---|---|---|
| 1 | El usuario abre el enlace del correo. | La Edge Function `email-verification` marca el correo como verificado (Backend 6.3; sujeto a SP-7). |
| 2 | El enlace abre la app (o una página de confirmación si se abre en otro dispositivo). | La app refresca la sesión. |
| 3 | La app oculta el banner de verificación. | Se habilitan ruleta y canjes. |

Recuperación:
- "Reenviar correo" desde el banner o A-05, con espera de 60 s entre envíos.
- Enlace vencido: mensaje "Este enlace venció" y botón para reenviar.

Acciones bloqueadas sin verificación: girar la ruleta (A-12 en estado bloqueado) y "Mostrar código" (A-19 en estado bloqueado). Ambas muestran E-06 con el botón de reenvío.

### F-05 Recuperar contraseña (US-03)

```mermaid
flowchart TD
  A[A-06 Captura correo] --> B[Solicitud de restablecimiento]
  B --> C[Mensaje genérico: si el correo existe recibirás un enlace]
  C --> D[Usuario abre enlace]
  D --> E{¿Enlace vigente?}
  E -- No --> F[Enlace vencido: solicitar otro] --> A
  E -- Sí --> G[Nueva contraseña]
  G --> H[Sesión iniciada] --> I[F-01]
```

El mensaje del paso C es el mismo exista o no el correo, para no revelar cuentas registradas.

---

## 4. Flujos principales (cliente)

### F-06 Explorar y abrir un comercio (US-07, US-08)

```mermaid
flowchart TD
  A[A-07 Explorar] --> B[list_merchants página 1, semilla de sesión]
  B --> C{Resultado}
  C -- Error --> D[E-01 Sin conexión: reintentar]
  C -- Vacío --> E[Sin resultados: limpiar búsqueda o filtro]
  C -- Datos --> F[Lista de comercios]
  F -- Scroll al final --> G[Página siguiente]
  F -- Búsqueda o categoría --> B
  F -- Ícono ubicación --> SA1[SA-01 Google Maps]
  F -- Toque en comercio --> H[get_merchant_detail]
  H --> I{¿Comercio disponible?}
  I -- No --> J[Mensaje E-05 y regreso a la lista]
  I -- Sí --> K[A-08 Pestaña Tarjeta]
```

- La búsqueda se ejecuta 300 ms después de la última tecla.
- La semilla de orden aleatorio se conserva hasta que la app se cierra.

### F-07 Agregar tarjeta y ruleta de bienvenida (US-10, US-15)

```mermaid
flowchart TD
  A[A-08 Tarjeta sin relación] --> B[Toque en Agregar a mis tarjetas]
  B --> C[add_card]
  C --> D{¿Primera tarjeta del usuario y permiso de notificaciones sin decidir?}
  D -- Sí --> E[A-16 Permiso de notificaciones]
  D -- No --> F
  E --> F{¿Ruleta disponible?}
  F -- "Ya girada por la cuenta" --> G[Tarjeta en progreso]
  F -- "Ya girada en este dispositivo" --> G
  F -- "Correo sin verificar" --> H[Insignia Gira tu ruleta + E-06 al tocarla]
  F -- Sí --> I[A-12 Ruleta]
  I --> J[spin_wheel]
  J --> K{Resultado}
  K -- "Cupón" --> L[Premio + Ver mi cupón]
  K -- "Sello extra" --> M[Premio + insignia +1 en tu próxima visita]
  K -- Error --> N[E-01 o E-09: reintentar más tarde]
  L --> G
  M --> G
  H --> O[Al verificar el correo, la insignia abre A-12]
```

Regla de disponibilidad: la ruleta permanece ofrecida en la tarjeta (insignia "Gira tu ruleta") hasta que la cuenta la gire, siempre que el dispositivo no la haya girado con otra cuenta (RN-07, RN-31).

### F-08 Registrar visita (US-11, US-13)

```mermaid
flowchart TD
  A["Registrar visita (A-08 o Mis Tarjetas)"] --> B{¿Permiso de cámara?}
  B -- "Sin decidir" --> C[A-13 Explicación] --> D[Solicitud del sistema]
  D -- Denegado --> E[Mensaje + SA-04 Ajustes]
  D -- Concedido --> F
  B -- Denegado --> E
  B -- Concedido --> F[A-14 Escáner]
  F --> G{¿URL de Ekko con token?}
  G -- No --> H[E-08 QR no reconocido] --> F
  G -- Sí --> I[claim_visit token + hash de dispositivo]
  I --> J{Resultado}
  J -- "Sello otorgado" --> K[A-15 Sello registrado, X de N]
  J -- "Tarjeta completada" --> L[A-15 Tarjeta completada → F-10]
  J -- "E-02 QR vencido / E-03 QR usado" --> M[Pide al cajero uno nuevo] --> F
  J -- "E-04 Límite diario" --> N[Ya registraste hoy]
  J -- "E-05 Comercio no disponible" --> O[Mensaje y cierre]
  J -- "E-01 Sin conexión" --> P[Reintentar con el mismo token si sigue vigente]
  K --> Q{¿Relación nueva?}
  Q -- Sí --> R[F-07 desde permiso de notificaciones y ruleta]
  Q -- No --> S[A-08 del comercio con sello animado]
```

- La cámara se cierra al leer el primer código válido para evitar lecturas dobles.
- Si se aplicó un sello extra pendiente, A-15 indica "+2 sellos".
- El reintento por falta de conexión solo se ofrece mientras el token no haya vencido (la app conoce `expires_at` del token solo tras la respuesta; si no la conoce, reintenta una vez y después muestra E-02).

### F-09 Entrada por enlace universal `/v/:token` (EN-02, EN-03)

```mermaid
flowchart TD
  A[Cámara nativa lee el QR] --> B{¿App instalada?}
  B -- No --> C[W-01 Página de descarga] --> D[SA-07 Tienda]
  D --> E[Instala y abre la app] --> F[F-01 sin token: el cajero genera uno nuevo]
  B -- Sí --> G[App abre con token]
  G --> H{¿Sesión válida?}
  H -- Sí --> I[F-08 desde claim_visit]
  H -- No --> J[Guarda token pendiente con hora de recepción]
  J --> K[F-02 o F-03]
  K --> L{¿Menos de 60 s desde la recepción?}
  L -- Sí --> I
  L -- No --> M[E-02: pide al cajero un código nuevo y usa el escáner]
```

Un usuario nuevo normalmente no completa su registro en 60 s; el flujo esperado en caja es: registrarse, y el cajero genera un nuevo QR. El texto de W-01 y de E-02 lo indica.

### F-10 Tarjeta completada y recompensa (RN-26 a RN-28)

```mermaid
flowchart TD
  A[claim_visit devuelve tarjeta completada] --> B[A-15 Celebración]
  B --> C[Ver recompensa]
  B --> D[Cerrar]
  D --> E[A-08: cuadrícula en 0 + aviso Recompensa disponible]
  E --> C
  C --> F[Detalle del cupón Premio, vence en 30 días]
  F --> G[F-11 Canje]
```

- El aviso "Recompensa disponible" permanece mientras el cupón de premio esté vigente y sin usar.
- Si el cupón vence, el aviso desaparece y el cupón pasa a "Vencido" (visible en el historial).

### F-11 Canje de cupón o premio (US-17)

```mermaid
flowchart TD
  A[Cupón en A-08, A-10 o A-18] --> B[Mostrar código]
  B --> C{¿Correo verificado?}
  C -- No --> D[E-06 Verifica tu correo]
  C -- Sí --> E[reveal_coupon_code]
  E --> F{Resultado}
  F -- "E-10 Vencido / E-11 Usado" --> G[Mensaje y actualización de la lista]
  F -- "E-01" --> H[Reintentar]
  F -- Éxito --> I[A-19 Código de canje]
  I --> J[El cajero valida: F-22]
  J --> K[La app detecta el canje al volver al primer plano o al cerrar A-19]
  K --> L[Cupón marcado como usado + historial]
```

La app no requiere confirmación en tiempo real del canje: al refrescar la lista, el cupón aparece como usado.

### F-12 Cupón de cumpleaños (RN-43 a RN-45)

| Paso | Condición | Resultado |
|---|---|---|
| 1 | La app se abre (F-01). | Se llama `ensure_birthday_coupons`. |
| 2 | El mes actual coincide con el de nacimiento. | Se crea un cupón por cada comercio con relación activa y beneficio configurado que aún no lo tenga este año. |
| 3 | Se crearon cupones nuevos. | Se muestra una sola tarjeta de felicitación en Explorar con acceso a A-18. |
| 4 | No hay cupones nuevos. | Sin cambios visibles. |

### F-13 Notificación push recibida (EN-04)

```mermaid
flowchart TD
  A[Llega la notificación] --> B{Estado de la app}
  B -- "Primer plano" --> C[Toast con el mensaje y acceso a ver]
  B -- "Fondo o cerrada" --> D[Notificación del sistema]
  D --> E[Toque]
  C --> E
  E --> F{¿Sesión válida?}
  F -- No --> G[F-01 y luego destino]
  F -- Sí --> H{¿Comercio disponible?}
  H -- Sí --> I[A-10 Promociones y cupones del comercio]
  H -- No --> J[A-18 Mis cupones]
```

La carga útil de la notificación incluye `merchant_id` y, si aplica, `coupon_id` para resaltar el cupón al abrir A-10.

### F-14 Permisos

| Permiso | Momento | Si se concede | Si se deniega |
|---|---|---|---|
| Cámara | Primer toque en "Registrar visita" (A-13 antes de la solicitud del sistema). | Abre A-14. | Mensaje con SA-04; el botón vuelve a ofrecer los ajustes. |
| Notificaciones | Tras agregar la primera tarjeta o recibir el primer sello (A-16 antes de la solicitud). | Se registra el Expo Push Token. | Se continúa sin push; los cupones de push igualmente aparecen en la app (RN-48). Se puede activar desde Perfil. |

### F-15 Eliminar cuenta (US-05)

```mermaid
flowchart TD
  A[A-20 Perfil] --> B[Eliminar mi cuenta]
  B --> C[A-22 Advertencia: se pierden sellos, cupones y premios]
  C --> D{¿Confirma escribiendo ELIMINAR?}
  D -- No --> A
  D -- Sí --> AP{¿Cuenta con Apple Sign-In?}
  AP -- Sí --> AR[Volver a autenticar con Apple para obtener el código de autorización]
  AR -- Cancelado --> A
  AR -- Éxito --> E
  AP -- No --> E[Edge Function delete-account]
  E --> F{Resultado}
  F -- Error --> G[E-01 o error general: reintentar]
  F -- Éxito --> H[Cierre de sesión local]
  H --> I[A-02 con mensaje Cuenta eliminada]
```

### F-16 Cerrar sesión

Perfil → "Cerrar sesión" → confirmación → desactivar el token push del dispositivo → borrar sesión segura y caché en memoria → A-02.

---

## 5. Flujos del panel del comercio

### F-20 Inicio de sesión del comercio

```mermaid
flowchart TD
  A[P-01] --> B[Correo y contraseña]
  B --> C{Resultado}
  C -- "Credenciales inválidas" --> D[Mensaje genérico] --> B
  C -- "Rol cliente" --> E[E-19 Esta cuenta no es de comercio] --> B
  C -- Éxito --> F{¿Comercio activo?}
  F -- Sí --> G[P-02 Modo Caja]
  F -- No --> H[P-12 Comercio inactivo]
```

La sesión se mantiene en el dispositivo de caja (renovación automática). La contraseña olvidada se resuelve con Oxis.

### F-21 Generar QR de visita (US-19)

```mermaid
flowchart TD
  A[P-02 Listo] --> B[Generar QR]
  B --> C[generate_visit_qr]
  C --> D{Resultado}
  D -- Error --> E[Mensaje + reintentar]
  D -- Éxito --> F[QR + cuenta regresiva 60 s + suscripción Realtime]
  F --> G{Evento}
  G -- "Token usado" --> H[Visita registrada en verde, 3 s] --> A
  G -- "Llega a 0 s" --> I[QR vencido] --> A
  G -- "Generar otro" --> C
  G -- "Pérdida de conexión Realtime" --> J[Consulta de estado cada 3 s hasta reconectar]
  J --> G
```

Generar un QR nuevo invalida el pendiente anterior del mismo comercio (TRD 6.4).

### F-22 Validar canje (US-20)

```mermaid
flowchart TD
  A[P-02 Campo de código] --> B[Captura 6 caracteres]
  B --> C[lookup_redemption]
  C --> D{Resultado}
  D -- "E-12 No encontrado" --> E[Código no válido, intentos restantes] --> A
  D -- "E-10 Vencido / E-11 Usado" --> F[Mensaje específico] --> A
  D -- "E-13 Validador bloqueado" --> G[Bloqueado, tiempo restante]
  D -- Éxito --> H[P-03 Nombre del cliente + beneficio]
  H --> I{Cajero}
  I -- Cancelar --> A
  I -- Confirmar --> J[confirm_redemption]
  J --> K{Resultado}
  K -- Éxito --> L[Canje registrado] --> A
  K -- "E-11 Usado en otro dispositivo" --> F
```

El código de otro comercio se trata como "no encontrado" para no revelar información.

### F-23 Desbloqueo administrativo y expiración (US-21)

```mermaid
flowchart TD
  A[P-02 Administrar] --> B[P-04 PIN]
  B --> C[unlock_admin]
  C --> D{Resultado}
  D -- "E-14 PIN incorrecto" --> E[Intentos restantes] --> B
  D -- "E-15 Bloqueado" --> F[Bloqueado 15 min, regresar a Modo Caja]
  D -- Éxito --> G[Secciones administrativas]
  G --> H{Evento}
  H -- "5 min sin interacción" --> I[P-02]
  H -- "RPC devuelve E-16 sesión administrativa vencida" --> J[P-04 conservando el formulario en memoria]
  H -- "Salir" --> I
```

Si la sesión administrativa vence durante una edición, el formulario no se pierde: tras el PIN, el usuario reintenta guardar.

### F-24 Configuración de tarjeta (US-22)

P-06 → editar campos → "Guardar" → modal "Los cambios aplicarán a las tarjetas nuevas" → confirmar → `update_card_config` → éxito o error de validación por campo (sellos fuera de 4 a 10, vigencia fuera de 3 a 12 meses, vigencia de push fuera de 24 a 48 h).

Imagen de fondo: selección → recorte a 1.586:1 → generación de variantes WebP (respaldo JPEG) → subida → vista previa de la tarjeta con sellos de ejemplo → guardar.

### F-25 Gestión del menú (US-23)

```mermaid
flowchart TD
  A[P-07 Menú] --> B[Nuevo producto o editar]
  B --> C[P-08 Formulario]
  C --> D{¿Imagen nueva?}
  D -- Sí --> E[Recorte 1:1 + variantes WebP + subida]
  E --> F{¿Subida correcta?}
  F -- No --> G[Error de imagen: reintentar o guardar sin imagen]
  F -- Sí --> H
  D -- No --> H[upsert_product]
  H --> A
  A --> I[Interruptor Agotado por hoy] --> J[set_product_flags]
  A --> K[Interruptor Más pedidos] --> J
  A --> L[Eliminar] --> M[Confirmación] --> N[delete_product]
```

### F-26 Ofertas semanales (US-24)

P-09 → nueva o editar → título, descripción, día de la semana, imagen 16:9 → `upsert_offer` → lista. Eliminar requiere confirmación.

### F-27 Enviar notificación push (US-25)

```mermaid
flowchart TD
  A[P-10] --> B{¿Envíos restantes este mes?}
  B -- "0" --> C[E-17 Límite alcanzado, fecha de reinicio]
  B -- "1 o más" --> D[Título y mensaje]
  D --> E{¿Adjuntar cupón?}
  E -- Sí --> F[Beneficio, restricciones, vigencia 24 a 48 h]
  E -- No --> G
  F --> G[Vista previa de la notificación y del cupón]
  G --> H[Confirmación: se enviará a N clientes y queda X de 5]
  H --> I[Edge Function send-push]
  I --> J{Resultado}
  J -- "E-17" --> C
  J -- "E-16" --> K[F-23 PIN]
  J -- Error de red --> L[Estado desconocido: consultar historial antes de reintentar]
  J -- Éxito --> M[Resultado: enviados y fallidos]
```

Para evitar envíos duplicados, el botón se deshabilita al enviar, y la campaña lleva una clave de idempotencia generada en el panel.

### F-28 Comercio inactivo (RN-71)

| Pantalla | Comportamiento |
|---|---|
| P-12 | Aviso "Tu suscripción no está activa. Contacta a Oxis para reactivarla." |
| Validador | Disponible: permite canjear beneficios ya emitidos (F-22). |
| Generar QR, PIN y secciones administrativas | Ocultos. |
| Reactivación | Al detectar el cambio de estado (al recargar o iniciar sesión), el panel vuelve a P-02. |

---

## 6. Flujos de operación Oxis

| Flujo | Disparador | Pasos | Resultado |
|---|---|---|---|
| F-30 Alta de comercio | Contrato firmado y pago del onboarding | 1. Reunir datos e imágenes. 2. Ejecutar `onboard-merchant.ts` en staging y revisar en la app de staging. 3. Ejecutar en producción. 4. Entregar credenciales y PIN. 5. Capacitar. 6. Marcar `is_visible = true`. | Comercio visible y operando. |
| F-31 Vencimiento | Fin del periodo pagado | 1. Script lista comercios por vencer y vencidos. 2. Contacto de cobranza. 3. Tras 15 días de gracia sin pago, `set-merchant-status.ts` a inactivo. | RN-70, RN-71. |
| F-32 Reactivación | Pago recibido | `set-merchant-status.ts` a activo con nueva fecha de vencimiento. | Datos y progreso intactos (RN-72). |
| F-33 Restablecer PIN | Solicitud del comercio | Verificar identidad del dueño por el canal acordado → `reset-pin.ts` → comunicar el PIN nuevo. | RN-65. |
| F-34 Restablecer contraseña del comercio | Solicitud del comercio | Verificar identidad → restablecer desde Supabase Studio o script. | — |
| F-35 Corrección de fecha de nacimiento | Solicitud del cliente al soporte | Verificar titularidad del correo → corrección por script. | RN-04. |

---

## 7. Catálogo de errores y recuperación

Las RPC devuelven un código estable; la interfaz traduce cada código a un mensaje y una acción.

| Código | Situación | Dónde ocurre | Mensaje (resumen) | Acción de recuperación |
|---|---|---|---|---|
| E-01 | Sin conexión o tiempo agotado | Global | No hay conexión. | Reintentar. |
| E-02 | QR vencido | F-08, F-09 | Este código ya no es válido. | Pedir uno nuevo al cajero; volver al escáner. |
| E-03 | QR ya usado | F-08 | Este código ya fue usado. | Igual que E-02. |
| E-04 | Límite diario de sellos | F-08 | Ya registraste tu visita de hoy. | Cerrar. |
| E-05 | Comercio no disponible | F-06, F-08, F-13 | Este negocio no está disponible por ahora. | Volver; los sellos se conservan. |
| E-06 | Correo sin verificar | F-07, F-11 | Verifica tu correo para continuar. | Reenviar correo. |
| E-07 | Menor de edad | F-02, F-03 | Solo para mayores de 18 años. | Corregir fecha o salir. |
| E-08 | QR no reconocido | F-08 | Este no es un código de Ekko. | Seguir escaneando. |
| E-09 | Ruleta ya girada (cuenta o dispositivo) | F-07 | Ya usaste tu giro de bienvenida en este negocio. | Cerrar. |
| E-10 | Cupón vencido | F-11, F-22 | Este cupón venció. | Actualizar lista. |
| E-11 | Cupón ya usado | F-11, F-22 | Este cupón ya fue canjeado. | Actualizar lista. |
| E-12 | Código no encontrado | F-22 | Código no válido. | Revisar y volver a capturar. |
| E-13 | Validador bloqueado | F-22 | Demasiados intentos. Espera unos minutos. | Esperar el tiempo indicado. |
| E-14 | PIN incorrecto | F-23 | PIN incorrecto. Te quedan N intentos. | Reintentar. |
| E-15 | PIN bloqueado | F-23 | Acceso bloqueado por 15 minutos. | Esperar o contactar a Oxis. |
| E-16 | Sesión administrativa vencida | F-23, F-24 a F-27 | Ingresa tu PIN para continuar. | P-04 conservando el formulario. |
| E-17 | Límite de push alcanzado | F-27 | Usaste tus 5 envíos de este mes. | Esperar al siguiente mes. |
| E-18 | Sesión expirada | Global | Tu sesión expiró. | Iniciar sesión; regresar al destino previo. |
| E-19 | Rol incorrecto | F-01, F-03, F-20 | Esta cuenta no corresponde a esta aplicación. | Cerrar sesión. |
| E-20 | Correo ya registrado | F-02 | Ya existe una cuenta con este correo. | Iniciar sesión o recuperar contraseña. |
| E-21 | Error del proveedor social | F-03 | No pudimos conectar con Google/Apple. | Reintentar u otro método. |
| E-22 | Error de imagen | F-24 a F-26 | No pudimos procesar la imagen. | Otra imagen o reintentar. |
| E-99 | Error inesperado | Global | Algo salió mal. | Reintentar; el error se reporta a Sentry. |

### 7.1 Reglas generales de recuperación

| Regla | Descripción |
|---|---|
| RR-1 | Toda acción que modifica datos deshabilita su botón mientras espera respuesta. |
| RR-2 | Las operaciones del servidor son idempotentes ante reintentos: un reintento de `claim_visit` con el mismo token no otorga dos sellos; un reintento de `confirm_redemption` no duplica el canje. |
| RR-3 | Ante E-18, la app conserva el destino y el token de visita pendiente para retomarlos tras el login. |
| RR-4 | Las listas se refrescan al volver la app a primer plano y con gesto de arrastrar. |
| RR-5 | Ningún error deja al usuario sin una acción visible para continuar. |
