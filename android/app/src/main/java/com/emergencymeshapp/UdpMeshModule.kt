package com.emergencymeshapp

import android.content.Context
import android.net.wifi.WifiManager
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
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Emergency Mesh Nürnberg — Native Android Hardware Radio Driver
 * Implements physical over-the-air packet broadcasting via raw UDP sockets & MulticastLock.
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

            // Acquire MulticastLock so Android OS doesn't filter incoming UDP broadcast packets
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

            // Initialize UDP DatagramSocket with SO_BROADCAST and SO_REUSEADDR
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

    @ReactMethod
    fun broadcastPacket(payload: String, port: Int, promise: Promise) {
        Thread {
            try {
                val activeSocket = socket ?: DatagramSocket().apply {
                    broadcast = true
                }

                val bytes = payload.toByteArray(Charsets.UTF_8)
                val broadcastAddr = InetAddress.getByName("255.255.255.255")
                val datagram = DatagramPacket(bytes, bytes.size, broadcastAddr, port)

                activeSocket.send(datagram)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(tag, "Failed to broadcast packet: ${e.message}", e)
                promise.reject("BROADCAST_ERROR", e.message, e)
            }
        }.start()
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
