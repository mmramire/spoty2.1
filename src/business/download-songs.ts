import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchAllSavedTracks } from '../data/download-songs.service.js';
import { getUserProfile } from './auth/profile.js';
import { getStoredTokens } from './auth/tokens.js';
import type { TrackObject } from './types/download-songs.types.js';

export interface DownloadSongsOptions {
  outputDir?: string;
}

export interface DownloadResult {
  success: boolean;
  filePath: string;
  totalTracks: number;
  error?: string;
}

export interface OutputJSON {
  metadata: {
    downloadedAt: string;
    totalTracks: number;
    spotifyUserId: string;
    spotifyDisplayName: string;
    version: string;
  };
  tracks: Array<{
    addedAt: string;
    track: {
      id: string;
      name: string;
      durationMs: number;
      explicit: boolean;
      popularity: number;
      artists: Array<{ id: string; name: string }>;
      album: { name: string; releaseDate: string };
      externalUrls: { spotify: string };
      previewUrl?: string | null;
      uri: string;
    };
  }>;
}

export async function downloadSongs(options: DownloadSongsOptions): Promise<DownloadResult> {
  const tokens = getStoredTokens();

  if (!tokens) {
    return {
      success: false,
      filePath: '',
      totalTracks: 0,
      error: 'No hay tokens guardados. Ejecuta "spoty connect" primero.',
    };
  }

  if (!tokens.scope.includes('user-library-read')) {
    return {
      success: false,
      filePath: '',
      totalTracks: 0,
      error:
        'El token no tiene el scope "user-library-read". Ejecuta "spoty connect" con los permisos adecuados.',
    };
  }

  // Logging: registrar inicio de descarga (sin bloquear si falla)
  const logPath = path.resolve('data/app.log');
  await fs.mkdir(path.dirname(logPath), { recursive: true }).catch(() => {});
  const logStartMsg = `[${new Date().toISOString()}] Iniciando descarga de biblioteca Spotify\n`;
  fs.appendFile(logPath, logStartMsg).catch(() => {
    /* logging fallido, no bloquear flujo */
  });

  try {
    const tracks = await fetchAllSavedTracks(tokens.access_token);

    // Get user profile for metadata display name
    const profile = await getUserProfile(tokens.access_token);

    // Transform tracks to output JSON structure
    const totalTracks = tracks.length;
    // Formato fecha y hora: 2026-10-06_14-30-45 (sin ms, sin :, sin Z)
    const dateHour = new Date().toISOString().split('.')[0]?.replace('T', '_').replace(/:/g, '-');
    const filename = `${dateHour}-download_songs.json`;
    // Carpeta por defecto: downloads/
    const outputDir = options.outputDir || path.resolve('downloads');
    const filePath = path.join(outputDir, filename);

    const outputJSON: OutputJSON = {
      metadata: {
        downloadedAt: new Date().toISOString(),
        totalTracks,
        spotifyUserId: '',
        spotifyDisplayName: profile.display_name || 'Usuario anónimo',
        version: '1.0',
      },
      tracks: tracks.map((track) => ({
        addedAt: (track as TrackObject).addedAt,
        track: {
          id: track.id,
          name: track.name,
          durationMs: track.durationMs,
          explicit: track.explicit,
          popularity: track.popularity,
          artists: track.artists.map((a: { id: string; name: string }) => ({
            id: a.id,
            name: a.name,
          })),
          album: {
            name: track.album?.name || '',
            releaseDate: track.album?.releaseDate || '',
          },
          externalUrls: { spotify: track.externalUrls?.spotify || '' },
          previewUrl: track.previewUrl,
          uri: track.uri,
        },
      })),
    };

    // Logging: tracks obtenidos
    const logTracksMsg = `[${new Date().toISOString()}] Tracks obtenidos: ${totalTracks}\n`;
    fs.appendFile(logPath, logTracksMsg).catch(() => {
      /* logging fallido, no bloquear flujo */
    });

    // Escribir el archivo JSON en disco
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(outputJSON, null, 2));

    // Logging: completado exitoso
    const logSuccessMsg = `[${new Date().toISOString()}] Descarga completada: ${filePath} (${totalTracks} tracks)\n`;
    fs.appendFile(logPath, logSuccessMsg).catch(() => {
      /* logging fallido, no bloquear flujo */
    });

    return {
      success: true,
      filePath,
      totalTracks,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido durante la descarga';

    // Logging: error durante descarga
    const logErrorMsg = `[${new Date().toISOString()}] Error durante descarga: ${msg}\n`;
    fs.appendFile(logPath, logErrorMsg).catch(() => {
      /* logging fallido, no bloquear flujo */
    });

    return { success: false, filePath: '', totalTracks: 0, error: msg };
  }
}
