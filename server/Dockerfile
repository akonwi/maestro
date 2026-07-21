# Multi-stage build for the Ard server.
#
#   ard       — downloads the published Ard 0.30.0 compiler.
#   migr      — downloads the published migr release.
#   builder   — compiles the server with Ard 0.30.0.
#   runtime   — slim image with both binaries, migrations, and entrypoint.

# --- Published Ard compiler --------------------------------------------------
FROM alpine:latest AS ard

ARG ARD_VERSION=v0.30.0
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl \
  && mkdir -p /out \
  && curl -fsSL "https://github.com/akonwi/ard/releases/download/${ARD_VERSION}/ard_${ARD_VERSION}_linux_${TARGETARCH}.tar.gz" \
    | tar -xz -C /out

# --- Published migr release --------------------------------------------------
FROM alpine:latest AS migr

ARG MIGR_VERSION=v0.1.1
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl \
  && mkdir -p /out \
  && curl -fsSL "https://github.com/akonwi/migr/releases/download/${MIGR_VERSION}/migr-linux-${TARGETARCH}.tar.gz" \
    | tar -xz -C /out

# --- Build the server with the same Ard release -----------------------------
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git
COPY --from=ard /out/ard /usr/local/bin/ard

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN ard deps fetch
ENV CGO_ENABLED=0
RUN ard build main.ard --out /out/maestro-server

# --- Runtime -----------------------------------------------------------------
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /out/maestro-server /usr/local/bin/maestro-server
COPY --from=migr /out/migr /usr/local/bin/migr
COPY migrations /app/migrations
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /usr/local/bin/maestro-server /usr/local/bin/migr /app/entrypoint.sh

# Zeabur mounts a persistent volume at /data; the SQLite file lives there.
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_URL=/data/maestro.db
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
