# Ekko Rewards: notas para App Review

Borrador para App Store Connect (App Review Information) y checklist de envío. Responde a [la auditoría](ekko_auditoria_app_store.md) (R2, W2, W3, W4, W5, W7). Los textos entre `<...>` se llenan al preparar el envío; nunca se commitean credenciales reales.

## 1. Video de pantalla (iPhone físico)

Grabar un iPhone real, en este orden:

- [ ] Lanzamiento en frío y pantalla de bienvenida.
- [ ] Registro con correo (con aviso de privacidad visible).
- [ ] Inicio de sesión con Apple (hoja del sistema, sin pantalla propia previa).
- [ ] Permiso de cámara y escaneo del QR del Panel ("Registrar visita").
- [ ] Sello sumado y ruleta de bienvenida.
- [ ] Tarjeta completa y cupón de premio.
- [ ] Canje del cupón.
- [ ] Permiso de notificaciones (pantalla con "Continuar" y aviso del sistema) y permiso de ubicación/fotos si se pide.
- [ ] Eliminar cuenta (Perfil).

## 2. Propósito

Ekko es una app de sellos de lealtad para negocios locales de México. El cliente escanea un QR en el comercio, junta sellos, completa la tarjeta, gana un cupón y lo canjea en el local. No vende nada dentro de la app ni usa compras integradas.

## 3. Acceso

- Cliente demo: `<correo-cliente-demo>` / `<contraseña>` (correo verificado).
- Panel del comercio: `<URL del panel>`, usuario `<correo-panel>`, contraseña `<contraseña>`, PIN `<pin>`.
- No hay feature flags: la versión enviada es la de producción.

Pasos para el revisor:

1. En una computadora, abrir la URL del Panel e iniciar sesión; desbloquear con el PIN.
2. Entrar a "Registrar visita": aparece un QR que dura 60 s.
3. En el iPhone, iniciar sesión con la cuenta demo y escanear el QR desde la pestaña de escaneo.
4. La tarjeta demo está a un sello de completarse: ese escaneo la completa, da el cupón y habilita la ruleta. Canjear el cupón desde "Mis cupones".

Preparación (una sola vez por envío, antes de subir el build):

```sh
# Comercio de prueba oculto: onboard-merchant deja is_visible = false; usar stamps_required = 4 en el JSON.
node scripts/onboard-merchant.ts ~/altas/comercio-revision.json
# Deja al cliente demo con 3 de 4 sellos (días previos) y correo verificado. Idempotente: repetir antes de cada reenvío.
node scripts/prepare-review-demo.ts --merchant <correo-panel> --customer <correo-cliente-demo>
```

El script se niega a actuar sobre un comercio visible en el catálogo. Si el revisor ya completó la tarjeta, volver a ejecutarlo.

## 4. Servicios externos

- Supabase: autenticación, base de datos y almacenamiento de imágenes.
- Expo Push / APNs: notificaciones.
- Sentry: diagnóstico de fallos, sin datos personales (`sendDefaultPii: false`).
- Google OAuth e inicio de sesión con Apple.

## 5. Regiones

Funciona igual en todas las regiones; el contenido (comercios) es de México.

## 6. Industria regulada y datos pedidos

- No es una industria regulada y no maneja pagos ni dinero.
- **Fecha de nacimiento (18+), guideline 5.1.1(iii):** algunos comercios promueven bebidas alcohólicas, por lo que se exige mayoría de edad. Pendiente de confirmación legal (PRD §12.1); si se descarta, se vuelve opcional.
- **Pantalla "Completa tu perfil" tras Apple (4.0):** pide nombre y apellido solo cuando Apple no los compartió; si los compartió, solo se pide la fecha de nacimiento.
- **Notificaciones (4.5.4):** `push_opt_in` arranca en `false`; se activa solo cuando el usuario acepta la pantalla previa, cuyo texto menciona ofertas. Se puede desactivar en Editar perfil.

## Etiqueta de privacidad (App Store Connect)

Todos ligados al usuario, sin rastreo (no se usa ATT).

| Dato | Ligado al usuario | Finalidad |
|---|---|---|
| Nombre | Sí | Funcionalidad de la app |
| Correo | Sí | Funcionalidad de la app, cuenta |
| Fecha de nacimiento | Sí | Funcionalidad de la app (edad mínima, beneficio de cumpleaños) |
| Foto de perfil | Sí | Funcionalidad de la app |
| Identificador de dispositivo (IDFV con hash) | Sí | Prevención de fraude en la ruleta |
| Historial de visitas y canjes | Sí | Funcionalidad de la app |
| Datos de fallos (Sentry) | Sí | Diagnóstico de la app |

## Clasificación por edad (respuestas a revisar)

- Concursos: sí (la ruleta; gratuita, sin compra).
- Referencias a alcohol: sí, contenido generado por comercios (confirmar con legal).
- Capacidad de redes sociales / contenido generado por usuarios: no.
- Apuestas: no.

## Cumplimiento de exportación

`ios.config.usesNonExemptEncryption: false` en `app.config.ts` (solo HTTPS y cifrado del sistema).

## Ruleta

Leyenda que muestra la app bajo el botón "Girar", junto al enlace "Ver bases": "Apple no patrocina ni participa en esta promoción." Las bases viven en `https://ekko.oxis.mx/terminos#ruleta`.
