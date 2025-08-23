// Content script for Google Calendar Event Duplicator

console.log('Google Calendar Event Duplicator content script loaded');

// Track processed event popups to avoid duplicates - using WeakSet for automatic cleanup
const processedPopups = new WeakSet();

// Track active observers for proper cleanup
const activeObservers = new Set();
let mainObserver = null;

// Security utility functions
function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags and limit length
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;')
    .substring(0, 500); // Limit length
}

function validateEventInfo(eventInfo) {
  if (!eventInfo || typeof eventInfo !== 'object') {
    return false;
  }
  
  // Validate event ID
  if (!eventInfo.eventId || typeof eventInfo.eventId !== 'string') {
    return false;
  }
  
  if (eventInfo.eventId.length > 500 || eventInfo.eventId.length === 0) {
    return false;
  }
  
  // Check for dangerous characters in event ID
  const dangerousChars = /[<>"'&\\]/;
  if (dangerousChars.test(eventInfo.eventId)) {
    return false;
  }
  
  return true;
}

// Initialize the content script
function init() {
  console.log('Initializing Google Calendar duplicate button injection...');

  // Clean up any existing observers
  cleanup();

  // Set up mutation observer to watch for event popups
  mainObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Look for event popup containers
            checkForEventPopups(node);
          }
        });
      }
    });
  });

  // Start observing the entire document for changes
  mainObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  activeObservers.add(mainObserver);

  // Also check for existing popups on initial load
  setTimeout(() => {
    checkForEventPopups(document.body);
  }, 1000);

  // Set up cleanup listeners
  setupCleanupListeners();
}

// Global cleanup function to disconnect all observers
function cleanup() {
  console.log('Cleaning up observers...');
  
  // Disconnect main observer
  if (mainObserver) {
    mainObserver.disconnect();
    mainObserver = null;
  }
  
  // Disconnect all active observers
  activeObservers.forEach(observer => {
    observer.disconnect();
  });
  activeObservers.clear();
  
  console.log('Cleanup completed');
}

// Set up listeners for cleanup events
function setupCleanupListeners() {
  // Clean up when page is about to be unloaded
  window.addEventListener('beforeunload', cleanup);
  
  // Clean up when page visibility changes (user switches tabs)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Optional: pause observers or do lightweight cleanup
      console.log('Page hidden - observers still active');
    }
  });
  
  // Periodic cleanup of stale references (every 5 minutes)
  setInterval(periodicCleanup, 5 * 60 * 1000);
}

// Periodic cleanup of stale references and disconnected observers
function periodicCleanup() {
  console.log('Running periodic cleanup...');
  
  // Remove disconnected observers from activeObservers set
  const disconnectedObservers = [];
  activeObservers.forEach(observer => {
    // Check if observer is still connected by trying to access its properties
    try {
      // If observer is disconnected, this will work but the observer won't be monitoring
      if (!observer.takeRecords) {
        disconnectedObservers.push(observer);
      }
    } catch (e) {
      disconnectedObservers.push(observer);
    }
  });
  
  disconnectedObservers.forEach(observer => {
    activeObservers.delete(observer);
  });
  
  console.log(`Periodic cleanup: removed ${disconnectedObservers.length} stale observers`);
}

