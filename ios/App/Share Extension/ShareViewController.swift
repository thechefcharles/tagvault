import UIKit
import Social
import UniformTypeIdentifiers
import MobileCoreServices
import os.log

private let appGroupId = "group.com.tagvault.app"
private let queueKey = "pending_share_payload_queue_v1"
private let legacyKey = "pending_share_payload_v1"
private let openUrl = "tagvault://share-import"
private let log = OSLog(subsystem: "com.tagvault.app.ShareExtension", category: "Share")

class ShareViewController: UIViewController {

    private var statusLabel: UILabel!
    private var hintLabel: UILabel!
    private var openButton: UIButton!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        statusLabel = UILabel()
        statusLabel.text = "Saving to TagVault…"
        statusLabel.textColor = .label
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)

        hintLabel = UILabel()
        hintLabel.text = "If the app didn't open, open TagVault from your home screen and go to Share Import."
        hintLabel.font = .systemFont(ofSize: 12)
        hintLabel.textColor = .secondaryLabel
        hintLabel.textAlignment = .center
        hintLabel.numberOfLines = 0
        hintLabel.isHidden = true
        hintLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(hintLabel)

        openButton = UIButton(type: .system)
        openButton.setTitle("Open TagVault", for: .normal)
        openButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        openButton.isHidden = true
        openButton.addTarget(self, action: #selector(openTapped), for: .touchUpInside)
        openButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(openButton)

        NSLayoutConstraint.activate([
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -36),
            statusLabel.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            statusLabel.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24),
            openButton.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 20),
            openButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            hintLabel.topAnchor.constraint(equalTo: openButton.bottomAnchor, constant: 16),
            hintLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            hintLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
        ])
        handleShare()
    }

    @objc private func openTapped() {
        Task {
            _ = await openMainApp()
            await MainActor.run { finishWithoutPayload() }
        }
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
                await MainActor.run {
                    statusLabel.text = "Saved!"
                    openButton.isHidden = false
                    hintLabel.isHidden = false
                }
            } else {
                os_log(.info, log: log, "No payload extracted from attachments")
                await MainActor.run { finishWithoutPayload() }
            }
        }
    }

    private func openMainApp() async -> Bool {
        guard let url = URL(string: openUrl) else { return false }
        let selector = sel_registerName("openURL:")
        var responder: UIResponder? = self
        while let r = responder {
            if r.responds(to: selector) {
                r.perform(selector, with: url)
                return true
            }
            responder = r.next
        }
        return false
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
        var queue: [[String: Any]] = []
        if let queueString = ud.string(forKey: queueKey),
           let data = queueString.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            queue = arr
        } else if let legacyString = ud.string(forKey: legacyKey),
                  let data = legacyString.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            queue = [dict]
            ud.removeObject(forKey: legacyKey)
        }
        queue.append(payload)
        guard let outData = try? JSONSerialization.data(withJSONObject: queue),
              let outString = String(data: outData, encoding: .utf8) else { return }
        ud.set(outString, forKey: queueKey)
        ud.synchronize()
    }

    private func finishWithoutPayload() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
