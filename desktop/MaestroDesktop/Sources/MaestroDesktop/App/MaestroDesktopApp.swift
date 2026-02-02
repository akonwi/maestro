import SwiftUI
import AppKit

@main
struct MaestroDesktopApp: App {
    @StateObject private var appState = AppState()

    init() {
        // Required for keyboard input when running as a plain executable (not in .app bundle)
        NSApplication.shared.setActivationPolicy(.regular)
        DispatchQueue.main.async {
            NSApplication.shared.activate(ignoringOtherApps: true)
        }
    }

    var body: some Scene {
        WindowGroup {
            MainScreen()
                .environmentObject(appState)
                .preferredColorScheme(nil)
        }
    }
}
