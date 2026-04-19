import { ScrapeResponse } from "../types";

interface TwitterOEmbedResponse {
  author_name?: string;
  author_url?: string;
  html?: string;
  url?: string;
  provider_name?: string;
}

/**
 * Detects Twitter / X URLs.
 * Handles both twitter.com and x.com domains.
 */
export function isTwitterUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const host = hostname.replace("www.", "").toLowerCase();
    return host === "twitter.com" || host === "x.com";
  } catch {
    return false;
  }
}

/**
 * Checks whether the URL points to a specific tweet (has a /status/ segment).
 * Profile pages and home pages won't have meaningful oEmbed data.
 */
function isTweetUrl(url: string): boolean {
  return /\/(status|statuses)\/\d+/i.test(url);
}

/**
 * Normalises x.com URLs to twitter.com so the oEmbed endpoint accepts them.
 * (publish.twitter.com only accepts twitter.com URLs as of 2024)
 */
function normaliseToTwitterCom(url: string): string {
  return url.replace(/^(https?:\/\/)(www\.)?x\.com/, "$1twitter.com");
}

/**
 * Fetches tweet metadata via Twitter's public oEmbed endpoint.
 * No API key required. Returns null if the request fails.
 */
async function fetchTweetOEmbed(url: string): Promise<ScrapeResponse | null> {
  const twitterUrl = normaliseToTwitterCom(url);
  const oEmbedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(twitterUrl)}&omit_script=true`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(oEmbedUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as TwitterOEmbedResponse;

    // oEmbed gives us: author_name, author_url, html (embed HTML with tweet text)
    // Extract plain text from the embed HTML as description
    const descriptionMatch = (data.html as string)?.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let description = descriptionMatch
      ? descriptionMatch[1]
          .replace(/<[^>]+>/g, "") // strip tags
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim()
      : "";

    // Truncate long descriptions
    if (description.length > 200) {
      description = description.slice(0, 197) + "…";
    }

    return {
      title: data.author_name ? `${data.author_name} on X` : "Post on X",
      description,
      favicon: "https://abs.twimg.com/favicons/twitter.3.ico",
      category: "Twitter (X)",
    };
  } catch {
    return null;
  }
}

/**
 * Returns metadata for a Twitter/X URL.
 * - For tweet URLs: tries oEmbed first, falls back to branded stub.
 * - For profile/home URLs: returns a branded stub immediately.
 */
export async function fetchTwitterMetadata(url: string): Promise<ScrapeResponse> {
  if (isTweetUrl(url)) {
    const oembed = await fetchTweetOEmbed(url);
    if (oembed) return oembed;
  }

  // Branded fallback for profiles, home page, or when oEmbed fails
  return {
    title: "X (formerly Twitter)",
    description: "See what's happening in the world right now.",
    favicon: "https://abs.twimg.com/favicons/twitter.3.ico",
    category: "Twitter (X)",
  };
}
