# Brief de Diseño UX/UI — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Documento | Brief de Diseño UX/UI |
| Versión | 1.0 |
| Fecha | 20 de octubre de 2026 |
| Estado | Borrador para aprobación |
| Documentos base | ekko_prd.md v1.0, ekko_trd.md v1.0 |
| Referencias visuales | 7 pantallas de exploración: Iniciar sesión, Crear cuenta, Negocios afiliados, Detalle de comercio, Tarjeta, Menú, Promociones |

---

## 1. Objetivos de diseño

| ID | Objetivo | Medida |
|---|---|---|
| OD-1 | Registrar una visita en el menor número de pasos posible. | Desde la app abierta: 2 toques hasta la cámara; confirmación visible en menos de 3 s. |
| OD-2 | Que el cliente entienda su progreso de un vistazo. | Sellos, premio y vencimiento visibles sin desplazarse en la pantalla de tarjeta. |
| OD-3 | Transmitir recompensa y dinamismo con una estética sobria. | Paleta neutra; el color acento se reserva para sellos, premios y ruleta. |
| OD-4 | Primer registro sin fricción frente al mostrador. | Login social en un toque; formulario de correo en una sola pantalla. |
| OD-5 | Operar la caja sin capacitación extensa. | Modo Caja con dos acciones principales y botones grandes. |
| OD-6 | Mantener la app ligera. | Sin imágenes decorativas en bitmap dentro del binario; una sola familia tipográfica. |

---

## 2. User Personas

### 2.1 Clientes finales

**P1 — Daniela, 22 años, estudiante universitaria en Colima.**
| Atributo | Detalle |
|---|---|
| Contexto | Visita cafeterías 3 a 4 veces por semana para estudiar; presupuesto ajustado. |
| Dispositivo | Android de gama media, almacenamiento casi lleno. |
| Motivaciones | Descuentos, café gratis, descubrir lugares nuevos. |
| Frustraciones | Apps pesadas, registros largos, perder tarjetas de cartón. |
| Implicaciones | App ligera, login con Google, ruleta de bienvenida visible, catálogo para descubrir. |

**P2 — Roberto, 38 años, profesionista.**
| Atributo | Detalle |
|---|---|
| Contexto | Corte de cabello cada 3 semanas, comida de negocios 1 vez por semana. |
| Dispositivo | iPhone reciente. |
| Motivaciones | Rapidez, no cargar tarjetas, recibir beneficios sin esfuerzo. |
| Frustraciones | Notificaciones excesivas, procesos lentos en caja. |
| Implicaciones | Apple Sign-In, escaneo inmediato, máximo 5 push al mes por comercio, "Mis Tarjetas" como pantalla de consulta rápida. |

### 2.2 Comercios

**P3 — Lucía, 45 años, dueña de una cafetería.**
| Atributo | Detalle |
|---|---|
| Contexto | Opera una sucursal con 3 empleados; administra desde una PC en la trastienda y una tableta en caja. |
| Habilidad digital | Media: usa WhatsApp Business y redes sociales. |
| Motivaciones | Que los clientes regresen, llenar los días flojos, ver si el programa funciona. |
| Frustraciones | Sistemas complicados, pagar por funciones que no usa. |
| Implicaciones | Panel claro con métricas simples, envío de push guiado, contador de envíos restantes visible. |

**P4 — Kevin, 20 años, cajero.**
| Atributo | Detalle |
|---|---|
| Contexto | Atiende filas en horas pico; usa la tableta de caja. |
| Motivaciones | Atender rápido sin errores. |
| Frustraciones | Pantallas con muchas opciones, códigos difíciles de leer. |
| Implicaciones | Modo Caja con dos acciones, cuenta regresiva del QR, campo de código con caracteres grandes, confirmaciones con color y texto. |

---

## 3. Principios de experiencia