// Check if a node or its children contain event popups
function checkForEventPopups(node) {
  // Only check nodes that look like they could be event dialogs
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  // Try multiple selectors - be less strict
  const eventDialogSelectors = [
    '[role="dialog"][data-eventid]', // Dialog with event ID
    '[jsname="ssXDle"][data-eventid]', // ssXDle with event ID
    '[role="dialog"][jsname="ssXDle"]' // Dialog with ssXDle jsname
  ];

  let eventDialogs = [];

  eventDialogSelectors.forEach(selector => {
    // Check if the node itself matches
    if (node.matches && node.matches(selector)) {
      eventDialogs.push(node);
    }

    // Check for child dialogs
    if (node.querySelectorAll) {
      const childDialogs = Array.from(node.querySelectorAll(selector));
      eventDialogs.push(...childDialogs);
    }
  });

  eventDialogs.forEach(dialog => {
    if (!processedPopups.has(dialog)) {
      // Simpler validation
      if (isValidEventDialog(dialog)) {
        console.log('Found valid event dialog:', dialog);
        processEventPopup(dialog);
        processedPopups.add(dialog);
        
        // Set up cleanup detection for this specific dialog
        const dialogObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            mutation.removedNodes.forEach(removedNode => {
              if (removedNode === dialog || (removedNode.nodeType === Node.ELEMENT_NODE && removedNode.contains(dialog))) {
                console.log('Dialog removed from DOM, triggering cleanup');
                if (dialog._duplicateButtonCleanup) {
                  dialog._duplicateButtonCleanup();
                }
                dialogObserver.disconnect();
                activeObservers.delete(dialogObserver);
              }
            });
          });
        });
        
        // Watch the parent for dialog removal
        if (dialog.parentNode) {
          dialogObserver.observe(dialog.parentNode, { childList: true });
          activeObservers.add(dialogObserver);
        }
      }
    }
  });
}

// Validate that this is actually an event dialog we should process
function isValidEventDialog(dialog) {
  console.log('Validating dialog:', dialog);

  // Must be visible (not display: none)
  const style = window.getComputedStyle(dialog);
  if (style.display === 'none') {
    console.log('Dialog hidden (display: none)');
    return false;
  }

  // Check for basic dialog indicators (be more lenient)
  const hasEventIndicators = (
    dialog.getAttribute('data-eventid') ||
    dialog.querySelector('#rAECCd') ||
    dialog.querySelector('.AzuXid') ||
    dialog.querySelector('.JEx5le') ||
    dialog.textContent?.includes('Location:') ||
    dialog.textContent?.includes('Description:')
  );

  if (!hasEventIndicators) {
    console.log('No event indicators found');
    return false;
  }

  console.log('Event dialog validation passed');
  return true;
}

// Process an event popup by adding our duplicate button
async function processEventPopup(popup) {
  console.log('Processing event popup:', popup);

  // Check if we've already processed this specific popup instance
  if (popup.hasAttribute('data-duplicate-button-processed')) {
    console.log('This popup has already been processed');
    return;
  }

  // Mark this popup as processed
  popup.setAttribute('data-duplicate-button-processed', 'true');

  // Extract event info to check if we should show the duplicate button
  let eventInfo = extractEventInfo(popup);

  // Get the destination calendar setting and info
  const settings = await chrome.storage.sync.get(['selectedCalendarId', 'selectedCalendarName']);
  console.log('Checking destination calendar settings');
  console.log('Comparing calendar information');

  // Don't show button if no destination calendar is configured
  if (!settings.selectedCalendarId) {
    console.log('No destination calendar configured, skipping button injection');
    return;
  }

  // If we don't have calendar ID yet, still proceed with name-based comparison
  // The button watcher will handle re-processing if content changes
  if (!eventInfo.calendarId) {
    console.log('Calendar ID not found, using name-based comparison');
  }

  // Check if event is already in destination calendar
  const isInDestinationCalendar = checkIfInDestinationCalendar(
    eventInfo, 
    settings.selectedCalendarId, 
    settings.selectedCalendarName
  );

  if (isInDestinationCalendar) {
    console.log('Event is already in destination calendar, skipping button injection');
    return;
  }

  console.log('Different calendars - proceeding with button injection');
  proceedWithButtonInjection(popup);
}

// Helper function to check if event is in destination calendar
function checkIfInDestinationCalendar(eventInfo, destinationCalendarId, destinationCalendarName) {
  // First try calendar ID comparison (most reliable) with validation
  if (eventInfo.calendarId && typeof eventInfo.calendarId === 'string' && 
      eventInfo.calendarId.length > 0 && destinationCalendarId && 
      typeof destinationCalendarId === 'string' && destinationCalendarId.length > 0) {
    const match = eventInfo.calendarId === destinationCalendarId;
    console.log('Calendar ID comparison:', match);
    return match;
  }

  // Fall back to calendar name comparison (with validation)
  if (eventInfo.calendarName && typeof eventInfo.calendarName === 'string' && 
      eventInfo.calendarName.length > 0 && destinationCalendarName && 
      typeof destinationCalendarName === 'string' && destinationCalendarName.length > 0) {
    const match = eventInfo.calendarName.toLowerCase() === destinationCalendarName.toLowerCase();
    console.log('Calendar name comparison result:', match);
    return match;
  }

  console.log('Could not determine if calendars match - not enough info');
  return false; // Can't determine, so show button
}

