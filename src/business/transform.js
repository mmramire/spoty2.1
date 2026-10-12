import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export interface TrackObject {
  id: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  popularity: number;
  isrc: string | null;
  artists: Array<{
    id: string;
    name: string;
    externalUrls: { spotify: string };
  }>;
  album: {
    id: string;
    name: string;
    releaseDate: string;
    releaseDatePrecision: string;
    totalTracks: number;
    images: Array<{ url: string; height: number; width: number }>;
    externalUrls: { spotify: string };
  };
  externalUrls: { spotify: string };
  previewUrl: string | null;
  type: string;
  uri: string;
  addedAt: string;
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
    track: TrackObject;
  }>;
}

interface DownloadOptions {
  outputDir?: string;
}

export function createOutputJSON(
  tracks: TrackObject[],
  options: DownloadOptions = {}
): { filePath: string; totalTracks: number; json: OutputJSON } {
  const now = new Date();
  const datePrefix = now.toISOString().split('T')[0];
  const filename = `${datePrefix}-download_songs.json`;

  let outputDir: string;
  if (options.outputDir) {
    outputDir = path.resolve(options.outputDir);
  } else {
    outputDir = process.cwd();
  }

  const safeOutputDir = path.resolve(outputDir);
  const filePath = path.join(safeOutputDir, filename);

  const totalTracks = tracks.length;

  const metadata = {
    downloadedAt: now.toISOString(),
    totalTracks,
    spotifyUserId: 'unknown',
    spotifyDisplayName: 'Unknown',
    version: '1.0',
  };

  const outputTracks = tracks.map((track) => ({
    addedAt: track.addedAt,
    track: {
      id: track.id,
      name: track.name,
      durationMs: track.durationMs,
      explicit: track.explicit,
      popularity: track.popularity,
      isrc: track.isrc || null,
      artists: track.artists?.map((a) => ({
        id: a.id,
        name: a.name,
        externalUrls: a.externalUrls || { spotify: '' },
      })) || [],
      album: track.album
        ? {
            id: track.album.id,
            name: track.album.name,
            releaseDate: track.album.releaseDate,
            releaseDatePrecision: track.album.releaseDatePrecision,
            totalTracks: track.album.totalTracks,
            images: track.album.images?.map((img) => ({
              url: img.url,
              height: img.height,
              width: img.width,
            })) || [],
            externalUrls: track.album.externalUrls || { spotify: '' },
          }
        : {
            id: '',
            name: '',
            releaseDate: '',
            releaseDatePrecision: 'day',
            totalTracks: 0,
            images: [],
            externalUrls: { spotify: '' },
          },
      externalUrls: track.externalUrls || { spotify: '' },
      previewUrl: track.previewUrl || null,
      type: track.type || 'track',
      uri: track.uri || `spotify:track:${track.id}`,
    },
  }));

  const outputJSON: OutputJSON = {
    metadata,
    tracks: outputTracks,
  };

  return { filePath, totalTracks, json: outputJSON };
}