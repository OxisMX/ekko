export const ERRORS = {
  "E-01": { message: "No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo.", action: "Reintentar." },
  "E-02": { message: "Este código ya no es válido. Pide al cajero uno nuevo.", action: "Pedir uno nuevo al cajero; volver al escáner." },
  "E-03": { message: "Este código ya fue usado. Pide al cajero uno nuevo.", action: "Pedir uno nuevo al cajero; volver al escáner." },
  "E-04": { message: "Ya registraste tu visita de hoy en este negocio. Vuelve mañana.", action: "Cerrar." },
  "E-05": { message: "Este negocio no está disponible por ahora. Tus sellos siguen guardados.", action: "Volver; los sellos se conservan." },
  "E-06": { message: "Verifica tu correo para continuar.", action: "Reenviar correo." },
  "E-07": { message: "Ekko Rewards es solo para mayores de 18 años.", action: "Corregir fecha o salir." },
  "E-08": { message: "Este no es un código de Ekko.", action: "Seguir escaneando." },
  "E-09": { message: "Ya usaste tu giro de bienvenida en este negocio.", action: "Cerrar." },
  "E-10": { message: "Este cupón venció.", action: "Actualizar lista." },
  "E-11": { message: "Este cupón ya fue canjeado.", action: "Actualizar lista." },
  "E-12": { message: "Código no válido.", action: "Revisar y volver a capturar." },
  "E-13": { message: "Demasiados intentos. Espera unos minutos.", action: "Esperar el tiempo indicado." },
  "E-14": { message: "PIN incorrecto.", action: "Reintentar." },
  "E-15": { message: "Acceso bloqueado por 15 minutos.", action: "Esperar o contactar a Oxis." },
  "E-16": { message: "Ingresa tu PIN para continuar.", action: "Ingresar el PIN; el formulario se conserva." },
  "E-17": { message: "Usaste tus 5 envíos de este mes.", action: "Esperar al siguiente mes." },
  "E-18": { message: "Tu sesión expiró.", action: "Iniciar sesión." },
  "E-19": { message: "Esta cuenta no corresponde a esta aplicación.", action: "Cerrar sesión." },
  "E-20": { message: "Ya existe una cuenta con este correo.", action: "Iniciar sesión o recuperar contraseña." },
  "E-21": { message: "No pudimos conectar con Google/Apple.", action: "Reintentar u otro método." },
  "E-22": { message: "No pudimos procesar la imagen.", action: "Otra imagen o reintentar." },
  // Backend §3.1 (S2): invalid RPC input; details = {"field": "<param without p_>"}.
  "E-23": { message: "Revisa los datos marcados.", action: "Corregir el campo." },
  "E-99": { message: "Algo salió mal.", action: "Reintentar." },
} as const satisfies Record<string, { message: string; action: string }>;

export type ErrorCode = keyof typeof ERRORS;

export type RpcError = { code: ErrorCode; details: Record<string, unknown> | null };

function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(ERRORS, value);
}

function parseDetails(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // WHY: details are optional copy hints; a malformed payload must not mask the error code.
    return null;
  }
}

// Error contract: backend §3.1 (message = "E-xx", details = JSON string or null).
export function parseRpcError(err: { message?: string; details?: string | null }): RpcError {
  const message = err.message ?? "";
  if (!isErrorCode(message)) return { code: "E-99", details: null };
  return { code: message, details: parseDetails(err.details) };
}
