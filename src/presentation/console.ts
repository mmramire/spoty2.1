export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

export function success(msg: string): string {
  return `${colors.green}✓${colors.reset} ${msg}`;
}

export function error(msg: string): string {
  return `${colors.red}✗${colors.reset} ${msg}`;
}

export function warning(msg: string): string {
  return `${colors.yellow}⚠${colors.reset} ${msg}`;
}

export function info(msg: string): string {
  return `${colors.blue}ℹ${colors.reset} ${msg}`;
}

export function dim(msg: string): string {
  return `${colors.dim}${msg}${colors.reset}`;
}

export function bold(msg: string): string {
  return `${colors.bold}${msg}${colors.reset}`;
}

export function cyan(msg: string): string {
  return `${colors.cyan}${msg}${colors.reset}`;
}

export function section(title: string): string {
  return `\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}\n`;
}

export function divider(): string {
  return `${colors.dim}────────────────────────────────────────${colors.reset}`;
}

export function step(message: string): string {
  return `${colors.blue}▶${colors.reset} ${message}`;
}

export function confirm(message: string): string {
  return `${colors.green}✓${colors.reset} ${message}`;
}

export function blank(): string {
  return '';
}

let spinnerInterval: NodeJS.Timeout | null = null;
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let spinnerIndex = 0;
let spinnerStartTime = 0;
let _spinnerMessage = '';

export function startSpinner(message: string): void {
  stopSpinner();
  _spinnerMessage = message;
  spinnerStartTime = Date.now();
  process.stdout.write(`\r\x1b[K ${colors.cyan}${spinnerFrames[0]}${colors.reset} ${message}`);
  spinnerInterval = setInterval(() => {
    spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    const elapsed = Math.floor((Date.now() - spinnerStartTime) / 1000);
    const timeStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    process.stdout.write(
      `\r\x1b[K ${colors.cyan}${spinnerFrames[spinnerIndex]}${colors.reset} ${message} ${colors.dim}(${timeStr})${colors.reset}`
    );
  }, 100);
}

export function stopSpinner(successMsg?: string): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    spinnerIndex = 0;
    if (successMsg) {
      process.stdout.write(`\r\x1b[K${success(successMsg)}\n`);
    } else {
      process.stdout.write('\r\x1b[K');
    }
  }
}

export function stopSpinnerWithError(errorMsg: string): void {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    spinnerIndex = 0;
    process.stdout.write(`\r\x1b[K${error(errorMsg)}\n`);
  }
}