| ID | Principio | Aplicación |
|---|---|---|
| PX-1 | El progreso es el protagonista. | La cuadrícula de sellos ocupa el centro visual de la tarjeta; el premio siempre está nombrado. |
| PX-2 | Una acción principal por pantalla. | Un solo botón primario oscuro por vista. |
| PX-3 | Permisos en contexto. | Cámara al tocar "Registrar visita"; notificaciones después del primer sello o de agregar la primera tarjeta, con una pantalla previa que explique el beneficio. |
| PX-4 | Errores que dicen qué hacer. | Cada error indica la causa y el siguiente paso ("Este código venció. Pide al cajero uno nuevo."). |
| PX-5 | Esqueletos, no spinners. | Las cargas muestran la forma del contenido. |
| PX-6 | Celebrar con medida. | Animación breve al recibir sello, completar tarjeta y girar la ruleta; nada que bloquee más de 2 s. |
| PX-7 | Sin callejones sin salida. | Todo estado vacío ofrece una acción (por ejemplo, "Explora negocios"). |

---

## 4. Dirección visual

### 4.1 Lectura de las referencias

Las referencias definen una identidad clara que se conserva como base:

- Fondo oscuro casi negro con patrón de círculos azul marino superpuestos.
- Hoja de contenido blanca con una curva amplia en la esquina superior.
- Tipografía geométrica en negrita para títulos; cuerpo sans serif limpio.
- Botones primarios en negro con texto blanco y esquinas redondeadas.
- Chips de filtro: seleccionado en azul marino, no seleccionados con contorno.
- Tarjetas de contenido en gris muy claro con radios generosos.
- Barra inferior de tres íconos circulares blancos.

### 4.2 Qué se conserva y qué se ajusta

| Pantalla de referencia | Se conserva | Se ajusta | Motivo |
|---|---|---|---|
| Iniciar sesión | Composición, curva, logo centrado, botón negro | Campo "Nombre" pasa a "Correo electrónico"; se agregan botones de Google y Apple; enlace a recuperar contraseña se mantiene | El login es por correo (RN-01); Apple exige ofrecer su botón con prominencia equivalente al de Google. |
| Crear cuenta | Formulario en una sola pantalla, etiquetas en mayúsculas espaciadas | "Nombre" se divide en "Nombre" y "Apellido"; se agregan login social, aviso de privacidad, nota de 18+ y reglas de contraseña | RN-01, RN-03, RNF-06. |
| Negocios afiliados | Buscador, chips, tarjeta con logo y portada | Chips alineados a las 9 categorías del PRD en una fila desplazable; se agrega acceso a Google Maps en la tarjeta; texto alineado a la izquierda (no justificado) | RN-51, US-07; el texto justificado genera espacios irregulares en pantallas angostas. |
| Detalle de comercio | Encabezado con portada y logo, botón de ubicación | El menú de 4 botones grandes se reemplaza por pestañas bajo el encabezado, con la tarjeta como pestaña inicial | Elimina un toque en la acción más frecuente y el encabezado ya es común a las 4 vistas (ver DA-2). Se corrige "Reconpensas". |
| Tarjeta | Cuadrícula de círculos, sello con logo y fecha, botón "Registrar visita" | Se agregan imagen de fondo del comercio, nombre del premio, progreso en texto ("1 de 8"), vencimiento del ciclo, términos, estados de recompensa y sello extra; el encabezado se compacta | RN-23 a RN-27, RN-36; la referencia deja mucho espacio vacío. |
| Menú | Chips de categoría con "Más pedidos" primero, tarjeta de producto con foto | Se agrega estado "Agotado"; se elimina la etiqueta de categoría dentro de cada producto cuando el chip ya la indica | RN-56; reduce ruido. |
| Promociones | Ofertas por día con imagen, cupones con botón | Cupones muestran origen (premio, ruleta, push, cumpleaños) y vencimiento; botón "Mostrar código" | RN-37, RN-38. |
| Barra inferior | Tres destinos, íconos circulares | Se agregan etiquetas de texto bajo cada ícono y estado activo visible | Accesibilidad y claridad (Explorar, Mis Tarjetas, Perfil). |

### 4.3 Paleta (tokens propuestos)

Los valores son una aproximación a las referencias y se ajustan en el archivo de diseño.

