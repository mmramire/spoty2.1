/**
 * Implementación del puerto `RegistroTecnico` sobre Pino (capa Data).
 *
 * Trazabilidad: OBJ-001 → RNF-001, RNF-006 → UC-001 → AC-001, AC-004, AC-005 →
 * TASK-003 → TC-004.
 *
 * Conforma estructuralmente el puerto `RegistroTecnico` de Business sin
 * importarlo (RNF-003); la comprobación se realiza en la prueba de
 * integración. La ruta la resuelve `pino-setup.ts` hacia `data/app.log` o
 * hacia `SPOTY_LOG_FILE` en pruebas, sobre la base existente `log-file.ts`.
 *
 * El módulo no emite eventos por sí mismo: solo escribe lo que Business
 * indique (RNF-006). Antes de escribir depura el mensaje y los campos: solo
 * sobreviven los campos estructurados del conjunto cerrado y se omiten
 * testigos, secretos, cabeceras de autorización y cuerpos de respuesta
 * (RNF-001).
 */
import { getLogger } from './pino-setup.js';

/** Visibilidad registrable: exactamente los dos valores aprobados (P-001). */
type VisibilidadRegistro = 'publica' | 'privada';

/** Campos estructurados admitidos: conjunto cerrado, sin testigos ni cuerpos. */
export interface CamposRegistroPino {
  nombre?: string;
  visibilidad?: VisibilidadRegistro;
  descripcionEfectiva?: string;
  identificador?: string;
  intento?: number;
  estado?: number;
  causa?: string;
}

/** Registro técnico con la forma estructural del puerto `RegistroTecnico`. */
export interface RegistroTecnicoPino {
  info: (mensaje: string, campos?: CamposRegistroPino) => void;
  advertencia: (mensaje: string, campos?: CamposRegistroPino) => void;
  error: (mensaje: string, campos?: CamposRegistroPino) => void;
}

type NivelRegistro = 'info' | 'warn' | 'error';

/** Lista central de campos depurados: texto susceptible de contener secretos. */
const CAMPOS_DE_TEXTO = ['nombre', 'descripcionEfectiva', 'identificador', 'causa'] as const;
/** Lista central de campos depurados: valores numéricos seguros por construcción. */
const CAMPOS_NUMERICOS = ['intento', 'estado'] as const;
const VISIBILIDADES: readonly VisibilidadRegistro[] = ['publica', 'privada'];

const MARCA_DATO_OMITIDO = '[dato omitido]';
const MARCA_CUERPO_OMITIDO = '[cuerpo omitido]';

/** Patrones de testigo, cabecera de autorización o credencial (RNF-001). */
const PATRONES_SECRETOS: readonly RegExp[] = [
  /\bbearer\s+[^,;\s"']+/gi,
  /\bauthorization\b"?\s*[:=]\s*[^,;\n]*/gi,
  /\b(access_token|refresh_token|id_token)\b"?\s*[:=]\s*"?[^,;\s"'}]+/gi,
  /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
];
/** Objetos JSON embebidos: se tratan como cuerpo de respuesta (RNF-001). */
const PATRON_CUERPO_JSON = /\{[^{}]*\}/g;

function esJsonCompleto(valor: string): boolean {
  const texto = valor.trim();
  if (!texto.startsWith('{') && !texto.startsWith('[')) {
    return false;
  }
  try {
    JSON.parse(texto);
    return true;
  } catch {
    return false;
  }
}

/** Depura un texto: omite cuerpos JSON y patrones de testigo o autorización. */
function depurarTexto(valor: string): string {
  if (esJsonCompleto(valor)) {
    return MARCA_CUERPO_OMITIDO;
  }
  let depurado = valor.replace(PATRON_CUERPO_JSON, MARCA_CUERPO_OMITIDO);
  for (const patron of PATRONES_SECRETOS) {
    depurado = depurado.replace(patron, MARCA_DATO_OMITIDO);
  }
  return depurado;
}

/** Conserva solo los campos estructurados admitidos, ya depurados (RNF-001). */
function depurarCampos(campos: CamposRegistroPino = {}): CamposRegistroPino {
  const depurados: CamposRegistroPino = {};
  for (const campo of CAMPOS_DE_TEXTO) {
    const valor = campos[campo];
    if (typeof valor === 'string' && valor.length > 0) {
      depurados[campo] = depurarTexto(valor);
    }
  }
  for (const campo of CAMPOS_NUMERICOS) {
    const valor = campos[campo];
    if (typeof valor === 'number' && Number.isFinite(valor)) {
      depurados[campo] = valor;
    }
  }
  const visibilidad = campos.visibilidad;
  if (visibilidad && VISIBILIDADES.includes(visibilidad)) {
    depurados.visibilidad = visibilidad;
  }
  return depurados;
}

function escribir(nivel: NivelRegistro, mensaje: string, campos?: CamposRegistroPino): void {
  getLogger()[nivel](depurarCampos(campos), depurarTexto(mensaje));
}

/**
 * Crea el registro técnico que conforma el puerto `RegistroTecnico` hacia
 * `data/app.log` (o `SPOTY_LOG_FILE` en pruebas). No escribe nada hasta que
 * Business invoca `info`, `advertencia` o `error`.
 */
export function crearRegistroTecnico(): RegistroTecnicoPino {
  return {
    info: (mensaje, campos) => escribir('info', mensaje, campos),
    advertencia: (mensaje, campos) => escribir('warn', mensaje, campos),
    error: (mensaje, campos) => escribir('error', mensaje, campos),
  };
}
