// Popup script

console.log('Popup script loaded');

let allProfiles = {};
let filteredProfiles = {};

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded');
  try {
    loadProfiles();

    document.getElementById('scrapeBtn').addEventListener('click', scrapeCurrentProfile);
    document.getElementById('exportBtn').addEventListener('click', exportAllProfiles);
    document.getElementById('clearBtn').addEventListener('click', clearAllProfiles);

    // Search functionality
    document.getElementById('searchBox').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!query) {
        displayProfiles(allProfiles);
        return;
      }

      const filtered = {};
      Object.keys(allProfiles).forEach(key => {
        const profile = allProfiles[key];
        const searchText = [
          profile.name,
          profile.headline,
          profile.location,
          profile.currentCompany,
          profile.currentPosition,
          ...(profile.experience || []).map(e => `${e.title} ${e.company}`),
          ...(profile.skills || []).map(s => s.name || s)
        ].join(' ').toLowerCase();

        if (searchText.includes(query)) {
          filtered[key] = profile;
        }
      });

      displayProfiles(filtered);
    });

    console.log('Event listeners attached');
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
  }
});

function showStatus(message, isError = false) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = isError ? 'status error' : 'status success';

  setTimeout(() => {
    statusDiv.className = 'status';
  }, 3000);
}

async function scrapeCurrentProfile() {
  const scrapeBtn = document.getElementById('scrapeBtn');
  scrapeBtn.disabled = true;
  scrapeBtn.textContent = 'Scraping...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('linkedin.com/in/')) {
      showStatus('Please navigate to a LinkedIn profile page', true);
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = 'Scrape Current Profile';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'scrapeProfile' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: Please refresh the LinkedIn page and try again', true);
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = 'Scrape Current Profile';
        return;
      }

      if (response && response.success) {
        // Save the profile
        chrome.runtime.sendMessage({
          action: 'saveProfile',
          data: response.data
        }, (saveResponse) => {
          if (saveResponse && saveResponse.success) {
            showStatus('Profile scraped successfully!');
            loadProfiles();
          } else {
            showStatus('Error saving profile', true);
          }
          scrapeBtn.disabled = false;
          scrapeBtn.textContent = 'Scrape Current Profile';
        });
      } else {
        showStatus('Error scraping profile', true);
        scrapeBtn.disabled = false;
        scrapeBtn.textContent = 'Scrape Current Profile';
      }
    });
  } catch (error) {
    showStatus('Error: ' + error.message, true);
    scrapeBtn.disabled = false;
    scrapeBtn.textContent = 'Scrape Current Profile';
  }
}

function loadProfiles() {
  console.log('Loading profiles...');
  chrome.runtime.sendMessage({ action: 'getAllProfiles' }, (response) => {
    console.log('Got response:', response);
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      allProfiles = {};
      displayProfiles({});
      return;
    }
    if (response && response.success) {
      allProfiles = response.profiles;
      displayProfiles(allProfiles);
      updateStatistics(allProfiles);
    } else {
      console.error('Failed to load profiles');
      allProfiles = {};
      displayProfiles({});
    }
  });
}

function updateStatistics(profiles) {
  const profilesArray = Object.values(profiles);

  if (profilesArray.length === 0) {
    document.getElementById('stats').style.display = 'none';
    return;
  }

  document.getElementById('stats').style.display = 'block';

  // Total profiles
  document.getElementById('statTotal').textContent = profilesArray.length;

  // Unique companies
  const companies = new Set();
  profilesArray.forEach(p => {
    (p.experience || []).forEach(exp => {
      if (exp.company) companies.add(exp.company);
    });
  });
  document.getElementById('statCompanies').textContent = companies.size;

  // Average experience count
  const avgExp = (profilesArray.reduce((sum, p) => sum + (p.experience?.length || 0), 0) / profilesArray.length).toFixed(1);
  document.getElementById('statAvgExp').textContent = avgExp;

  // Top skill
  const skillCounts = {};
  profilesArray.forEach(p => {
    (p.skills || []).forEach(skill => {
      const skillName = skill.name || skill;
      skillCounts[skillName] = (skillCounts[skillName] || 0) + 1;
    });
  });

  const topSkill = Object.entries(skillCounts).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statTopSkill').textContent = topSkill ? `${topSkill[0]} (${topSkill[1]})` : '-';
}