| Token | Valor propuesto | Uso |
|---|---|---|
| `color.bg.brand` | `#1E2124` | Fondo exterior oscuro. |
| `color.pattern` | `#2C3A5E` | Círculos decorativos. |
| `color.surface` | `#FFFFFF` | Hoja de contenido. |
| `color.surface.muted` | `#F1F1F1` | Tarjetas de producto, oferta y cupón. |
| `color.surface.card` | `#E9E6DF` | Fondo de la cuadrícula de sellos cuando el comercio no sube imagen. |
| `color.text.primary` | `#1E2124` | Títulos y texto principal. |
| `color.text.secondary` | `#6B6F76` | Texto secundario (oscurecido respecto a la referencia para cumplir contraste AA). |
| `color.primary` | `#1E2124` | Botón primario. |
| `color.navy` | `#1F2A4A` | Chip seleccionado, íconos de acción. |
| `color.accent` | `#FF7A3D` (por validar) | Sellos recién otorgados, recompensa disponible, ruleta, insignias. |
| `color.success` | `#1F9D55` | Confirmaciones. |
| `color.error` | `#D93A3A` | Errores. |
| `color.warning` | `#E0A100` | Vencimientos próximos. |

Regla: el acento no se usa en botones genéricos ni en navegación; solo en momentos de recompensa (OD-3).

### 4.4 Tipografía

| Rol | Estilo propuesto |
|---|---|
| Familia | Una sola familia geométrica con 3 pesos (Regular, SemiBold, Bold), por ejemplo Poppins o DM Sans; se elige una en el archivo de diseño (DA-3). |
| Display | 32/36, Bold (títulos de autenticación). |
| H1 | 24/30, Bold. |
| H2 | 20/26, SemiBold. |
| Cuerpo | 16/22, Regular. |
| Secundario | 14/20, Regular. |
| Etiqueta de campo | 12/16, SemiBold, mayúsculas, espaciado 1.5. |
| Código de canje | 32/40, Bold, interletrado amplio, cifras tabulares. |

La app respeta el escalado de fuente del sistema hasta 130% sin romper el diseño.

### 4.5 Forma, espaciado e iconografía

| Elemento | Especificación |
|---|---|
| Escala de espaciado | 4, 8, 12, 16, 24, 32, 48. |
| Radios | 8 (campos pequeños), 12 (botones), 16 (tarjetas), 24 (contenedor de sellos), 32 (curva de la hoja). |
| Elevación | Sin sombras pesadas; separación por color de superficie. |
| Íconos | Un solo set de íconos lineales en SVG, importados individualmente. |
| Patrón de círculos | Dibujado como SVG en código, no como imagen. |
| Imágenes de comercio | Siempre cargadas desde la nube con relación de aspecto fija (ver 6.2). |

---

## 5. Componentes clave

### 5.1 Tarjeta de sellos

| Sellos | Distribución |
|---|---|
| 4 | 4 en una fila |
| 5 | 5 en una fila |
| 6 | 3 + 3 |
| 7 | 4 + 3 |
| 8 | 4 + 4 |
| 9 | 5 + 4 |
| 10 | 5 + 5 |

| Estado del sello | Representación |
|---|---|
| Vacío | Círculo en tono de superficie. |
| Otorgado | Logo del comercio sobre fondo blanco con la fecha `dd/mm/aa` debajo. |
| Recién otorgado | Mismo que otorgado, con animación de entrada y anillo en color acento. |
| Último sello (vacío) | Ícono de regalo en contorno para anticipar el premio. |
| Sello extra pendiente | Insignia "+1 en tu próxima visita" sobre la tarjeta. |

| Estado de la tarjeta | Contenido |
|---|---|
| Sin relación | Vista previa de la tarjeta, premio, términos y botón "Agregar a mis tarjetas". |
| En progreso | Cuadrícula, "X de N sellos", premio, "Vence el dd/mm/aaaa", términos y "Registrar visita". |
| Recompensa disponible | Aviso en color acento "Recompensa disponible" con botón "Ver recompensa", sobre la cuadrícula ya reiniciada (RN-27). |
| Comercio no disponible | Tarjeta en gris con etiqueta "No disponible"; sin botón de registrar visita (RN-71). |

### 5.2 Cupón

