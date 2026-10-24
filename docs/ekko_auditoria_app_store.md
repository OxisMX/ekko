# Auditoría App Store (preflight) — Ekko Rewards

Fecha: 2026-10-24 · Rama: `develop @ 5876a7a` · Alcance: `apps/mobile` (Expo SDK 58, `mx.oxis.ekko`) más lo que la App necesita del backend y del Panel.

Checklists aplicados: *All apps*. No aplica *Subscriptions/IAP* (no se vende contenido digital), *Social/UGC* (los clientes no publican contenido visible para otros), *Kids*, *AI*, *Finance* ni *Games*.

Límite: todavía no existe la app en App Store Connect ni el CLI `asc`, así que la metadata de la tienda (descripción, capturas, notas de revisión, etiqueta de privacidad, clasificación por edad) se revisa como **pendiente**, no como aprobada.

---

## ❌ Riesgo de rechazo (4)

### R1. [5.1.1(iv)] Las pantallas previas a los permisos tienen salida "Ahora no"
- Archivo: `apps/mobile/src/components/visit/PermissionExplainer.tsx` (variantes `camera` y `notifications`).
- Apple rechaza las pantallas propias que se muestran antes del aviso del sistema si ofrecen un botón para saltarse el aviso ("Ahora no", "Más tarde"). También objeta los botones que dicen "Permitir", porque imitan al aviso del sistema.
- Corrección:
  - Dejar un solo botón, "Continuar", que siempre abra el aviso del sistema, y quitar "Ahora no".
  - La pantalla de notificaciones puede seguir cerrándose sola si el usuario rechaza en el aviso del sistema.
  - La variante `denied` ("Abrir ajustes" / "Volver") está bien: el usuario ya rechazó el permiso.

### R2. [2.1] El revisor no tiene forma de sumar sellos
- Para sumar un sello hay que escanear un QR que genera el Panel del comercio. Ese QR dura 60 s y sirve una sola vez.
- Sin una cuenta demo de cliente y un comercio de prueba accesibles, el revisor no puede probar el flujo central de la App: sello, tarjeta llena, ruleta, cupón y canje. Ya está pendiente en PRD §12.2 y en la fase S18 del plan.
- Corrección:
  - Crear en producción un comercio de prueba oculto del catálogo y una cuenta de cliente con correo verificado.
  - Poner en las notas de revisión las credenciales del Panel y los pasos: abrir el Panel en una computadora, "Registrar visita" y escanear con el iPhone.
  - Dejar la tarjeta del cliente demo a un sello de completarse, para que el revisor vea premio y ruleta sin esperar varios días.

### R3. [5.1.1(i)] El aviso de privacidad solo se ve al registrarse y la URL no existe
- `register.tsx:21` tiene `PRIVACY_URL = "https://ekko.oxis.mx/privacidad"` con un `TODO(legal)`, y Perfil no tiene ningún enlace al aviso.
- Apple exige que el aviso esté en App Store Connect y sea fácil de encontrar dentro de la App en cualquier momento, no solo durante el registro.
- Corrección:
  - Publicar el aviso de privacidad y los términos (PRD §12.1).
  - En Perfil, agregar una sección "Legal" con "Aviso de privacidad" y "Términos y condiciones".
  - Mover `PRIVACY_URL` a una constante compartida.

### R4. [1.5 / 5.1.1] Falta un contacto de soporte para el cliente
- La App no ofrece ningún medio para contactar a soporte, y App Store Connect pide una URL de soporte con contacto real (PRD §12.2, "Definir el canal de soporte").
- Corrección: publicar la página de soporte y, en Perfil, agregar "Ayuda y soporte" (`mailto:` o URL).

---

## ⚠️ Advertencias (9)

- **W1. [5.3 / 2.3.6] La ruleta da premios al azar.**
  - Es gratuita y no se compra con dinero, así que no es apuesta. Aun así, Apple trata los premios al azar como promoción.
  - Hay que agregar en la pantalla de la ruleta un enlace a "Bases de la promoción" (quién otorga los premios y cómo) con la leyenda "Apple no patrocina ni participa en esta promoción".
  - En el cuestionario de edad hay que declarar "Concursos" si aplica. Coincide con el pendiente legal de PRD §12.1.
