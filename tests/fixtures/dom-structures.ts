// Sample DOM structures for testing content script

export function createMockEventDialog(options: {
  eventId?: string;
  title?: string;
  time?: string;
  location?: string;
  description?: string;
  calendarName?: string;
  calendarId?: string;
  isBirthdayEvent?: boolean;
} = {}): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('jsname', 'ssXDle');
  
  if (options.eventId) {
    dialog.setAttribute('data-eventid', options.eventId);
  }

  // Event title
  if (options.title) {
    const titleElement = document.createElement('h2');
    titleElement.id = 'rAECCd';
    titleElement.textContent = options.title;
    dialog.appendChild(titleElement);
  }

  // Event time
  if (options.time) {
    const timeElement = document.createElement('div');
    timeElement.className = 'AzuXid';
    timeElement.textContent = options.time;
    dialog.appendChild(timeElement);
  }

  // Event location
  if (options.location) {
    const locationElement = document.createElement('div');
    locationElement.id = 'xDetDlgLoc';
    locationElement.textContent = options.location;
    dialog.appendChild(locationElement);
  }

  // Event description
  if (options.description) {
    const descElement = document.createElement('div');
    descElement.id = 'xDetDlgDesc';
    descElement.textContent = `Description: ${options.description}`;
    dialog.appendChild(descElement);
  }

  // Calendar information
  if (options.calendarName || options.calendarId) {
    const calendarElement = document.createElement('div');
    calendarElement.id = 'xDetDlgCal';
    
    const dataText = options.calendarName && options.calendarId ? 
      `${options.calendarName} – ${options.calendarId}` :
      options.calendarName || options.calendarId || '';
    
    calendarElement.setAttribute('data-text', dataText);
    dialog.appendChild(calendarElement);
  }

  // Button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'pPTZAe';
  dialog.appendChild(buttonContainer);

  // Add birthday-specific content if needed
  if (options.isBirthdayEvent) {
    dialog.textContent = (dialog.textContent || '') + ' birthday celebration';
    
    if (options.calendarId) {
      // Update calendar element with birthday calendar pattern
      const calendarElement = dialog.querySelector('#xDetDlgCal');
      if (calendarElement) {
        calendarElement.setAttribute('data-text', 
          `Birthday Calendar – ${options.calendarId || '#contacts@group.v.calendar.google.com'}`
        );
      }
    }
  }

  return dialog;
}

export function createMockBirthdayDialog(): HTMLElement {
  return createMockEventDialog({
    eventId: '2023_BIRTHDAY_john_doe',
    title: "John's Birthday",
    time: 'All day',
    calendarName: 'Birthday Calendar',
    calendarId: '#contacts@group.v.calendar.google.com',
    isBirthdayEvent: true
  });
}

export function createMockRegularEventDialog(): HTMLElement {
  return createMockEventDialog({
    eventId: 'regular_event_123',
    title: 'Team Meeting',
    time: '2:00 PM - 3:00 PM',
    location: 'Conference Room A',
    description: 'Weekly team sync meeting',
    calendarName: 'Work Calendar',
    calendarId: 'work@company.com'
  });
}

export function createMockAllDayEventDialog(): HTMLElement {
  return createMockEventDialog({
    eventId: 'holiday_event_456',
    title: 'Holiday',
    time: 'All day',
    calendarName: 'Holidays',
    calendarId: 'holidays@group.calendar.google.com'
  });
}

export function createMockEventDialogMinimal(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('data-eventid', 'minimal_event_789');
  
  // Just the essentials
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'pPTZAe';
  dialog.appendChild(buttonContainer);
  
  return dialog;
}

export function createMockEventDialogWithoutContainer(): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('data-eventid', 'no_container_event');
  
  // No button container - should not get duplicate button
  return dialog;
}

export function createMockHiddenEventDialog(): HTMLElement {
  const dialog = createMockRegularEventDialog();
  dialog.style.display = 'none';
  return dialog;
}

export function createMockDocument(): Document {
  const doc = document.implementation.createHTMLDocument('Mock Document');
  
  // Add some basic structure
  const body = doc.body;
  const mainContainer = doc.createElement('div');
  mainContainer.id = 'main-container';
  body.appendChild(mainContainer);
  
  return doc;
}

export function createMockMutationRecord(addedNodes: Node[], removedNodes: Node[] = []): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: {
      length: addedNodes.length,
      item: (index: number) => addedNodes[index] || null,
      [Symbol.iterator]: function* () {
        for (const node of addedNodes) {
          yield node;
        }
      }
    } as NodeList,
    removedNodes: {
      length: removedNodes.length,
      item: (index: number) => removedNodes[index] || null,
      [Symbol.iterator]: function* () {
        for (const node of removedNodes) {
          yield node;
        }
      }
    } as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null
  };
}