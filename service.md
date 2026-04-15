# Scraping Service Context

This document provides the required context from the Context Window project for building a new scraping service using metascraper and puppeteer with Redis caching on Railway.

## Overview

The new scraping service will:
- Receive URL requests from the Context Window app
- Fetch rich metadata using metascraper and puppeteer (for headless browser)
- Cache results in Redis to avoid re-scraping
- Return metadata back to the app to update Firestore

## Required Context Files

### 1. Types Definition (`types/index.ts`)

The service should return metadata matching the `LinkItem` interface fields:

```typescript
export interface LinkItem {
  id: string;
  url: string;
  title: string;          // ← Extract this
  description: string;    // ← Extract this
  favicon: string;        // ← Extract this
  note: string;
  status: LinkStatus;
  category: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  userId: string;
}
```

**Required output fields:** `title`, `description`, `favicon`

---

### 2. Current Metascraper Implementation (`app/api/scrape/route.ts`)

Current implementation using metascraper packages:

```typescript
import metascraper from "metascraper";
import metascraperTitle from "metascraper-title";
import metascraperDescription from "metascraper-description";
import metascraperImage from "metascraper-image";
import metascraperLogo from "metascraper-logo";

const scrape = metascraper([
  metascraperTitle(),
  metascraperDescription(),
  metascraperImage(),
  metascraperLogo(),
]);
```

**User-Agent headers for fetching:**
```
Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36
```

**Fallback favicon logic:**
```typescript
function fallbackFavicon(url: string) {
  const hostname = new URL(url).hostname;
  return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
}
```

---

### 3. Metadata Fetching Logic (`contexts/LinksContext.tsx` - lines 65-111)

**YouTube oEmbed Special Case:**
YouTube blocks HTML scrapers. Use oEmbed API instead:

```typescript
if (url.includes("youtube.com") || url.includes("youtu.be")) {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  );
  if (response.ok) {
    const data = await response.json();
    return {
      title: data.title,
      description: data.author_name || "",
      favicon: fallback.favicon,
    };
  }
}
```

**Timeout Handling:**
- 10-second timeout on external fetches
- Use AbortController for timeout implementation

**Fallback Response Structure:**
When scraping fails, return:
```javascript
{
  title: new URL(url).hostname.replace("www.", ""),
  description: "",
  favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
}
```

---

### 4. Categorization Logic (`contexts/LinksContext.tsx` - lines 113-130)

Optional but useful for the scraping service to return category:

```typescript
function categorizeUrl(url: string): string {
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
```

---

### 5. Package Dependencies (`package.json`)

Metascraper packages currently used:
```json
{
  "metascraper": "^5.50.0",
  "metascraper-description": "^5.50.0",
  "metascraper-image": "^5.50.0",
  "metascraper-logo": "^5.50.0",
  "metascraper-title": "^5.50.0"
}
```

---

## API Contract

### Input
- **Parameter:** `url` (query parameter or request body)
- **Type:** String (valid HTTP/HTTPS URL)

### Output
```json
{
  "title": "string",
  "description": "string",
  "favicon": "string",
  "category": "string"  // optional
}
```

### Error Handling
- Return error message with appropriate HTTP status code
- Always provide fallback metadata to prevent UI breakage

---

## Key Implementation Notes

1. **YouTube Special Case:** Must use oEmbed API, not HTML scraping
2. **Fallback Strategy:** Always return valid metadata even if scraping fails
3. **User-Agent:** Use proper headers to avoid being blocked by target sites
4. **Timeout:** Implement 10-second timeout for external fetches
5. **Redis Caching:** Cache results by URL to avoid re-scraping
6. **Puppeteer Integration:** Use headless browser for JavaScript-heavy sites that metascraper can't handle
7. **Rate Limiting:** Consider implementing rate limiting to prevent abuse

---

## Architecture Flow

```
Context Window App
    ↓ (async request with URL)
Scraping Service (Railway)
    ↓ (check Redis cache)
    ↓ (cache miss)
    ↓ (fetch HTML with puppeteer/metascraper)
    ↓ (extract metadata)
    ↓ (store in Redis)
    ↓ (return metadata)
Context Window App
    ↓ (update Firestore)
```

---

## Deployment Target

- **Platform:** Railway
- **Caching:** Redis (Railway Redis)
- **Runtime:** Node.js
- **Scaling:** Consider horizontal scaling for high concurrency