- **W2. [5.1.1(iii)] La fecha de nacimiento es obligatoria.** Es válido solo si la edad mínima de 18 años tiene una razón legal, como las promociones de bebidas alcohólicas (pendiente legal, PRD §12.1). Hay que explicarlo en las notas de revisión y declarar contenido de alcohol en la clasificación por edad si aplica.
- **W3. [4.0 SIWA] Pantalla "Completa tu perfil" después de entrar con Apple.**
  - Si el usuario no comparte su nombre, se le pide nombre y apellido.
  - Pedir la fecha de nacimiento es aceptable. Repetir el nombre ha causado rechazos.
  - Hay que justificarlo en las notas, o pedir el nombre como opcional y usar uno por defecto, por ejemplo "Cliente Ekko".
- **W4. [4.5.4] Notificaciones promocionales.**
  - `customers.push_opt_in` vale `true` por defecto (`20261105000000_ux_refactor.sql:491`).
  - Hoy el único consentimiento es el texto previo al permiso ("…cuando tus negocios tengan ofertas"). Al corregir R1 hay que mantener esa frase.
  - Lo más seguro: que `push_opt_in` arranque en `false` y se active con el botón del permiso. La baja dentro de la App ya existe en Editar perfil.
- **W5. [Export compliance] Falta declarar el cifrado.** Hay que agregar `ios.config.usesNonExemptEncryption: false` en `app.config.ts` (la App solo usa HTTPS y el cifrado del sistema). Si no, cada build queda en espera hasta responder la pregunta de exportación.
- **W6. [Privacy manifest] No hay manifiesto propio.**
  - Expo 58 junta los `PrivacyInfo.xcprivacy` de sus módulos, Sentry y AsyncStorage. Hay que comprobarlo en el primer `eas build` revisando el reporte de privacidad de Xcode.
  - Si falta alguna API, se declara en `ios.privacyManifests`.
- **W7. [Etiqueta de privacidad en App Store Connect].** Hay que declarar como datos ligados al usuario:
  - nombre, correo, fecha de nacimiento y foto de perfil;
  - el identificador de dispositivo (IDFV con hash, para prevenir fraude en la ruleta);
  - el historial de visitas y canjes;
  - los diagnósticos de fallos (Sentry, `sendDefaultPii: false`).

  No hay rastreo entre apps, así que no hace falta ATT.
- **W8. [2.1] Configuración pendiente para producción.**
  - `EAS_PROJECT_ID` está vacío.
  - El archivo de enlaces universales `apple-app-site-association` todavía no existe en `apps/panel/public/.well-known/`.
  - `EXPO_PUBLIC_APP_URL` usa `http://localhost:5173` si no está definida (`visitToken.ts:5`); hay que confirmar que esté definida en el entorno `production` de EAS.
  - Sentry sin organización ni proyecto.

  Todo está en `docs/ekko_despliegue.md`.
- **W9. [Accesibilidad] El texto crece como máximo 1.3× (`MAX_FONT_SCALE`).**
  - No causa rechazo, pero corta el texto grande de iOS para usuarios con baja visión.
  - Conviene subir el límite a 2 en textos de párrafo y dejar 1.3 solo en botones y pestañas.

---

## ✅ Cumple (14)

- **[5.1.1(v)] Eliminar cuenta.** Está en Perfil → "Eliminar mi cuenta" (`DeleteAccountScreen`). En cuentas de Apple pide una autorización nueva para revocar el token, como exige Apple.
- **[4.8] Sign in with Apple.** Se ofrece junto a Google con la misma prominencia, usa el botón nativo `AppleAuthenticationButton` (`SocialButtons.tsx`) y el nonce está hasheado.
- **[4.0] Correos ocultos de Apple.** No hay validaciones que rechacen dominios de reenvío (ni `privaterelay` ni `private.icloud.com`).
- **[5.1.1] Acceso sin redes sociales.** Hay registro con correo y contraseña.
- **[5.1.2(i)] Push, cámara y ubicación son opcionales.**
  - Sin notificaciones la App funciona.
  - La cámara solo se pide para escanear.
  - No se pide ubicación: los mapas se abren con un enlace.
