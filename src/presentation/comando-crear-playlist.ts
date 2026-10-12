/**
 * Comando directo `spoty create-new-playlist` (TASK-015, TC-021).
 *
 * Trazabilidad: `OBJ-001 → RF-001, RF-002, RNF-002, RNF-003, RNF-005 →
 * UC-001, UC-001-E3 → AC-002, AC-005 → TASK-015 → TC-021`.
 *
 * Punto de entrada funcional del flujo UC-001 por comando directo
 * (ARCHITECTURE §3, §4.1, §6.1): analiza los indicadores `--name`,
 * `--description`, `--public` y `--private`, traduciéndolos a la
 * `EntradaVisibilidad` de dominio sin decidir su validez (BR-005), y delega
 * en el coordinador TASK-014 con los mismos tipos que la vía de menú. La
 * descripción ausente se resuelve con el predicado de Business (TASK-005),
 * igual que la petición interactiva de TASK-012; la confirmación viaja
 * pre-resuelta en `confirmada` porque el disparador de comando directo aporta
 * los parámetros sin reingreso (P-001, N-001, DISC-002), y cualquier petición
 * interactiva posterior la convierte en solicitud por el canal.
 *
 * El módulo no decide longitudes, no comprueba duplicados, no registra y no
 * presenta literales propios: cada desenlace y su literal exacto los gestiona
 * el coordinador con `MESSAGES` (TASK-011, TASK-014; ARCHITECTURE §6.2, §6.3).
 */
import type { EntradaVisibilidad } from '../business/playlists/types.js';
import { resolverDescripcionEfectiva } from '../business/playlists/validacion.js';
import { componerCrearPlaylistVacia } from './composicion-crear-playlist.js';
import {
  type CoordinadorCreacion,
  type EntradaDirecta,
  type FinalizacionCreacion,
  ejecutarFlujoCreacion,
  peticionesDeTerminal,
} from './crear-playlist.js';

/** Valor del indicador `--name` o `--description`, tal como lo aportó el usuario. */
function leerValor(argumentos: readonly string[], indicador: string): string | undefined {
  for (let i = 0; i < argumentos.length; i++) {
    if (argumentos[i] === indicador) {
      return argumentos[i + 1];
    }
  }
  return undefined;
}

/**
 * Presencia de indicadores de visibilidad traducida al estado de entrada de
 * dominio: un único indicador produce su visibilidad y la ausencia o la doble
 * presencia producen `ausente` o `doble`, cuyo dictamen corresponde a Business
 * (BR-005, ARCHITECTURE §6.3).
 */
function leerVisibilidad(argumentos: readonly string[]): EntradaVisibilidad {
  const publica = argumentos.includes('--public');
  const privada = argumentos.includes('--private');
  if (publica && privada) {
    return 'doble';
  }
  if (publica) {
    return 'publica';
  }
  if (privada) {
    return 'privada';
  }
  return 'ausente';
}

/**
 * Análisis orientativo de indicadores hacia la entrada directa del
 * coordinador (UC-001 paso 3): el nombre viaja en bruto —ausente como cadena
 * vacía, rechazable por Business (BR-004)— y la descripción ausente se
 * resuelve con el predicado de Business, que aporta el valor por defecto
 * aprobado (RF-001, P-004).
 */
export function analizarEntradaDirecta(argumentos: readonly string[]): EntradaDirecta {
  return {
    nombre: leerValor(argumentos, '--name') ?? '',
    descripcion: resolverDescripcionEfectiva(leerValor(argumentos, '--description')),
    visibilidad: leerVisibilidad(argumentos),
    confirmacionPreResuelta: true,
  };
}

/**
 * Ejecuta el comando delegando en la composición real (TASK-013) y en el
 * coordinador del flujo (TASK-014), que traduce cada desenlace y gestiona el
 * reingreso interactivo (UC-001-E3, ARCHITECTURE §6.1, §6.2 y §6.3).
 */
export async function ejecutarComandoCrearPlaylist(
  argumentos: readonly string[]
): Promise<FinalizacionCreacion> {
  const coordinador: CoordinadorCreacion = {
    casoUso: componerCrearPlaylistVacia(),
    peticiones: peticionesDeTerminal,
    entradaDirecta: analizarEntradaDirecta(argumentos),
  };
  return ejecutarFlujoCreacion(coordinador);
}
