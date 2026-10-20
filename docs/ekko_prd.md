# PRD — Ekko Rewards

| Campo | Valor |
|---|---|
| Producto | Ekko Rewards |
| Empresa | Oxis |
| Documento | Product Requirements Document (PRD) |
| Versión | 1.0 |
| Fecha | 20 de octubre de 2026 |
| Estado | Aprobado para diseño técnico (Fase 2) |
| Alcance | MVP — Fase 1 |
| Fuentes | ekko_rewards.md, ekko_perf.md, ekko_preguntas / ekko_respuestas (rondas 1 a 4) |

---

## 1. Contexto y problema

Los comercios locales de Colima (restaurantes, cafeterías, barberías, estéticas, spas, entre otros) fidelizan a sus clientes con tarjetas de cartón: se pierden, se falsifican, no generan datos y no permiten comunicarse con el cliente después de la visita.

Los consumidores, por su parte, acumulan tarjetas físicas dispersas y no tienen un lugar único para consultar beneficios, menús y promociones de sus negocios favoritos.

Las apps de lealtad existentes suelen ser pesadas. El espacio ocupado en el teléfono es una causa principal de desinstalación, lo que destruye el valor del programa para el comercio.

## 2. Visión del producto

Ekko Rewards es una plataforma de lealtad B2B2C que reemplaza las tarjetas de sellos físicas por una app móvil única, ligera y gratuita para el consumidor, y un panel web para el comercio. El comercio paga a Oxis un onboarding y una suscripción trimestral o anual.

### 2.1 Propuesta de valor

| Actor | Valor |
|---|---|
| Comercio | Retención de clientes a bajo costo, registro de visitas con QR dinámico antifraude, menú digital con estado de agotados en tiempo real, canal directo de notificaciones push con cupones y métricas básicas. |
| Cliente final | Todas sus tarjetas de lealtad, cupones, menús y promociones en una sola app gratuita, ligera y sin papel. |
| Oxis | Ingreso recurrente (SaaS) y puerta de entrada comercial para otros servicios digitales. |

### 2.2 Principios del producto

1. **Ultraligera y cloud-first:** la app no almacena assets pesados; todo el procesamiento y las reglas de negocio viven en el servidor.
2. **Cero fricción en caja:** registrar una visita debe tomar segundos.
3. **Antifraude por diseño:** el QR se genera bajo demanda, vence en 60 segundos y es de un solo uso; las reglas se validan en el servidor.
4. **Privacidad del cliente:** el comercio no accede a datos personales ni puede exportar su base de clientes.

---

## 3. Objetivos y métricas de éxito (KPIs)

### 3.1 Objetivos

| ID | Objetivo |
|---|---|
| OBJ-1 | Lanzar el MVP con 10 a 12 comercios afiliados en Colima. |
| OBJ-2 | Demostrar que la tarjeta digital genera visitas recurrentes medibles. |
| OBJ-3 | Validar el canal push con cupones como herramienta de reactivación. |
| OBJ-4 | Mantener la app por debajo de 25 MB de descarga y 20 MB de caché. |

### 3.2 KPIs

| KPI | Definición | Mes 1 | Mes 3 | Mes 6 |
|---|---|---|---|---|
| Comercios activos | Comercios con `is_visible = true` y suscripción vigente | 10 a 12 | 25 | 50 |
| Usuarios registrados | Cuentas de cliente no eliminadas | — | 1,500 | 4,000 |
| Escaneos semanales | Sellos otorgados por semana en toda la plataforma | — | 300 | — |
| Canje de premios de tarjeta | Premios de tarjeta canjeados / premios de tarjeta emitidos | — | — | 60% o más |
| Canje de cupones | Cupones canjeados (ruleta, push, cumpleaños) / cupones emitidos | — | — | 15% o más |

### 3.3 Métricas técnicas de soporte

| Métrica | Meta | Tipo |
|---|---|---|
| Tamaño de descarga reportado por las tiendas | Menos de 25 MB | Pauta monitoreada |
| Caché de imágenes en disco | Máximo 20 MB (LRU) | Requisito |
| Tiempo de registro de visita (escaneo a confirmación) | Menos de 3 s con conexión 4G | Pauta monitoreada |

---

## 4. Usuarios y roles