// Separate function to handle the actual button injection logic
function proceedWithButtonInjection(popup) {
  // Use a more persistent injection approach
  const tryInjectButton = () => {
    // Look for the specific button container (pPTZAe)
    const buttonContainer = popup.querySelector('.pPTZAe');

    if (!buttonContainer) {
      console.log('pPTZAe container not found');
      return false;
    }

    // Check if our button already exists anywhere in the popup
    const existingButtons = popup.querySelectorAll('.duplicate-calendar-button');
    if (existingButtons.length > 0) {
      console.log('Duplicate button(s) already exist:', existingButtons.length);
      return true;
    }

    console.log('Injecting duplicate button into .pPTZAe container');
    injectDuplicateButton(buttonContainer, popup);
    return true;
  };

  // Try injection immediately
  if (!tryInjectButton()) {
    console.log('Initial injection failed, retrying...');
    // Retry after a short delay in case the dialog is still building
    setTimeout(() => {
      tryInjectButton();
    }, 100);
  }

  // Set up a more persistent watcher for this specific dialog
  const cleanupWatcher = setupButtonWatcher(popup);
  
  // Store cleanup function on the popup for external access if needed
  popup._duplicateButtonCleanup = cleanupWatcher;
}

// Set up a watcher to re-inject button if it gets removed or content changes
function setupButtonWatcher(popup) {
  let isWatching = true;
  let cleanupTimeout = null;

  const observer = new MutationObserver((mutations) => {
    if (!isWatching) return;

    // First, check if the popup is still in the DOM
    if (!document.contains(popup)) {
      console.log('ButtonWatcher: Popup removed from DOM, cleaning up');
      cleanup();
      return;
    }

    console.log('ButtonWatcher: Mutation detected, mutations count:', mutations.length);
    
    // Check for content changes or button removal
    const shouldCheck = mutations.some(mutation => {
      const hasChanges = mutation.type === 'childList' &&
        (mutation.removedNodes.length > 0 || mutation.addedNodes.length > 0);
      
      if (hasChanges) {
        console.log('ButtonWatcher: Content change detected - removed:', mutation.removedNodes.length, 'added:', mutation.addedNodes.length);
      }
      
      return hasChanges;
    });

    if (shouldCheck) {
      // Check if our button was removed and container still exists
      const buttonContainer = popup.querySelector('.pPTZAe');
      const existingButtons = popup.querySelectorAll('.duplicate-calendar-button');

      console.log('ButtonWatcher: Container exists:', !!buttonContainer, 'Existing buttons:', existingButtons.length);

      if (buttonContainer && existingButtons.length === 0) {
        console.log('Button was removed or content changed, re-processing dialog...');
        
        // Remove the processed flag and re-process the dialog
        popup.removeAttribute('data-duplicate-button-processed');
        
        // Debounce re-processing to avoid rapid firing
        setTimeout(() => {
          if (isWatching && document.contains(popup) && popup.querySelectorAll('.duplicate-calendar-button').length === 0) {
            processEventPopup(popup);
          }
        }, 100);
      }
    }
  });

  // Watch the entire popup for content changes
  observer.observe(popup, {
    childList: true,
    subtree: true
  });
  
  // Track this observer for cleanup
  activeObservers.add(observer);
  
  console.log('ButtonWatcher: Set up observer for popup:', popup);

  // Clean up observer when dialog is closed or removed
  const cleanup = () => {
    if (!isWatching) return; // Already cleaned up
    
    console.log('ButtonWatcher: Cleaning up observer');
    isWatching = false;
    observer.disconnect();
    activeObservers.delete(observer);
    
    if (cleanupTimeout) {
      clearTimeout(cleanupTimeout);
      cleanupTimeout = null;
    }
  };

  // Set up intersection observer to detect when popup is removed from viewport/DOM
  const intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting && !document.contains(popup)) {
        console.log('ButtonWatcher: Popup no longer intersecting and not in DOM');
        cleanup();
        intersectionObserver.disconnect();
      }
    });
  });

  // Start observing the popup's visibility
  intersectionObserver.observe(popup);

  // Also clean up after a reasonable time (safety net)
  cleanupTimeout = setTimeout(() => {
    console.log('ButtonWatcher: Timeout cleanup triggered');
    cleanup();
    intersectionObserver.disconnect();
  }, 30000); // 30 seconds

  // Return cleanup function for external use if needed
  return cleanup;
}

