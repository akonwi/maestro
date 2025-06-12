import { getSyncConfig, exportAllData, getSyncStatus } from './syncService';

export interface AutoSyncSettings {
  enabled: boolean;
  lastAutoSync: Date | null;
}

// Get auto-sync settings
export const getAutoSyncSettings = (): AutoSyncSettings => {
  const settings = localStorage.getItem('maestro_auto_sync');
  if (settings) {
    const parsed = JSON.parse(settings);
    return {
      ...parsed,
      lastAutoSync: parsed.lastAutoSync ? new Date(parsed.lastAutoSync) : null
    };
  }
  return {
    enabled: false,
    lastAutoSync: null
  };
};

// Save auto-sync settings
export const setAutoSyncSettings = (settings: AutoSyncSettings): void => {
  localStorage.setItem('maestro_auto_sync', JSON.stringify(settings));
};

// Service Worker Manager
class ServiceWorkerManager {
  private sw: ServiceWorker | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  async register(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/maestro/sw.js', {
        scope: '/maestro/'
      });

      console.log('Service Worker registered successfully');

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));

      // Set up sync config when service worker is ready
      if (this.registration.active) {
        this.sw = this.registration.active;
        await this.setupServiceWorker();
      }

      // Handle service worker updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              this.sw = newWorker;
              this.setupServiceWorker();
            }
          });
        }
      });

      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  private async setupServiceWorker() {
    if (!this.sw) return;

    // Send sync config to service worker
    const syncConfig = getSyncConfig();
    if (syncConfig) {
      this.postMessage('SET_SYNC_CONFIG', syncConfig);
    }

    // Start auto-sync if enabled
    const autoSyncSettings = getAutoSyncSettings();
    if (autoSyncSettings.enabled) {
      await this.startAutoSync();
    }
  }

  private handleMessage(event: MessageEvent) {
    const { type, data } = event.data;

    switch (type) {
      case 'GET_EXPORT_DATA':
        this.handleDataRequest(event);
        break;
      case 'SYNC_SUCCESS':
        console.log('Background sync successful:', data);
        // Update auto-sync settings
        const settings = getAutoSyncSettings();
        setAutoSyncSettings({
          ...settings,
          lastAutoSync: new Date(data.lastSync)
        });
        break;
      case 'SYNC_ERROR':
        console.error('Background sync failed:', data.error);
        break;
    }
  }

  private async handleDataRequest(event: MessageEvent) {
    try {
      // Export data and send back to service worker
      const exportData = await exportAllData();
      
      // Use the port from the message to respond
      const port = event.ports[0];
      if (port) {
        port.postMessage(exportData);
      }
    } catch (error) {
      console.error('Failed to export data for service worker:', error);
      const port = event.ports[0];
      if (port) {
        port.postMessage(null);
      }
    }
  }

  async startAutoSync(): Promise<boolean> {
    if (!this.sw) {
      console.warn('Service Worker not available');
      return false;
    }

    const syncConfig = getSyncConfig();
    if (!syncConfig) {
      console.warn('Sync not configured');
      return false;
    }

    try {
      // Try to register periodic background sync (if supported)
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        await this.registration?.sync.register('background-sync');
      }

      // Start interval-based sync in service worker
      this.postMessage('START_AUTO_SYNC');

      // Update settings
      const settings = getAutoSyncSettings();
      setAutoSyncSettings({
        ...settings,
        enabled: true
      });

      console.log('Auto-sync started');
      return true;
    } catch (error) {
      console.error('Failed to start auto-sync:', error);
      return false;
    }
  }

  async stopAutoSync(): Promise<void> {
    if (this.sw) {
      this.postMessage('STOP_AUTO_SYNC');
    }

    // Update settings
    const settings = getAutoSyncSettings();
    setAutoSyncSettings({
      ...settings,
      enabled: false
    });

    console.log('Auto-sync stopped');
  }

  async triggerSync(): Promise<void> {
    if (this.sw) {
      this.postMessage('SYNC_NOW');
    }
  }

  updateSyncConfig(config: any): void {
    if (this.sw) {
      this.postMessage('SET_SYNC_CONFIG', config);
    }
  }

  private postMessage(type: string, data?: any): void {
    if (this.sw) {
      this.sw.postMessage({ type, data });
    }
  }

  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  isRegistered(): boolean {
    return this.registration !== null;
  }
}

// Global service worker manager instance
export const swManager = new ServiceWorkerManager();
