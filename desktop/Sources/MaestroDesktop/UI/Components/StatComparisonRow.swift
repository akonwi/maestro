import SwiftUI

struct StatComparisonRow: View {
    let stat: StatComparison

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Text(stat.homeDisplay)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(width: 50, alignment: .leading)

                Spacer()

                Text(stat.label)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                Text(stat.awayDisplay)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .frame(width: 50, alignment: .trailing)
            }

            GeometryReader { geometry in
                HStack(spacing: 2) {
                    // Home bar
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.accentColor)
                        .frame(width: max(geometry.size.width * stat.homeRatio - 1, 0))

                    // Away bar
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Color.accentColor.opacity(0.4))
                        .frame(width: max(geometry.size.width * stat.awayRatio - 1, 0))
                }
            }
            .frame(height: 8)
        }
        .padding(.vertical, 4)
    }
}
