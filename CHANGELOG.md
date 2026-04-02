# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added
- Optional API token protection via `KV_API_TOKEN` (client sends `x-kv-token` when set).
- Basic per-IP rate limiting for `/api/ai/*` via `KV_AI_RATE_LIMIT_PER_MIN`.
- Demo helpers: `npm run demo` and `npm run demo:bootstrap`.

### Changed
- Centralized client API calls through `apiFetch` to ensure token header is consistently applied.
- Configurable CORS origins via `KV_CORS_ORIGINS`.