| Rol | Interfaz | Descripción | Alta |
|---|---|---|---|
| Cliente final | App móvil (iOS y Android) | Consumidor que acumula sellos, gira la ruleta y canjea cupones y premios. Mayor de 18 años. | Autoservicio |
| Comercio | Panel web B2B | Credencial única por comercio (sucursal), compartida entre dueño y personal de caja. Las secciones administrativas se protegen con PIN. | Oxis, por script |
| Equipo Oxis | Supabase Studio y scripts del repositorio | Alta de comercios, pesos de la ruleta, estado de suscripción, restablecimiento de PIN y soporte. | Interno |

No existen roles múltiples dentro del panel ni un panel Superadmin en el MVP.

---

## 5. Alcance funcional (In-Scope)

### 5.1 App móvil del cliente

| Módulo | Contenido |
|---|---|
| Autenticación | Correo y contraseña, Google Sign-In y Apple Sign-In; completar perfil tras login social; verificación de correo; recuperación de contraseña. |
| Explorar | Catálogo global paginado, búsqueda, filtro por categoría, tarjetas compactas de comercio y enlace a Google Maps. |
| Vista de comercio | Cuatro pestañas: Tarjeta de recompensas, Menú digital, Promociones y cupones, Dejar una reseña. |
| Escáner global | Botón "Registrar visita" que abre la cámara para leer el QR del comercio. |
| Mis Tarjetas | Tarjetas con relación activa y lista global de cupones activos. |
| Ruleta de bienvenida | Un giro por cuenta y comercio al crear la relación. |
| Perfil | Datos de la cuenta, historial básico de canjes y eliminación de cuenta. |

Navegación inferior: **Explorar**, **Mis Tarjetas**, **Perfil**.

### 5.2 Panel web del comercio

| Módulo | Acceso | Contenido |
|---|---|---|
| Modo Caja | Por defecto, sin PIN | Generador de QR bajo demanda, validador de códigos de canje, confirmación en tiempo real. |
| Personalización de tarjeta | PIN | Imagen de fondo, número de sellos (4 a 10), premio, términos y condiciones, vigencia (3 a 12 meses), vigencia de cupones por push. |
| Menú digital (CRUD) | PIN | Categorías y productos, fotos, precios, "Más pedidos" y "Agotado por hoy". |
| Ofertas semanales | PIN | Título, descripción, día de la semana e imagen. |
| Notificaciones push | PIN | Envío masivo inmediato, con cupón opcional, hasta 5 por mes calendario. |
| Métricas | PIN | Visitas totales, cupones canjeados, clientes activos; filtros de 30 días e histórico. |
| Registro de QR | PIN | Bitácora de QR generados y escaneados. |

### 5.3 Operación Oxis (sin interfaz)

- Alta de comercio por script versionado: cuenta, perfil, categoría, URLs de Google Maps y reseñas, configuración de tarjeta, premios y pesos de la ruleta, beneficio de cumpleaños y estado de suscripción.
- Cambios de estado (`is_active`, `is_visible`, `subscription_status`) por script o Supabase Studio.
- Restablecimiento de PIN por script.

---

## 6. Reglas de negocio

### 6.1 Cuentas y registro

| ID | Regla |
|---|---|
| RN-01 | Registro por correo: nombre y apellido (obligatorios), correo, fecha de nacimiento y contraseña. No se solicita teléfono. |
| RN-02 | Tras el login con Google o Apple, una pantalla obligatoria completa los datos faltantes (fecha de nacimiento y, si no se recibió, nombre y apellido). |
| RN-03 | Edad mínima: 18 años, validada con la fecha de nacimiento. |
| RN-04 | La fecha de nacimiento no es editable por el usuario; su corrección solo la hace soporte de Oxis. |
| RN-05 | El correo debe verificarse para girar la ruleta y para canjear cualquier beneficio. Registrar sellos no requiere verificación. Las cuentas de Google y Apple se consideran verificadas. |
| RN-06 | Una cuenta puede usarse en varios dispositivos y conserva su progreso. |
| RN-07 | Se guarda un hash del `device_id`. Si un dispositivo ya giró la ruleta de un comercio con otra cuenta, la ruleta de ese comercio queda bloqueada en ese dispositivo. |
| RN-08 | Eliminación de cuenta: soft delete con anonimización. Se conservan solo el hash del correo, el hash del `device_id` y el historial anonimizado. Con Apple Sign-In se revoca el token. |
| RN-09 | Un usuario puede volver a registrarse con el mismo correo, pero no vuelve a girar ruletas que ya usó. |

