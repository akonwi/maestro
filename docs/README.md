# Maestro Documentation

This directory contains cross-project product, architecture, and design documentation for Maestro.

## Architecture Decision Records

Durable architecture decisions are recorded in [`adrs/`](./adrs/). Use an ADR when a decision:

- materially affects system structure, data ownership, deployment, or integration boundaries;
- establishes a convention future work should preserve; or
- benefits from retaining its context and tradeoffs over time.

Implementation plans, temporary investigations, and routine code-level choices generally do not need ADRs.

### Adding an ADR

1. Review the existing records and related project documentation.
2. Choose the next four-digit number in sequence.
3. Create `adrs/NNNN-short-kebab-case-topic.md`.
4. Use the structure established by [ADR 0001](./adrs/0001-record-architecture-decisions.md):
   - Status
   - Context
   - Decision
   - Consequences
   - Related
5. Start with `Proposed` unless the decision has already been explicitly accepted.
6. Update the ADR rather than silently changing the decision while it is proposed. If an accepted decision changes materially, create a new ADR that supersedes it.

ADRs should describe durable decisions and their consequences without becoming implementation specifications.

## Other documents

- [Prediction Game Plan](./prediction-game-plan.md) — product scope, architecture direction, data model, and milestones for the web prediction game.
- [Scoring and Leaderboards Milestone](./scoring-and-leaderboards-plan.md) — functional scope and implementation guide for asynchronous scoring and group standings.
