// swift-tools-version: 6.2
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "MaestroDesktop",
    platforms: [
        .macOS(.v14)
    ],
    targets: [
        .executableTarget(
            name: "MaestroDesktop",
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        )
    ]
)

