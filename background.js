console.log("Background script loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  chrome.contextMenus.create({
    id: "searchAppleMaps",
    title: "Search on Apple Maps",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked", info);
  if (info.menuItemId === "searchAppleMaps") {
    const query = encodeURIComponent(info.selectionText);
    chrome.tabs.create({ url: `https://beta.maps.apple.com/?q=${query}` });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('google.com/maps')) {
    console.log("Sending showNotification message to tab", tabId);
    chrome.tabs.sendMessage(tabId, { action: "showNotification" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
      } else {
        console.log("Message sent successfully");
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received in background", request);
  if (request.action === "openAppleMaps") {
    console.log("Opening Apple Maps with URL:", request.url);
    chrome.tabs.create({ url: request.url });
    sendResponse({ status: "success" });
  }
  return true;
});