- **[5.1.1(ii)] Textos de permisos claros y en español.**
  - Cámara sin micrófono.
  - Fotos solo para la foto de perfil, con selector del sistema y sin cámara.
- **[2.5.19] Sin funciones ocultas.**
  - `DevTokenPaste` y `DevSimulatePush` están detrás de `__DEV__` y no llegan al build de producción.
  - No hay flags remotos ni detección del entorno de revisión.
  - Las actualizaciones OTA solo cambian JS del mismo `version`; un cambio de función mayor requiere un nuevo envío (2.3.1(a)).
- **[2.5.2] Sin código descargado.** No hay `eval` ni WebView que ejecute código remoto.
- **[4.2] Funcionalidad suficiente.** Es una app nativa con catálogo, tarjetas, escáner QR, ruleta, cupones, push y enlaces universales; no es un envoltorio web.
- **[3.1.1] Sin compras.** Los premios son bienes y servicios físicos del comercio, así que no requieren IAP.
- **[5.6.1] Sin solicitudes de reseña propias.**
- **[2.5.5] Funciona en redes solo IPv6.** Todo pasa por HTTPS a dominios de Supabase y Expo, sin IP fijas ni `http://` en producción.
- **[SDK] Versión de iOS.** Expo SDK 58 compila con Xcode 26 / iOS 26 SDK; el mínimo de iOS es 16.4.
- **[Entitlements] Solo los que se usan.** Sign in with Apple, push y dominios asociados, sin capacidades sobrantes.

---

## 📋 Pendiente en App Store Connect (no verificable desde el código)

| Requisito | Qué preparar |
|---|---|
| 2.3.7 Nombre | "Ekko Rewards" (12 caracteres, cabe en 30). Verificar que esté disponible. |
| 2.3.3 Capturas | Mostrar la App en uso con datos ficticios: tarjeta, ruleta, cupón. Sin pantallas de login. |
| 2.3.10 Metadata | Sin mencionar Android ni Google Play. |
| 2.3.6 Clasificación por edad | Responder concursos, alcohol y las nuevas preguntas de redes sociales (la respuesta es "no"). |
| 2.1 Notas de revisión | Las 6 secciones: video en un iPhone (registro, escaneo, ruleta, canje, eliminar cuenta y permisos), propósito, credenciales de la App y del Panel, servicios externos (Supabase, Expo Push/APNs, Sentry, Google OAuth), "funciona igual en todas las regiones" y la justificación de la edad mínima de 18 años. |
| 5.6.2 Desarrollador | Cuenta de Apple Developer a nombre de la razón social de Oxis (PRD §12.1). |
| iPhone Duo | Capturas obligatorias desde abril de 2027. |

---

## Otros aspectos revisados

- **Seguridad (App):**
  - La sesión se guarda cifrada (SecureStore + `aes-js`).
  - El ID de dispositivo se manda con hash.
  - Las RPC validan del lado del servidor (auditoría previa, `docs/ekko_auditoria.md`).
  - Sin secretos en el bundle: la anon key es pública por diseño.
- **Rendimiento:** quedó aplicado en el PR #22: una sola consulta en Mis Tarjetas, `staleTime` de 30 s y la lista memoizada.
- **iPad:** la App es solo para iPhone (`supportsTablet` no está definido), así que en iPad corre en modo compatible. Si se mantiene así, no hacen falta capturas de iPad.

---

## Orden sugerido

1. **R1:** botón único "Continuar" en las pantallas previas a los permisos, y **W4:** `push_opt_in` en `false` por defecto. Es código y sale en un PR chico.
2. **W5:** `usesNonExemptEncryption: false`. Es código y es una línea.
3. **R3 y R4:** sección "Legal y ayuda" en Perfil. El código está listo para hacerse y depende de las URLs finales.
4. **W1:** pantalla de bases de la ruleta con la leyenda de Apple. Depende del texto legal.
5. **R2, W2, W7, W8 y la tabla de App Store Connect:** tareas de lanzamiento S18 (cuenta demo, comercio de prueba, notas de revisión y etiqueta de privacidad).
