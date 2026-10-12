# spoty2

CLI para autenticación con Spotify usando OAuth 2.0 Authorization Code con PKCE. Genera un binario único ejecutable sin necesidad de instalar Node.js.

## Características

- ✅ Autenticación OAuth 2.0 con PKCE (segura para apps de escritorio)
- ✅ Apertura automática del navegador + fallback manual
- ✅ Persistencia de tokens en `data/tokens.json` con permisos restrictivos (0o600)
- ✅ Logging técnico en `data/app.log` (rotación automática >5MB)
- ✅ Reintentos automáticos con `Retry-After` en rate limiting (429)
- ✅ Manejo diferenciado de errores: 401 (token expirado) vs 403 (acceso revocado)
- ✅ Binario standalone (Node.js SEA) para distribución sin dependencias
- ✅ 100% TypeScript, validado con Biome, testeado con Vitest

## Requisitos

- Node.js 22+ (solo para desarrollo/build)
- Cuenta de desarrollador en [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Configuración Inicial

### 1. Crear aplicación en Spotify Dashboard

1. Ve a [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Crea una nueva aplicación
3. En **Redirect URIs**, añade: `http://127.0.0.1:8888/callback`
   - ⚠️ **Importante**: Debe usar `127.0.0.1` (no `localhost`)
   - El puerto puede ser cualquier puerto libre (ej. 8888, 3000, 8080)
4. Copia el **Client ID**

### 2. Configurar variables de entorno

```bash
# Linux/macOS
export SPOTIFY_CLIENT_ID="tu-client-id"
export SPOTIFY_REDIRECT_URI="http://127.0.0.1:8888/callback"

# Windows (PowerShell)
$env:SPOTIFY_CLIENT_ID="tu-client-id"
$env:SPOTIFY_REDIRECT_URI="http://127.0.0.1:8888/callback"

# Windows (CMD)
set SPOTIFY_CLIENT_ID=tu-client-id
set SPOTIFY_REDIRECT_URI=http://127.0.0.1:8888/callback
```

> **Nota**: Si no configuras las variables, la CLI te las pedirá interactivamente al ejecutar `spoty connect`.

## Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests
npm test

# Linting y formateo
npm run lint

# Verificar tipos
npx tsc --noEmit
```

## Ejecución después del Build

```bash
# Compilar TypeScript
npm run build

# Ejecutar el CLI compilado directamente con Node.js
node dist/cli.js

# O usando npx (usa el binario definido en package.json)
npx spoty

# O si instalaste globalmente (npm link / npm install -g .)
spoty
```

## Compilación a Binario Standalone

> **Estado (2026-10-07):** el empaquetado como binario único (Node.js SEA) es una **restricción de diseño** vigente —ver `AGENTS.md` §7 y `docs/constitution.md` (principio 7)—, pero el flujo de build del binario **aún no está configurado en este repositorio**: no existe `sea-config.json`, no hay script de empaquetado en `package.json` ni dependencia de inyección (`postject`). Por tanto, el comando `node --experimental-sea-config sea-config.json` **no es ejecutable todavía**.

Build disponible hoy:

```bash
# Compilar TypeScript
npm run build
```

La configuración `sea-config.json` y los pasos de inyección se crearán cuando se especifique el flujo de release del binario (feature futura). El diseño del proyecto se mantiene compatible con esa compilación futura.

## Uso

### Modo Interactivo (menú)

```bash
spoty
```

Muestra un menú con opciones:
```
=== spoty - Conexión a Spotify ===

Selecciona una opción:
1. Conectar con Spotify
2. Ver estado de conexión
3. Descargar biblioteca
9. Cerrar sesión
0. Salir
(navega con 0-3,9, Ctrl+C para cancelar)
```

### Comandos Directos

```bash
# Iniciar flujo de autenticación
spoty connect

# Ver estado de la sesión actual
spoty status

# Descargar biblioteca de canciones
spoty download-songs [--output-dir <ruta> | -o <ruta>]

# Cerrar sesión (borra tokens guardados)
spoty logout

# Ayuda
spoty --help
```

## Flujo de Autenticación

1. Ejecuta `spoty connect` (o elige opción 1 en el menú)
2. Se abre automáticamente el navegador en la página de autorización de Spotify
3. Inicia sesión en Spotify y autoriza la aplicación
4. La CLI recibe el callback, intercambia el código por tokens y los guarda
5. Muestra mensaje de éxito: `Conectado correctamente a Spotify como {nombre} ({email})`

### Descarga de biblioteca de canciones

Ejecuta `spoty download-songs` (o selecciona la opción 3 en el menú interactivo) para descargar todo el listado de canciones guardadas ("Me gusta") de tu biblioteca de Spotify. El sistema:

1. Valida sesión OAuth existente (reutiliza tokens guardados en `data/tokens.json`)
2. Obtiene access token válido (refresh automático si ha expirado)
3. Descarga paginada todas las tracks usando `GET /me/tracks` (máx 50 por página)
4. Maneja rate limits (HTTP 429) con backoff exponencial y respeto a `Retry-After`
5. Refresca token automáticamente si expira durante la descarga
6. Guarda los resultados en la carpeta `downloads/` con nombre `YYYY-MM-DD_HH-mm-ss-download_songs.json`
7. Muestra un spinner de progreso durante la descarga y mensaje final con ruta y número de tracks

**Nombre de archivo**: `YYYY-MM-DD_HH-mm-ss-download_songs.json` (fecha y hora local al iniciar la descarga)

**Opciones**:
- `--output-dir <ruta>` / `-o <ruta>`: Carpeta personalizada (por defecto: `downloads/`)

### Si el navegador no se abre automáticamente

La CLI muestra la URL de autorización en consola. Cópiala y pégala manualmente en tu navegador.

## Estructura de Archivos

```
spoty2/
├ data/
│   ├── tokens.json    # Tokens OAuth (permisos 0o600)
│   └── app.log        # Log técnico (rotación >5MB)
├ downloads/           # Archivos JSON de descargas (se crea automáticamente)
├ docs/
│   ├── constitution.md    # Principios innegociables SDD
│   ├── rules.md           # Reglas de integración API Spotify
│   ├── agent.md           # Identidad y rol del agente
│   └── open-api-schema.yaml  # Especificación OpenAPI de Spotify
├ specs/
│   ├── 001-spoty2-mvp/
│   │   ├── plan.md          # Plan de implementación N-Tier y RFs
│   │   ├── resumen-fixes.md # Correcciones UX/UI y no considerado inicialmente
│   │   └── spec.md          # Especificación funcional del MVP
│   └── 002-download-songs/
│       ├── ACCEPTANCE_CRITERIA.feature
│       ├── ARCHITECTURE.md
│       ├── REQUIREMENTS.md
│       ├── SPECS.md
│       └── USE_CASES.md
├ src/
│   ├── presentation/      # CLI, prompts, mensajes
│   ├── business/
│   │   ├── auth/          # Flujo OAuth 2.0 con PKCE
│   │   ├── download-songs.ts  # Descarga biblioteca Spotify
│   │   ├── transform.js     # Transformación de datos
│   │   └── types/
│   │       └── download-songs.types.ts
│   └── data/              # HTTP, storage, logging
└── tests/                 # Tests unitarios (Vitest)
```

## Scopes Solicitados

La aplicación solicita los siguientes permisos (pre-aprobados para evitar re-consentimiento futuro):

- `user-read-private` — Perfil privado del usuario
- `user-read-email` — Email del usuario
- `user-library-read` — Biblioteca guardada (lectura)
- `user-library-modify` — Biblioteca guardada (escritura)
- `playlist-read-private` — Playlists privadas (lectura)
- `playlist-modify-private` — Playlists privadas (escritura)
- `playlist-modify-public` — Playlists públicas (escritura)
- `playlist-read-collaborative` — Playlists colaborativas (lectura)

## Códigos de Salida

| Código | Significado |
|--------|-------------|
| `0` | Éxito (incluye cancelación voluntaria) |
| `1` | Error de autenticación/red no recuperable |
| `2` | Error de configuración (env vars faltantes/inválidas) |
| `3` | Error de recurso (puerto ocupado, FS) |
| `130` | Interrupción SIGINT (Ctrl+C) |

## Solución de Problemas

### "Puerto X en uso"
```bash
# Cambia el puerto en SPOTIFY_REDIRECT_URI y en Spotify Dashboard
export SPOTIFY_REDIRECT_URI="http://127.0.0.1:9999/callback"
```

### "Redirect URI inválida: localhost no permitido"
- Usa `http://127.0.0.1:PUERTO/callback` (no `localhost`)
- Actualiza la misma URI en Spotify Dashboard

### "Error al conectar con Spotify: ... Ver data/app.log"
- Revisa `data/app.log` para detalles técnicos
- Errores comunes: credenciales incorrectas, red, rate limiting

### Tokens corruptos o sesión inválida
```bash
spoty logout
spoty connect
```

## Seguridad

- Tokens guardados en `data/tokens.json` con permisos `0o600` (solo owner read/write)
- En Windows los permisos restrictivos se aplican automáticamente
- `client_secret` **nunca** se almacena en el código ni en disco
- PKCE S256 evita interceptación del código de autorización
- Logs no contienen tokens completos (solo prefijos/sufijos si debug)

## Licencia

MIT