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

            // Set app icon from resources (since we're not in an app bundle)
            if let iconURL = Bundle.module.url(
                forResource: "icon_512",
                withExtension: "png",
                subdirectory: "Assets.xcassets/AppIcon.appiconset"
            ), let icon = NSImage(contentsOf: iconURL) {
                NSApplication.shared.applicationIconImage = icon
            }
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