// Create and inject the duplicate button
function injectDuplicateButton(container, eventPopup) {
  console.log('Injecting duplicate button into:', container);
  console.log('Container children before injection:', container.children.length);

  const button = document.createElement('button');
  button.className = 'duplicate-calendar-button VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-k8QpJ VfPpkd-LgbsSe-OWXEXe-dgl2Hf nCP5yc AjY5Oe DuMIQc LQeN7 BqKGqe Jskylb TrZEUc lw1w4b';
  
  // Create button content using DOM methods instead of innerHTML for security
  const buttonSpan = document.createElement('span');
  buttonSpan.className = 'VfPpkd-vQzf8d';
  
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '📋 ';
  
  const textSpan = document.createElement('span');
  textSpan.className = 'duplicate-text';
  textSpan.textContent = 'Duplicate';
  
  buttonSpan.appendChild(iconSpan);
  buttonSpan.appendChild(textSpan);
  button.appendChild(buttonSpan);
  
  button.title = 'Duplicate this event to another calendar';

  // Add click handler
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleDuplicateClick(button, eventPopup);
  });

  // Insert the button into the container
  try {
    container.appendChild(button);
    console.log('Duplicate button injected successfully');
    console.log('Container children after injection:', container.children.length);
    console.log('Button element:', button);

    // Check if button is actually visible
    setTimeout(() => {
      const style = window.getComputedStyle(button);
      console.log('Button computed styles:');
      console.log('  - display:', style.display);
      console.log('  - visibility:', style.visibility);
      console.log('  - opacity:', style.opacity);
      console.log('  - width:', style.width);
      console.log('  - height:', style.height);
      console.log('  - position:', style.position);

      console.log('Container computed styles:');
      const containerStyle = window.getComputedStyle(container);
      console.log('  - display:', containerStyle.display);
      console.log('  - visibility:', containerStyle.visibility);
      console.log('  - overflow:', containerStyle.overflow);

      // Check if button is in the DOM
      console.log('Button still in DOM:', document.contains(button));
      console.log('Button parent:', button.parentElement);
    }, 100);

  } catch (error) {
    console.error('Failed to inject button:', error);
    // Try inserting as first child instead
    try {
      container.insertBefore(button, container.firstChild);
      console.log('Button injected as first child successfully');
    } catch (error2) {
      console.error('Failed to inject as first child:', error2);
    }
  }
}

// Handle duplicate button click
async function handleDuplicateClick(button, eventPopup) {
  console.log('Duplicate button clicked');

  try {
    // Extract event information from the popup
    const eventInfo = extractEventInfo(eventPopup);
    console.log('Event info extracted');

    if (!eventInfo || !validateEventInfo(eventInfo)) {
      showButtonState(button, 'error', 'Invalid event data');
      return;
    }

    // Show loading state
    showButtonState(button, 'loading', 'Duplicating...');

    // Send message to background script to duplicate the event
    const response = await chrome.runtime.sendMessage({
      action: 'duplicateEvent',
      eventInfo: eventInfo
    });

    if (response && response.success) {
      showButtonState(button, 'success', 'Duplicated!');
    } else {
      showButtonState(button, 'error', response?.error || 'Failed to duplicate');
    }

  } catch (error) {
    console.error('Error duplicating event:', error);
    showButtonState(button, 'error', 'Error occurred');
  }
}