### 6.2 Relación cliente-comercio

| ID | Regla |
|---|---|
| RN-10 | La relación nace con la acción explícita "Agregar a mis tarjetas" o con el primer sello. Ver la ficha de un comercio no crea relación. |
| RN-11 | La relación habilita la ruleta, el cupón de cumpleaños y la recepción de push y cupones de ese comercio. |
| RN-12 | Cada sucursal es un comercio independiente; no comparte sellos, cupones ni relación con otras sucursales. |

### 6.3 Sellos y QR

| ID | Regla |
|---|---|
| RN-13 | El cajero genera el QR bajo demanda después de cobrar una compra válida. |
| RN-14 | El QR vence a los 60 segundos o tras el primer escaneo exitoso, lo que ocurra primero. |
| RN-15 | El QR contiene un enlace universal (`https://ekko.oxis.mx/v/<token>`). Escaneado desde la cámara nativa abre la app o, si no está instalada, una página de descarga. |
| RN-16 | El escáner de la app es global; el token identifica al comercio. |
| RN-17 | Cada escaneo válido otorga 1 sello. Máximo 1 sello por cliente por comercio por día calendario en zona horaria `America/Mexico_City`. |
| RN-18 | El consumo mínimo para recibir sello lo define cada comercio en sus términos y condiciones y lo controla el cajero al decidir generar el QR. |
| RN-19 | Cada sello registra su fecha y hora. |
| RN-20 | Se requiere conexión a internet en el teléfono del cliente y en el dispositivo de caja. No hay modo offline. |
| RN-21 | El panel confirma en tiempo real al cajero que la visita se registró. |

### 6.4 Ciclo de vida de la tarjeta

| ID | Regla |
|---|---|
| RN-22 | Cada comercio tiene un solo programa de lealtad activo. |
| RN-23 | Sellos requeridos: de 4 a 10; valor predeterminado 6. |
| RN-24 | Vigencia del ciclo: de 3 a 12 meses; valor predeterminado 6. Se cuenta desde el inicio del ciclo. |
| RN-25 | Si el ciclo vence sin completarse, los sellos parciales expiran y la tarjeta se reinicia a 0, iniciando un ciclo nuevo. |
| RN-26 | Al completar los sellos, el premio se emite como cupón con vigencia de 30 días y la tarjeta se reinicia a 0 de inmediato, iniciando un ciclo nuevo. |
| RN-27 | Mientras el premio esté vigente, la tarjeta muestra el aviso "Recompensa disponible" y el botón "Ver recompensa". |
| RN-28 | Si el premio vence sin canjearse, se pierde. |
| RN-29 | Los cambios de configuración (sellos, premio, términos, vigencia) aplican solo a ciclos nuevos. Cada ciclo conserva una copia de la configuración con la que inició. |
| RN-30 | No existe anulación de sellos por el comercio en el MVP. |

### 6.5 Ruleta de bienvenida

| ID | Regla |
|---|---|
| RN-31 | Un giro por cuenta por comercio, disponible al crearse la relación y con el correo verificado. |
| RN-32 | Todos los resultados otorgan un incentivo; no existe "sin premio". |
| RN-33 | Los premios se acuerdan con el comercio en el onboarding. Los pesos de probabilidad viven en la base de datos y solo Oxis los edita. |
| RN-34 | El resultado se calcula en el servidor. |
| RN-35 | El premio se emite como cupón con vigencia fija de 48 horas. |
| RN-36 | Premio "Sello extra": se aplica en el siguiente escaneo válido, que otorga 2 sellos, y está exento del límite diario. Si rebasa el total de la tarjeta, el excedente se pierde. |

### 6.6 Cupones y canje

| Tipo | Origen | Vigencia | Configuración |
|---|---|---|---|
| Premio de tarjeta | Tarjeta completada | 30 días desde que se completa | Fija |
| Cupón de ruleta | Giro de bienvenida | 48 horas | Fija |
| Cupón por push | Envío del comercio | 24 a 48 horas | Configurable por el comercio |
| Cupón de cumpleaños | Mes de cumpleaños | Hasta el último día del mes | Fija |

