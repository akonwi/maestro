import Foundation
import SQLite3

@MainActor
final class BetRepository {
    static let shared = BetRepository()

    private init() {
        ensureTable()
    }

    private func debugLog(_ msg: String) {
        let path = NSHomeDirectory() + "/maestro_debug.log"
        let line = "[\(Date())] [BetRepo] \(msg)\n"
        if let data = line.data(using: .utf8) {
            if FileManager.default.fileExists(atPath: path) {
                if let handle = FileHandle(forWritingAtPath: path) {
                    handle.seekToEndOfFile()
                    handle.write(data)
                    handle.closeFile()
                }
            } else {
                FileManager.default.createFile(atPath: path, contents: data)
            }
        }
    }

    private func ensureTable() {
        guard let db = Database.shared.handle else { return }

        // Check if table has correct schema by checking for fixture_id column
        var hasCorrectSchema = false
        let checkSql = "PRAGMA table_info(bets);"
        var checkStmt: OpaquePointer?
        if sqlite3_prepare_v2(db, checkSql, -1, &checkStmt, nil) == SQLITE_OK {
            while sqlite3_step(checkStmt) == SQLITE_ROW {
                if let name = sqlite3_column_text(checkStmt, 1) {
                    if String(cString: name) == "fixture_id" {
                        hasCorrectSchema = true
                        break
                    }
                }
            }
            sqlite3_finalize(checkStmt)
        }

        // Drop old table if schema is wrong
        if !hasCorrectSchema {
            sqlite3_exec(db, "DROP TABLE IF EXISTS bets;", nil, nil, nil)
        }

        let sql = """
        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fixture_id INTEGER NOT NULL,
            market_id INTEGER NOT NULL,
            line REAL,
            odds INTEGER NOT NULL,
            stake REAL NOT NULL,
            result TEXT NOT NULL DEFAULT 'pending',
            notes TEXT,
            created_at INTEGER NOT NULL
        );
        """

        sqlite3_exec(db, sql, nil, nil, nil)
    }

    func create(
        fixtureId: Int,
        marketId: Int,
        line: Double?,
        odds: Int,
        stake: Double,
        notes: String?
    ) -> Bet? {
        guard let db = Database.shared.handle else {
            debugLog("No database handle")
            return nil
        }

        let sql = """
        INSERT INTO bets (fixture_id, market_id, line, odds, stake, result, notes, created_at)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?);
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            let errmsg = String(cString: sqlite3_errmsg(db))
            debugLog("Prepare failed: \(errmsg)")
            return nil
        }

        let now = Int64(Date().timeIntervalSince1970 * 1000)
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

        sqlite3_bind_int64(statement, 1, Int64(fixtureId))
        sqlite3_bind_int64(statement, 2, Int64(marketId))
        if let line = line {
            sqlite3_bind_double(statement, 3, line)
        } else {
            sqlite3_bind_null(statement, 3)
        }
        sqlite3_bind_int(statement, 4, Int32(odds))
        sqlite3_bind_double(statement, 5, stake)
        if let notes = notes, !notes.isEmpty {
            sqlite3_bind_text(statement, 6, notes, -1, transient)
        } else {
            sqlite3_bind_null(statement, 6)
        }
        sqlite3_bind_int64(statement, 7, now)

        let stepResult = sqlite3_step(statement)
        guard stepResult == SQLITE_DONE else {
            let errmsg = String(cString: sqlite3_errmsg(db))
            debugLog("Step failed (\(stepResult)): \(errmsg)")
            sqlite3_finalize(statement)
            return nil
        }

        let id = Int(sqlite3_last_insert_rowid(db))
        sqlite3_finalize(statement)

        debugLog("Created bet with id \(id)")
        return Bet(
            id: id,
            fixtureId: fixtureId,
            marketId: marketId,
            line: line,
            odds: odds,
            stake: stake,
            result: .pending,
            notes: notes,
            createdAt: Date()
        )
    }

    func update(id: Int, result: BetResult) {
        guard let db = Database.shared.handle else { return }

        let sql = "UPDATE bets SET result = ? WHERE id = ?;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            sqlite3_bind_text(statement, 1, result.rawValue, -1, transient)
            sqlite3_bind_int64(statement, 2, Int64(id))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    func delete(id: Int) {
        guard let db = Database.shared.handle else { return }

        let sql = "DELETE FROM bets WHERE id = ?;"

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int64(statement, 1, Int64(id))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    func allBets() -> [Bet] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT id, fixture_id, market_id, line, odds, stake, result, notes, created_at
        FROM bets
        ORDER BY created_at DESC;
        """

        return fetchBets(db: db, sql: sql)
    }

