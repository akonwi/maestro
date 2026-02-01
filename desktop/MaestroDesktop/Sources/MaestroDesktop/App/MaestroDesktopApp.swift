import SwiftUI
import AppKit

@main
struct MaestroDesktopApp: App {
    @StateObject private var appState = AppState()

    init() {
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
