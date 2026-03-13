import SwiftUI

struct TeamPositionView: View {
    let position: Int?
    let size: TeamPositionSize
    
    enum TeamPositionSize {
        case small
        case medium
        case large
        
        var font: Font {
            switch self {
            case .small: return .caption2
            case .medium: return .caption
            case .large: return .subheadline
            }
        }
        
        var padding: EdgeInsets {
            switch self {
            case .small: return EdgeInsets(top: 2, leading: 4, bottom: 2, trailing: 4)
            case .medium: return EdgeInsets(top: 3, leading: 6, bottom: 3, trailing: 6)
            case .large: return EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8)
            }
        }
        
        var cornerRadius: CGFloat {
            switch self {
            case .small: return 3
            case .medium: return 4
            case .large: return 6
            }
        }
    }
    
    private var backgroundColor: Color {
        Color.gray.opacity(0.15)
    }
    
    private var foregroundColor: Color {
        .secondary
    }
    
    private var displayText: String {
        guard let position = position else { return "—" }
        return "\(position)"
    }
    
    var body: some View {
        Text(displayText)
            .font(size.font)
            .fontWeight(.medium)
            .foregroundStyle(foregroundColor)
            .padding(size.padding)
            .background(
                RoundedRectangle(cornerRadius: size.cornerRadius)
                    .fill(backgroundColor)
            )
    }
}

// Helper view for displaying position with suffix (e.g., "2nd")
struct TeamPositionWithSuffix: View {
    let position: Int?
    let size: TeamPositionView.TeamPositionSize
    
    private var displayText: String {
        guard let position = position else { return "—" }
        
        let suffix: String
        switch position % 10 {
        case 1 where position != 11:
            suffix = "st"
        case 2 where position != 12:
            suffix = "nd"
        case 3 where position != 13:
            suffix = "rd"
        default:
            suffix = "th"
        }
        
        return "\(position)\(suffix)"
    }
    
    var body: some View {
        Text(displayText)
            .font(size.font)
            .fontWeight(.medium)
            .foregroundStyle(.secondary)
    }
}

#Preview {
    VStack(spacing: 16) {
        HStack(spacing: 8) {
            TeamPositionView(position: 1, size: .small)
            TeamPositionView(position: 2, size: .small)
            TeamPositionView(position: 3, size: .small)
            TeamPositionView(position: 8, size: .small)
            TeamPositionView(position: 15, size: .small)
            TeamPositionView(position: nil, size: .small)
        }
        
        HStack(spacing: 8) {
            TeamPositionView(position: 1, size: .medium)
            TeamPositionView(position: 2, size: .medium)
            TeamPositionView(position: 5, size: .medium)
            TeamPositionView(position: 10, size: .medium)
            TeamPositionView(position: 16, size: .medium)
        }
        
        HStack(spacing: 8) {
            TeamPositionView(position: 1, size: .large)
            TeamPositionView(position: 3, size: .large)
            TeamPositionView(position: 6, size: .large)
            TeamPositionView(position: 9, size: .large)
            TeamPositionView(position: 14, size: .large)
        }
        
        Divider()
        
        VStack(alignment: .leading, spacing: 4) {
            Text("With suffix:")
            HStack(spacing: 12) {
                TeamPositionWithSuffix(position: 1, size: .medium)
                TeamPositionWithSuffix(position: 2, size: .medium)
                TeamPositionWithSuffix(position: 3, size: .medium)
                TeamPositionWithSuffix(position: 11, size: .medium)
                TeamPositionWithSuffix(position: nil, size: .medium)
            }
        }
    }
    .padding()
}