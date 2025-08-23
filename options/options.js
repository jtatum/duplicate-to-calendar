// Options page JavaScript for Google Calendar Event Duplicator

console.log('Google Calendar Event Duplicator options page loaded');

// Security validation functions
function validateCalendarId(calendarId) {
  if (!calendarId || typeof calendarId !== 'string') {
    return false;
  }
  
  // Calendar IDs should be reasonable length
  if (calendarId.length > 320 || calendarId.length === 0) {
    return false;
  }
  
  // Should not contain dangerous characters
  const dangerousChars = /[<>"'&\\]/;
  if (dangerousChars.test(calendarId)) {
    return false;
  }
  
  return true;
}

function sanitizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;')
    .substring(0, 500);
}

document.addEventListener('DOMContentLoaded', async () => {
  const calendarSelect = document.getElementById('destination-calendar');
  const saveButton = document.getElementById('save-settings');
  const logoutButton = document.getElementById('logout-btn');
  const statusMessage = document.getElementById('status-message');
  
  // Load calendars and update status card
  await loadCalendars();
  
  // Load saved settings and update status card
  await loadSavedSettings();
  
  // Update status card after initial load
  await updateStatusCard();
  
  // Save settings when button is clicked
  saveButton.addEventListener('click', saveSettings);
  
  // Logout when button is clicked
  logoutButton.addEventListener('click', logout);
  
  // Update status card when calendar selection changes
  calendarSelect.addEventListener('change', updateStatusCard);
});

// Function to update the status card based on current configuration
async function updateStatusCard() {
  const statusCard = document.getElementById('status-card');
  const statusIcon = statusCard.querySelector('.status-icon');
  const statusTitle = statusCard.querySelector('.status-title');
  const accountInfo = document.getElementById('account-info');
  const calendarInfo = document.getElementById('calendar-info');
  const calendarSelect = document.getElementById('destination-calendar');
  
  try {
    // Check authentication status by trying to get calendars
    const response = await chrome.runtime.sendMessage({ action: 'getCalendars' });
    const savedSettings = await chrome.storage.sync.get(['selectedCalendarId', 'selectedCalendarName']);
    
    if (!response.success) {
      // Not authenticated
      statusCard.className = 'status-card status-error';
      statusIcon.textContent = '❌';
      statusTitle.textContent = 'Not Configured';
      accountInfo.textContent = 'Not signed in to Google Calendar';
      calendarInfo.textContent = 'Please log in to continue';
    } else if (!savedSettings.selectedCalendarId || !calendarSelect.value) {
      // Authenticated but no calendar selected
      statusCard.className = 'status-card status-partial';
      statusIcon.textContent = '⚠️';
      statusTitle.textContent = 'Setup Required';
      accountInfo.textContent = 'Signed in to Google Calendar';
      calendarInfo.textContent = 'Please select a destination calendar';
    } else {
      // Fully configured
      statusCard.className = 'status-card status-ready';
      statusIcon.textContent = '✅';
      statusTitle.textContent = 'Ready to Duplicate Events';
      accountInfo.textContent = 'Signed in to Google Calendar';
      calendarInfo.textContent = `Destination: ${savedSettings.selectedCalendarName || 'Selected calendar'}`;
    }
  } catch (error) {
    // Error state
    statusCard.className = 'status-card status-error';
    statusIcon.textContent = '❌';
    statusTitle.textContent = 'Configuration Error';
    accountInfo.textContent = 'Unable to verify authentication';
    calendarInfo.textContent = 'Please try refreshing the page';
  }
}

async function loadCalendars() {
  const calendarSelect = document.getElementById('destination-calendar');
  const statusMessage = document.getElementById('status-message');
  
  try {
    statusMessage.textContent = 'Loading calendars...';
    
    // Request calendars from background script
    const response = await chrome.runtime.sendMessage({ action: 'getCalendars' });
    
    if (response.success) {
      // Clear existing options except the first one
      calendarSelect.innerHTML = '<option value="">Select a calendar...</option>';
      
      // Add calendar options (with validation)
      response.calendars.forEach(calendar => {
        if (validateCalendarId(calendar.id)) {
          const option = document.createElement('option');
          option.value = calendar.id;
          const displayName = sanitizeText(calendar.summaryOverride || calendar.summary);
          option.textContent = displayName;
          option.dataset.calendarName = displayName;
          calendarSelect.appendChild(option);
        }
      });
      
      statusMessage.textContent = `Found ${response.calendars.length} writable calendars`;
      
      // Show login button if user was logged out
      hideLoginButton();
      
      // Update status card after successful load
      await updateStatusCard();
    } else {
      // Check if error is due to logout state
      if (response.error.includes('logged out')) {
        statusMessage.textContent = 'You are logged out. Please log in to access calendars.';
        showLoginButton();
      } else {
        // Sanitize error message
        const sanitizedError = sanitizeText(response.error || 'Unknown error');
        statusMessage.textContent = `Error: ${sanitizedError}`;
      }
      
      // Update status card after error
      await updateStatusCard();
    }
  } catch (error) {
    console.error('Failed to load calendars:', error);
    statusMessage.textContent = 'Failed to load calendars. Please try again.';
  }
}