| ID | Regla |
|---|---|
| RN-37 | Los cupones se muestran en la lista global de "Mis Tarjetas" y, filtrados, en la pestaña "Promociones y cupones" de cada comercio. |
| RN-38 | Al tocar "Mostrar código" se despliega un código alfanumérico de 6 caracteres generado en el servidor, sin caracteres ambiguos (0/O, 1/I). |
| RN-39 | El cajero ingresa el código en el validador. El panel solo acepta códigos de su propio comercio y muestra el nombre completo del cliente y el beneficio. Ese dato no queda disponible en ninguna otra vista. |
| RN-40 | El validador limita los intentos fallidos consecutivos para impedir la adivinación de códigos. |
| RN-41 | En una misma visita se puede registrar el sello y canjear beneficios. Restricciones como "un cupón por ticket" son reglas operativas de cada comercio publicadas en sus términos. |
| RN-42 | La validación de identidad con INE ante canjes sospechosos es una medida operativa y opcional de cada comercio; no la registra el sistema. |

### 6.7 Cumpleaños

| ID | Regla |
|---|---|
| RN-43 | El cupón se genera de forma perezosa al abrir la app durante el mes de cumpleaños, si aún no existe. |
| RN-44 | Se genera uno por cada comercio con relación activa que tenga beneficio de cumpleaños configurado. |
| RN-45 | El beneficio lo define cada comercio en el onboarding. |

### 6.8 Notificaciones push

| ID | Regla |
|---|---|
| RN-46 | Envío masivo e inmediato a todos los clientes con relación activa. No hay segmentación ni programación. |
| RN-47 | Tope: 5 envíos por comercio por mes calendario; cuentan todos los envíos, con o sin cupón. Se recomienda en la capacitación 1 por semana más 1 de margen. |
| RN-48 | Si el envío incluye cupón, se crea un cupón para cada destinatario aunque tenga las notificaciones desactivadas. |
| RN-49 | Se envía a todos los dispositivos registrados del usuario mediante Expo Push API. |
| RN-50 | El cliente gestiona las notificaciones desde los ajustes de su teléfono; no hay centro de notificaciones en la app. |

### 6.9 Catálogo, menú y ofertas

| ID | Regla |
|---|---|
| RN-51 | Categorías fijas, una por comercio: Restaurantes, Cafeterías y Postres, Bares y Snacks, Barberías, Belleza, Spas, Deporte/Salud, Servicios, Otros. |
| RN-52 | El catálogo se pagina de 10 en 10 y se ordena de forma aleatoria estable por sesión. |
| RN-53 | Solo se muestran comercios con `is_visible = true`. |
| RN-54 | La ubicación es un enlace externo a Google Maps; no hay ordenamiento por cercanía. |
| RN-55 | El menú es informativo, en lista plana: las variantes se registran como productos independientes. |
| RN-56 | "Agotado por hoy" se restablece automáticamente al día siguiente (zona horaria `America/Mexico_City`). |
| RN-57 | "Más pedidos" es una marca manual del comercio. |
| RN-58 | Las ofertas semanales son un aparador: título, descripción, día de la semana e imagen, sin lógica de expiración. |
| RN-59 | La pestaña de reseñas redirige a la ficha del comercio en Google Maps. Las URLs de Maps y de reseñas son obligatorias en el onboarding. |
| RN-60 | El menú, las fotos y las ofertas los captura el equipo de Oxis en el onboarding o el propio comercio desde su panel. |

### 6.10 Panel del comercio

| ID | Regla |
|---|---|
| RN-61 | Credencial única por comercio; el panel puede estar abierto en varios dispositivos a la vez. |
| RN-62 | El Modo Caja es la pantalla por defecto. Las secciones administrativas requieren PIN de 4 dígitos asignado en el onboarding. |
| RN-63 | 5 intentos fallidos de PIN bloquean el acceso administrativo 15 minutos; el límite se aplica en el servidor. |
| RN-64 | Tras 5 minutos de inactividad, el panel regresa a Modo Caja. |
| RN-65 | El PIN olvidado lo restablece Oxis. |
| RN-66 | El comercio ve solo métricas agregadas y el registro de QR; no ve ni exporta datos personales de clientes. |
| RN-67 | "Cliente activo": cliente con al menos 1 visita en los últimos 30 días. |
| RN-68 | El panel convierte las imágenes a WebP en el navegador (2 o 3 tamaños), con respaldo a JPEG comprimido. |

