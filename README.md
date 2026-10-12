# Spoty

Spoty es un programa que se conecta con tu cuenta de Spotify para hacer dos cosas:

1. **Descargar la lista de canciones que marcaste con "Me gusta"** a un archivo en tu computadora.
2. **Crear playlists vacías** nuevas en tu cuenta de Spotify.

Todo se usa desde una ventana de comandos (la terminal), siguiendo un menú con opciones numeradas.

## Qué necesitas antes de empezar

- **Node.js versión 22 o superior** instalado. Si no lo tienes, descárgalo desde <https://nodejs.org> (elige la versión LTS) e instálalo como cualquier otro programa.
- **Una cuenta de Spotify** (sirve la gratuita).
- Este proyecto descargado en tu computadora.

## Instalación (solo la primera vez)

1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta esto para instalar lo necesario (solo tarda la primera vez):

```bash
npm install
```

## Conectar con Spotify (primera vez)

Para que el programa pueda entrar a tu cuenta, Spotify pide que registres una "aplicación". Es gratis y solo se hace una vez:

1. Entra a <https://developer.spotify.com/dashboard> e inicia sesión con tu cuenta de Spotify.
2. Crea una aplicación nueva (botón "Create app").
3. En el campo **Redirect URIs** escribe exactamente esto y guarda:

```text
http://127.0.0.1:8888/callback
```

4. Copia el **Client ID** que te muestra la página.

Ahora abre la terminal en la carpeta del proyecto y ejecuta:

```bash
npm run dev
```

Elige la opción **1. Conectar con Spotify**. El programa te va a pedir dos datos:

- Tu **Client ID** (el que copiaste).
- La **Redirect URI** (`http://127.0.0.1:8888/callback`).

Se abrirá tu navegador para que inicies sesión en Spotify y autorices la aplicación. Al volver a la terminal verás un mensaje de que la conexión fue exitosa. A partir de ahí ya no tienes que repetir este paso, salvo que cierres la sesión.

> Consejo: si ya configuraste las variables `SPOTIFY_CLIENT_ID` y `SPOTIFY_REDIRECT_URI` en tu sistema, el programa las usa directamente y no te las pide.

## Cómo usarlo

Inicia el programa siempre con:

```bash
npm run dev
```

Verás este menú:

```text
1. Conectar con Spotify
2. Ver estado de conexión
3. Descargar biblioteca
4. Crear playlist vacía
9. Cerrar sesión
0. Salir
```

Escribe el número de la opción y pulsa Enter.

- **1. Conectar con Spotify**: inicia sesión (solo la primera vez o si la sesión caducó).
- **2. Ver estado de conexión**: te dice si hay una sesión activa y con qué usuario.
- **3. Descargar biblioteca**: guarda tus canciones con "Me gusta" en un archivo dentro de la carpeta `downloads/`. Al terminar te muestra cuántas canciones descargó y dónde quedó el archivo.
- **4. Crear playlist vacía**: te pide el nombre, una descripción opcional y si la quieres pública o privada. Después te muestra un resumen y debes confirmar escribiendo `s`. Si ya tienes una playlist con ese nombre, te deja cambiarlo, crearla igual o cancelar.
- **9. Cerrar sesión**: borra tu sesión de esta computadora.
- **0. Salir**: cierra el programa (antes te pide confirmación).

> Nota: las opciones 3 y 4 necesitan que hayas iniciado sesión primero. Si no lo hiciste, el programa te lo avisa y no hace nada más.

## Atajos (opcional)

Si prefieres no entrar al menú, puedes ejecutar acciones directas:

```bash
# Iniciar sesión
npm run dev -- connect

# Ver el estado de la sesión
npm run dev -- status

# Descargar biblioteca (se guarda en la carpeta downloads/)
npm run dev -- download-songs

# Crear una playlist pública llamada "Mis favoritas"
npm run dev -- create-new-playlist --name "Mis favoritas" --public

# Cerrar sesión
npm run dev -- logout
```

## Versión compilada (opcional, más rápida)

Si prefieres no usar `npm run dev`, puedes compilar el programa una vez y ejecutarlo directamente con Node.js:

```bash
# Compilar (solo hace falta repetirlo si cambia el código)
npm run build

# Abrir el menú interactivo
node dist/cli.js

# O ejecutar un comando directo (aquí NO se usa --)
node dist/cli.js connect
node dist/cli.js download-songs
```

Funciona igual que `npm run dev`, pero usa la versión compilada en la carpeta `dist/`.

## Dónde quedan tus cosas

- **Tu sesión**: se guarda en `data/tokens.json` en la carpeta del proyecto. No la compartas con nadie.
- **Tus descargas**: quedan en la carpeta `downloads/`, en archivos con la fecha y hora en el nombre.
- El programa nunca te pide tu contraseña de Spotify: el inicio de sesión siempre se hace en la página oficial de Spotify desde tu navegador.

## Si algo sale mal

- **"No hay sesión activa" o "Configuración requerida"**: ejecuta el programa y elige la opción **1** para iniciar sesión de nuevo. Las sesiones pueden caducar o revocarse con el tiempo.
- **"Puerto 8888 en uso"**: otra aplicación está usando ese puerto. Ciérrala o usa otro puerto (por ejemplo `http://127.0.0.1:9999/callback`), pero recuerda poner la misma dirección en el Dashboard de Spotify y cuando el programa te la pida.
- **"Redirect URI inválida" o algo sobre "localhost"**: la dirección debe ser exactamente `http://127.0.0.1:puerto/callback` (con `127.0.0.1`, no con `localhost`) y debe coincidir con la que registraste en el Dashboard de Spotify.
- **La descarga falla a la mitad**: vuelve a intentarlo; si el error menciona la sesión, inicia sesión de nuevo con la opción **1**.
- **¿Empezar de cero con la sesión?**: elige la opción **9** (cerrar sesión) y luego la opción **1** (conectar).