async function loadSavedSettings() {
  try {
    const result = await chrome.storage.sync.get(['selectedCalendarId']);
    if (result.selectedCalendarId) {
      document.getElementById('destination-calendar').value = result.selectedCalendarId;
    }
  } catch (error) {
    console.error('Failed to load saved settings:', error);
  }
}

async function saveSettings() {
  const calendarSelect = document.getElementById('destination-calendar');
  const statusMessage = document.getElementById('status-message');
  
  const selectedCalendarId = calendarSelect.value;
  
  if (!selectedCalendarId) {
    statusMessage.textContent = 'Please select a calendar first.';
    return;
  }
  
  // Validate selected calendar ID
  if (!validateCalendarId(selectedCalendarId)) {
    statusMessage.textContent = 'Invalid calendar selection. Please try again.';
    return;
  }
  
  // Get the calendar name from the selected option (with validation)
  const selectedOption = calendarSelect.options[calendarSelect.selectedIndex];
  const rawCalendarName = selectedOption.dataset.calendarName;
  const selectedCalendarName = sanitizeText(rawCalendarName);
  
  try {
    await chrome.storage.sync.set({ 
      selectedCalendarId,
      selectedCalendarName
    });
    statusMessage.textContent = 'Settings saved successfully!';
    
    // Update status card after saving
    await updateStatusCard();
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      statusMessage.textContent = '';
    }, 3000);
  } catch (error) {
    console.error('Failed to save settings:', error);
    statusMessage.textContent = 'Failed to save settings. Please try again.';
  }
}

async function logout() {
  const statusMessage = document.getElementById('status-message');
  const calendarSelect = document.getElementById('destination-calendar');
  
  try {
    statusMessage.textContent = 'Logging out...';
    
    // Send logout request to background script
    const response = await chrome.runtime.sendMessage({ action: 'logout' });
    
    if (response.success) {
      // Clear the calendar dropdown
      calendarSelect.innerHTML = '<option value="">Select a calendar...</option>';
      
      // Clear saved settings
      await chrome.storage.sync.clear();
      
      statusMessage.textContent = 'Logged out successfully. Click "Log In" to re-authenticate.';
      
      // Show login button
      showLoginButton();
      
      // Update status card after logout
      await updateStatusCard();
    } else {
      const sanitizedError = sanitizeText(response.error || 'Unknown error');
      statusMessage.textContent = `Logout failed: ${sanitizedError}`;
    }
  } catch (error) {
    console.error('Failed to logout:', error);
    statusMessage.textContent = 'Failed to logout. Please try again.';
  }
}

async function login() {
  const statusMessage = document.getElementById('status-message');
  
  try {
    statusMessage.textContent = 'Logging in...';
    
    // Send login request to background script
    const response = await chrome.runtime.sendMessage({ action: 'login' });
    
    if (response.success) {
      // Reload calendars and settings
      await loadCalendars();
      await loadSavedSettings();
      
      // Update status card after login
      await updateStatusCard();
    } else {
      const sanitizedError = sanitizeText(response.error || 'Unknown error');
      statusMessage.textContent = `Login failed: ${sanitizedError}`;
    }
  } catch (error) {
    console.error('Failed to login:', error);
    statusMessage.textContent = 'Failed to login. Please try again.';
  }
}

function showLoginButton() {
  const buttonGroup = document.querySelector('.button-group');
  let loginButton = document.getElementById('login-btn');
  
  if (!loginButton) {
    loginButton = document.createElement('button');
    loginButton.id = 'login-btn';
    loginButton.className = 'login-btn';
    loginButton.textContent = 'Log In';
    loginButton.addEventListener('click', login);
    buttonGroup.insertBefore(loginButton, buttonGroup.firstChild);
  }
  
  loginButton.style.display = 'block';
}

function hideLoginButton() {
  const loginButton = document.getElementById('login-btn');
  if (loginButton) {
    loginButton.style.display = 'none';
  }
}