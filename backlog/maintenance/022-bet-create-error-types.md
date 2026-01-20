# Union Error Type for Bet Creation

## Problem

The `bets::create()` function returns `Bet!Str` but the error could be either bad input (validation error) or a database error. Using a union type would allow callers to distinguish between these cases.

## Location

`api/server/bets.ard` line 228

```ard
// todo: use a union for the error type - could be bad inputs or db error
fn create(db: sql::Database, input: Dynamic) Bet!Str {
```

## Proposed Solution

Define a union type for the error:

```ard
union CreateBetError {
  InvalidInput(Str),
  DatabaseError(Str),
}

fn create(db: sql::Database, input: Dynamic) Bet!CreateBetError {
  let match_id = try decode_match_id(input) -> errs {
    Result::err(CreateBetError::InvalidInput(errs.at(0).to_str()))
  }
  // ... validation errors use InvalidInput

  let row = try insert.first(values) -> err {
    Result::err(CreateBetError::DatabaseError(err))
  }
  // ... db errors use DatabaseError
}
```

This would allow the HTTP handler to return 400 for `InvalidInput` and 500 for `DatabaseError`.

## Files to Modify

- `api/server/bets.ard`
- `api/server/main.ard` (update handler to match on error type)

## Impact

Low - improves type safety and error handling correctness
