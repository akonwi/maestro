import SwiftUI

struct Toast: Equatable {
    let message: String
    let isError: Bool

    static func success(_ message: String) -> Toast {
        Toast(message: message, isError: false)
    }

    static func error(_ message: String) -> Toast {
        Toast(message: message, isError: true)
    }
}

struct ToastView: View {
    let toast: Toast

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: toast.isError ? "xmark.circle.fill" : "checkmark.circle.fill")
                .foregroundStyle(toast.isError ? .red : .green)
            Text(toast.message)
                .font(.callout)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
        .shadow(radius: 4)
    }
}

struct ToastModifier: ViewModifier {
    @Binding var toast: Toast?

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if let toast {
                    ToastView(toast: toast)
                        .padding(.bottom, 20)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .onAppear {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                                withAnimation {
                                    self.toast = nil
                                }
                            }
                        }
                }
            }
            .animation(.easeInOut(duration: 0.2), value: toast)
    }
}

extension View {
    func toast(_ toast: Binding<Toast?>) -> some View {
        modifier(ToastModifier(toast: toast))
    }
}
