// Service Worker for background sync
const CACHE_NAME = "maestro-v1";
const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

// Install event
self.addEventListener("install", (event) => {
  console.log("Service Worker installing");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("Service Worker activating");
  event.waitUntil(self.clients.claim());
});

// Background sync handler
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(performBackgroundSync());
  }
});

// Periodic background sync (when supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "auto-sync") {
    event.waitUntil(performBackgroundSync());
  }
});

// Message handler for communication with main thread
self.addEventListener("message", (event) => {
  const { type, data } = event.data;

  switch (type) {
    case "SYNC_NOW":
      event.waitUntil(performBackgroundSync());
      break;
    case "START_AUTO_SYNC":
      startAutoSync();
      break;
    case "STOP_AUTO_SYNC":
      stopAutoSync();
      break;
    case "SET_SYNC_CONFIG":
      setSyncConfig(data);
      break;
  }
});

let syncInterval;
let syncConfig = null;

// Start automatic sync timer
function startAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  syncInterval = setInterval(() => {
    performBackgroundSync();
  }, SYNC_INTERVAL);

  console.log("Auto-sync started (every hour)");
}

// Stop automatic sync timer
function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log("Auto-sync stopped");
}

// Set sync configuration
function setSyncConfig(config) {
  syncConfig = config;
}

// Perform the actual sync
async function performBackgroundSync() {
  try {
    // Get sync config from storage or use cached version
    if (!syncConfig) {
      const stored = await getStoredSyncConfig();
      if (!stored) {
        console.log("No sync config found, skipping sync");
        return;
      }
      syncConfig = stored;
    }

    console.log("Performing background sync...");

    // Check if we're online
    if (!navigator.onLine) {
      console.log("Offline, skipping sync");
      return;
    }

    // Get data from IndexedDB via main thread
    const data = await getDataFromMainThread();
    if (!data) {
      console.log("Failed to get data from main thread");
      return;
    }

    // Upload to GitHub
    await syncToGitHub(syncConfig, data);

    console.log("Background sync completed successfully");

    // Notify main thread of successful sync
    notifyClients("SYNC_SUCCESS", { lastSync: new Date() });
  } catch (error) {
    console.error("Background sync failed:", error);

    // Notify main thread of sync error
    notifyClients("SYNC_ERROR", { error: error.message });
  }
}

// Get sync config from IndexedDB
async function getStoredSyncConfig() {
  try {
    const stored = localStorage.getItem("maestro_sync_config");
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error("Failed to get sync config:", error);
    return null;
  }
}

// Get data from main thread (since service worker can't easily access IndexedDB)
async function getDataFromMainThread() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };

    // Send message to all clients
    self.clients.matchAll().then((clients) => {
      if (clients.length > 0) {
        clients[0].postMessage(
          {
            type: "GET_EXPORT_DATA",
          },
          [channel.port2],
        );
      } else {
        resolve(null);
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => resolve(null), 10000);
  });
}

// Sync data to GitHub
async function syncToGitHub(config, exportData) {
  // Get existing file (if any)
  const existingFile = await getFileFromGitHub(config);

  // Save to GitHub
  await saveFileToGitHub(config, exportData, existingFile?.sha);
}

// Get file from GitHub
async function getFileFromGitHub(config) {
  const response = await fetch(
    `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}`,
    {
      headers: {
        Authorization: `token ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (response.status === 404) {
    return null; // File doesn't exist yet
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  const fileData = await response.json();
  return { sha: fileData.sha };
}

// Save file to GitHub
async function saveFileToGitHub(config, data, sha) {
  const content = btoa(JSON.stringify(data, null, 2));

  const body = {
    message: `Auto-sync Maestro data - ${new Date().toISOString()}`,
    content,
  };

  if (sha) {
    body.sha = sha; // Required for updates
  }

  const response = await fetch(
    `https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${config.githubToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `GitHub API error: ${errorData.message || response.statusText}`,
    );
  }
}

// Notify all clients
function notifyClients(type, data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, data });
    });
  });
}
