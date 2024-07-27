document.addEventListener('DOMContentLoaded', () => {
  const durationInput = document.getElementById('notificationDuration');
  const autodetectCheckbox = document.getElementById('autodetectEnabled');
  const saveButton = document.getElementById('save');

  // Load saved options
  chrome.storage.sync.get(['notificationDuration', 'autodetectEnabled'], (result) => {
    durationInput.value = result.notificationDuration || 5;
    autodetectCheckbox.checked = result.autodetectEnabled !== false;
  });

  // Save options
  saveButton.addEventListener('click', () => {
    chrome.storage.sync.set({
      notificationDuration: parseInt(durationInput.value, 10),
      autodetectEnabled: autodetectCheckbox.checked
    }, () => {
      alert('Options saved!');
    });
  });
});
