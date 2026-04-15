# Scraping Service

A Fastify-based metadata scraping service with metascraper as the primary extractor and YouTube oEmbed support. Structured for future Redis caching and queue integration.

## Features

- **Metascraper Integration**: Extracts title, description, and favicon from web pages
- **YouTube oEmbed**: Special handling for YouTube URLs using the official oEmbed API
- **In-Memory Caching**: Redis-ready cache structure (currently uses in-memory Map)
- **Fallback Strategy**: Always returns valid metadata to prevent UI breakage
- **Category Detection**: Automatically categorizes URLs (Youtube, Github, Twitter, etc.)
- **10-Second Timeout**: Prevents hanging on slow or unresponsive sites
- **Production Ready**: Configured for Railway deployment with dynamic port support

## Installation

```bash
npm install
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoint

### POST /scrape

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "title": "Example Domain",
  "description": "This domain is for use in illustrative examples...",
  "favicon": "https://www.google.com/s2/favicons?domain=example.com&sz=64",
  "category": "Website"
}
```

### Health Check

### GET /health

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 86400)

## Architecture

```
Request → Check Cache → YouTube oEmbed? → Metascraper → Fallback → Cache → Response
```

## Future Enhancements

- Redis caching integration (structure already in place)
- Queue system for high-volume processing
- Rate limiting
- Enhanced logging and monitoring

## Deployment

Designed for Railway deployment. The service automatically uses the `PORT` environment variable provided by Railway.
