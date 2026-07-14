import Foundation
import SQLite3

@MainActor
final class Database {
    static let shared = Database()

    private(set) var handle: OpaquePointer?

    private init() {
        openDatabase()
    }

    private func openDatabase() {
        let dbURL = resolveDatabaseURL()

        if sqlite3_open(dbURL.path, &handle) != SQLITE_OK {
            print("Failed to open database at \(dbURL.path)")
        } else {
            print("Opened database at \(dbURL.path)")
        }
    }

    private func resolveDatabaseURL() -> URL {
        let fileManager = FileManager.default
        let appSupport = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let appDirectory = appSupport?.appendingPathComponent("com.akonwi.maestro", isDirectory: true)
        let targetURL = appDirectory?.appendingPathComponent("maestro.sqlite")

        if let appDirectory, let targetURL {
            if !fileManager.fileExists(atPath: appDirectory.path) {
                try? fileManager.createDirectory(at: appDirectory, withIntermediateDirectories: true)
            }

            if !fileManager.fileExists(atPath: targetURL.path) {
                if let bundleURL = Bundle.main.url(forResource: "maestro", withExtension: "sqlite") {
                    try? fileManager.copyItem(at: bundleURL, to: targetURL)
                    print("Copied bundled database to \(targetURL.path)")
                } else {
                    let cwd = URL(fileURLWithPath: fileManager.currentDirectoryPath)
                    let fallbackURL = cwd.appendingPathComponent("desktop/maestro.sqlite")
                    if fileManager.fileExists(atPath: fallbackURL.path) {
                        try? fileManager.copyItem(at: fallbackURL, to: targetURL)
                        print("Copied fallback database to \(targetURL.path)")
                    } else {
                        print("No bundled database found; expected \(fallbackURL.path)")
                    }
                }
            }

            return targetURL
        }

        return URL(fileURLWithPath: "maestro.sqlite")
    }
}