// Extract event information from popup DOM
function extractEventInfo(popup) {
  const eventInfo = {};

  // Try to extract event ID from the xDetDlg child element
  const xDetDlgElement = popup.querySelector('#xDetDlg') ||
                        popup.querySelector('.xDetDlg') ||
                        popup.querySelector('[id="xDetDlg"]');

  const rawEventId = xDetDlgElement?.getAttribute('data-eventid') ||
                     popup.getAttribute('data-eventid') ||
                     popup.querySelector('[data-eventid]')?.getAttribute('data-eventid');

  console.log('Event ID extracted from DOM');

  if (rawEventId) {
    // The event ID might be URL-encoded or base64-encoded, try to decode it
    try {
      // First try decoding as base64
      eventInfo.eventId = atob(rawEventId);
      console.log('Event ID decoded (base64)');
    } catch (e) {
      // If base64 fails, try URL decoding
      try {
        eventInfo.eventId = decodeURIComponent(rawEventId);
        console.log('Event ID decoded (URL)');
      } catch (e2) {
        // If both fail, use raw value
        eventInfo.eventId = rawEventId;
        console.log('Using raw event ID');
      }
    }
  }

  // Check if this is a birthday event by looking for birthday indicators
  eventInfo.isBirthdayEvent = detectBirthdayEvent(popup, eventInfo.eventId);

  // Extract title - try multiple selectors based on actual DOM structure
  const titleElement = popup.querySelector('#rAECCd') ||
                      popup.querySelector('[role="heading"]') ||
                      popup.querySelector('.rjjUXe h2') ||
                      popup.querySelector('h1') ||
                      popup.querySelector('[data-event-title]');
  eventInfo.title = sanitizeText(titleElement?.textContent?.trim());

  // Extract time information
  const timeElement = popup.querySelector('.AzuXid') ||
                     popup.querySelector('.JEx5le') ||
                     popup.querySelector('[data-start-time]') ||
                     popup.querySelector('.DN8Jnd') ||
                     popup.querySelector('[jsname="M5N8Ue"]');
  eventInfo.time = sanitizeText(timeElement?.textContent?.trim());

  // Extract location
  const locationElement = popup.querySelector('[id*="Loc"]') ||
                         popup.querySelector('[data-location]') ||
                         popup.querySelector('.DN8Jnd + .DN8Jnd') ||
                         popup.querySelector('[jsname="YKoHj"]');
  eventInfo.location = sanitizeText(locationElement?.textContent?.trim());

  // Extract description
  const descElement = popup.querySelector('[id*="Desc"]') ||
                     popup.querySelector('[data-description]') ||
                     popup.querySelector('.rjjUXe div:last-child') ||
                     popup.querySelector('[jsname="f9896d"]');
  let description = descElement?.textContent?.trim();

  // Remove "Description:" prefix if present and sanitize
  if (description && description.startsWith('Description:')) {
    description = description.substring('Description:'.length).trim();
  }
  eventInfo.description = sanitizeText(description);

  // Extract calendar information from the calendar element with data-text attribute
  const calendarElement = popup.querySelector('#xDetDlgCal') ||
                          popup.querySelector('[data-text*="@"]'); // Fallback: any element with data-text containing @

  if (calendarElement) {
    const dataText = calendarElement.getAttribute('data-text');
    console.log('Calendar data-text found');

    if (dataText) {
      // Parse "Calendar Name – calendar.id@domain.com" format
      const match = dataText.match(/^(.+?)\s*–\s*(.+)$/);
      if (match) {
        eventInfo.calendarName = sanitizeText(match[1].trim());
        eventInfo.calendarId = sanitizeText(match[2].trim());
        console.log('Calendar name and ID extracted');
      }
    }
  }

  // Fallback: try the old method if we didn't find the data-text element
  if (!eventInfo.calendarName) {
    console.log('Fallback: looking for organizer in XuJrye elements');
    const organizerElements = popup.querySelectorAll('.XuJrye');

    organizerElements.forEach(element => {
      const text = element.textContent?.trim();
      console.log('XuJrye element found');

      if (text && text.startsWith('Organizer:')) {
        eventInfo.calendarName = sanitizeText(text.substring('Organizer:'.length).trim());
        console.log('Calendar name extracted (fallback method)');
      }
    });
  }

  console.log('Event extraction complete');
  return eventInfo;
}

