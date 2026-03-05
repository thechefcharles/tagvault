import Capacitor

private let appGroupId = "group.com.tagvault.app"
private let queueKey = "pending_share_payload_queue_v1"
private let legacyKey = "pending_share_payload_v1"

@objc(SharePayloadPlugin)
public class SharePayloadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharePayloadPlugin"
    public let jsName = "SharePayload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPendingPayload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingPayload", returnType: CAPPluginReturnPromise)
    ]

    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    @objc func getPendingPayload(_ call: CAPPluginCall) {
        guard let ud = userDefaults else {
            call.reject("App Group not configured")
            return
        }
        var queue: [[String: Any]] = []
        if let queueString = ud.string(forKey: queueKey),
           let data = queueString.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            queue = arr
        } else if let legacyString = ud.string(forKey: legacyKey),
                  let data = legacyString.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            queue = [dict]
            if let migrated = try? JSONSerialization.data(withJSONObject: queue), let str = String(data: migrated, encoding: .utf8) {
                ud.set(str, forKey: queueKey)
            }
            ud.removeObject(forKey: legacyKey)
        }
        call.resolve(["payloads": queue])
    }

    @objc func clearPendingPayload(_ call: CAPPluginCall) {
        guard let ud = userDefaults else {
            call.resolve()
            return
        }
        guard let index = call.getInt("index") else {
            ud.removeObject(forKey: queueKey)
            call.resolve()
            return
        }
        guard var queue = ud.string(forKey: queueKey).flatMap({ $0.data(using: .utf8) }).flatMap({ try? JSONSerialization.jsonObject(with: $0) as? [[String: Any]] }),
              index >= 0, index < queue.count else {
            call.resolve()
            return
        }
        queue.remove(at: index)
        if queue.isEmpty {
            ud.removeObject(forKey: queueKey)
        } else if let data = try? JSONSerialization.data(withJSONObject: queue), let str = String(data: data, encoding: .utf8) {
            ud.set(str, forKey: queueKey)
        }
        ud.synchronize()
        call.resolve()
    }
}
