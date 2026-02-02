// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Maestro",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "Maestro",
            path: "Sources/MaestroDesktop",
            resources: [
                .process("Resources")
            ],
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        )
    ]
)