### 6.11 Suscripción y estado del comercio

| ID | Regla |
|---|---|
| RN-69 | Plan único, cobro trimestral o anual, gestionado manualmente por Oxis (transferencia o efectivo). Sin CFDI automatizado. |
| RN-70 | Periodo de gracia de 15 días tras el vencimiento; después el comercio pasa a inactivo. |
| RN-71 | Comercio inactivo: desaparece del catálogo; su tarjeta aparece como "No disponible" en "Mis Tarjetas" y no suma sellos; el panel solo permite canjear beneficios ya emitidos; se bloquean QR, push y edición. |
| RN-72 | Al reactivarse, se conservan íntegros la información del comercio y el progreso de los clientes. |
| RN-73 | La app es gratuita para el cliente final. |

---

## 7. User Stories y criterios de aceptación

### Épica 1 — Autenticación y cuenta del cliente

**US-01 Registro con correo.**
Como cliente, quiero registrarme con mi correo para guardar mis tarjetas en la nube.
- Dado que capturo nombre, apellido, correo, fecha de nacimiento y contraseña válidos, cuando envío el formulario, entonces se crea la cuenta y se envía un correo de verificación.
- Dado que mi fecha de nacimiento indica menos de 18 años, entonces el registro se rechaza con un mensaje claro.
- Dado que el correo ya existe, entonces el sistema me lo indica y ofrece iniciar sesión o recuperar la contraseña.
- Dado que no he verificado mi correo, puedo registrar sellos, pero no girar la ruleta ni canjear beneficios.

**US-02 Login social.**
Como cliente, quiero entrar con Google o Apple para registrarme en segundos.
- Dado que inicio sesión con Google o Apple por primera vez, entonces se muestra una pantalla obligatoria para completar fecha de nacimiento y, si falta, nombre y apellido.
- Dado que Apple entrega un correo de relevo, entonces la cuenta funciona normalmente con ese correo.

**US-03 Recuperar contraseña.**
- Dado que solicito recuperar mi contraseña, entonces recibo un correo con enlace de restablecimiento.

**US-04 Multidispositivo.**
- Dado que inicio sesión en un teléfono nuevo, entonces veo todas mis tarjetas, sellos y cupones vigentes.

**US-05 Eliminar cuenta.**
Como cliente, quiero eliminar mi cuenta desde la app.
- Dado que confirmo "Eliminar mi cuenta", entonces mi cuenta se deshabilita, mis datos personales se anonimizan y cierro sesión.
- Dado que mi cuenta usa Apple Sign-In, entonces se revoca el token de Apple.
- Dado que vuelvo a registrarme con el mismo correo, entonces no puedo girar ruletas que ya giré.

**US-06 Perfil.**
- Dado que abro Perfil, entonces veo mis datos, mi historial básico de canjes y el botón de eliminar cuenta.
- La fecha de nacimiento se muestra como no editable.

### Épica 2 — Catálogo y vista de comercio

**US-07 Explorar comercios.**
- Dado que abro Explorar, entonces veo los comercios visibles en páginas de 10, en orden aleatorio estable durante la sesión.
- Dado que escribo en el buscador o elijo una categoría, entonces la lista se filtra.
- Cada tarjeta muestra portada, logo, descripción breve y un acceso que abre Google Maps.

**US-08 Vista de comercio.**
- Dado que selecciono un comercio, entonces se cargan bajo demanda sus cuatro pestañas: Tarjeta, Menú, Promociones y cupones, Reseña.
- Dado que no tengo relación con el comercio, entonces veo el botón "Agregar a mis tarjetas".

**US-09 Dejar reseña.**
- Dado que toco "Dejar una reseña", entonces se abre la ficha del comercio en Google Maps.

### Épica 3 — Tarjeta de sellos

**US-10 Agregar tarjeta.**
- Dado que toco "Agregar a mis tarjetas", entonces se crea la relación, la tarjeta aparece en "Mis Tarjetas" y se ofrece la ruleta si cumplo las condiciones.

