package com.anonymous.bulwarkmobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

// Process-wide holder for the most recent ACTION_SEND / ACTION_SEND_MULTIPLE
// intent (the system share sheet). MainActivity fills this on onCreate /
// onNewIntent; JS drains it via BulwarkFcm.getInitialShare or reacts to the
// live "app:share" event and opens the composer.
object ShareIntentStore {
    @Volatile
    private var pending: SharePayload? = null

    fun consume(): SharePayload? {
        val value = pending
        pending = null
        return value
    }

    fun captureFromIntent(intent: Intent?): SharePayload? {
        val action = intent?.action ?: return null
        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return null

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.take(MAX_TEXT)
        val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)?.take(512)
        val uris = mutableListOf<Uri>()
        if (action == Intent.ACTION_SEND) {
            streamExtra(intent)?.let { uris.add(it) }
        } else {
            streamExtras(intent)?.let { uris.addAll(it) }
        }
        val type = intent.type

        if (text.isNullOrBlank() && uris.isEmpty()) return null
        val payload = SharePayload(
            text = text,
            subject = subject,
            uris = uris.map { it.toString() },
            mimeTypes = uris.map { type ?: "" },
        )
        pending = payload
        // Clear so a later lifecycle event doesn't replay this share.
        intent.removeExtra(Intent.EXTRA_TEXT)
        intent.removeExtra(Intent.EXTRA_SUBJECT)
        intent.removeExtra(Intent.EXTRA_STREAM)
        intent.action = Intent.ACTION_MAIN
        return payload
    }

    @Suppress("DEPRECATION")
    private fun streamExtra(intent: Intent): Uri? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableExtra(Intent.EXTRA_STREAM)
        }

    @Suppress("DEPRECATION")
    private fun streamExtras(intent: Intent): List<Uri>? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
        }

    data class SharePayload(
        val text: String?,
        val subject: String?,
        val uris: List<String>,
        val mimeTypes: List<String>,
    ) {
        fun toMap(): WritableMap = Arguments.createMap().apply {
            if (text != null) putString("text", text)
            if (subject != null) putString("subject", subject)
            putArray("uris", Arguments.fromList(uris))
            putArray("mimeTypes", Arguments.fromList(mimeTypes))
        }
    }

    // 1 MiB of shared text is plenty; anything bigger is an attachment.
    private const val MAX_TEXT = 1 * 1024 * 1024
}
