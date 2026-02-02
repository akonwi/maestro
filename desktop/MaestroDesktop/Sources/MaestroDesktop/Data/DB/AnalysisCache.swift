import Foundation
import SQLite3

@MainActor
final class AnalysisCache {
    static let shared = AnalysisCache()

    private let ttlSeconds: Int = 86400 // 24 hours

    private init() {
        ensureTable()
    }

    private func ensureTable() {
        guard let db = Database.shared.handle else { return }

        let sql = """
        CREATE TABLE IF NOT EXISTS analysis_cache (
            fixture_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            cached_at INTEGER NOT NULL
        );
        """

        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func get(fixtureId: Int) -> CornerAnalysisResponse? {
        guard let db = Database.shared.handle else { return nil }

        let now = Int(Date().timeIntervalSince1970)
        let minTime = now - ttlSeconds

        let sql = """
        SELECT data FROM analysis_cache
        WHERE fixture_id = ? AND cached_at > ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(fixtureId))
        sqlite3_bind_int64(statement, 2, Int64(minTime))

        var result: CornerAnalysisResponse?

        if sqlite3_step(statement) == SQLITE_ROW {
            if let dataPtr = sqlite3_column_text(statement, 0) {
                let jsonString = String(cString: dataPtr)
                if let jsonData = jsonString.data(using: .utf8) {
                    result = try? JSONDecoder().decode(CornerAnalysisResponse.self, from: jsonData)
                }
            }
        }

        sqlite3_finalize(statement)
        return result
    }

    func set(fixtureId: Int, data: CornerAnalysisResponse) {
        guard let db = Database.shared.handle else { return }

        guard let jsonData = try? JSONEncoder().encode(data),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }

        let now = Int(Date().timeIntervalSince1970)

        let sql = """
        INSERT OR REPLACE INTO analysis_cache (fixture_id, data, cached_at)
        VALUES (?, ?, ?);
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            sqlite3_bind_int64(statement, 1, Int64(fixtureId))
            sqlite3_bind_text(statement, 2, jsonString, -1, transient)
            sqlite3_bind_int64(statement, 3, Int64(now))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    func clear(fixtureId: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "DELETE FROM analysis_cache WHERE fixture_id = ?;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int64(statement, 1, Int64(fixtureId))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    func clearExpired() {
        guard let db = Database.shared.handle else { return }

        let minTime = Int(Date().timeIntervalSince1970) - ttlSeconds

        let sql = "DELETE FROM analysis_cache WHERE cached_at < ?;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int64(statement, 1, Int64(minTime))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }
}
