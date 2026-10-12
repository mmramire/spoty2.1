import { main } from './cli-main.js';
import { MESSAGES } from './presentation/messages.js';
import { showError } from './presentation/prompts.js';

// Arranque exclusivo del binario spoty (TASK-010, TC-016): la lógica vive en cli-main.ts
// y aquí solo se invoca main() preservando los códigos de salida actuales.
main()
  .then((code) => process.exit(code))
  .catch((err) => {
    showError(MESSAGES.errors.generic(err instanceof Error ? err.message : 'Error desconocido'));
    process.exit(1);
  });
