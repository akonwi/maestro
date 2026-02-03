import Foundation
import SQLite3

struct CachedAnalysis {
    let analysis: CornerAnalysisResponse
    let cachedAt: Date
}

@MainActor
final class AnalysisCache {
    static let shared = AnalysisCache()

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

    func get(fixtureId: Int) -> CachedAnalysis? {
        guard let db = Database.shared.handle else { return nil }

        let sql = """
        SELECT data, cached_at FROM analysis_cache
        WHERE fixture_id = ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(fixtureId))

        var result: CachedAnalysis?

        if sqlite3_step(statement) == SQLITE_ROW {
            if let dataPtr = sqlite3_column_text(statement, 0) {
                let jsonString = String(cString: dataPtr)
                let timestamp = sqlite3_column_int64(statement, 1)
                let cachedAt = Date(timeIntervalSince1970: TimeInterval(timestamp))

                if let jsonData = jsonString.data(using: .utf8),
                   let analysis = try? JSONDecoder().decode(CornerAnalysisResponse.self, from: jsonData) {
                    result = CachedAnalysis(analysis: analysis, cachedAt: cachedAt)
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
}
