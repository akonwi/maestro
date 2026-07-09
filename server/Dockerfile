# Multi-stage build for the Ard server.
#
#   migr-builder — builds the migr CLI from source. The published migr
#                  release is compiled CGO-free and its old `ard/sql` uses
#                  mattn/go-sqlite3, which needs CGO, so the release's SQLite
#                  path is a stub. We build it ourselves with CGO on, against
#                  the Ard version migr targets (0.24.x, which still ships the
#                  `ard/sql` stdlib module).
#   builder      — builds the Ard compiler from main and compiles the server
#                  (pure-Go SQLite via modernc, so CGO-free).
#   runtime      — slim image with both binaries, migrations, entrypoint.

# --- migr, built from source with CGO ---------------------------------------
FROM golang:1.26-alpine AS migr-builder

RUN apk add --no-cache git gcc musl-dev

# migr needs an Ard that still ships the ard/io, ard/argv, ard/sql, ard/decode
# stdlib modules AND has migr's newer syntax. 0.24.0 lacks the syntax; current
# dev dropped those stdlib modules. 0.25.0 satisfies both.
ARG MIGR_ARD_VERSION=v0.25.0
WORKDIR /build
RUN git clone https://github.com/akonwi/ard.git ard-migr
WORKDIR /build/ard-migr/compiler
RUN git checkout ${MIGR_ARD_VERSION}
RUN go mod download
ENV CGO_ENABLED=1
RUN go build --tags=goexperiment.jsonv2 -o /usr/local/bin/ard-migr .

# Build migr with CGO on so mattn/go-sqlite3 is functional (the published
# release is CGO-free and its SQLite path is a non-functional stub). Pinned
# to a known-good commit that builds against Ard 0.25.0.
ARG MIGR_COMMIT=9fa4b52365b20642329feb75fc3b841bc3b74390
WORKDIR /build
RUN git clone https://github.com/akonwi/migr.git
WORKDIR /build/migr
RUN git checkout ${MIGR_COMMIT}
ENV CGO_ENABLED=1
RUN ard-migr build main.ard --out /out/migr

# --- Build the Ard compiler + server ----------------------------------------
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git gcc musl-dev

# TODO: pin to a tagged Ard release once one lands that matches local dev.
# For now we track main to dogfood the unreleased compiler.
WORKDIR /build
RUN git clone https://github.com/akonwi/ard.git
WORKDIR /build/ard/compiler
RUN go mod download
ENV CGO_ENABLED=1
RUN go build --tags=goexperiment.jsonv2 -o /usr/local/bin/ard .

# modernc.org/sqlite is pure Go, so a static (CGO-free) server binary is fine
# and runs cleanly on a minimal runtime image.
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN ard build main.ard --out /out/maestro-server

# --- Runtime -----------------------------------------------------------------
FROM alpine:latest

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /out/maestro-server /usr/local/bin/maestro-server
COPY --from=migr-builder /out/migr /usr/local/bin/migr
COPY migrations /app/migrations
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /usr/local/bin/maestro-server /usr/local/bin/migr /app/entrypoint.sh

# Zeabur mounts a persistent volume at /data; the SQLite file lives there.
ENV PORT=8080
ENV HOST=0.0.0.0
ENV DATABASE_URL=/data/maestro.db
EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