// Detect if this is a birthday event
function detectBirthdayEvent(popup, eventId) {
  // Check event ID patterns typical for birthday events
  if (eventId) {
    // Birthday event IDs often follow patterns like "YYYY_BIRTHDAY_contactId" or contain "BIRTHDAY"
    if (eventId.includes('BIRTHDAY') || eventId.includes('_BIRTHDAY_')) {
      console.log('Birthday event detected via event ID pattern');
      return true;
    }
  }

  // Check for birthday-specific DOM indicators
  const birthdayIndicators = [
    // Check if the popup contains birthday-specific text
    popup.textContent?.toLowerCase().includes('birthday'),
    
    // Check for special birthday calendar indicators
    popup.querySelector('[data-text*="birthday"]') !== null,
    popup.querySelector('[data-text*="Birthday"]') !== null,
    
    // Check if the calendar source indicates birthdays
    (() => {
      const calendarElement = popup.querySelector('#xDetDlgCal') || popup.querySelector('[data-text*="@"]');
      if (calendarElement) {
        const dataText = calendarElement.getAttribute('data-text');
        return dataText && (
          dataText.toLowerCase().includes('birthday') ||
          dataText.includes('addressbook#contacts@group.v.calendar.google.com') ||
          dataText.includes('#contacts@group.v.calendar.google.com')
        );
      }
      return false;
    })(),
    
    // Check if the event is an all-day event with birthday indicators
    (() => {
      const timeElement = popup.querySelector('.AzuXid') || popup.querySelector('.JEx5le');
      const timeText = timeElement?.textContent?.toLowerCase();
      return timeText && timeText.includes('all day') && popup.textContent?.toLowerCase().includes('birthday');
    })()
  ];

  const isBirthday = birthdayIndicators.some(indicator => indicator);
  if (isBirthday) {
    console.log('Birthday event detected via DOM indicators');
  }
  
  return isBirthday;
}

// Show different button states
function showButtonState(button, state, text) {
  // Remove existing state classes
  button.classList.remove('duplicate-loading', 'duplicate-success', 'duplicate-error');

  switch (state) {
    case 'loading':
      button.classList.add('duplicate-loading');
      updateButtonContent(button, '⏳', sanitizeText(text));
      button.disabled = true;
      break;

    case 'success':
      button.classList.add('duplicate-success');
      updateButtonContent(button, '✅', sanitizeText(text));
      // Reset after 3 seconds
      setTimeout(() => {
        updateButtonContent(button, '📋', 'Duplicate');
        button.classList.remove('duplicate-success');
        button.disabled = false;
      }, 3000);
      break;

    case 'error':
      button.classList.add('duplicate-error');
      updateButtonContent(button, '❌', sanitizeText(text));
      // Reset after 3 seconds
      setTimeout(() => {
        updateButtonContent(button, '📋', 'Duplicate');
        button.classList.remove('duplicate-error');
        button.disabled = false;
      }, 3000);
      break;
  }
}

// Helper function to safely update button content
function updateButtonContent(button, icon, text) {
  // Clear existing content
  button.innerHTML = '';
  
  // Create new content using DOM methods
  const buttonSpan = document.createElement('span');
  buttonSpan.className = 'VfPpkd-vQzf8d';
  
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icon + ' ';
  
  const textSpan = document.createElement('span');
  textSpan.className = 'duplicate-text';
  textSpan.textContent = text;
  
  buttonSpan.appendChild(iconSpan);
  buttonSpan.appendChild(textSpan);
  button.appendChild(buttonSpan);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}