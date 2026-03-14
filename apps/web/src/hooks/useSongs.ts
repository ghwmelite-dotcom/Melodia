import { api } from "../lib/api.js";
import type { GenerateSongInput, Song, SongDetail } from "@melodia/shared";

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

    getAudioBlob: async (id: string): Promise<Blob> => {
      return api.getBlob(`/api/songs/${id}/stream`);
    },
  };
}