    func pendingBets() -> [Bet] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT id, fixture_id, market_id, line, odds, stake, result, notes, created_at
        FROM bets
        WHERE result = 'pending'
        ORDER BY created_at DESC;
        """

        return fetchBets(db: db, sql: sql)
    }

    func bets(for fixtureId: Int) -> [Bet] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT id, fixture_id, market_id, line, odds, stake, result, notes, created_at
        FROM bets
        WHERE fixture_id = ?
        ORDER BY created_at DESC;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(fixtureId))

        var bets: [Bet] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let bet = parseBet(statement: statement) {
                bets.append(bet)
            }
        }

        sqlite3_finalize(statement)
        return bets
    }

    func stats() -> BetStats {
        guard let db = Database.shared.handle else { return .empty }

        let sql = """
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN result = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN result = 'won' THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN result = 'lost' THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
            SUM(CASE WHEN result != 'push' THEN stake ELSE 0 END) as total_staked,
            SUM(CASE
                WHEN result = 'won' AND odds > 0 THEN stake + (stake * odds / 100.0)
                WHEN result = 'won' AND odds < 0 THEN stake + (stake * 100.0 / ABS(odds))
                WHEN result = 'push' THEN stake
                ELSE 0
            END) as total_payout
        FROM bets;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return .empty
        }

        var stats = BetStats.empty

        if sqlite3_step(statement) == SQLITE_ROW {
            stats = BetStats(
                totalBets: Int(sqlite3_column_int(statement, 0)),
                pendingBets: Int(sqlite3_column_int(statement, 1)),
                wins: Int(sqlite3_column_int(statement, 2)),
                losses: Int(sqlite3_column_int(statement, 3)),
                pushes: Int(sqlite3_column_int(statement, 4)),
                totalStaked: sqlite3_column_double(statement, 5),
                totalPayout: sqlite3_column_double(statement, 6)
            )
        }

        sqlite3_finalize(statement)
        return stats
    }

    // MARK: - Private Helpers

    private func fetchBets(db: OpaquePointer, sql: String) -> [Bet] {
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        var bets: [Bet] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            if let bet = parseBet(statement: statement) {
                bets.append(bet)
            }
        }

        sqlite3_finalize(statement)
        return bets
    }

    private func parseBet(statement: OpaquePointer?) -> Bet? {
        guard let statement = statement else { return nil }

        let id = Int(sqlite3_column_int64(statement, 0))
        let fixtureId = Int(sqlite3_column_int64(statement, 1))
        let marketId = Int(sqlite3_column_int64(statement, 2))
        let line: Double? = sqlite3_column_type(statement, 3) != SQLITE_NULL
            ? sqlite3_column_double(statement, 3)
            : nil
        let odds = Int(sqlite3_column_int(statement, 4))
        let stake = sqlite3_column_double(statement, 5)
        let resultStr = String(cString: sqlite3_column_text(statement, 6))
        let result = BetResult(rawValue: resultStr) ?? .pending
        let notes: String? = sqlite3_column_type(statement, 7) != SQLITE_NULL
            ? String(cString: sqlite3_column_text(statement, 7))
            : nil
        let timestamp = sqlite3_column_int64(statement, 8)
        let createdAt = Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000)

        return Bet(
            id: id,
            fixtureId: fixtureId,
            marketId: marketId,
            line: line,
            odds: odds,
            stake: stake,
            result: result,
            notes: notes,
            createdAt: createdAt
        )
    }
}
