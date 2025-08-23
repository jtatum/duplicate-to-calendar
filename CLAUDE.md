# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Calendar Event Duplicator is a Chrome extension (Manifest V3) that adds a "Duplicate" button to Google Calendar event popups, allowing users to copy events to a pre-configured destination calendar with one click.

## Architecture

### Modern TypeScript Structure
The codebase has been completely refactored into a modular TypeScript architecture:

```
src/
├── shared/              # Shared utilities and type definitions
│   ├── types.ts        # Comprehensive TypeScript interfaces for Google Calendar API
│   ├── constants.ts    # Application constants and message actions
│   ├── validators.ts   # Input validation functions
│   ├── sanitizers.ts   # Data sanitization utilities
│   └── utils.ts        # General utility functions and logging
├── background/         # Background service worker (compiled to dist/background.js)
│   ├── auth/           # Authentication management
│   │   ├── authenticator.ts  # Chrome Identity API wrapper
│   │   └── token-manager.ts  # OAuth token lifecycle management
│   ├── api/            # Google Calendar API client
│   │   ├── calendar-api.ts   # API client with retry logic
│   │   └── calendar-cache.ts # Calendar list caching layer
│   ├── services/       # Business logic services
│   │   ├── event-duplicator.ts   # Core event duplication logic
│   │   └── birthday-handler.ts   # Special birthday event handling
│   ├── messaging/      # Chrome runtime messaging
│   │   └── message-handler.ts    # Background message dispatcher
│   └── index.ts        # Background script entry point
├── content/            # Content script (compiled to dist/content.js)
│   ├── observers/      # DOM observation and mutation handling
│   │   ├── mutation-manager.ts   # MutationObserver lifecycle
│   │   └── popup-detector.ts     # Event dialog detection
│   ├── ui/             # UI components and state management
│   │   ├── button-injector.ts    # Duplicate button injection
│   │   └── button-state.ts       # Button visual state management
│   ├── extractors/     # Event data extraction from DOM
│   │   └── event-extractor.ts    # DOM parsing for event information
│   └── index.ts        # Content script entry point
└── options/            # Settings page (compiled to dist/options.js)
    ├── components/     # UI components
    │   ├── calendar-selector.ts  # Calendar selection dropdown
    │   └── status-card.ts        # Authentication status display
    ├── services/       # Settings management
    │   ├── settings-manager.ts   # User preferences storage
    │   └── auth-manager.ts       # Options page authentication
    └── index.ts        # Options page entry point
```

### Build System
The project uses TypeScript compilation followed by esbuild bundling:
1. **TypeScript (`tsc`)**: Compiles all `.ts` files to `dist/` preserving structure
2. **esbuild**: Bundles entry points into single files for each context:
   - `dist/background.js` - Background service worker
   - `dist/content.js` - Content script
   - `dist/options.js` - Options page script

## Development Commands

```bash
npm run build        # Full build: tsc + esbuild bundling
npm run build:prod   # Production build: minified with info logs suppressed
npm run build:watch  # Build in watch mode for development
npm run package      # Create production ZIP package for distribution
npm run typecheck    # Type checking without compilation
npm run test         # Run Jest test suite
npm run test:watch   # Run tests in watch mode
npm run clean        # Remove dist/ directory
npm run dev          # Clean + build:watch (development workflow)
```

### Testing Commands
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test -- --coverage # With coverage report
npm run test -- --verbose  # Detailed output
```

### Extension Development Workflow
1. Run `npm run dev` to start watch mode
2. Load unpacked extension in Chrome from project root (not dist/)
3. Make changes - builds automatically rebuild
4. Reload extension in Chrome to test changes

### Extension Packaging for Distribution
1. Run `npm run package` to create `duplicate-to-calendar-extension.zip`
2. This ZIP contains everything needed for Chrome Web Store or sideloading:
   - Production-optimized JavaScript bundles
   - All required assets (icons, styles, manifest)
   - Legal files (LICENSE, PRIVACY.md, README.md)
3. Upload ZIP to Chrome Web Store or share for manual installation

## Event Detection Strategy

The content script uses sophisticated DOM detection for Google Calendar's dynamic interface:

- **Popup Detection**: Multiple selectors target `[role="dialog"][data-eventid]`, `[jsname="ssXDle"]`
- **Event ID Extraction**: Attempts base64 decoding, URL decoding, then raw value from `data-eventid`
- **Calendar Identification**: Parses `data-text` attribute format: `"Calendar Name – calendar.id@domain.com"`
- **Button Injection**: Targets `.pPTZAe` container with persistent re-injection on DOM changes

## Google Calendar API Integration

### Authentication Flow
- Uses Chrome Identity API with OAuth2 scopes: `calendar` and `calendar.events`
- Implements token refresh logic for expired tokens
- Client ID configured in manifest.json

### API Endpoints Used
- `GET /calendar/v3/users/me/calendarList` - Fetch user calendars
- `GET /calendar/v3/calendars/{id}/events/{eventId}` - Get source event
- `POST /calendar/v3/calendars/{id}/events` - Create duplicate event

### Event Search Logic
The extension employs a multi-step search to locate events:
1. Try specific calendar ID from extracted dialog info
2. Search by calendar name if ID unavailable
3. Fallback: search all accessible calendars
4. Handle both full event IDs and parsed event IDs (space-separated)

## Key Implementation Patterns

### Button State Management
Content script shows visual feedback: loading (🔄), success (✅), error (❌) with auto-reset timers.

### DOM Mutation Handling
Uses nested MutationObserver pattern:
- Main observer watches for new event dialogs
- Per-dialog observers handle button re-injection on content changes
- Automatic cleanup prevents memory leaks

### Error Handling
Background script implements retry logic for 401 errors (token refresh) and provides user-friendly error messages for common failures.

### Event Duplication Logic
Only copies essential fields: title, description, location, start/end times. Excludes attendees, attachments, video links, and recurring rules per MVP scope defined in PRD.md.

### Birthday Event Support
Special handling for birthday events from Google Contacts:
- **Detection**: Identifies birthday events through DOM analysis and event ID patterns
- **API Access**: Searches primary calendar with `eventTypes=birthday` filter (birthday calendar not in CalendarList API)
- **Duplication**: Creates regular events with special description noting birthday source
- **Recurrence**: Automatically adds yearly recurrence (`RRULE:FREQ=YEARLY`) to birthday event copies
- **Leap Year Support**: February 29 birthdays use special rule (`RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1`)
- **Limitations**: Birthday events have limited properties; location typically omitted from copies