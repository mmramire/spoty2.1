export interface DownloadSongsOptions {
  outputDir?: string;
}

export interface DownloadResult {
  success: boolean;
  filePath: string;
  totalTracks: number;
  error?: string;
}

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
