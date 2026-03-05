import UIKit
import Social
import UniformTypeIdentifiers
import MobileCoreServices

private let appGroupId = "group.com.tagvault.app"
private let payloadKey = "pending_share_payload_v1"
private let openUrl = "tagvault://share-import"

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        handleShare()
    }

    private func handleShare() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            finishWithoutPayload()
            return
        }

        Task {
            if let payload = await extractPayload(from: attachments) {
                await storePayload(payload)
                await openMainApp()
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

    private func openMainApp() async {
        guard let url = URL(string: openUrl) else { return }
        let selector = sel_registerName("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: url)
                break
            }
            responder = r.next
        }
        try? await Task.sleep(nanoseconds: 500_000_000)
    }

    private func finishWithoutPayload() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
