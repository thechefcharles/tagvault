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
private const val QUEUE_KEY = "pending_share_payload_queue_v1"
private const val LEGACY_KEY = "pending_share_payload_v1"
private const val MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

@CapacitorPlugin(name = "SharePayload")
class SharePayloadPlugin : Plugin() {

    private val prefs by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private fun parsePayload(obj: JSONObject): JSObject {
        val payload = JSObject()
        payload.put("kind", obj.optString("kind", "text"))
        if (obj.has("url")) payload.put("url", obj.getString("url"))
        if (obj.has("text")) payload.put("text", obj.getString("text"))
        if (obj.has("fileName")) payload.put("fileName", obj.getString("fileName"))
        if (obj.has("mimeType")) payload.put("mimeType", obj.getString("mimeType"))
        if (obj.has("fileBase64")) payload.put("fileBase64", obj.getString("fileBase64"))
        return payload
    }

    @PluginMethod
    fun getPendingPayload(call: PluginCall) {
        try {
            var queueJson = prefs.getString(QUEUE_KEY, null)
            if (queueJson == null) {
                val legacy = prefs.getString(LEGACY_KEY, null)
                if (legacy != null) {
                    val arr = org.json.JSONArray().put(JSONObject(legacy))
                    queueJson = arr.toString()
                    prefs.edit().putString(QUEUE_KEY, queueJson).remove(LEGACY_KEY).apply()
                }
            }
            if (queueJson == null || queueJson == "[]") {
                call.resolve(JSObject().put("payloads", org.json.JSONArray()))
                return
            }
            val arr = org.json.JSONArray(queueJson)
            val payloadsArray = org.json.JSONArray()
            for (i in 0 until arr.length()) {
                payloadsArray.put(parsePayload(arr.getJSONObject(i)))
            }
            call.resolve(JSObject().put("payloads", payloadsArray))
        } catch (e: Exception) {
            prefs.edit().remove(QUEUE_KEY).remove(LEGACY_KEY).apply()
            call.resolve(JSObject().put("payloads", org.json.JSONArray()))
        }
    }

    @PluginMethod
    fun clearPendingPayload(call: PluginCall) {
        val index = call.getInt("index", -1)
        if (index < 0) {
            prefs.edit().remove(QUEUE_KEY).apply()
            call.resolve()
            return
        }
        try {
            val queueJson = prefs.getString(QUEUE_KEY, null) ?: run {
                call.resolve()
                return
            }
            val arr = org.json.JSONArray(queueJson)
            if (index >= arr.length()) {
                call.resolve()
                return
            }
            val newArr = org.json.JSONArray()
            for (i in 0 until arr.length()) {
                if (i != index) newArr.put(arr.get(i))
            }
            if (newArr.length() == 0) {
                prefs.edit().remove(QUEUE_KEY).apply()
            } else {
                prefs.edit().putString(QUEUE_KEY, newArr.toString()).apply()
            }
        } catch (e: Exception) {
            prefs.edit().remove(QUEUE_KEY).apply()
        }
        call.resolve()
    }
}
