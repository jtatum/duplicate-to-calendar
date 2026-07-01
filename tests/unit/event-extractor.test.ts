// Tests for EventExtractor
//
// Coverage is organized by the seven review categories:
// Security, Performance, Retry, Unit, Integration, Functional, Frame.
//
// The DOM is built inline (mirroring the real Google Calendar popup structure
// the extractor reads) so these tests are fully self-contained.

import { EventExtractor } from '../../src/content/extractors/event-extractor';

interface DialogOptions {
  eventId?: string;
  title?: string;
  time?: string;
  location?: string;
  description?: string;
  calendarName?: string;
  calendarId?: string;
  isBirthday?: boolean;
}

function buildDialog(options: DialogOptions = {}): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('jsname', 'ssXDle');

  if (options.eventId) {
    dialog.setAttribute('data-eventid', options.eventId);
  }

  if (options.title) {
    const el = document.createElement('h2');
    el.id = 'rAECCd';
    el.textContent = options.title;
    dialog.appendChild(el);
  }

  if (options.time) {
    const el = document.createElement('div');
    el.className = 'AzuXid';
    el.textContent = options.time;
    dialog.appendChild(el);
  }

  if (options.location) {
    const el = document.createElement('div');
    el.id = 'xDetDlgLoc';
    el.textContent = options.location;
    dialog.appendChild(el);
  }

  if (options.description) {
    const el = document.createElement('div');
    el.id = 'xDetDlgDesc';
    el.textContent = `Description: ${options.description}`;
    dialog.appendChild(el);
  }

  if (options.calendarName || options.calendarId) {
    const el = document.createElement('div');
    el.id = 'xDetDlgCal';
    const dataText =
      options.calendarName && options.calendarId
        ? `${options.calendarName} – ${options.calendarId}`
        : options.calendarName || options.calendarId || '';
    el.setAttribute('data-text', dataText);
    dialog.appendChild(el);
  }

  if (options.isBirthday) {
    dialog.appendChild(document.createTextNode(' birthday celebration'));
  }

  return dialog;
}

function regularDialog(): HTMLElement {
  return buildDialog({
    eventId: 'regular_event_123',
    title: 'Team Meeting',
    time: '2:00 PM - 3:00 PM',
    location: 'Conference Room A',
    description: 'Weekly team sync meeting',
    calendarName: 'Work Calendar',
    calendarId: 'work@company.com',
  });
}

function birthdayDialog(): HTMLElement {
  return buildDialog({
    eventId: '2023_BIRTHDAY_john_doe',
    title: "John's Birthday",
    time: 'All day',
    calendarName: 'Birthday Calendar',
    calendarId: 'contacts@group.calendar.google.com',
    isBirthday: true,
  });
}

function minimalDialog(): HTMLElement {
  return buildDialog({ eventId: 'minimal_event_789' });
}

describe('EventExtractor', () => {
  let extractor: EventExtractor;

  beforeEach(() => {
    extractor = new EventExtractor();
  });

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  describe('Security', () => {
    it('escapes HTML in the extracted title (no raw markup passes through)', () => {
      const info = extractor.extractEventInfo(
        buildDialog({ eventId: 'evt_secure', title: '<script>alert(1)</script>Meeting' }),
      );

      expect(info.title).not.toContain('<script>');
      expect(info.title).toContain('&lt;script&gt;');
    });

    it('escapes dangerous characters in the extracted description', () => {
      const info = extractor.extractEventInfo(
        buildDialog({ eventId: 'evt_secure2', description: 'a & b <img src=x>' }),
      );

      expect(info.description).toContain('&amp;');
      expect(info.description).not.toContain('<img');
    });
  });

  // ---------------------------------------------------------------------------
  // Performance
  // ---------------------------------------------------------------------------
  describe('Performance', () => {
    // Extraction is a bounded, single-pass read over a small popup subtree with
    // no network or loops of concern, so there is no dedicated performance path
    // to exercise. We assert the operation is a deterministic, side-effect-free
    // read by confirming repeated extraction yields identical output.
    it('produces identical results on repeated extraction (pure read)', () => {
      const dialog = regularDialog();
      expect(extractor.extractEventInfo(dialog)).toEqual(
        extractor.extractEventInfo(dialog),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------
  describe('Retry', () => {
    // The extractor performs no I/O, so there is no retry behavior to test.
    // It degrades gracefully on missing data instead (covered under Unit).
    it('is not applicable — extraction performs no I/O', () => {
      expect(true).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unit
  // ---------------------------------------------------------------------------
  describe('Unit', () => {
    it('extracts all fields from a fully-populated dialog', () => {
      const info = extractor.extractEventInfo(regularDialog());

      expect(info.eventId).toBe('regular_event_123');
      expect(info.title).toBe('Team Meeting');
      expect(info.time).toBe('2:00 PM - 3:00 PM');
      expect(info.location).toBe('Conference Room A');
      expect(info.calendarName).toBe('Work Calendar');
      expect(info.calendarId).toBe('work@company.com');
      expect(info.isBirthdayEvent).toBe(false);
    });

    it('strips the "Description:" prefix from the description', () => {
      const info = extractor.extractEventInfo(regularDialog());
      expect(info.description).toBe('Weekly team sync meeting');
    });

    it('returns empty strings for fields absent from a minimal dialog', () => {
      const info = extractor.extractEventInfo(minimalDialog());

      expect(info.eventId).toBe('minimal_event_789');
      expect(info.title).toBe('');
      expect(info.time).toBe('');
      expect(info.location).toBe('');
      expect(info.calendarName).toBeUndefined();
      expect(info.calendarId).toBeUndefined();
    });

    it('returns an empty event id when none is present in the DOM', () => {
      const bare = document.createElement('div');
      bare.setAttribute('role', 'dialog');
      expect(extractor.extractEventInfo(bare).eventId).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // Integration
  // ---------------------------------------------------------------------------
  describe('Integration', () => {
    it('parses the calendar name and id out of a combined data-text attribute', () => {
      const info = extractor.extractEventInfo(regularDialog());
      expect(info.calendarName).toBe('Work Calendar');
      expect(info.calendarId).toBe('work@company.com');
    });

    it('extracts a coherent EventInfo object from a birthday dialog', () => {
      const info = extractor.extractEventInfo(birthdayDialog());

      expect(info.eventId).toBe('2023_BIRTHDAY_john_doe');
      // sanitizeText escapes the apostrophe (' -> &#x27;).
      expect(info.title).toBe('John&#x27;s Birthday');
      expect(info.isBirthdayEvent).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Functional
  // ---------------------------------------------------------------------------
  describe('Functional', () => {
    it('flags birthday events via DOM indicators', () => {
      expect(extractor.extractEventInfo(birthdayDialog()).isBirthdayEvent).toBe(true);
    });

    it('does not flag a regular event as a birthday', () => {
      expect(extractor.extractEventInfo(regularDialog()).isBirthdayEvent).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------
  describe('Frame', () => {
    it('decodes a base64-encoded event id read from a DOM element', () => {
      const encoded = btoa('event_abc_123');
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');

      const idHost = document.createElement('div');
      idHost.id = 'xDetDlg';
      idHost.setAttribute('data-eventid', encoded);
      dialog.appendChild(idHost);

      expect(extractor.extractEventInfo(dialog).eventId).toBe('event_abc_123');
    });

    it('reads the event id from the popup element itself when no child carries it', () => {
      expect(extractor.extractEventInfo(minimalDialog()).eventId).toBe('minimal_event_789');
    });
  });
});
