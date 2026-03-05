package com.tagvault.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Base64
import android.util.Log
import org.json.JSONObject

/**
 * Handles ACTION_SEND / ACTION_SEND_MULTIPLE intents.
 * Normalizes shared content to the standard payload shape and stores in SharedPreferences.
 * Call from MainActivity.onCreate() when intent.action is Intent.ACTION_SEND or ACTION_SEND_MULTIPLE.
 *
 * Payload shape: { kind: "url"|"text"|"file", url?, text?, fileName?, mimeType?, fileBase64? }
 */
object ShareIntentHandler {
    private const val TAG = "ShareIntentHandler"
    private const val PREFS_NAME = "share_payload_prefs"
    private const val QUEUE_KEY = "pending_share_payload_queue_v1"
    private const val LEGACY_KEY = "pending_share_payload_v1"
    private const val MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

    fun handleIntent(context: Context, intent: Intent?): Boolean {
        if (intent == null) return false
        val action = intent.action
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return false

        val payload = when (action) {
            Intent.ACTION_SEND -> extractSinglePayload(context, intent)
            Intent.ACTION_SEND_MULTIPLE -> extractMultiplePayload(context, intent)
            else -> null
        } ?: return false

        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            var queueJson = prefs.getString(QUEUE_KEY, null)
            if (queueJson == null) {
                val legacy = prefs.getString(LEGACY_KEY, null)
                queueJson = if (legacy != null) {
                    org.json.JSONArray().put(JSONObject(legacy)).put(payload).toString()
                } else {
                    org.json.JSONArray().put(payload).toString()
                }
                prefs.edit().putString(QUEUE_KEY, queueJson).remove(LEGACY_KEY).apply()
            } else {
                val arr = org.json.JSONArray(queueJson)
                arr.put(payload)
                prefs.edit().putString(QUEUE_KEY, arr.toString()).apply()
            }
            return true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to store share payload", e)
            return false
        }
    }

    private fun extractSinglePayload(context: Context, intent: Intent): JSONObject? {
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }
        if (uri != null) {
            val mime = intent.type ?: context.contentResolver.getType(uri) ?: "application/octet-stream"
            return extractFilePayload(context, uri, mime)
        }
        intent.getStringExtra(Intent.EXTRA_TEXT)?.let { text ->
            if (!text.isBlank()) {
                val trimmed = text.trim()
                if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                    return JSONObject().apply {
                        put("kind", "url")
                        put("url", trimmed)
                    }
                }
                return JSONObject().apply {
                    put("kind", "text")
                    put("text", trimmed)
                }
            }
        }
        return null
    }

    private fun extractMultiplePayload(context: Context, intent: Intent): JSONObject? {
        val uris = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
        }
        if (uris.isNullOrEmpty()) return null
        val uri = uris.first()
        val mime = intent.type ?: context.contentResolver.getType(uri) ?: "application/octet-stream"
        return extractFilePayload(context, uri, mime)
    }

    private fun extractFilePayload(context: Context, uri: Uri, mimeType: String): JSONObject? {
        return try {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val bytes = stream.readBytes()
                if (bytes.size > MAX_FILE_SIZE_BYTES) return null
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val fileName = uri.lastPathSegment ?: "shared_file"
                JSONObject().apply {
                    put("kind", "file")
                    put("fileName", fileName)
                    put("mimeType", mimeType)
                    put("fileBase64", base64)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read shared file", e)
            null
        }
    }
}
