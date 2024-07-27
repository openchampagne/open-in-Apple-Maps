console.log("Content script loaded");

let notificationTimeout;
let extractionAttempts = 0;
const MAX_EXTRACTION_ATTEMPTS = 5;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received:", request);
  if (request.action === "showNotification") {
    extractLocationAndShowNotification();
  }
});

function extractLocationAndShowNotification() {
  const location = getLocationFromGoogleMaps();
  if (location.name === "Current location" && extractionAttempts < MAX_EXTRACTION_ATTEMPTS) {
    extractionAttempts++;
    console.log(`Extraction attempt ${extractionAttempts}. Retrying in 1 second...`);
    setTimeout(extractLocationAndShowNotification, 1000);
  } else {
    showNotification(location);
  }
}

function getLocationFromGoogleMaps() {
  const url = window.location.href;
  let result = { type: 'name', name: "Current location", address: "", lat: "", lng: "" };

  // Extract place name from URL
  const placeMatch = url.match(/\/maps\/place\/([^/@]+)/);
  if (placeMatch) {
    result.name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
  }

  // Extract precise coordinates
  const preciseCoordMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (preciseCoordMatch) {
    result.type = 'coordinates';
    result.lat = preciseCoordMatch[1];
    result.lng = preciseCoordMatch[2];
  } else {
    // Fallback to less precise coordinates
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      result.type = 'coordinates';
      result.lat = coordMatch[1];
      result.lng = coordMatch[2];
    }
  }

  // Try to get the full address
  const addressElements = document.querySelectorAll('button[data-item-id^="address"], [data-item-id^="address"] button');
  if (addressElements.length > 0) {
    result.address = addressElements[0].textContent.trim();
  }

  // If we couldn't get the address from the page, try to get it from the meta tags
  if (!result.address) {
    const metaAddress = document.querySelector('meta[property="og:description"]');
    if (metaAddress) {
      result.address = metaAddress.content.split('·')[0].trim();
    }
  }

  console.log("Extracted location:", result);
  return result;
}


function showNotification(location) {
  chrome.storage.sync.get(['notificationDuration', 'autodetectEnabled'], (result) => {
    console.log("Storage result:", result);

    if (result.autodetectEnabled === false) {
      console.log("Autodetect is disabled");
      return;
    }

    console.log("Creating notification");

    const displayName = location.name;
    const notification = document.createElement('div');
    notification.id = 'apple-maps-notification';
    notification.innerHTML = `
      <div class="notification-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="icon">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
      <div class="notification-text">
        <p class="notification-title">Open in Apple Maps?</p>
        <p class="notification-body">${displayName}</p>
      </div>
      <button id="closeNotification" class="close-button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="close-icon">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
      <div class="notification-actions">
        <button id="openAppleMaps" class="action-button primary">Open</button>
        <button id="cancelNotification" class="action-button secondary">Cancel</button>
      </div>
      <div class="progress"></div>
    `;
    document.body.appendChild(notification);

    const duration = (result.notificationDuration || 5) * 1000;
    notificationTimeout = setTimeout(hideNotification, duration);

    animateProgress(duration);
  });
}

// Event delegation
document.body.addEventListener('click', function (event) {
  if (event.target.id === 'openAppleMaps') {
    console.log('Open button clicked');
    const location = getLocationFromGoogleMaps();
    openInAppleMaps(location);
  } else if (event.target.id === 'cancelNotification' || event.target.id === 'closeNotification') {
    console.log('Cancel or Close button clicked');
    hideNotification();
  }
});

function hideNotification() {
  console.log("Hiding notification");
  const notification = document.getElementById('apple-maps-notification');
  if (notification) {
    notification.remove();
    clearTimeout(notificationTimeout);
  } else {
    console.error("Notification element not found");
  }
}