function displayProfiles(profiles) {
  const profilesList = document.getElementById('profilesList');
  const profileCount = document.getElementById('profileCount');
  const profilesArray = Object.values(profiles);

  profileCount.textContent = profilesArray.length;

  if (profilesArray.length === 0) {
    profilesList.innerHTML = '<div class="empty-state">No profiles scraped yet. Visit a LinkedIn profile and click "Scrape Current Profile".</div>';
    return;
  }

  // Sort by timestamp (newest first)
  profilesArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  profilesList.innerHTML = profilesArray.map(profile => `
    <div class="profile-item">
      <div style="display: flex; align-items: center; margin-bottom: 10px;">
        ${profile.profilePicture ? `<img src="${profile.profilePicture}" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 10px;">` : ''}
        <div style="flex: 1;">
          <h3>${escapeHtml(profile.name || 'Unknown')}</h3>
          ${profile.currentPosition ? `<p style="font-weight: bold; margin: 2px 0;">${escapeHtml(profile.currentPosition)}</p>` : ''}
          ${profile.currentCompany ? `<p style="margin: 2px 0;">@ ${escapeHtml(profile.currentCompany)}</p>` : ''}
        </div>
      </div>
      <p style="font-size: 12px;">${escapeHtml(profile.headline || 'No headline')}</p>
      ${profile.connections ? `<p style="font-size: 11px; color: #666;">🔗 ${escapeHtml(profile.connections)}</p>` : ''}
      <p style="font-size: 11px; color: #666;">📍 ${escapeHtml(profile.location || 'N/A')}</p>
      <p style="font-size: 11px; color: #666;">
        💼 ${profile.experience?.length || 0} positions |
        🎓 ${profile.education?.length || 0} schools |
        ⭐ ${profile.skills?.length || 0} skills
      </p>
      <p style="font-size: 10px; color: #999; margin-top: 8px;">
        Scraped: ${new Date(profile.timestamp).toLocaleString()}
      </p>
      <div style="margin-top: 10px;">
        <button class="btn-small btn-view" data-profile-id="${escapeHtml(profile.profileId)}">View JSON</button>
        <button class="btn-small btn-delete" data-profile-id="${escapeHtml(profile.profileId)}">Delete</button>
      </div>
    </div>
  `).join('');

  // Add event listeners to all View and Delete buttons
  profilesList.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const profileId = e.target.getAttribute('data-profile-id');
      viewProfile(profileId);
    });
  });

  profilesList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const profileId = e.target.getAttribute('data-profile-id');
      deleteProfile(profileId);
    });
  });
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function viewProfile(profileId) {
  chrome.runtime.sendMessage({ action: 'getAllProfiles' }, (response) => {
    if (response && response.success) {
      const profile = response.profiles[profileId];
      if (profile) {
        // Open a new window with formatted profile data
        const jsonStr = JSON.stringify(profile, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    }
  });
}

function deleteProfile(profileId) {
  if (confirm('Are you sure you want to delete this profile?')) {
    chrome.runtime.sendMessage({
      action: 'deleteProfile',
      profileId: profileId
    }, (response) => {
      if (response && response.success) {
        showStatus('Profile deleted successfully!');
        loadProfiles();
      } else {
        showStatus('Error deleting profile', true);
      }
    });
  }
}

function exportAllProfiles() {
  chrome.runtime.sendMessage({ action: 'getAllProfiles' }, (response) => {
    if (response && response.success) {
      const profiles = Object.values(response.profiles);

      if (profiles.length === 0) {
        showStatus('No profiles to export', true);
        return;
      }

      const jsonStr = JSON.stringify(profiles, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `linkedin_profiles_${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      showStatus(`Exported ${profiles.length} profiles!`);
    } else {
      showStatus('Error exporting profiles', true);
    }
  });
}

function clearAllProfiles() {
  if (confirm('Are you sure you want to delete all scraped profiles? This action cannot be undone.')) {
    chrome.runtime.sendMessage({ action: 'clearAllProfiles' }, (response) => {
      if (response && response.success) {
        showStatus('All profiles cleared!');
        loadProfiles();
      } else {
        showStatus('Error clearing profiles', true);
      }
    });
  }
}
