import { getSyncConfig, syncToGitHub, syncFromGitHub } from "./syncService";

export interface AutoSyncSettings {
	enabled: boolean;
	lastAutoSync: Date | null;
}

// Get auto-sync settings
export const getAutoSyncSettings = (): AutoSyncSettings => {
	const settings = localStorage.getItem("maestro_auto_sync");
	if (settings) {
		const parsed = JSON.parse(settings);
		return {
			...parsed,
			lastAutoSync: parsed.lastAutoSync ? new Date(parsed.lastAutoSync) : null,
		};
	}
	return {
		enabled: false,
		lastAutoSync: null,
	};
};

// Save auto-sync settings
export const setAutoSyncSettings = (settings: AutoSyncSettings): void => {
	localStorage.setItem("maestro_auto_sync", JSON.stringify(settings));
};

class AutoSyncManager {
	private isEnabled = false;
	private syncInProgress = false;
	private hasBlurred = false;

	init() {
		const settings = getAutoSyncSettings();
		if (settings.enabled) {
			this.enable();
		}
	}

	enable() {
		if (this.isEnabled) return;

		this.isEnabled = true;
		this.setupEventListeners();

		// Update settings
		const settings = getAutoSyncSettings();
		setAutoSyncSettings({ ...settings, enabled: true });

		console.log("Auto-sync enabled (focus/blur)");
	}

	disable() {
		if (!this.isEnabled) return;

		this.isEnabled = false;
		this.removeEventListeners();

		// Update settings
		const settings = getAutoSyncSettings();
		setAutoSyncSettings({ ...settings, enabled: false });

		console.log("Auto-sync disabled");
	}

	private setupEventListeners() {
		window.addEventListener("blur", this.handleBlur);
		window.addEventListener("focus", this.handleFocus);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
	}

	private removeEventListeners() {
		window.removeEventListener("blur", this.handleBlur);
		window.removeEventListener("focus", this.handleFocus);
		document.removeEventListener(
			"visibilitychange",
			this.handleVisibilityChange,
		);
	}

	private handleBlur = () => {
		if (!this.isEnabled || this.syncInProgress) return;

		console.log("App lost focus, uploading data...");
		this.hasBlurred = true;
		this.uploadData();
	};

	private handleFocus = () => {
		if (!this.isEnabled || this.syncInProgress || !this.hasBlurred) return;

		console.log("App gained focus, downloading data...");
		this.hasBlurred = false;
		this.downloadData();
	};

	private handleVisibilityChange = () => {
		if (document.hidden) {
			this.handleBlur();
		} else {
			this.handleFocus();
		}
	};

	private async uploadData() {
		const config = getSyncConfig();
		if (!config) {
			console.log("No sync config, skipping upload");
			return;
		}

		if (!navigator.onLine) {
			console.log("Offline, skipping upload");
			return;
		}

		try {
			this.syncInProgress = true;
			await syncToGitHub();

			// Update last sync time
			const settings = getAutoSyncSettings();
			setAutoSyncSettings({
				...settings,
				lastAutoSync: new Date(),
			});

			console.log("Auto-upload completed");
		} catch (error) {
			console.error("Auto-upload failed:", error);
		} finally {
			this.syncInProgress = false;
		}
	}

	private async downloadData() {
		const config = getSyncConfig();
		if (!config) {
			console.log("No sync config, skipping download");
			return;
		}

		if (!navigator.onLine) {
			console.log("Offline, skipping download");
			return;
		}

		try {
			this.syncInProgress = true;

			// Only download if there might be changes
			// (we could add timestamp checking here later)
			await syncFromGitHub();

			// Update last sync time
			const settings = getAutoSyncSettings();
			setAutoSyncSettings({
				...settings,
				lastAutoSync: new Date(),
			});

			console.log("Auto-download completed");
		} catch (error) {
			console.error("Auto-download failed:", error);

			// If download fails, it might be because there's no remote data yet
			// Don't show error to user in this case
			if (!error.message.includes("No data found")) {
				console.warn("Download error (non-critical):", error.message);
			}
		} finally {
			this.syncInProgress = false;
		}
	}

	async triggerUpload() {
		if (this.syncInProgress) {
			console.log("Sync already in progress");
			return;
		}

		console.log("Manual upload triggered");
		await this.uploadData();
	}

	async triggerDownload() {
		if (this.syncInProgress) {
			console.log("Sync already in progress");
			return;
		}

		console.log("Manual download triggered");
		await this.downloadData();
	}

	isAutoSyncEnabled(): boolean {
		return this.isEnabled;
	}

	isSyncInProgress(): boolean {
		return this.syncInProgress;
	}
}

// Global auto-sync manager instance
export const autoSyncManager = new AutoSyncManager();
