# Ekko — Propuestas de mejora UI/UX (revisión 2026-10-23)

Revisión de la App móvil y del Panel B2B con la skill `ui-ux-pro-max` (3 subagentes, solo lectura).
Dirección: **minimalista, moderno, elegante, con sensación de recompensa**; la app se mantiene **ligera**.
Fuente de verdad que se respeta: `docs/ekko_brief_ux_ui.md` (son evoluciones, no una marca nueva).

**Cómo aprobar:** responde con los IDs (ej. "A-27, A-28, P-19"). Lo aprobado se hace en una rama de prueba; si te gusta, se integra.
**Leyenda:** Impacto Alto/Medio/Bajo · Esfuerzo S (horas) / M (1 día) / L · Peso: *sin deps* o *dep nueva*.

## Notas del orquestador

- **Peso:** la app solo tiene `Animated` de RN + `react-native-svg` (no hay Reanimated ni Lottie). Todas las animaciones propuestas usan eso. La **única dependencia nueva propuesta es `expo-haptics`** (módulo Expo pequeño; requiere nuevo build EAS). Todo lo háptico es opcional y separable.
- **Duplicados fusionados** (dos subagentes llegaron a lo mismo; apruébalos como uno):
  A-28 = A-57 (sello nuevo "estampado") · A-30 = A-56 (slots vacíos punteados) · A-27 ≈ A-50 (anticipación "te falta 1") · A-23 = A-74 + A-75 (cumpleaños) · A-02 = A-83 (escala al presionar) · A-08 ≈ nota de tokens rgba · A-84 = utilidad común de hápticos.
- **A-22 (favoritos no recarga todo el catálogo):** contradice una decisión reciente — el servidor ordena favoritos primero y por eso se recarga la lista. Opción intermedia: no recargar la lista al tocar el corazón y dejar que el nuevo orden aparezca al volver a entrar/refrescar (evita que la lista "salte" bajo el dedo). Recomiendo aprobarla así.
- **Verificado por mí:** la ruleta gira 4.2 s y el brief pide 2–3 s (A-71); `key={group}` repetible en el código del cupón (A-67).
- **Requieren backend:** A-19 (progreso en Explorar), P-20 (progreso en Modo Caja), variación de P-23.

---

# 1. App móvil

## 1.1 Kit UI y layout global

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-01 | **Foco visible en campos**: TextField/PasswordField/buscador dejan el borde transparente sin error (`TextField.tsx:15`) → borde `navy` al enfocar, como CodeField. | Alto | S | sin deps |
| A-02 | **Escala 0.97 al presionar** botones (hoy solo opacidad, `Button.tsx:60`), con `Animated.spring` nativo, respeta reduce-motion. | Medio | S | sin deps |
| A-03 | **Ícono en EmptyState/ErrorState** (hoy solo texto): SVG 48 pt en círculo `surfaceMuted` (lupa, nube tachada). | Medio | S | sin deps |
| A-04 | **Skeleton con un solo loop compartido** (hoy un loop por bloque, desfasados) y usar `useReduceMotion`. | Bajo | S | sin deps |
| A-05 | **Toast sin acción obligatoria y sin sombra pesada** (`Toast.tsx:61`); usarlo en vez de `Alert.alert` para errores breves (favoritos). | Medio | S | sin deps |
| A-06 | **Corazón con color propio** (hoy usa `colors.error`) + "pop" 1→1.2→1 en 180 ms al marcar. | Bajo | S | sin deps |
| A-07 | **Chips no seleccionados más ligeros**: borde 1 pt `surfaceCard` (9 chips con contorno oscuro = ruido). | Bajo | S | sin deps |
| A-08 | **Tokens sueltos a tokens**: rgba del pill activo, VEIL, SCRIM, backdrop de DateField, `fontSize:12` → `colors.navyTint/veil/overlay`, `radii.pill`. | Bajo | S | sin deps |
| A-09 | **Header con propósito en Explorar**: "Hola, {nombre}" + "Tienes 2 recompensas listas" (datos ya cacheados). | Medio | M | sin deps |
| A-10 | **Patrón de marca con un "sello"**: uno de los círculos navy como anillo `accent` de 2 pt. Une marca y recompensa, 0 bytes extra. | Medio | S | sin deps |
| A-53 | **Badge en la pestaña "Mis Tarjetas"** (punto acento) cuando hay recompensa disponible o cupones vigentes (`tabBarBadge`, ya incluido). | Alto | S | sin deps |
| A-63 | **Un solo componente `Entrance`** + tokens `motion.fast/base/celebrate` (hoy hay 2 entradas animadas duplicadas y vendrían más). | Medio | S | sin deps |
| A-84 | **`lib/haptics.ts`** con `success`/`light`, usado solo en 4 momentos: sello, tarjeta completa, premio de ruleta, canje confirmado. | Alto | S | dep nueva (expo-haptics) |