Contenido: beneficio, comercio, origen (Premio, Bienvenida, Promoción, Cumpleaños), vencimiento relativo ("Vence en 23 h") y absoluto, restricciones y botón "Mostrar código".
Estados: vigente, por vencer (menos de 24 h, color de advertencia), requiere verificación de correo, usado, vencido.

### 5.3 Código de canje

Pantalla completa con fondo blanco, código de 6 caracteres en tamaño grande separado en dos grupos de 3, nombre del beneficio y del comercio, e instrucción "Muestra este código al cajero". El brillo de pantalla no se modifica.

### 5.4 Ruleta de bienvenida

Modal de pantalla completa. Muestra los premios del comercio en segmentos; el giro dura entre 2 y 3 s y se detiene en el resultado que devolvió el servidor. Al terminar: tarjeta del premio y botón "Ver mi cupón". Si el correo no está verificado, se muestra la ruleta bloqueada con el mensaje para verificar.

### 5.5 Otros componentes

| Componente | Notas |
|---|---|
| Tarjeta de comercio (catálogo) | Logo circular, portada 16:9, nombre, categoría, descripción de 2 líneas máximo, ícono de ubicación. |
| Tarjeta de producto | Foto 1:1, nombre, descripción de 2 líneas, precio; estado "Agotado" con foto en escala de grises y etiqueta. |
| Tarjeta de oferta | Día de la semana destacado, descripción, imagen; resaltada si es el día actual. |
| Chip | Seleccionado (azul marino, texto blanco) y no seleccionado (contorno). |
| Banner de verificación | Persistente en la parte superior mientras el correo no esté verificado, con "Reenviar correo". |
| Toast | Confirmaciones breves (3 s). |
| Esqueletos | Para catálogo, detalle de comercio, menú y listas. |

---

## 6. Restricciones técnicas de interfaz

### 6.1 Generales

| ID | Restricción |
|---|---|
| RT-01 | Solo modo claro y solo español. |
| RT-02 | iOS 15.0+ y Android 8.0+; diseño base a 375 × 812 pt, verificado en 360 × 640 dp. |
| RT-03 | Respetar áreas seguras (notch, barra de gestos). |
| RT-04 | Áreas táctiles mínimas de 44 × 44 pt. |
| RT-05 | Contraste mínimo WCAG AA (4.5:1 texto normal, 3:1 texto grande). |
| RT-06 | El binario solo incluye: logo de Ekko, ícono de la app, splash y los SVG de íconos. Nada de imágenes de comercios ni fotos decorativas. |
| RT-07 | Los textos deben tolerar longitudes reales: nombres de comercio de hasta 40 caracteres y descripciones de hasta 140. |
| RT-08 | No hay centro de notificaciones ni modo offline: el diseño no debe sugerirlos. Sin conexión se muestra un estado de error con "Reintentar". |

### 6.2 Imágenes (alineadas con el TRD, sección 8)

| Tipo | Relación de aspecto | Recomendación al comercio |
|---|---|---|
| Logo | 1:1 | Fondo blanco o transparente, centrado. |
| Portada | 16:9 | Foto del local, sin texto. |
| Fondo de tarjeta | 1.586:1 | Imagen de baja saturación para que los sellos sean legibles; se aplica un velo semitransparente sobre ella. |
| Producto | 1:1 | Producto centrado sobre fondo neutro. |
| Oferta | 16:9 | — |

### 6.3 Panel web

| ID | Restricción |
|---|---|
| RT-09 | Diseño principal para tableta horizontal (1024 × 768) y PC (1280 o más); funcional en tableta vertical. |
| RT-10 | El QR se muestra a un mínimo de 280 × 280 px con margen blanco, centrado y con cuenta regresiva visible. |
| RT-11 | El campo de código de canje acepta minúsculas y las convierte a mayúsculas; usa caracteres grandes y separación en dos grupos. |
| RT-12 | Las secciones administrativas muestran claramente que están desbloqueadas y cuánto falta para volver a Modo Caja. |
| RT-13 | Misma identidad visual que la app, en versión más sobria: sin patrón de círculos en áreas de trabajo. |

---

## 7. Inventario de pantallas

### 7.1 App móvil

