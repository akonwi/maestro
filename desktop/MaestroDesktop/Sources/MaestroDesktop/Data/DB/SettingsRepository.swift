import Foundation
import SQLite3

@MainActor
final class SettingsRepository {
    init() {
        ensureTable()
    }

    func getApiToken() -> String {
        guard let db = Database.shared.handle else { return "" }

        let sql = "SELECT value FROM settings WHERE key = 'api_token' LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return ""
        }

        var token = ""
        if sqlite3_step(statement) == SQLITE_ROW {
            if let text = sqlite3_column_text(statement, 0) {
                token = String(cString: text)
            }
        }

        sqlite3_finalize(statement)
        return token
    }

    func setApiToken(_ token: String) {
        setValue(token, forKey: "api_token")
    }

    func getOpenAIKey() -> String {
        getValue(forKey: "openai_key") ?? ""
    }

    func setOpenAIKey(_ key: String) {
        setValue(key, forKey: "openai_key")
    }

    private func getValue(forKey key: String) -> String? {
        guard let db = Database.shared.handle else { return nil }

        let sql = "SELECT value FROM settings WHERE key = ? LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(statement, 1, key, -1, transient)

        var value: String?
        if sqlite3_step(statement) == SQLITE_ROW {
            if let text = sqlite3_column_text(statement, 0) {
                value = String(cString: text)
            }
        }

        sqlite3_finalize(statement)
        return value
    }

    private func setValue(_ value: String, forKey key: String) {
        guard let db = Database.shared.handle else { return }

        let sql = "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(statement, 1, key, -1, transient)
        sqlite3_bind_text(statement, 2, value, -1, transient)
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    private func ensureTable() {
        guard let db = Database.shared.handle else { return }
        let sql = """
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        """

        sqlite3_exec(db, sql, nil, nil, nil)
    }
}