## 1.2 Acceso y onboarding

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-11 | "¿Olvidaste tu contraseña?" **bajo el campo**, alineado a la derecha (hoy bajo el botón Entrar). | Bajo | S | sin deps |
| A-12 | **Regla de contraseña persistente** como helper (hoy es placeholder y desaparece al escribir). | Medio | S | sin deps |
| A-13 | **Consentimiento con casilla**, no switch; "Solo mayores de 18" como helper del campo de fecha. | Bajo | S | sin deps |
| A-14 | **Verificar correo con acción principal** clara (hoy solo botón secundario). | Medio | S | sin deps |
| A-15 | **Celebrar la verificación**: check SVG animado + "Ya puedes girar la ruleta y canjear tus premios". | Medio | S | sin deps |
| A-16 | **Skeleton en vez de spinner** en completar perfil y nueva contraseña. | Bajo | S | sin deps |
| A-17 | Permisos: **"Ahora no" como enlace**, no botón de ancho completo. | Bajo | S | sin deps |
| A-82 | **Explicador de notificaciones con beneficios concretos** ("te avisamos cuando un cupón esté por vencer…") + ilustración SVG de campana. | Medio | S | sin deps |

## 1.3 Explorar

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-18 | **Buscador completo**: lupa + botón "×" de 44 pt en ambas plataformas (hoy el clear solo funciona en iOS). | Medio | S | sin deps |
| A-19 | **Progreso por comercio en la tarjeta** ("3/8 · Café gratis" + barra fina). Mayor disparador de anticipación del catálogo. | Alto | M | sin deps (cambio de RPC) |
| A-20 | **Portada vacía digna** (patrón de marca claro o iniciales) en vez de bloque gris. | Bajo | S | sin deps |
| A-21 | **Menos controles sobre la portada**: solo el corazón; "Ver mapa" pasa a la fila de categoría. | Bajo | S | sin deps |
| A-22 | **Favorito sin recargar todo el catálogo** (ver nota del orquestador). | Medio | S | sin deps |
| A-23 | **Felicitación de cumpleaños con identidad**: fondo `surfaceCard`, regalo/pastel SVG en círculo acento, X en SVG (hoy "✕" de texto), copy cálido. *(incluye A-74, A-75)* | Medio | S | sin deps |

## 1.4 Detalle del comercio

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-24 | **Skeleton con forma real** (círculos de sellos) en vez de bloque de 260 pt. | Bajo | S | sin deps |
| A-25 | **Chip "3 de 8 sellos" junto al nombre** en el header, visible en las 4 pestañas (aprovecha ~30 pt vacíos). | Medio | S | sin deps |
| A-26 | **Comercio no disponible en pantalla** (EmptyState + "Volver a Explorar") en vez de Alert nativo. | Bajo | S | sin deps |
| A-27 | **Anticipación explícita**: "Te faltan 5 para tu premio" + barra de 4 pt; con 1: "¡Solo te falta 1!" y anillo acento en el slot del regalo. *(≈A-50)* | Alto | S | sin deps |
| A-28 | **Sello nuevo que se siente**: spring 0.6→1 con overshoot, anillo acento que se desvanece, háptico Success; estático con reduce-motion. *(=A-57)* | Alto | S | sin deps (+expo-haptics) |
| A-29 | **Aviso de recompensa arriba de la cuadrícula** (como pide el brief §5.1) con pulso único del regalo. | Alto | S | sin deps |
| A-30 | **Slots vacíos punteados** (1 pt, más elegantes, se leen "por llenar"). *(=A-56)* | Medio | S | sin deps |
| A-31 | **Menos botones apilados**: la ruleta pasa a banner acento dentro de la tarjeta ("Tienes un giro de bienvenida"); el premio se integra a la tarjeta. | Alto | M | sin deps |
| A-32 | **Términos colapsables** (acordeón). | Bajo | S | sin deps |
| A-33 | **Un solo botón primario en Promociones** (hoy cada cupón tiene "Mostrar código" primario). | Medio | S | sin deps |
| A-34 | **Cupón resaltado con palabra** ("Nuevo"/"Tu premio") y no solo borde acento. | Medio | S | sin deps |
| A-35 | Copy de vacíos ("Menú próximamente") y **producto sin foto alineado** (placeholder 88 pt). | Bajo | S | sin deps |
| A-36 | **Reseña con contexto**: 5 estrellas decorativas + ícono de Maps. | Bajo | S | sin deps |

