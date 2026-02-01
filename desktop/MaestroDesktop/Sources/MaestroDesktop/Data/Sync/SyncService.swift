import Foundation
import SQLite3

struct SyncResult {
    let leagueName: String
    let fixtureCount: Int
    let error: String?

    var isSuccess: Bool { error == nil }
}

@MainActor
final class SyncService: ObservableObject {
    @Published var syncingLeagues: Set<Int> = []

    private let leagueRepository = LeagueRepository()

    func importLeague(id: Int, apiKey: String) async -> SyncResult {
        guard !syncingLeagues.contains(id) else {
            return SyncResult(leagueName: "", fixtureCount: 0, error: "Already syncing")
        }

        syncingLeagues.insert(id)
        defer { syncingLeagues.remove(id) }

        let client = APIFootballClient(apiKey: apiKey)

        do {
            guard let leagueData = try await client.getLeague(id: id),
                  let season = leagueData.currentSeason else {
                return SyncResult(leagueName: "", fixtureCount: 0, error: "Could not get current season")
            }

            let leagueName = leagueData.league.name
            print("Importing \(leagueName) season \(season)...")

            let fixtures = try await client.getSeasonFixtures(leagueId: id, season: season)
            print("Fetched \(fixtures.count) fixtures")

            saveFixtures(fixtures, leagueId: id, season: season)
            leagueRepository.updateSyncedAt(leagueId: id)

            print("Import complete for \(leagueName)")
            return SyncResult(leagueName: leagueName, fixtureCount: fixtures.count, error: nil)
        } catch {
            print("Import failed for league \(id): \(error.localizedDescription)")
            return SyncResult(leagueName: "", fixtureCount: 0, error: error.localizedDescription)
        }
    }

    func syncAllLeagues(apiKey: String) async {
        let leagues = leagueRepository.followedLeagues()

        for league in leagues {
            await syncLeague(id: league.id, apiKey: apiKey)
        }
    }

    func syncLeague(id: Int, apiKey: String) async -> SyncResult {
        guard !syncingLeagues.contains(id) else {
            return SyncResult(leagueName: "", fixtureCount: 0, error: "Already syncing")
        }

        syncingLeagues.insert(id)
        defer { syncingLeagues.remove(id) }

        let client = APIFootballClient(apiKey: apiKey)

        do {
            guard let leagueData = try await client.getLeague(id: id),
                  let season = leagueData.currentSeason else {
                return SyncResult(leagueName: "", fixtureCount: 0, error: "Could not get current season")
            }

            let leagueName = leagueData.league.name
            let existingCount = fixtureCount(leagueId: id, season: season)

            if existingCount == 0 {
                print("No fixtures for \(leagueName), doing full import...")
                let fixtures = try await client.getSeasonFixtures(leagueId: id, season: season)
                saveFixtures(fixtures, leagueId: id, season: season)
                leagueRepository.updateSyncedAt(leagueId: id)
                return SyncResult(leagueName: leagueName, fixtureCount: fixtures.count, error: nil)
            } else {
                print("Syncing unfinished fixtures for \(leagueName)...")
                let unfinishedIds = unfinishedFixtureIds(leagueId: id, season: season)

                for fixtureId in unfinishedIds {
                    if let fixture = try await client.getFixture(id: fixtureId) {
                        updateFixture(fixture)
                    }
                }

                leagueRepository.updateSyncedAt(leagueId: id)
                print("Sync complete for \(leagueName)")
                return SyncResult(leagueName: leagueName, fixtureCount: unfinishedIds.count, error: nil)
            }
        } catch {
            print("Sync failed for league \(id): \(error.localizedDescription)")
            return SyncResult(leagueName: "", fixtureCount: 0, error: error.localizedDescription)
        }
    }

    // MARK: - Database Operations

    private func fixtureCount(leagueId: Int, season: Int) -> Int {
        guard let db = Database.shared.handle else { return 0 }

        let sql = "SELECT COUNT(*) FROM fixtures WHERE league_id = ? AND season = ?;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return 0
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_bind_int64(statement, 2, Int64(season))

        var count = 0
        if sqlite3_step(statement) == SQLITE_ROW {
            count = Int(sqlite3_column_int64(statement, 0))
        }

        sqlite3_finalize(statement)
        return count
    }

    private func unfinishedFixtureIds(leagueId: Int, season: Int) -> [Int] {
        guard let db = Database.shared.handle else { return [] }

        let sql = "SELECT id FROM fixtures WHERE league_id = ? AND season = ? AND finished = 0;"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) != SQLITE_OK {
            return []
        }

        sqlite3_bind_int64(statement, 1, Int64(leagueId))
        sqlite3_bind_int64(statement, 2, Int64(season))

