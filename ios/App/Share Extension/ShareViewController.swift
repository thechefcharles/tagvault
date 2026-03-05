import UIKit
import Social
import UniformTypeIdentifiers
import MobileCoreServices
import os.log

private let appGroupId = "group.com.tagvault.app"
private let payloadKey = "pending_share_payload_v1"
private let openUrl = "tagvault://share-import"
private let log = OSLog(subsystem: "com.tagvault.app.ShareExtension", category: "Share")

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        let label = UILabel()
        label.text = "Saving to TagVault…"
        label.textColor = .label
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
        handleShare()
    }

    private func handleShare() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            os_log(.info, log: log, "No input items or attachments")
            finishWithoutPayload()
            return
        }

        Task {
            if let payload = await extractPayload(from: attachments) {
                os_log(.info, log: log, "Extracted payload kind=%{public}@", payload["kind"] as? String ?? "?")
                await storePayload(payload)
                let opened = await openMainApp()
                os_log(.info, log: log, "openMainApp result=%{public}@", opened ? "true" : "false")
                try? await Task.sleep(nanoseconds: 800_000_000)
            } else {
                os_log(.info, log: log, "No payload extracted from attachments")
            }
            finishWithoutPayload()
        }
    }

    private func extractPayload(from attachments: [NSItemProvider]) async -> [String: Any]? {
        for provider in attachments {
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                if let url = try? await provider.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL {
                    return [
                        "kind": "url",
                        "url": url.absoluteString
                    ]
                }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                if let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String {
                    return [
                        "kind": "text",
                        "text": text
                    ]
                }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                if let payload = await extractFilePayload(from: provider, mimeType: "image/*") {
                    return payload
                }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                if let payload = await extractFilePayload(from: provider, mimeType: "video/*") {
                    return payload
                }
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
                if let payload = await extractFilePayload(from: provider, mimeType: "application/octet-stream") {
                    return payload
                }
            }
        }
        return nil
    }

    private func extractFilePayload(from provider: NSItemProvider, mimeType: String) async -> [String: Any]? {
        let maxSizeBytes = 20 * 1024 * 1024
        if let url = try? await provider.loadItem(forTypeIdentifier: UTType.data.identifier) as? URL {
            let fileName = url.lastPathComponent
            guard let data = try? Data(contentsOf: url),
                  data.count <= maxSizeBytes else {
                return nil
            }
            let base64 = data.base64EncodedString()
            return [
                "kind": "file",
                "fileName": fileName,
                "mimeType": mimeType,
                "fileBase64": base64
            ]
        }
        return nil
    }

    private func storePayload(_ payload: [String: Any]) async {
        guard let ud = UserDefaults(suiteName: appGroupId) else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: data, encoding: .utf8) else { return }
        ud.set(jsonString, forKey: payloadKey)
        ud.synchronize()
    }

    private func openMainApp() async -> Bool {
        guard let url = URL(string: openUrl) else { return false }
        let selector = sel_registerName("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: url)
                os_log(.info, log: log, "openURL performed on responder")
                return true
            }
            responder = r.next
        }
        os_log(.error, log: log, "No responder for openURL: - main app may not open")
        return false
    }

    private func finishWithoutPayload() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
