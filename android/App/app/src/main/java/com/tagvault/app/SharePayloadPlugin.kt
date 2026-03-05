package com.tagvault.app

import android.content.Context
import android.content.Intent
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.FileInputStream

private const val PREFS_NAME = "share_payload_prefs"
private const val PAYLOAD_KEY = "pending_share_payload_v1"
private const val MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

@CapacitorPlugin(name = "SharePayload")
class SharePayloadPlugin : Plugin() {

    private val prefs by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @PluginMethod
    fun getPendingPayload(call: PluginCall) {
        val jsonString = prefs.getString(PAYLOAD_KEY, null) ?: run {
            call.resolve(JSObject().put("payload", JSObject.NULL))
            return
        }
        try {
            val obj = JSONObject(jsonString)
            val payload = JSObject()
            payload.put("kind", obj.optString("kind", "text"))
            if (obj.has("url")) payload.put("url", obj.getString("url"))
            if (obj.has("text")) payload.put("text", obj.getString("text"))
            if (obj.has("fileName")) payload.put("fileName", obj.getString("fileName"))
            if (obj.has("mimeType")) payload.put("mimeType", obj.getString("mimeType"))
            if (obj.has("fileBase64")) payload.put("fileBase64", obj.getString("fileBase64"))
            call.resolve(JSObject().put("payload", payload))
        } catch (e: Exception) {
            prefs.edit().remove(PAYLOAD_KEY).apply()
            call.resolve(JSObject().put("payload", JSObject.NULL))
        }
    }

    @PluginMethod
    fun clearPendingPayload(call: PluginCall) {
        prefs.edit().remove(PAYLOAD_KEY).apply()
        call.resolve()
    }
}