function openInAppleMaps(location) {
  console.log("Opening in Apple Maps:", location);
  let url = 'https://beta.maps.apple.com/?';

  const parts = [];

  // Add address if available
  if (location.address) {
    // Remove non-printable characters, trim, and add ", United States"
    const cleanAddress = location.address.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim() + ", United States";
    parts.push(`address=${encodeURIComponent(cleanAddress)}`);
  }

  // Add a placeholder auid (you may want to generate this dynamically if possible)
  parts.push('auid=12854371437431820590');

  // Add coordinates if available
  if (location.type === 'coordinates' && location.lat && location.lng) {
    parts.push(`ll=${location.lat},${location.lng}`);
  }

  // Add lsp parameter
  parts.push('lsp=9902');

  // Add the query parameter last, with the place name from the URL
  if (location.name && location.name !== "Current location") {
    // Remove non-printable characters, trim, and capitalize words
    const cleanName = location.name.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim()
      .replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
    parts.push(`q=${encodeURIComponent(cleanName)}`);
  } else {
    parts.push('q=Dropped+Pin');
  }

  url += parts.join('&');

  console.log("Constructed Apple Maps URL:", url);

  chrome.runtime.sendMessage({ action: "openAppleMaps", url: url }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError);
    } else {
      console.log("Message sent successfully", response);
    }
  });
  hideNotification();
}


function animateProgress(duration) {
  const progress = document.querySelector('#apple-maps-notification .progress');
  if (progress) {
    progress.style.width = '0%';
    progress.style.transition = `width ${duration}ms linear`;
    setTimeout(() => {
      progress.style.width = '100%';
    }, 50);
  } else {
    console.error("Progress bar element not found");
  }
}

// Attempt to show notification on page load
setTimeout(() => {
  console.log("Attempting to show notification");
  extractLocationAndShowNotification();
}, 1000);  // Delay to ensure the page has loaded

window.addEventListener('error', (event) => {
  console.error("Uncaught error:", event.error);
});

// Inject CSS
const style = document.createElement('style');
style.textContent = `
 #apple-maps-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
  background: linear-gradient(to bottom, #3a3a3a, #2a2a2a);
  border-radius: 12px;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 1px 3px rgba(255, 255, 255, 0.1) inset,
    0 -1px 3px rgba(0, 0, 0, 0.2) inset;
  overflow: hidden;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.notification-icon {
  float: left;
  width: 40px;
  height: 40px;
  margin-right: 12px;
  background: linear-gradient(135deg, #4a4a4a, #3a3a3a);
  border-radius: 50%;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.2),
    0 -1px 1px rgba(255, 255, 255, 0.1) inset;
  padding: 8px;
}

.icon {
  width: 100%;
  height: 100%;
  color: #ffffff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.notification-text {
  margin-right: 24px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.notification-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.notification-body {
  margin: 4px 0 0;
  font-size: 14px;
  color: #cccccc;
}

.close-button {
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #4a4a4a, #3a3a3a);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 4px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.3),
    0 -1px 1px rgba(255, 255, 255, 0.1) inset;
}

.close-icon {
  width: 16px;
  height: 16px;
  color: #999999;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
}

.notification-actions {
  display: flex;
  margin-top: 16px;
}

.action-button {
  flex-grow: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
}

.action-button.primary {
  background: linear-gradient(to bottom, #0088ff, #0066cc);
  color: #ffffff;
  margin-right: 8px;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
}

.action-button.primary:hover {
  background: linear-gradient(to bottom, #0099ff, #0077dd);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.3) inset;
}

.action-button.primary:active {
  background: linear-gradient(to bottom, #0066cc, #0077dd);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.4) inset,
    0 1px 0 rgba(255, 255, 255, 0.1);
}

.action-button.secondary {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
  color: #ffffff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.2),
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
}

.action-button.secondary:hover {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
}

.action-button.secondary:active {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.1));
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.3) inset,
    0 1px 0 rgba(255, 255, 255, 0.05);
}

.progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(to right, #0088ff, #00aaff);
  width: 0;
  box-shadow: 0 0 4px rgba(0, 136, 255, 0.5);
}
`;
document.head.appendChild(style);