## 1.5 Mis Tarjetas

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-50 | **"¡Te falta 1 sello!"** en la fila y **orden**: recompensa disponible → más cercanas al premio → resto. | Alto | S | sin deps |
| A-51 | **Último punto de progreso con regalo** (mismo lenguaje que la tarjeta). | Medio | S | sin deps |
| A-52 | **Badges con radio píldora consistente** (token `radii.pill`). | Bajo | S | sin deps |
| A-54 | **"Cupones · 2"** en la pestaña (conteo crea expectativa). | Medio | S | sin deps |
| A-55 | **Urgencia de vencimiento**: < 7 días → "Vence en 3 días" + píldora "Por vencer". | Medio | S | sin deps |
| A-69 | "No disponible por ahora" **en su propia línea**, no pegado al nombre. | Bajo | S | sin deps |

## 1.6 Registrar visita

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-58 | **Feedback al detectar el QR**: esquinas del visor en acento ~150 ms antes de navegar (+háptico ligero). | Medio | S | sin deps (+expo-haptics) |
| A-59 | **Botón de linterna** en el escáner (`enableTorch` de expo-camera). Cafeterías y bares con poca luz. | Medio | S | sin deps |
| A-60 | **Progreso visual en "¡Sello registrado!"**: fila de puntos con el último llenándose. | Alto | S | sin deps |
| A-61 | **Celebración de tarjeta completa**: N puntos llenos + "burst" de 8 trazos SVG en acento (~500 ms, una vez) + háptico. El momento más importante de la app. | Alto | M | sin deps |
| A-62 | Evitar **doble anuncio** del lector de pantalla en Android. | Bajo | S | sin deps |

## 1.7 Cupones

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-64 | **Cupón con forma de "ticket"** (muescas + línea punteada) e ícono por origen (regalo, estrella, megáfono, pastel). | Alto | S | sin deps |
| A-65 | **Cerrar el ciclo del canje**: la pantalla del código detecta que el cajero ya lo validó y muestra "¡Listo! Disfruta tu {beneficio}" (hoy un refresco mostraría "Cupón no disponible"). | Alto | M | sin deps |
| A-66 | **"Reveal" sutil del código** (fade + escala 250 ms). | Bajo | S | sin deps |
| A-67 | Valores fijos a tokens (`radii.card`, nuevo `codeLarge`) y **bug de `key` repetida** en el código. | Bajo | S | sin deps |
| A-68 | **Historial de canjes como logro**: check + "Canjeado" + logo del comercio, menos peso visual. | Medio | S | sin deps |

## 1.8 Ruleta

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-70 | **La ruleta gira al tocar** (giro de preparación mientras responde el servidor, luego desacelera al premio). Hoy se queda quieta. | Alto | M | sin deps |
| A-71 | **Giro de 2.8 s** (hoy 4.2 s; el brief pide 2–3 s). | Medio | S | sin deps |
| A-72 | **Premio celebrado**: mismo burst que A-61 + mini cupón ticket con beneficio y vencimiento. | Alto | S | sin deps |
| A-73 | **Acabado del disco**: centro navy más grande, anillo exterior; opcional tick háptico al desacelerar. | Medio | S | sin deps (+expo-haptics) |

## 1.9 Perfil

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| A-76 | **Unificar los dos controles de notificaciones** en una sección (switch + "Desactivadas en el sistema · Abrir ajustes" solo si aplica). | Alto | S | sin deps |
| A-77 | **Candado SVG** en vez del emoji 🔒. | Bajo | S | sin deps |
| A-78 | **Franja de logros**: "Sellos · Tarjetas · Canjes" bajo el avatar. | Medio | M | sin deps |
| A-79 | **"Guardar cambios" solo cuando hay cambios**; éxito como Toast. | Medio | S | sin deps |
| A-80 | Chevron SVG e ícono en "Historial de canjes". | Bajo | S | sin deps |
| A-81 | **Eliminar cuenta concreto**: "Perderás 3 tarjetas, 14 sellos y 2 cupones". | Medio | S | sin deps |

