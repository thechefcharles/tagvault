import Capacitor

private let appGroupId = "group.com.tagvault.app"
private let payloadKey = "pending_share_payload_v1"

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
        guard let jsonString = ud.string(forKey: payloadKey) else {
            call.resolve(["payload": NSNull()])
            return
        }
        guard let data = jsonString.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            ud.removeObject(forKey: payloadKey)
            call.resolve(["payload": NSNull()])
            return
        }
        call.resolve(["payload": dict])
    }

    @objc func clearPendingPayload(_ call: CAPPluginCall) {
        userDefaults?.removeObject(forKey: payloadKey)
        call.resolve()
    }
}
