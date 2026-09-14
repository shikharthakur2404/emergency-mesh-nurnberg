package com.emergencymeshapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Emergency Mesh Nürnberg — Persistent Background Radio Service
 * Maintains CPU execution & socket listener through Android Doze and deep sleep cycles.
 */
class EmergencyMeshService : Service() {

    private val tag = "EmergencyMeshService"
    private val channelId = "emergency_mesh_radio_channel"
    private val notificationId = 8888
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()

        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as? PowerManager
            wakeLock = powerManager?.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "EmergencyMesh::RadioServiceWakeLock"
            )?.apply {
                setReferenceCounted(false)
                acquire()
            }
            Log.d(tag, "Acquired PartialWakeLock for continuous mesh radio operation")
        } catch (e: Exception) {
            Log.w(tag, "Could not acquire PartialWakeLock: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification: Notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Emergency Mesh Nürnberg")
            .setContentText("🟢 P2P-Funk & Relais aktiv · Port 8888")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        startForeground(notificationId, notification)
        return START_STICKY
    }

    override fun onDestroy() {
        try {
            wakeLock?.let {
                if (it.isHeld) it.release()
            }
        } catch (e: Exception) {
            Log.w(tag, "Error releasing WakeLock: ${e.message}")
        }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Katastrophenschutz Mesh Radio",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Hält den autonomen P2P-Notfallfunk im Hintergrund aufrecht"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}