| ID | Pantalla | Propósito | Estados | Referencia |
|---|---|---|---|---|
| A-01 | Splash | Carga inicial y verificación de sesión. | — | — |
| A-02 | Iniciar sesión | Correo y contraseña, Google, Apple. | Error de credenciales, cuenta de comercio rechazada | US-02, US-03 |
| A-03 | Crear cuenta | Registro por correo. | Validación por campo, correo existente, menor de edad | US-01 |
| A-04 | Completar perfil | Datos faltantes tras login social. | Menor de edad | RN-02, RN-03 |
| A-05 | Verifica tu correo | Instrucciones y reenvío. | Enviado, error de envío | RN-05 |
| A-06 | Recuperar contraseña | Solicitud de enlace. | Enviado | US-03 |
| A-07 | Explorar | Catálogo, búsqueda, categorías. | Cargando, vacío por búsqueda, sin conexión, fin de lista | US-07 |
| A-08 | Detalle de comercio — Tarjeta | Progreso y registro de visita. | Ver 5.1 | US-10 a US-14 |
| A-09 | Detalle de comercio — Menú | Productos por categoría. | Vacío, agotado | US-08, RN-55 a RN-57 |
| A-10 | Detalle de comercio — Promociones y cupones | Ofertas semanales y cupones del comercio. | Sin ofertas, sin cupones | RN-37, RN-58 |
| A-11 | Detalle de comercio — Reseña | Acceso a Google Maps. | — | US-09 |
| A-12 | Ruleta | Giro de bienvenida. | Bloqueada por verificación, girando, resultado | US-15 |
| A-13 | Permiso de cámara | Explicación previa. | Denegado (enlace a ajustes) | PX-3 |
| A-14 | Escáner | Lectura del QR. | Buscando, leyendo | US-11 |
| A-15 | Resultado de visita | Confirmación o error. | Sello otorgado, tarjeta completada, ya registraste hoy, QR vencido o usado, comercio no disponible, sin conexión | US-11, US-13 |
| A-16 | Permiso de notificaciones | Explicación previa. | — | PX-3 |
| A-17 | Mis Tarjetas — Tarjetas | Tarjetas con relación. | Vacío | RN-37 |
| A-18 | Mis Tarjetas — Cupones | Todos los cupones vigentes. | Vacío | US-16 |
| A-19 | Código de canje | Mostrar código al cajero. | Requiere verificación | US-17 |
| A-20 | Perfil | Datos, historial y eliminar cuenta. | Fecha de nacimiento no editable | US-06 |
| A-21 | Historial de canjes | Lista básica. | Vacío | US-06 |
| A-22 | Eliminar cuenta | Confirmación con advertencia. | Procesando, error | US-05 |
| A-23 | Aviso de privacidad y términos | Vista web externa. | — | RNF-06 |

Puntos de entrada al escáner: botón "Registrar visita" en la tarjeta de cada comercio y en el encabezado de "Mis Tarjetas". Ambos abren el mismo escáner global (RN-16).

### 7.2 Web pública

| ID | Pantalla | Propósito |
|---|---|---|
| W-01 | `/v/:token` | Para quien escanea sin la app: logo, mensaje breve y botones a App Store y Google Play. |

### 7.3 Panel del comercio

| ID | Pantalla | Propósito | Estados | Referencia |
|---|---|---|---|---|
| P-01 | Iniciar sesión | Acceso del comercio. | Error, cuenta de cliente rechazada | RN-61 |
| P-02 | Modo Caja | Generar QR y validar códigos. | Listo, QR activo con cuenta regresiva, visita registrada, QR vencido, comercio inactivo (solo validador) | US-19, US-20 |
| P-03 | Resultado de validación | Nombre del cliente y beneficio, botón confirmar. | Código inválido, vencido, usado, de otro comercio, validador bloqueado | US-20 |
| P-04 | Desbloqueo con PIN | Acceso administrativo. | PIN incorrecto con intentos restantes, bloqueado con tiempo restante | US-21 |
| P-05 | Métricas | Visitas, canjes, clientes activos. | Sin datos aún | US-26 |
| P-06 | Configuración de tarjeta | Sellos, premio, términos, vigencias, imagen de fondo. | Advertencia de "aplica a ciclos nuevos" | US-22 |
| P-07 | Menú | Lista de categorías y productos con interruptores. | Vacío | US-23 |
| P-08 | Formulario de producto | Alta y edición. | Subiendo imagen, error de imagen | US-23 |
| P-09 | Ofertas semanales | Lista y formulario. | Vacío | US-24 |
| P-10 | Notificaciones push | Redacción, cupón opcional, vista previa, envíos restantes. | Límite alcanzado, enviando, resultado | US-25 |
| P-11 | Registro de QR | Bitácora de QR generados y usados. | Vacío | RN-66 |
| P-12 | Comercio inactivo | Aviso y acceso solo al validador. | — | RN-71 |

