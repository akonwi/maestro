# 0001: Record Architecture Decisions

## Status

Accepted

## Context

Maestro contains multiple product surfaces and uses architecture and product plans to guide implementation. As the systems evolve, important decisions can otherwise become difficult to distinguish from temporary plans or recover from code and commit history alone.

The project needs a lightweight way to preserve the context, decision, and consequences of durable architectural choices.

## Decision

We will document significant architecture decisions as Architecture Decision Records in `docs/adrs/`.

Each ADR will:

- use the next sequential four-digit number;
- use a short kebab-case filename such as `0002-example-decision.md`;
- contain Status, Context, Decision, Consequences, and Related sections;
- begin as `Proposed` unless the decision has already been explicitly accepted; and
- remain as a historical record after acceptance.

When an accepted decision changes materially, a new ADR will supersede the earlier record rather than rewriting its history. Small clarifications that do not alter the decision may be made in place.

## Consequences

- Important decisions have a stable, reviewable history.
- Contributors must decide when a change is architecturally significant enough to warrant an ADR.
- ADRs require modest maintenance as proposals are accepted, rejected, deprecated, or superseded.
- Plans and implementation details remain in their appropriate documents instead of being duplicated into ADRs.

## Related

- [Documentation index](../README.md)
- [Prediction Game Plan](../prediction-game-plan.md)
