import { api } from "../lib/api.js";
import type {
  GenerateSongInput,
  RegenerateSongInput,
  Song,
  SongDetail,
  SongWithCreator,
  UserProfile,
} from "@melodia/shared";

interface GenerateResponse {
  success: boolean;
  song_id: string;
  status: string;
}

interface ListSongsResponse {
  success: boolean;
  songs: Song[];
  next_cursor: string | null;
}

interface GetSongResponse {
  success: boolean;
  song: SongDetail;
}

interface ExploreSongsResponse {
  success: boolean;
  songs: SongWithCreator[];
  next_cursor: string | null;
}

interface LikeResponse {
  liked: boolean;
  like_count: number;
}

interface GetProfileResponse {
  success: boolean;
  data: UserProfile;
}

interface GetProfileSongsResponse {
  success: boolean;
  songs: Song[];
  next_cursor: string | null;
}

interface UpdateSongResponse {
  success: boolean;
  song: SongDetail;
}

interface RegenerateResponse {
  success: boolean;
  song_id: string;
  status: string;
}

interface SelectVariationResponse {
  success: boolean;
  song: SongDetail;
}

interface VariationItem {
  index: number;
  is_selected: boolean;
}

interface GetVariationsResponse {
  variations: VariationItem[];
  selected_index: number;
  count: number;
}

export function useSongs() {
  return {
    generate: async (input: GenerateSongInput): Promise<{ song_id: string }> => {
      const res = await api.post<GenerateResponse>("/api/songs/generate", input);
      return { song_id: res.song_id };
    },

    getSong: async (id: string): Promise<SongDetail> => {
      const res = await api.get<GetSongResponse>(`/api/songs/${id}`);
      return res.song;
    },

    listSongs: async (opts?: {
      status?: string;
      cursor?: string;
      limit?: number;
    }): Promise<{ songs: Song[]; next_cursor: string | null }> => {
      const params = new URLSearchParams();
      if (opts?.status) params.set("status", opts.status);
      if (opts?.cursor) params.set("cursor", opts.cursor);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      const res = await api.get<ListSongsResponse>(
        `/api/songs${query ? `?${query}` : ""}`
      );
      return { songs: res.songs, next_cursor: res.next_cursor };
    },

    deleteSong: async (id: string): Promise<void> => {
      await api.delete(`/api/songs/${id}`);
    },

    getAudioBlob: async (id: string, variationIndex = 0): Promise<Blob> => {
      const path =
        variationIndex > 0
          ? `/api/songs/${id}/stream?variation=${variationIndex}`
          : `/api/songs/${id}/stream`;
      return api.getBlob(path);
    },

    // ─── Explore ──────────────────────────────────────────────────────────────

    exploreSongs: async (opts: {
      tab: string;
      genre?: string;
      cursor?: string;
      offset?: number;
      limit?: number;
    }): Promise<{ songs: SongWithCreator[]; next_cursor: string | null }> => {
      const params = new URLSearchParams();
      params.set("tab", opts.tab);
      if (opts.genre) params.set("genre", opts.genre);
      if (opts.cursor) params.set("cursor", opts.cursor);
      if (opts.offset !== undefined) params.set("offset", String(opts.offset));
      if (opts.limit) params.set("limit", String(opts.limit));
      const res = await api.get<ExploreSongsResponse>(
        `/api/songs/explore?${params.toString()}`
      );
      return { songs: res.songs, next_cursor: res.next_cursor };
    },

    // ─── Likes ────────────────────────────────────────────────────────────────

    likeSong: async (songId: string): Promise<{ liked: boolean; like_count: number }> => {
      const res = await api.post<LikeResponse>(`/api/songs/${songId}/like`);
      return res;
    },

    unlikeSong: async (songId: string): Promise<{ liked: boolean; like_count: number }> => {
      const res = await api.delete<LikeResponse>(`/api/songs/${songId}/like`);
      return res;
    },

    likedSongs: async (opts?: {
      page?: number;
      limit?: number;
    }): Promise<{ songs: Song[]; next_cursor: string | null }> => {
      const params = new URLSearchParams();
      if (opts?.page !== undefined) params.set("page", String(opts.page));
      if (opts?.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      const res = await api.get<ListSongsResponse>(
        `/api/songs/liked${query ? `?${query}` : ""}`
      );
      return { songs: res.songs, next_cursor: res.next_cursor };
    },

    // ─── Profile ──────────────────────────────────────────────────────────────

    getProfile: async (username: string): Promise<UserProfile> => {
      const res = await api.get<GetProfileResponse>(`/api/users/${username}`);
      return res.data;
    },

    getProfileSongs: async (
      username: string,
      opts?: { cursor?: string; limit?: number }
    ): Promise<{ songs: Song[]; next_cursor: string | null }> => {
      const params = new URLSearchParams();
      if (opts?.cursor) params.set("cursor", opts.cursor);
      if (opts?.limit) params.set("limit", String(opts.limit));
      const query = params.toString();
      const res = await api.get<GetProfileSongsResponse>(
        `/api/users/${username}/songs${query ? `?${query}` : ""}`
      );
      return { songs: res.songs, next_cursor: res.next_cursor };
    },

    // ─── Update ───────────────────────────────────────────────────────────────

    updateSong: async (
      id: string,
      fields: { is_public?: boolean; title?: string }
    ): Promise<SongDetail> => {
      const res = await api.put<UpdateSongResponse>(`/api/songs/${id}`, fields);
      return res.song;
    },

    // ─── Regenerate ───────────────────────────────────────────────────────────

    regenerate: async (
      songId: string,
      keep: RegenerateSongInput["keep"]
    ): Promise<{ song_id: string; status: string }> => {
      const res = await api.post<RegenerateResponse>(
        `/api/songs/${songId}/regenerate`,
        { keep }
      );
      return { song_id: res.song_id, status: res.status };
    },

    // ─── Variation selection ──────────────────────────────────────────────────

    selectVariation: async (
      songId: string,
      variationIndex: number
    ): Promise<SongDetail> => {
      const res = await api.put<SelectVariationResponse>(
        `/api/songs/${songId}/select-variation`,
        { variation_index: variationIndex }
      );
      return res.song;
    },

    // ─── Get variations list ──────────────────────────────────────────────────

    getVariations: async (
      songId: string
    ): Promise<{ variations: VariationItem[]; selected_index: number; count: number }> => {
      return api.get<GetVariationsResponse>(`/api/songs/${songId}/variations`);
    },
  };
}