---

## 8. Microcopy

### 8.1 Tono

Cercano, breve y en segunda persona del singular ("tú"). Sin tecnicismos. Celebraciones cortas; errores sin culpar al usuario.

### 8.2 Mensajes clave

| Situación | Texto propuesto |
|---|---|
| Sello otorgado | "¡Sello registrado! Llevas 4 de 8." |
| Tarjeta completada | "¡Completaste tu tarjeta! Tu recompensa te espera." |
| Ya registró hoy | "Ya registraste tu visita de hoy en este negocio. Vuelve mañana." |
| QR vencido o usado | "Este código ya no es válido. Pide al cajero uno nuevo." |
| Comercio no disponible | "Este negocio no está disponible por ahora. Tus sellos siguen guardados." |
| Requiere verificación | "Verifica tu correo para girar la ruleta y canjear tus premios." |
| Sin conexión | "No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo." |
| Menor de edad | "Ekko Rewards es solo para mayores de 18 años." |
| Cambio de configuración (panel) | "Los cambios aplicarán a las tarjetas nuevas. Las tarjetas en curso conservan sus reglas actuales." |
| Límite de push (panel) | "Usaste tus 5 envíos de este mes. Podrás enviar de nuevo el 1 de [mes]." |

---

## 9. Accesibilidad (mínimos del MVP)

- Contraste AA en texto e íconos funcionales.
- Etiquetas de texto en la barra inferior y etiquetas accesibles en todos los botones de solo ícono.
- La información nunca depende solo del color (estados con texto o ícono).
- Soporte de escalado de fuente del sistema hasta 130%.
- Orden de lectura lógico para lectores de pantalla en tarjeta, cupón y código.
- Animaciones reducidas si el sistema tiene activada la opción de reducir movimiento.

---

## 10. Entregables de diseño

| ID | Entregable | Formato |
|---|---|---|
| ED-1 | Archivo de diseño con todas las pantallas del inventario y sus estados. | Figma (o la herramienta del equipo). |
| ED-2 | Biblioteca de componentes con variantes. | Mismo archivo. |
| ED-3 | Tokens de diseño (color, tipografía, espaciado, radios) exportados a `packages/shared`. | JSON o TypeScript. |
| ED-4 | Prototipo navegable de los flujos: primer registro en caja, registro de visita, completar tarjeta y canjear, ruleta. | Prototipo interactivo. |
| ED-5 | Logo final, ícono de la app (iOS y Android adaptativo) y splash. | SVG y PNG en tamaños de tiendas. |
| ED-6 | Plantilla estándar de fondo de tarjeta para el onboarding. | PNG/WebP 1.586:1. |
| ED-7 | Capturas para tiendas (tarea pendiente de la fase final). | Tamaños requeridos por cada tienda. |

---

## 11. Decisiones abiertas de diseño

| ID | Decisión | Propuesta |
|---|---|---|
| DA-1 | Color acento vibrante. | `#FF7A3D` (naranja), contrastante con el azul marino; validar en el archivo de diseño. |
| DA-2 | Navegación dentro del comercio: menú de 4 botones (referencia) o pestañas. | Pestañas bajo el encabezado, con la tarjeta como vista inicial. |
| DA-3 | Familia tipográfica única. | Poppins o DM Sans, 3 pesos. |
| DA-4 | Comportamiento del encabezado del comercio. | Se compacta al desplazarse (portada se oculta, quedan logo y nombre). |
