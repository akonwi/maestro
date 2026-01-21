# API-Football Rate Limit Handling

## Problem

The `fapi.ard` module's `send_request()` function doesn't handle rate limiting from API-Football. When multiple requests are made in parallel (e.g., fetching stats for 20 fixtures), the API returns 429 responses which are not handled gracefully, causing failures.

Current behavior:
- Ignores HTTP status codes (assumes all responses are 200)
- Doesn't read rate limit headers
- No retry logic on 429
- Parallel requests easily trigger rate limits

## Location

`api/server/fapi.ard` - `send_request()` function (lines 11-24)

```ard
fn send_request(url: Str) Dynamic!Str {
  let req = http::Request{...}
  let res = try http::send(req) -> err { Result::err("Error fetching {url}: {err}") }
  // ← No status check here
  let body = try decode::from_json(res.body) -> found { ... }
  Result::ok(body)
}
```

## Proposed Solution

Update `send_request()` to handle rate limiting with retry logic:

```ard
fn send_request(url: Str) Dynamic!Str {
  mut attempts = 0
  while attempts < 3 {
    let req = http::Request{
      method: http::Method::Get,
      url: url,
      headers: [
        "x-rapidapi-key": config::api_key(),
        "Accept": "application/json",
      ],
    }

    let res = try http::send(req) -> err {
      Result::err("Error fetching {url}: {err}")
    }

    match res.status {
      200 => {
        let body = try decode::from_json(res.body) -> found {
          Result::err("Unable to parse JSON for {url}. Found {found}")
        }
        return Result::ok(body)
      },
      429 => {
        // Rate limited - read Retry-After header or default to 1 second
        let wait_str = res.headers.get("Retry-After").or("1")
        let wait_seconds = Int::from_str(wait_str).or(1)
        async::sleep(duration::from_seconds(wait_seconds))
        attempts =+ 1
      },
      status => {
        Result::err("HTTP {status} for {url}: {res.body}")
      }
    }
  }

  Result::err("Max retries exceeded for {url}")
}
```

## API-Football Rate Limit Headers

- `x-ratelimit-requests-remaining`: Remaining requests in current window
- `x-ratelimit-requests-limit`: Total requests allowed
- `Retry-After`: Seconds to wait before retrying (on 429)

## Additional Considerations

- Could log remaining requests for monitoring
- Could implement request queuing/throttling to proactively avoid 429s
- Cache layer already helps reduce requests for repeated data

## Files to Modify

- `api/server/fapi.ard`

## Impact

Medium - Improves reliability of all external API calls, especially for non-followed leagues where data isn't cached locally.
