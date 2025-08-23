# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google Calendar Event Duplicator is a Chrome extension (Manifest V3) that adds a "Duplicate" button to Google Calendar event popups, allowing users to copy events to a pre-configured destination calendar with one click.

## Architecture

### Core Components
- **`background.js`**: Service worker handling Google Calendar API authentication, API calls, and event duplication logic
- **`content.js`**: Content script injected into `calendar.google.com` that detects event popups and injects duplicate buttons
- **`options/`**: Settings page for selecting destination calendar
- **`manifest.json`**: Chrome extension configuration with OAuth2 setup and required permissions

### Key Data Flow
1. Content script detects event popups via MutationObserver
2. Extracts event info from DOM (event ID, title, time, calendar info)
3. Background script authenticates with Google Calendar API
4. Background script fetches original event and creates duplicate in destination calendar

## Development Commands

```bash
npm run build    # No-op - extension works directly without build step
npm run test     # No tests configured yet
```

To test the extension:
1. Load unpacked extension in Chrome Developer Mode
2. Grant calendar permissions when prompted
3. Configure destination calendar in extension options
4. Test on calendar.google.com event popups

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