**US-11 Registrar visita.**
Como cliente, quiero escanear el QR de caja para sumar un sello.
- Dado que el cajero generó un QR vigente y lo escaneo con el escáner global, entonces recibo 1 sello con fecha y hora, y el panel muestra "Visita registrada".
- Dado que no tenía relación con el comercio, entonces el escaneo la crea.
- Dado que ya recibí un sello hoy en ese comercio, entonces el sistema me indica que ya registré mi visita diaria.
- Dado que el QR venció o ya fue usado, entonces se muestra un error y el cajero debe generar otro.
- Dado que tengo un "Sello extra" pendiente, entonces el escaneo me otorga 2 sellos.
- Dado que escaneo el QR con la cámara nativa sin tener la app, entonces se abre la página de descarga.

**US-12 Ver progreso.**
- Dado que abro la tarjeta, entonces veo la imagen de fondo, la cuadrícula de sellos con su fecha, el premio, los términos y condiciones y la fecha de vencimiento del ciclo.

**US-13 Completar tarjeta.**
- Dado que obtengo el último sello, entonces se emite el premio como cupón con 30 días de vigencia, la tarjeta se reinicia a 0 y aparece el aviso "Recompensa disponible" con el botón "Ver recompensa".

**US-14 Vencimiento del ciclo.**
- Dado que el ciclo vence sin completarse, entonces los sellos se reinician a 0 y comienza un ciclo nuevo con la configuración vigente.

### Épica 4 — Ruleta de bienvenida

**US-15 Girar la ruleta.**
- Dado que tengo relación nueva con el comercio, correo verificado y ni mi cuenta ni mi dispositivo han girado esa ruleta, entonces puedo girarla una vez.
- El resultado lo decide el servidor y siempre otorga un premio.
- El premio se emite como cupón de 48 horas, o como "Sello extra" pendiente.
- Dado que mi dispositivo ya giró esa ruleta con otra cuenta, entonces la ruleta no está disponible.

### Épica 5 — Cupones y canje

**US-16 Ver cupones.**
- Dado que abro "Mis Tarjetas", entonces veo todos mis cupones vigentes con comercio, beneficio y vencimiento.
- En la pestaña de cada comercio veo solo los cupones de ese comercio.

**US-17 Canjear.**
- Dado que toco "Mostrar código" en un cupón vigente con correo verificado, entonces veo un código de 6 caracteres.
- Dado que el cajero ingresa el código, entonces ve mi nombre completo y el beneficio, y al confirmar el cupón queda como usado y aparece en mi historial.
- Dado que el código pertenece a otro comercio, venció o ya se usó, entonces el validador lo rechaza.

**US-18 Cupón de cumpleaños.**
- Dado que abro la app en mi mes de cumpleaños, entonces se crea un cupón por cada comercio con relación activa y beneficio configurado, válido hasta el último día del mes, sin duplicados.

### Épica 6 — Panel del comercio: Modo Caja

**US-19 Generar QR.**
Como cajero, quiero generar un QR después de cobrar.
- Dado que toco "Generar QR", entonces se muestra un QR válido por 60 segundos con cuenta regresiva.
- Dado que el cliente lo escanea, entonces el QR se invalida y el panel muestra la confirmación.
- Dado que vence sin escanearse, entonces se invalida y se puede generar otro.

**US-20 Validar canje.**
- Dado que ingreso un código válido de mi comercio, entonces veo el nombre del cliente y el beneficio, y al confirmar se marca como usado.
- Dado que supero el límite de intentos fallidos, entonces el validador se bloquea temporalmente.

**US-21 Acceso administrativo.**
- Dado que ingreso el PIN correcto, entonces accedo a las secciones administrativas.
- Dado que fallo 5 veces, entonces el acceso se bloquea 15 minutos.
- Dado que pasan 5 minutos sin actividad, entonces el panel regresa a Modo Caja.

### Épica 7 — Panel del comercio: administración

**US-22 Personalizar tarjeta.**
- Puedo subir imagen de fondo, definir sellos (4 a 10), premio, términos y condiciones, vigencia del ciclo (3 a 12 meses) y vigencia de cupones por push (24 a 48 horas).
- Dado que guardo cambios, entonces aplican solo a ciclos nuevos y el sistema me lo advierte antes de guardar.

