export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  title: string;
  description: string;
  favicon: string;
  category?: string;
}

export interface CacheEntry {
  data: ScrapeResponse;
  timestamp: number;
}
