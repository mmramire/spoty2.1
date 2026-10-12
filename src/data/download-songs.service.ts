import { getLogger } from './logging/pino-setup.js';

const LIMIT_PER_PAGE = 50;

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
}

export interface FetchAllSavedTracksResult {
  tracks: TrackObject[];
  totalCount: number;
}

interface FetchPageResponse {
  tracks: TrackObject[];
  /** True if there are more pages available */
  hasMore: boolean;
  /** Error message if the fetch failed */
  error?: string;
}

/** Fetch a single page of saved tracks */
async function fetchPage(currentToken: string, offset: number): Promise<FetchPageResponse> {
  const url = new URL('https://api.spotify.com/v1/me/tracks');
  url.searchParams.set('limit', String(LIMIT_PER_PAGE));
  url.searchParams.set('offset', String(offset));

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${currentToken}`,
      },
    } as RequestInit);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? Math.min(Number.parseInt(retryAfter, 10) * 1000, 60000) : 1000;
      return { tracks: [], hasMore: false, error: `Rate limit, retry after ${delay}ms` };
    }

    if (response.status === 401) {
      return { tracks: [], hasMore: false, error: 'TOKEN_EXPIRED' };
    }

    if (!response.ok) {
      const errorData = (await response.json()) as { error: { message: string } };
      return { tracks: [], hasMore: false, error: `API error: ${errorData.error?.message ?? ''}` };
    }

    const data = (await response.json()) as {
      items: Array<{ track: TrackObject }>;
      /** Spotify API returns 'next' when there are more pages */
      next: string | null;
    };
    const tracks = data.items?.map((item) => item.track) || [];
    /** Has more pages if there's a 'next' cursor AND we got a full page */
    const hasMore = data.next !== null && data.items?.length >= LIMIT_PER_PAGE;
    return { tracks, hasMore };
  } catch (error) {
    return { tracks: [], hasMore: false, error: (error as Error).message };
  }
}

/** Fetch all saved tracks with pagination */
export async function fetchAllSavedTracks(accessToken: string): Promise<TrackObject[]> {
  const logger = getLogger();
  const currentToken = accessToken;
  let allTracks: TrackObject[] = [];
  let offset = 0;

  while (true) {
    const result = await fetchPage(currentToken, offset);

    if (result.error === 'TOKEN_EXPIRED') {
      logger.info('Access token expired, needs refresh');
      throw new Error(result.error);
    }

    if (result.error) {
      logger.error({ error: result.error }, 'Error fetching tracks page');
      throw new Error(result.error);
    }

    allTracks = allTracks.concat(result.tracks);

    if (!result.hasMore) {
      break;
    }

    offset += LIMIT_PER_PAGE;
  }

  return allTracks;
}