**US-23 Gestionar menú.**
- Puedo crear, editar y eliminar categorías y productos con foto, descripción y precio.
- Las imágenes se convierten a WebP antes de subir.
- Puedo marcar "Agotado por hoy", que se restablece al día siguiente, y "Más pedidos".
- Los cambios se reflejan en la app en la siguiente consulta del cliente.

**US-24 Ofertas semanales.**
- Puedo crear, editar y eliminar ofertas con título, descripción, día de la semana e imagen.

**US-25 Enviar push.**
- Puedo redactar un mensaje y, opcionalmente, adjuntar un cupón con su vigencia.
- El panel muestra los envíos restantes del mes.
- Dado que ya hice 5 envíos este mes, entonces el envío se bloquea hasta el siguiente mes calendario.
- Al enviar, cada cliente con relación activa recibe la notificación y, si aplica, el cupón.

**US-26 Ver métricas.**
- Veo visitas totales, cupones canjeados y clientes activos, con filtros de 30 días e histórico.
- Veo el registro de QR generados y escaneados.

### Épica 8 — Operación Oxis

**US-27 Alta de comercio.**
- Dado que ejecuto el script de alta con los datos del onboarding, entonces se crean la cuenta del comercio, su perfil, la configuración de tarjeta, los premios y pesos de la ruleta, el beneficio de cumpleaños y el PIN, con `is_visible = false` hasta su activación.

**US-28 Gestión de estado.**
- Dado que un comercio supera el periodo de gracia sin pagar, entonces Oxis lo marca inactivo y se aplican las restricciones de RN-71.
- Dado que se reactiva, entonces todo su historial y el progreso de sus clientes siguen intactos.

---

## 8. Requisitos no funcionales

| ID | Categoría | Requisito |
|---|---|---|
| RNF-01 | Plataformas | iOS 15.0 o superior; Android 8.0 (API 26) o superior. Panel web responsivo para PC y tableta. |
| RNF-02 | Peso | Descarga menor a 25 MB medida con el tamaño que reportan las tiendas; meta monitoreada en cada versión. |
| RNF-03 | Almacenamiento | Caché de imágenes LRU con tope de 20 MB en disco. |
| RNF-04 | Datos | Catálogo paginado; menú, promociones y tarjeta se cargan solo al abrir el comercio. |
| RNF-05 | Seguridad | Toda regla de negocio (QR, sellos, límites, ruleta, canjes, PIN) se valida en el servidor. Acceso a datos protegido por RLS. |
| RNF-06 | Privacidad | Aviso de privacidad accesible en el registro; anonimización al eliminar cuenta. |
| RNF-07 | Zona horaria | Todo cálculo de día y mes usa `America/Mexico_City`. |
| RNF-08 | Idioma y tema | Solo español; solo modo claro. |
| RNF-09 | Diseño | Minimalista, moderno y elegante, con paleta neutra y un color acento vibrante. |
| RNF-10 | Disponibilidad | Producción en Supabase Pro antes de que opere el primer comercio de pago (respaldos automáticos, sin pausas). |
| RNF-11 | Correo | Proveedor SMTP externo para verificación y recuperación de contraseña. |
| RNF-12 | Observabilidad | Monitoreo de errores en app y panel. |
| RNF-13 | Entornos | Desarrollo local, staging y producción aislados. |

---

## 9. Fuera de alcance (Out-of-Scope)

- Pedidos en línea, carrito y pagos dentro de la app.
- Horarios, teléfono, WhatsApp y redes sociales en la ficha del comercio.
- Ordenamiento o filtrado por cercanía GPS y mapas nativos dentro de la app.
- Validación de distancia del cliente al comercio.
- Roles múltiples en el panel, panel Superadmin y exportación de clientes.
- Segmentación y programación de notificaciones push; centro de notificaciones en la app.
- Anulación de sellos por el comercio.
- Modo offline, modo oscuro y multiidioma.
- Autenticación o registro por teléfono (OTP por SMS o WhatsApp).
- Facturación electrónica (CFDI) y cobro automatizado de suscripciones.
- Más de un programa de lealtad por comercio; agrupación de sucursales por marca.

---

## 10. Supuestos y dependencias