        var ids: [Int] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            ids.append(Int(sqlite3_column_int64(statement, 0)))
        }

        sqlite3_finalize(statement)
        return ids
    }

    private func saveFixtures(_ fixtures: [APIFixture], leagueId: Int, season: Int) {
        guard let db = Database.shared.handle else { return }

        ensureTables()

        for fixture in fixtures {
            saveTeam(id: fixture.teams.home.id, name: fixture.teams.home.name)
            saveTeam(id: fixture.teams.away.id, name: fixture.teams.away.name)

            let sql = """
            INSERT OR REPLACE INTO fixtures
                (id, league_id, season, home_id, away_id, timestamp, finished, home_goals, away_goals)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """

            var statement: OpaquePointer?
            if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
                sqlite3_bind_int64(statement, 1, Int64(fixture.id))
                sqlite3_bind_int64(statement, 2, Int64(leagueId))
                sqlite3_bind_int64(statement, 3, Int64(season))
                sqlite3_bind_int64(statement, 4, Int64(fixture.teams.home.id))
                sqlite3_bind_int64(statement, 5, Int64(fixture.teams.away.id))
                sqlite3_bind_int64(statement, 6, fixture.timestampMs)
                sqlite3_bind_int(statement, 7, fixture.isFinished ? 1 : 0)
                sqlite3_bind_int64(statement, 8, Int64(fixture.goals.home ?? 0))
                sqlite3_bind_int64(statement, 9, Int64(fixture.goals.away ?? 0))
                sqlite3_step(statement)
                sqlite3_finalize(statement)
            }

            if let stats = fixture.statistics, stats.count >= 2 {
                saveStats(fixtureId: fixture.id, teamId: fixture.teams.home.id, stats: stats[0], leagueId: leagueId, season: season)
                saveStats(fixtureId: fixture.id, teamId: fixture.teams.away.id, stats: stats[1], leagueId: leagueId, season: season)
            }
        }
    }

    private func updateFixture(_ fixture: APIFixture) {
        guard let db = Database.shared.handle else { return }

        let sql = """
        UPDATE fixtures SET
            finished = ?,
            home_goals = ?,
            away_goals = ?
        WHERE id = ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int(statement, 1, fixture.isFinished ? 1 : 0)
            sqlite3_bind_int64(statement, 2, Int64(fixture.goals.home ?? 0))
            sqlite3_bind_int64(statement, 3, Int64(fixture.goals.away ?? 0))
            sqlite3_bind_int64(statement, 4, Int64(fixture.id))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }

        if let stats = fixture.statistics, stats.count >= 2 {
            updateStats(fixtureId: fixture.id, teamId: fixture.teams.home.id, stats: stats[0])
            updateStats(fixtureId: fixture.id, teamId: fixture.teams.away.id, stats: stats[1])
        }
    }

    private func saveTeam(id: Int, name: String) {
        guard let db = Database.shared.handle else { return }

        let sql = "INSERT OR IGNORE INTO teams (id, name) VALUES (?, ?);"
        var statement: OpaquePointer?

        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            sqlite3_bind_int64(statement, 1, Int64(id))
            sqlite3_bind_text(statement, 2, name, -1, transient)
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    private func saveStats(fixtureId: Int, teamId: Int, stats: APIFixture.TeamStatistics, leagueId: Int, season: Int) {
        guard let db = Database.shared.handle else { return }

        let parsed = parseStats(stats.statistics)

        let sql = """
        INSERT OR REPLACE INTO fixture_stats
            (fixture_id, team_id, league_id, season, shots, shots_on_goal, shots_blocked,
             shots_in_box, shots_out_box, possession, passes, passes_completed,
             fouls, corners, offsides, yellow_cards, red_cards, xg, goals_prevented)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int64(statement, 1, Int64(fixtureId))
            sqlite3_bind_int64(statement, 2, Int64(teamId))
            sqlite3_bind_int64(statement, 3, Int64(leagueId))
            sqlite3_bind_int64(statement, 4, Int64(season))
            sqlite3_bind_int64(statement, 5, Int64(parsed.shots))
            sqlite3_bind_int64(statement, 6, Int64(parsed.shotsOnGoal))
            sqlite3_bind_int64(statement, 7, Int64(parsed.shotsBlocked))
            sqlite3_bind_int64(statement, 8, Int64(parsed.shotsInBox))
            sqlite3_bind_int64(statement, 9, Int64(parsed.shotsOutBox))
            sqlite3_bind_double(statement, 10, parsed.possession)
            sqlite3_bind_int64(statement, 11, Int64(parsed.passes))
            sqlite3_bind_int64(statement, 12, Int64(parsed.passesCompleted))
            sqlite3_bind_int64(statement, 13, Int64(parsed.fouls))
            sqlite3_bind_int64(statement, 14, Int64(parsed.corners))
            sqlite3_bind_int64(statement, 15, Int64(parsed.offsides))
            sqlite3_bind_int64(statement, 16, Int64(parsed.yellowCards))
            sqlite3_bind_int64(statement, 17, Int64(parsed.redCards))
            sqlite3_bind_double(statement, 18, parsed.xg)
            sqlite3_bind_int64(statement, 19, Int64(parsed.goalsPrevented))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    private func updateStats(fixtureId: Int, teamId: Int, stats: APIFixture.TeamStatistics) {
        guard let db = Database.shared.handle else { return }

        let parsed = parseStats(stats.statistics)

        let sql = """
        UPDATE fixture_stats SET
            shots = ?, shots_on_goal = ?, shots_blocked = ?,
            shots_in_box = ?, shots_out_box = ?, possession = ?,
            passes = ?, passes_completed = ?, fouls = ?, corners = ?,
            offsides = ?, yellow_cards = ?, red_cards = ?, xg = ?, goals_prevented = ?
        WHERE fixture_id = ? AND team_id = ?;
        """

        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_int64(statement, 1, Int64(parsed.shots))
            sqlite3_bind_int64(statement, 2, Int64(parsed.shotsOnGoal))
            sqlite3_bind_int64(statement, 3, Int64(parsed.shotsBlocked))
            sqlite3_bind_int64(statement, 4, Int64(parsed.shotsInBox))
            sqlite3_bind_int64(statement, 5, Int64(parsed.shotsOutBox))
            sqlite3_bind_double(statement, 6, parsed.possession)
            sqlite3_bind_int64(statement, 7, Int64(parsed.passes))
            sqlite3_bind_int64(statement, 8, Int64(parsed.passesCompleted))
            sqlite3_bind_int64(statement, 9, Int64(parsed.fouls))
            sqlite3_bind_int64(statement, 10, Int64(parsed.corners))
            sqlite3_bind_int64(statement, 11, Int64(parsed.offsides))
            sqlite3_bind_int64(statement, 12, Int64(parsed.yellowCards))
            sqlite3_bind_int64(statement, 13, Int64(parsed.redCards))
            sqlite3_bind_double(statement, 14, parsed.xg)
            sqlite3_bind_int64(statement, 15, Int64(parsed.goalsPrevented))
            sqlite3_bind_int64(statement, 16, Int64(fixtureId))
            sqlite3_bind_int64(statement, 17, Int64(teamId))
            sqlite3_step(statement)
            sqlite3_finalize(statement)
        }
    }

    private struct ParsedStats {
        var shots = 0
        var shotsOnGoal = 0
        var shotsBlocked = 0
        var shotsInBox = 0
        var shotsOutBox = 0
        var possession = 0.0
        var passes = 0
        var passesCompleted = 0
        var fouls = 0
        var corners = 0
        var offsides = 0
        var yellowCards = 0
        var redCards = 0
        var xg = 0.0
        var goalsPrevented = 0
    }

    private func parseStats(_ entries: [APIFixture.TeamStatistics.StatEntry]) -> ParsedStats {
        var result = ParsedStats()

        for entry in entries {
            guard let value = entry.value else { continue }

            switch entry.type {
            case "Total Shots": result.shots = value.intValue
            case "Shots on Goal": result.shotsOnGoal = value.intValue
            case "Blocked Shots": result.shotsBlocked = value.intValue
            case "Shots insidebox": result.shotsInBox = value.intValue
            case "Shots outsidebox": result.shotsOutBox = value.intValue
            case "Ball Possession": result.possession = value.floatValue / 100.0
            case "Total passes": result.passes = value.intValue
            case "Passes accurate": result.passesCompleted = value.intValue
            case "Fouls": result.fouls = value.intValue
            case "Corner Kicks": result.corners = value.intValue
            case "Offsides": result.offsides = value.intValue
            case "Yellow Cards": result.yellowCards = value.intValue
            case "Red Cards": result.redCards = value.intValue
            case "expected_goals": result.xg = value.floatValue
            case "goals_prevented": result.goalsPrevented = value.intValue
            default: break
            }
        }

        return result
    }

    private func ensureTables() {
        guard let db = Database.shared.handle else { return }

        let fixtures = """
        CREATE TABLE IF NOT EXISTS fixtures (
            id INTEGER PRIMARY KEY,
            league_id INTEGER,
            season INTEGER,
            home_id INTEGER,
            away_id INTEGER,
            timestamp INTEGER,
            finished BOOLEAN,
            home_goals INTEGER,
            away_goals INTEGER
        );
        """

        let teams = """
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );
        """

        let fixtureStats = """
        CREATE TABLE IF NOT EXISTS fixture_stats (
            fixture_id INTEGER,
            team_id INTEGER,
            league_id INTEGER,
            season INTEGER,
            shots INTEGER,
            shots_on_goal INTEGER,
            shots_blocked INTEGER,
            shots_in_box INTEGER,
            shots_out_box INTEGER,
            possession REAL,
            passes INTEGER,
            passes_completed INTEGER,
            fouls INTEGER,
            corners INTEGER,
            offsides INTEGER,
            yellow_cards INTEGER,
            red_cards INTEGER,
            xg REAL,
            goals_prevented INTEGER,
            PRIMARY KEY (fixture_id, team_id)
        );
        """

        sqlite3_exec(db, fixtures, nil, nil, nil)
        sqlite3_exec(db, teams, nil, nil, nil)
        sqlite3_exec(db, fixtureStats, nil, nil, nil)
    }
}