### Top 5 App
1. **A-61 + A-72** — celebración de tarjeta completa y premio de ruleta.
2. **A-27/A-50 + A-53** — anticipación: "te falta 1", orden por cercanía, badge en la pestaña.
3. **A-28 + A-84** — sello nuevo "estampado" + hápticos en 4 momentos (única dep nueva).
4. **A-65** — el canje se celebra en lugar de mostrar un error.
5. **A-70 + A-71** — ruleta inmediata y de 2–3 s.

---

# 2. Panel B2B

## 2.1 Transversal

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-01 | **Bordes de campos con contraste** (hoy `border-black/20` ≈1.6:1; WCAG pide 3:1) → `border-text-secondary` como en Login. | Alto | S | sin deps |
| P-02 | **Clases de botón/input y `Switch` en un solo lugar** (copiadas en 9 archivos). | Medio | S | sin deps |
| P-03 | **`Field` desde `components/FormField`** siempre (hoy duplicado o importado desde una página). | Bajo | S | sin deps |
| P-04 | **Radios y tipografía como tokens** en `index.css` (hoy `tracking-[1.5px]`, `rounded-[32px]`, `text-[32px]` sueltos). | Medio | S | sin deps |
| P-05 | **Un solo estilo de etiqueta** de formulario (recomendado: oración 14–16 px en formularios largos). | Bajo | S | sin deps |
| P-06 | **Eliminar con estilo de peligro** (rojo) y foco inicial en "Cancelar". | Medio | S | sin deps |
| P-07 | **Feedback al tocar en tableta** (`active:`), hoy solo el teclado del PIN lo tiene. | Medio | S | sin deps |
| P-08 | **Avisar cambios sin guardar** al salir de Perfil/Tarjeta/Producto/Oferta (`useBlocker` + barra "Cambios sin guardar"). | Alto | M | sin deps |
| P-09 | **Estados de carga/error uniformes** (`PageState` con título, skeleton y reintento). | Medio | S | sin deps |
| P-10 | **Íconos SVG en vez de glifos** (−, +, ↑, ↓, ★). | Bajo | S | sin deps |

## 2.2 Login, inactivo y navegación

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-11 | **Login con identidad de marca**: círculos navy (mismo patrón que la app) y logo. | Medio | S | sin deps |
| P-12 | **Mostrar/ocultar contraseña** y "Contacta a Oxis" como enlace real (mailto/WhatsApp). | Medio | S | sin deps |
| P-13 | **Mostrar el logo del negocio** en los encabezados (hoy TODO con iniciales). | Medio | S | sin deps |
| P-14 | **"Cerrar sesión" fuera del alcance del cajero** o con confirmación (un toque accidental deja la caja fuera). | Alto | S | sin deps |
| P-15 | **Una sola salida de Administración**: "Bloquear y volver a Caja". | Medio | S | sin deps |
| P-16 | **Aviso "Se bloqueará pronto"** cuando queda < 60 s de sesión admin. | Bajo | S | sin deps |
| P-17 | **Menú lateral más angosto** en 1024 px y agrupado: Mi programa / Mi negocio / Reportes. | Medio | S | sin deps |
| P-18 | **Skeleton correcto** en rutas de Administración (hoy siempre el de Caja). | Bajo | S | sin deps |

## 2.3 Modo Caja (prioridad: velocidad en mostrador)

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-19 | **Todo visible sin scroll en tableta 1024×768** (por cálculo ≈840 px; el botón queda bajo el pliegue): escenario QR adaptable, encabezado compacto, sin pie de versión. | Alto | S | sin deps |
| P-20 | **Visita registrada con progreso**: "Lleva 4 de 8 · faltan 4 para su premio" para que el cajero anime al cliente. | Medio | M | sin deps (dato backend) |
| P-21 | **Mismas etiquetas de origen del cupón que la app** (compartidas en `@ekko/shared`). | Bajo | S | sin deps |
| P-22 | **El beneficio pesa más que el nombre del cliente** en el resultado del canje; marcar "Vence hoy". | Medio | S | sin deps |

