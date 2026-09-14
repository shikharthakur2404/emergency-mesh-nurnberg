package com.emergencymeshapp

import android.content.Context
import android.content.Intent
import android.net.wifi.WifiManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Emergency Mesh Nürnberg — Native Android Hardware Radio Driver
 * Implements physical over-the-air packet broadcasting via raw UDP sockets,
 * dynamic multi-interface directed subnet broadcasting, and 24/7 Foreground Service survival.
 */
class UdpMeshModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val tag = "UdpMeshModule"
    private var socket: DatagramSocket? = null
    private var listenThread: Thread? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val isListening = AtomicBoolean(false)

    override fun getName(): String = "UdpMeshModule"

    @ReactMethod
    fun startRadio(port: Int, promise: Promise) {
        try {
            if (isListening.get()) {
                promise.resolve(true)
                return
            }

            // 1. Launch Persistent Foreground Service to survive Android Doze & screen-off sleep
            try {
                val serviceIntent = Intent(reactContext, EmergencyMeshService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    reactContext.startForegroundService(serviceIntent)
                } else {
                    reactContext.startService(serviceIntent)
                }
                Log.d(tag, "Started EmergencyMeshService foreground service")
            } catch (e: Exception) {
                Log.w(tag, "Could not start ForegroundService: ${e.message}")
            }

            // 2. Acquire MulticastLock so Android OS doesn't filter incoming UDP broadcast packets
            try {
                val wifiManager = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
                if (wifiManager != null) {
                    multicastLock = wifiManager.createMulticastLock("EmergencyMeshLock").apply {
                        setReferenceCounted(true)
                        acquire()
                    }
                    Log.d(tag, "Acquired Android WifiManager MulticastLock")
                }
            } catch (e: Exception) {
                Log.w(tag, "Could not acquire MulticastLock: ${e.message}")
            }

            // 3. Initialize UDP DatagramSocket with SO_BROADCAST and SO_REUSEADDR
            socket = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(InetAddress.getByName("0.0.0.0"), port))
            }

            isListening.set(true)

            listenThread = Thread {
                val buffer = ByteArray(8192)
                Log.i(tag, "OTA Radio listening on 0.0.0.0:$port")

                while (isListening.get()) {
                    try {
                        val datagramPacket = DatagramPacket(buffer, buffer.size)
                        socket?.receive(datagramPacket)

                        if (!isListening.get()) break

                        val receivedText = String(
                            datagramPacket.data,
                            datagramPacket.offset,
                            datagramPacket.length,
                            Charsets.UTF_8
                        )

                        val map = Arguments.createMap().apply {
                            putString("payload", receivedText)
                            putString("fromAddress", datagramPacket.address?.hostAddress ?: "")
                            putInt("fromPort", datagramPacket.port)
                        }

                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onUdpPacket", map)

                    } catch (e: Exception) {
                        if (isListening.get()) {
                            Log.e(tag, "Error reading inbound datagram: ${e.message}")
                        }
                    }
                }
            }.apply {
                isDaemon = true
                start()
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(tag, "Failed to start UDP radio: ${e.message}", e)
            promise.reject("RADIO_START_ERROR", e.message, e)
        }
    }

    /**
     * Resolves all active network interfaces and computes directed subnet broadcast addresses
     * (e.g. 192.168.43.255, 10.0.0.255) as well as the limited broadcast (255.255.255.255).
     */
    private fun getBroadcastAddresses(): List<InetAddress> {
        val broadcastAddresses = mutableListOf<InetAddress>()
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                if (!networkInterface.isUp || networkInterface.isLoopback) continue

                for (interfaceAddress in networkInterface.interfaceAddresses) {
                    val broadcast = interfaceAddress.broadcast
                    if (broadcast != null) {
                        broadcastAddresses.add(broadcast)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Failed to enumerate network broadcast addresses: ${e.message}")
        }

        // Always append fallback limited broadcast
        try {
            broadcastAddresses.add(InetAddress.getByName("255.255.255.255"))
        } catch (_: Exception) {}

        return broadcastAddresses.distinct()
    }

    @ReactMethod
    fun broadcastPacket(payload: String, port: Int, promise: Promise) {
        Thread {
            try {
                val activeSocket = socket ?: DatagramSocket().apply {
                    broadcast = true
                }

                val bytes = payload.toByteArray(Charsets.UTF_8)
                val targetAddresses = getBroadcastAddresses()

                // Dual-transmit: send datagram to every resolved subnet broadcast address
                for (targetAddr in targetAddresses) {
                    try {
                        val datagram = DatagramPacket(bytes, bytes.size, targetAddr, port)
                        activeSocket.send(datagram)
                    } catch (e: Exception) {
                        Log.w(tag, "Failed transmitting to subnet $targetAddr: ${e.message}")
                    }
                }

                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(tag, "Failed to broadcast packet: ${e.message}", e)
                promise.reject("BROADCAST_ERROR", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun getNetworkInfo(promise: Promise) {
        try {
            val addresses = getBroadcastAddresses().map { it.hostAddress ?: "" }
            val map = Arguments.createMap().apply {
                putArray("broadcastAddresses", Arguments.createArray().apply {
                    addresses.forEach { pushString(it) }
                })
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("NETWORK_INFO_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopRadio(promise: Promise) {
        try {
            isListening.set(false)
            socket?.close()
            socket = null

            try {
                multicastLock?.let {
                    if (it.isHeld) it.release()
                }
            } catch (e: Exception) {
                Log.w(tag, "Error releasing MulticastLock: ${e.message}")
            }
            multicastLock = null

            // Stop Foreground Service
            try {
                val serviceIntent = Intent(reactContext, EmergencyMeshService::class.java)
                reactContext.stopService(serviceIntent)
            } catch (e: Exception) {
                Log.w(tag, "Error stopping EmergencyMeshService: ${e.message}")
            }

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(tag, "Failed to stop radio: ${e.message}", e)
            promise.reject("RADIO_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Double) {
        // Required for RN NativeEventEmitter
    }
}
