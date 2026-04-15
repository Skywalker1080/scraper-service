export function fallbackFavicon(url: string): string {
  const hostname = new URL(url).hostname;
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}

export function categorizeUrl(url: string): string {
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "Youtube";
  if (hostname.includes("github.com") || hostname.includes("gitlab.com"))
    return "Github";
  if (hostname.includes("twitter.com") || hostname.includes("x.com"))
    return "Twitter (X)";
  if (hostname.includes("reddit.com"))
    return "Reddit";
  if (hostname.includes("substack.com"))
    return "Substack";
  if (hostname.includes("docs.") || url.includes("/docs") || url.includes("/documentation"))
    return "Documentation";

  return "Website";
}

export function getFallbackMetadata(url: string): {
  title: string;
  description: string;
  favicon: string;
  category: string;
} {
  const hostname = new URL(url).hostname.replace("www.", "");
  return {
    title: hostname,
    description: "",
    favicon: fallbackFavicon(url),
    category: categorizeUrl(url),
  };
}
