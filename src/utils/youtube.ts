import { fallbackFavicon, categorizeUrl } from "./fallback";

interface YouTubeOEmbedResponse {
  title: string;
  author_name: string;
}

export async function fetchYouTubeMetadata(url: string): Promise<{
  title: string;
  description: string;
  favicon: string;
  category: string;
} | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    
    if (response.ok) {
      const data = (await response.json()) as YouTubeOEmbedResponse;
      return {
        title: data.title,
        description: data.author_name || "",
        favicon: fallbackFavicon(url),
        category: categorizeUrl(url),
      };
    }
  } catch (error) {
    console.error("YouTube oEmbed fetch failed:", error);
  }
  
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}
