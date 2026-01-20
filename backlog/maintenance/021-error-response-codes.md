# Proper HTTP Error Response Codes

## Problem

The `/leagues` POST and PUT endpoints return 500 for all errors, including input validation failures. Decode errors (bad input) should return 400 Bad Request, not 500 Internal Server Error.

## Location

`api/server/main.ard` lines 202-203, 215-217

```ard
// todo: not all failures are 500
let input = try leagues::decode_follow_request(body) -> errs { internal_error(errs.at(0).to_str()) }
```

## Proposed Solution

Create a `bad_request(msg: Str)` helper similar to `internal_error()` and use it for decode/validation errors:

```ard
fn bad_request(msg: Str) http::Response {
  mut headers = res_headers
  headers.drop("Content-Type")
  http::Response{
    status: 400,
    body: msg,
    headers: headers,
  }
}
```

Then distinguish between input validation errors and actual server errors:

```ard
let input = try leagues::decode_follow_request(body) -> errs { bad_request(errs.at(0).to_str()) }
try leagues::create(conn, input) -> internal_error
```

## Files to Modify

- `api/server/main.ard`

## Impact

Low - improves API correctness and debugging experience
