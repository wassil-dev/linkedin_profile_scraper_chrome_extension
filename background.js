// Background service worker

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveProfile') {
    saveProfileData(request.data).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Error saving profile:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'getAllProfiles') {
    getAllProfiles().then((profiles) => {
      sendResponse({ success: true, profiles: profiles });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'deleteProfile') {
    deleteProfile(request.profileId).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (request.action === 'clearAllProfiles') {
    clearAllProfiles().then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

async function saveProfileData(profileData) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['profiles'], (result) => {
      const profiles = result.profiles || {};

      // Use profileId as key
      if (profileData.profileId) {
        profiles[profileData.profileId] = profileData;

        chrome.storage.local.set({ profiles: profiles }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log('Profile saved:', profileData.profileId);
            resolve();
          }
        });
      } else {
        reject(new Error('No profile ID found'));
      }
    });
  });
}

async function getAllProfiles() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['profiles'], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result.profiles || {});
      }
    });
  });
}

async function deleteProfile(profileId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['profiles'], (result) => {
      const profiles = result.profiles || {};

      if (profiles[profileId]) {
        delete profiles[profileId];

        chrome.storage.local.set({ profiles: profiles }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Profile not found'));
      }
    });
  });
}

async function clearAllProfiles() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ profiles: {} }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