## 2.4 Métricas

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-23 | **Métricas que cuentan el valor**: tasa de canje y "premios entregados a tus clientes" (variación vs periodo anterior requiere RPC). | Alto | M | sin deps |
| P-24 | **Gráficas con estilo de marca**: 2 columnas en pantallas grandes, leyenda solo donde hay 2 series, tooltip con formato, series no solo por color. | Medio | S | sin deps |
| P-25 | Selector de periodo: botones con `aria-pressed` (hoy `radio` sin flechas de teclado). | Bajo | S | sin deps |
| P-26 | **Vacío que guía** ("Ir a Modo Caja") en Métricas y Registro de QR. | Bajo | S | sin deps |

## 2.5 Configuración de tarjeta

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-27 | **Vista previa fiel a la app**: el último sello con regalo (hoy ★, que en la app significa sello extra), borde de vacíos, "X de N", "Premio", "Vence el…". | Alto | M | sin deps |
| P-28 | **Vista previa sin recorte** con 10 sellos (quitar proporción fija) y velo/colores iguales a la app. | Medio | S | sin deps |
| P-29 | **Vista previa visible en tableta** (arriba y fija bajo `xl`). | Medio | S | sin deps |
| P-30 | **Stepper con nombre accesible** (hoy `aria-labelledby` apunta a un id inexistente). | Medio | S | sin deps |
| P-31 | **Vigencia de cupones push en Notificaciones** como valor predeterminado (no en Tarjeta). | Bajo | S | sin deps |

## 2.6 Menú, Ofertas, Notificaciones, Perfil, Registro QR

| ID | Propuesta | Imp. | Esf. | Peso |
|---|---|---|---|---|
| P-32 | **Interruptor apagado con contraste** (≈2.1:1 hoy) e insignia de texto "Agotado". | Alto | S | sin deps |
| P-33 | **Acciones de fila de 48 px** y Subir/Bajar/Eliminar en un menú "Más". | Medio | S | sin deps |
| P-34 | **"Agregar producto" por categoría**. | Bajo | S | sin deps |
| P-35 | **Reutilizar `ImagePicker`** en Producto y Oferta. | Bajo | S | sin deps |
| P-36 | **Ofertas en vista semanal compacta** (hoy 7 tarjetas apiladas). | Medio | M | sin deps |
| P-37 | **Día de la semana con 7 chips** (Lun…Dom) en vez de `select`. | Bajo | S | sin deps |
| P-38 | **Vista previa del cupón push igual al de la app**. | Medio | S | sin deps |
| P-39 | **Recordar incluir el nombre del negocio** en el título de la notificación (o prefijarlo en backend). | Medio | S | sin deps |
| P-40 | **"Llegará a N clientes"** antes de enviar. | Medio | S | sin deps |
| P-41 | Texto "Adjuntar cupón" tocable (label). | Bajo | S | sin deps |
| P-42 | **Perfil con vista previa "Así te ven tus clientes"** (portada, logo, nombre, categoría). | Medio | M | sin deps |
| P-43 | **Registro de QR como tabla** con ícono + texto por estado. | Bajo | S | sin deps |

### Top 5 Panel
1. **P-19** — Modo Caja sin scroll en tableta (la pantalla más usada).
2. **P-01 + P-32** — contraste de campos e interruptores (WCAG) y "Agotado" con texto.
3. **P-27** — vista previa de tarjeta fiel a la app.
4. **P-08** — no perder cambios sin guardar.
5. **P-23** — métricas que muestran el valor entregado.

---

## Paquetes sugeridos (si prefieres aprobar por bloque)

- **Paquete "Recompensa" (App):** A-27, A-28, A-29, A-30, A-50, A-53, A-60, A-61, A-64, A-65, A-70, A-71, A-72 (+A-84 si aceptas expo-haptics).
- **Paquete "Pulido UI" (App):** A-01, A-02, A-03, A-05, A-08, A-18, A-63, A-67, A-76, A-77, A-79.
- **Paquete "Accesibilidad y caja" (Panel):** P-01, P-06, P-14, P-19, P-25, P-30, P-32.
- **Paquete "Fidelidad y valor" (Panel):** P-13, P-23, P-24, P-27, P-28, P-38, P-42.
