// API base URL — empty string for same-origin (dev proxy), or full URL for production
const API_BASE = import.meta.env.VITE_API_URL ?? "";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private onUnauthorized: (() => Promise<boolean>) | null = null;

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  setOnUnauthorized(handler: () => Promise<boolean>): void {
    this.onUnauthorized = handler;
  }

  private buildHeaders(extra: Record<string, string> = {}): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...extra,
    };
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async request<T>(
    path: string,
    options: RequestOptions = {},
    retry = true
  ): Promise<T> {
    const { method = "GET", body, headers: extraHeaders = {}, signal } = options;

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: this.buildHeaders(extraHeaders),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

    // Handle 401 with refresh retry
    if (response.status === 401 && retry && this.onUnauthorized) {
      const refreshed = await this.onUnauthorized();
      if (refreshed) {
        return this.request<T>(path, options, false);
      }
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      const message =
        typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData &&
        typeof (errorData as { error: unknown }).error === "string"
          ? (errorData as { error: string }).error
          : response.statusText;
      throw new ApiError(response.status, message, errorData);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  async postForm<T>(path: string, formData: FormData, retry = true): Promise<T> {
    // Do NOT set Content-Type — browser auto-sets multipart/form-data with boundary
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });

    // Handle 401 with refresh retry
    if (response.status === 401 && retry && this.onUnauthorized) {
      const refreshed = await this.onUnauthorized();
      if (refreshed) {
        return this.postForm<T>(path, formData, false);
      }
    }

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      const message =
        typeof errorData === "object" &&
        errorData !== null &&
        "error" in errorData &&
        typeof (errorData as { error: unknown }).error === "string"
          ? (errorData as { error: string }).error
          : response.statusText;
      throw new ApiError(response.status, message, errorData);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  async getBlob(path: string, retry = true): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      credentials: "include",
      headers,
    });

    // Handle 401 with refresh retry
    if (response.status === 401 && retry && this.onUnauthorized) {
      const refreshed = await this.onUnauthorized();
      if (refreshed) {
        return this.getBlob(path, false);
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    return response.blob();
  }
}

export const api = new ApiClient();
