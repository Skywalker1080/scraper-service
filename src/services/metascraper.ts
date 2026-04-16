import metascraper from "metascraper";
import metascraperTitle from "metascraper-title";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperLogo from "metascraper-logo";
import { ScrapeResponse } from "../types";
import { fallbackFavicon, categorizeUrl } from "../utils/fallback";
import { validatePublicUrl } from "../utils/ssrf-filter";

const scrape = metascraper([
  metascraperTitle(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
]);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

export async function fetchWithMetascraper(url: string): Promise<ScrapeResponse> {
  await validatePublicUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (contentLength > MAX_SIZE) {
      throw new Error("Response exceeds size limit of 5MB via Content-Length");
    }

    let html = "";
    let downloadedSize = 0;

    if (response.body) {
      for await (const chunk of response.body as any) {
        downloadedSize += chunk.length;
        if (downloadedSize > MAX_SIZE) {
          throw new Error("Response exceeds size limit of 5MB during download");
        }
        html += Buffer.from(chunk).toString("utf-8");
      }
    } else {
      html = await response.text();
    }
    
    const metadata = await scrape({ html, url });

    clearTimeout(timeout);

    return {
      title: metadata.title || new URL(url).hostname.replace("www.", ""),
      description: metadata.description || "",
      favicon: metadata.logo || metadata.image || fallbackFavicon(url),
      category: categorizeUrl(url),
    };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
