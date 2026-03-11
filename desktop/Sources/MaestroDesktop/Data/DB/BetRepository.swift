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
            line_name TEXT,
            line REAL,
            odds INTEGER NOT NULL,
            stake REAL NOT NULL,
            result TEXT NOT NULL DEFAULT 'pending',
            notes TEXT,
            created_at INTEGER NOT NULL
        );
        """

        sqlite3_exec(db, sql, nil, nil, nil)

        // Add line_name column to existing tables (will silently fail if already exists)
        sqlite3_exec(db, "ALTER TABLE bets ADD COLUMN line_name TEXT;", nil, nil, nil)
    }

    func create(
        fixtureId: Int,
        marketId: Int,
        lineName: String?,
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
        INSERT INTO bets (fixture_id, market_id, line_name, line, odds, stake, result, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?);
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
        if let lineName = lineName, !lineName.isEmpty {
            sqlite3_bind_text(statement, 3, lineName, -1, transient)
        } else {
            sqlite3_bind_null(statement, 3)
        }
        if let line = line {
            sqlite3_bind_double(statement, 4, line)
        } else {
            sqlite3_bind_null(statement, 4)
        }
        sqlite3_bind_int(statement, 5, Int32(odds))
        sqlite3_bind_double(statement, 6, stake)
        if let notes = notes, !notes.isEmpty {
            sqlite3_bind_text(statement, 7, notes, -1, transient)
        } else {
            sqlite3_bind_null(statement, 7)
        }
        sqlite3_bind_int64(statement, 8, now)

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
            lineName: lineName,
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
        SELECT id, fixture_id, market_id, line_name, line, odds, stake, result, notes, created_at
        FROM bets
        ORDER BY created_at DESC;
        """

        return fetchBets(db: db, sql: sql)
    }

    func pendingBets() -> [Bet] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT id, fixture_id, market_id, line_name, line, odds, stake, result, notes, created_at
        FROM bets
        WHERE result = 'pending'
        ORDER BY created_at DESC;
        """

        return fetchBets(db: db, sql: sql)
    }

    func bets(for fixtureId: Int) -> [Bet] {
        guard let db = Database.shared.handle else { return [] }

        let sql = """
        SELECT id, fixture_id, market_id, line_name, line, odds, stake, result, notes, created_at
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
            SUM(CASE WHEN result IN ('won', 'lost') THEN stake ELSE 0 END) as total_staked,
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
        let lineName: String? = sqlite3_column_type(statement, 3) != SQLITE_NULL
            ? String(cString: sqlite3_column_text(statement, 3))
            : nil
        let line: Double? = sqlite3_column_type(statement, 4) != SQLITE_NULL
            ? sqlite3_column_double(statement, 4)
            : nil
        let odds = Int(sqlite3_column_int(statement, 5))
        let stake = sqlite3_column_double(statement, 6)
        let resultStr = String(cString: sqlite3_column_text(statement, 7))
        let result = BetResult(rawValue: resultStr) ?? .pending
        let notes: String? = sqlite3_column_type(statement, 8) != SQLITE_NULL
            ? String(cString: sqlite3_column_text(statement, 8))
            : nil
        let timestamp = sqlite3_column_int64(statement, 9)
        let createdAt = Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000)

        return Bet(
            id: id,
            fixtureId: fixtureId,
            marketId: marketId,
            lineName: lineName,
            line: line,
            odds: odds,
            stake: stake,
            result: result,
            notes: notes,
            createdAt: createdAt
        )
    }

    // MARK: - Auto-Settle

    struct FixtureBetData {
        let isFinished: Bool
        let homeGoals: Int
        let awayGoals: Int
        let homeCorners: Int
        let awayCorners: Int
    }

    func trySettlePendingBets() -> Int {
        let pending = pendingBets()
        debugLog("=== Auto-settle check: \(pending.count) pending bets ===")
        var settledCount = 0

        for bet in pending {
            debugLog("Checking bet \(bet.id): fixtureId=\(bet.fixtureId), marketId=\(bet.marketId), lineName=\(bet.lineName ?? "nil"), line=\(bet.line ?? 0)")

            guard let fixtureData = getFixtureBetData(fixtureId: bet.fixtureId) else {
                debugLog("  -> No fixture data found for fixtureId=\(bet.fixtureId)")
                continue
            }

            guard fixtureData.isFinished else {
                debugLog("  -> Fixture not finished yet")
                continue
            }

            debugLog("  -> Fixture finished: homeGoals=\(fixtureData.homeGoals), awayGoals=\(fixtureData.awayGoals), totalGoals=\(fixtureData.homeGoals + fixtureData.awayGoals), homeCorners=\(fixtureData.homeCorners), awayCorners=\(fixtureData.awayCorners), totalCorners=\(fixtureData.homeCorners + fixtureData.awayCorners)")

            if let result = determineBetResult(
                bet: bet,
                homeGoals: fixtureData.homeGoals,
                awayGoals: fixtureData.awayGoals,
                homeCorners: fixtureData.homeCorners,
                awayCorners: fixtureData.awayCorners
            ) {
                update(id: bet.id, result: result)
                settledCount += 1
                debugLog("  -> SETTLED: \(result.rawValue)")
            } else {
                debugLog("  -> Could not determine result (lineName may not match expected patterns)")
            }
        }

        debugLog("=== Auto-settle complete: \(settledCount) bets settled ===")
        return settledCount
    }

    private func getFixtureBetData(fixtureId: Int) -> FixtureBetData? {
        guard let db = Database.shared.handle else { return nil }

        let fixtureSql = """
        SELECT finished, home_id, away_id, home_goals, away_goals FROM fixtures WHERE id = ?;
        """

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, fixtureSql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        sqlite3_bind_int64(stmt, 1, Int64(fixtureId))

        guard sqlite3_step(stmt) == SQLITE_ROW else {
            sqlite3_finalize(stmt)
            return nil
        }

        let finished = sqlite3_column_int(stmt, 0) == 1
        let homeId = Int(sqlite3_column_int64(stmt, 1))
        let awayId = Int(sqlite3_column_int64(stmt, 2))
        let homeGoals = Int(sqlite3_column_int(stmt, 3))
        let awayGoals = Int(sqlite3_column_int(stmt, 4))
        sqlite3_finalize(stmt)

        guard finished else {
            return FixtureBetData(isFinished: false, homeGoals: homeGoals, awayGoals: awayGoals, homeCorners: 0, awayCorners: 0)
        }

        let statsSql = """
        SELECT team_id, corners FROM fixture_stats WHERE fixture_id = ?;
        """

        guard sqlite3_prepare_v2(db, statsSql, -1, &stmt, nil) == SQLITE_OK else { return nil }
        sqlite3_bind_int64(stmt, 1, Int64(fixtureId))

        var homeCorners = 0
        var awayCorners = 0

        while sqlite3_step(stmt) == SQLITE_ROW {
            let teamId = Int(sqlite3_column_int64(stmt, 0))
            let corners = Int(sqlite3_column_int(stmt, 1))

            if teamId == homeId {
                homeCorners = corners
            } else if teamId == awayId {
                awayCorners = corners
            }
        }

        sqlite3_finalize(stmt)

        return FixtureBetData(
            isFinished: true,
            homeGoals: homeGoals,
            awayGoals: awayGoals,
            homeCorners: homeCorners,
            awayCorners: awayCorners
        )
    }

    private func determineBetResult(bet: Bet, homeGoals: Int, awayGoals: Int, homeCorners: Int, awayCorners: Int) -> BetResult? {
        let totalGoals = homeGoals + awayGoals
        let totalCorners = homeCorners + awayCorners
        let lineName = bet.lineName?.lowercased() ?? ""
        let lineValue = bet.line ?? 0

        debugLog("  -> Evaluating: marketId=\(bet.marketId), lineName='\(lineName)', lineValue=\(lineValue)")

        switch bet.marketId {
        case Bet.marketGoalsTotal:
            debugLog("  -> Market: Goals Over/Under, total=\(totalGoals) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(totalGoals) > lineValue { return .won }
                if Double(totalGoals) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(totalGoals) < lineValue { return .won }
                if Double(totalGoals) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketBothTeamsScore:
            debugLog("  -> Market: Both Teams Score, homeGoals=\(homeGoals), awayGoals=\(awayGoals)")
            let bothTeamsScored = homeGoals > 0 && awayGoals > 0
            if lineName.contains("yes") {
                return bothTeamsScored ? .won : .lost
            } else if lineName.contains("no") {
                return bothTeamsScored ? .lost : .won
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'yes' or 'no'")

        case Bet.marketGoalsHome:
            debugLog("  -> Market: Total - Home, homeGoals=\(homeGoals) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(homeGoals) > lineValue { return .won }
                if Double(homeGoals) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(homeGoals) < lineValue { return .won }
                if Double(homeGoals) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketGoalsAway:
            debugLog("  -> Market: Total - Away, awayGoals=\(awayGoals) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(awayGoals) > lineValue { return .won }
                if Double(awayGoals) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(awayGoals) < lineValue { return .won }
                if Double(awayGoals) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketCornersTotal:
            // Total Corners: Over/Under
            debugLog("  -> Market: Total Corners, total=\(totalCorners) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(totalCorners) > lineValue { return .won }
                if Double(totalCorners) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(totalCorners) < lineValue { return .won }
                if Double(totalCorners) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketCornersHome:
            // Home Team Corners: Over/Under
            debugLog("  -> Market: Home Corners, home=\(homeCorners) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(homeCorners) > lineValue { return .won }
                if Double(homeCorners) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(homeCorners) < lineValue { return .won }
                if Double(homeCorners) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketCornersAway:
            // Away Team Corners: Over/Under
            debugLog("  -> Market: Away Corners, away=\(awayCorners) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(awayCorners) > lineValue { return .won }
                if Double(awayCorners) < lineValue { return .lost }
                return .push
            } else if lineName.contains("under") {
                if Double(awayCorners) < lineValue { return .won }
                if Double(awayCorners) > lineValue { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over' or 'under'")

        case Bet.marketCornersAsian:
            // Asian Corners: Home/Away handicap
            debugLog("  -> Market: Asian Corners, home=\(homeCorners), away=\(awayCorners), handicap=\(lineValue)")
            if lineName.contains("home") {
                let adjustedHome = Double(homeCorners) + lineValue
                debugLog("  -> Home bet: adjustedHome=\(adjustedHome) vs away=\(awayCorners)")
                if adjustedHome > Double(awayCorners) { return .won }
                if adjustedHome < Double(awayCorners) { return .lost }
                return .push
            } else if lineName.contains("away") {
                let adjustedAway = Double(awayCorners) + lineValue
                debugLog("  -> Away bet: adjustedAway=\(adjustedAway) vs home=\(homeCorners)")
                if adjustedAway > Double(homeCorners) { return .won }
                if adjustedAway < Double(homeCorners) { return .lost }
                return .push
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'home' or 'away'")

        case Bet.marketCornersMoneyline:
            // Most Corners: Home/Away/Draw
            debugLog("  -> Market: Most Corners, home=\(homeCorners) vs away=\(awayCorners)")
            if lineName.contains("home") || lineName == "1" {
                if homeCorners > awayCorners { return .won }
                return .lost
            } else if lineName.contains("away") || lineName == "2" {
                if awayCorners > homeCorners { return .won }
                return .lost
            } else if lineName.contains("draw") || lineName.contains("tie") || lineName == "x" {
                if homeCorners == awayCorners { return .won }
                return .lost
            }
            debugLog("  -> lineName '\(lineName)' doesn't match expected patterns")

        case Bet.marketCornersTotal3Way:
            // Total Corners 3-Way: Over/Under/Exactly
            debugLog("  -> Market: Total Corners 3-Way, total=\(totalCorners) vs line=\(lineValue)")
            if lineName.contains("over") {
                if Double(totalCorners) > lineValue { return .won }
                return .lost
            } else if lineName.contains("under") {
                if Double(totalCorners) < lineValue { return .won }
                return .lost
            } else if lineName.contains("exactly") {
                if Double(totalCorners) == lineValue { return .won }
                return .lost
            }
            debugLog("  -> lineName '\(lineName)' doesn't contain 'over', 'under', or 'exactly'")

        default:
            debugLog("  -> Unknown marketId: \(bet.marketId)")
        }

        return nil
    }
}
