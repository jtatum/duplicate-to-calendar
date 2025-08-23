# Privacy Policy

## Google Calendar Event Duplicator Extension

**Effective Date:** August 23, 2024

### Overview

Your privacy is important to us. This privacy policy explains how the Google Calendar Event Duplicator Chrome extension handles your information.

### Data Collection and Usage

**We do not collect, store, transmit, or access any of your personal data.**

This extension:
- **Does NOT** send any data to external servers
- **Does NOT** store your calendar information on any external systems
- **Does NOT** track your usage or behavior
- **Does NOT** collect any personal information
- **Does NOT** use analytics or telemetry

### How the Extension Works

The extension operates entirely within your browser and directly communicates with Google's Calendar API using your authenticated Google account. All data processing happens locally in your browser.

The extension only:
1. Reads event information from calendar popups you open
2. Uses Google's Calendar API to duplicate events to your chosen destination calendar
3. Stores your destination calendar preference locally in your browser's extension storage

### Data Flow

```
Your Browser ←→ Google Calendar API
```

There are no intermediate servers, databases, or third-party services involved.

### Local Storage

The extension stores only:
- Your selected destination calendar ID and name (stored locally in Chrome's extension storage)
- Temporary authentication tokens (managed by Chrome's identity API)

This data never leaves your device.

### Google Account Access

The extension uses Google's OAuth2 system to access your calendar data. The extension requests permission to:
- Read your calendar list
- Read individual event details
- Create new events in your calendars

These permissions are granted directly between you and Google. We never have access to your Google account credentials.

### Third-Party Services

This extension communicates only with:
- **Google Calendar API** - for reading and creating calendar events
- **Google OAuth2 API** - for authentication

No other third-party services are used.

### Changes to This Policy

If we make changes to this privacy policy, we will update the effective date above. Since we don't collect any data, any changes would be to clarify our data practices, not to change how we handle your information.

### Contact

If you have questions about this privacy policy, you can:
- Review the open-source code on GitHub
- Contact us through the Chrome Web Store extension page

### Your Rights

Since we don't collect any data, there's no personal data to request, modify, or delete. All your calendar data remains under your direct control through your Google account.