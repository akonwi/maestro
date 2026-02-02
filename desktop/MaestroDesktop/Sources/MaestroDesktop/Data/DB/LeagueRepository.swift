import Foundation
import SQLite3

@MainActor
final class LeagueRepository {
    init() {
        ensureTable()
    }

    private func ensureTable() {
        guard let db = Database.shared.handle else { return }
        let sql = """
        CREATE TABLE IF NOT EXISTS leagues (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            synced_at INTEGER
        );
        """
        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func followedLeagues() -> [FollowedLeague] {
        guard let db = Database.shared.handle else { return [] }

        let sql = "SELECT id, name FROM leagues ORDER BY name ASC;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        var results: [FollowedLeague] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let id = Int(sqlite3_column_int64(statement, 0))
            let name = String(cString: sqlite3_column_text(statement, 1))
            results.append(FollowedLeague(id: id, name: name))
        }

        sqlite3_finalize(statement)
        return results
    }

    func isFollowing(leagueId: Int) -> Bool {
        guard let db = Database.shared.handle else { return false }

        let sql = "SELECT 1 FROM leagues WHERE id = ? LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return false
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))

        let found = sqlite3_step(statement) == SQLITE_ROW
        sqlite3_finalize(statement)
        return found
    }

    func follow(league: LeagueSearchResult) {
        guard let db = Database.shared.handle else { return }

        let sql = "INSERT OR IGNORE INTO leagues (id, name) VALUES (?, ?);"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_int64(statement, 1, Int64(league.league.id))
        sqlite3_bind_text(statement, 2, league.league.name, -1, transient)

        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func unfollow(leagueId: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "DELETE FROM leagues WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func updateSyncedAt(leagueId: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "UPDATE leagues SET synced_at = ? WHERE id = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return
        }

        let now = Int64(Date().timeIntervalSince1970)
        sqlite3_bind_int64(statement, 1, now)
        sqlite3_bind_int64(statement, 2, Int64(leagueId))
        sqlite3_step(statement)
        sqlite3_finalize(statement)
    }

    func syncedAt(leagueId: Int) -> Date? {
        guard let db = Database.shared.handle else { return nil }

        let sql = "SELECT synced_at FROM leagues WHERE id = ? LIMIT 1;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return nil
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))

        var result: Date?
        if sqlite3_step(statement) == SQLITE_ROW {
            let value = sqlite3_column_int64(statement, 0)
            if value > 0 {
                result = Date(timeIntervalSince1970: TimeInterval(value))
            }
        }

        sqlite3_finalize(statement)
        return result
    }
}

struct FollowedLeague: Identifiable, Equatable {
    let id: Int
    let name: String
}