| ID | Supuesto o dependencia |
|---|---|
| SUP-01 | Los comercios cuentan con un dispositivo con navegador e internet en caja (PC o tableta). |
| SUP-02 | Cada comercio tiene ficha en Google Maps. |
| SUP-03 | El equipo de 4 integrantes trabaja a tiempo parcial en sprints de 1 semana, sin fecha límite estricta. |
| SUP-04 | DNS de `oxis.mx` administrado en Cloudflare; el panel se publica en `ekko.oxis.mx` con Cloudflare Pages. |
| SUP-05 | Las cuentas de Apple y Google se registran a nombre de un integrante del equipo (persona física) en esta etapa. |
| SUP-06 | Expo Push API entrega a FCM y APNs sin integración directa con Firebase. |

---

## 11. Riesgos

| ID | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| R-01 | Un cliente reenvía la foto del QR a alguien fuera del local dentro de los 60 segundos. | Bajo | Aceptado: QR bajo demanda, uso único y límite diario. |
| R-02 | El `device_id` cambia al reinstalar o restablecer el teléfono. | Medio | Control de mejor esfuerzo, combinado con verificación de correo y un giro por cuenta. |
| R-03 | La credencial compartida permite que alguien del personal genere QR fuera del local. | Medio | Registro de QR en el panel; supervisión a cargo de cada comercio. |
| R-04 | Un error de migración en producción borra datos de clientes. | Alto | Supabase Pro con respaldos automáticos antes del primer comercio de pago; staging obligatorio. |
| R-05 | Rechazo o retraso en la revisión de las tiendas. | Medio | Tareas pendientes de la sección 12 planificadas con anticipación. |
| R-06 | La librería de imágenes no permite fijar el tope de caché de 20 MB. | Bajo | Validación técnica temprana; limpieza propia si es necesario. |
| R-07 | Baja adopción del cliente por fricción en el primer registro en caja. | Alto | Sellos sin verificación previa, login social y enlace universal en el QR. |

---

## 12. Tareas pendientes (fase final del proyecto)

### 12.1 Legal (con asesoría legal)

- [ ] Confirmar la razón social de Oxis como responsable de los datos y su relación con las cuentas de tiendas a nombre de persona física.
- [ ] Redactar el Aviso de Privacidad conforme a la legislación mexicana vigente, incluida la conservación de hashes e historial anonimizado.
- [ ] Redactar los Términos y Condiciones de uso para clientes finales.
- [ ] Redactar el contrato con comercios: responsabilidad sobre premios y cupones, cierre del comercio, suspensión por falta de pago.
- [ ] Revisar los requisitos aplicables a promociones (ruleta, cupones) y a promociones de bebidas alcohólicas.
- [ ] Validar la edad mínima de 18 años.

### 12.2 Publicación en tiendas

- [ ] Alta de cuentas de desarrollador (Google 25 USD pago único; Apple 99 USD al año).
- [ ] Verificar disponibilidad del nombre "Ekko Rewards" en ambas tiendas (y, opcionalmente, ante el IMPI).
- [ ] Planificar la prueba cerrada que exige Google a cuentas personales nuevas (actualmente 12 probadores durante 14 días; verificar el requisito vigente).
- [ ] Preparar cuenta de demostración y comercio de prueba oculto con QR de revisión para Apple.
- [ ] Publicar la URL de soporte y la URL del aviso de privacidad.
- [ ] Definir el canal de soporte para clientes finales (correo de Oxis).

---

## 13. Glosario

| Término | Definición |
|---|---|
| Comercio | Una sucursal registrada en la plataforma, con su propia tarjeta, menú y panel. |
| Relación | Vínculo entre un cliente y un comercio creado al agregar la tarjeta o recibir el primer sello. |
| Ciclo | Periodo de una tarjeta desde 0 sellos hasta completarse o vencer. |
| Sello | Registro de una visita válida, con fecha y hora. |
| Premio | Beneficio emitido al completar un ciclo; se canjea como cupón. |
| Cupón | Beneficio canjeable con código de 6 caracteres (premio, ruleta, push o cumpleaños). |
| Modo Caja | Pantalla por defecto del panel: generador de QR y validador de canjes. |
| PIN | Código de 4 dígitos que protege las secciones administrativas del panel. |
| Cliente activo | Cliente con al menos 1 visita en los últimos 30 días. |
