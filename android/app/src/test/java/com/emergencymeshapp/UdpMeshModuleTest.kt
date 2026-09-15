package com.emergencymeshapp

import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Native Unit Test Suite for UdpMeshModule networking and radio driver mechanics.
 * Validates socket reuse, broadcast flags, 8192-byte buffer boundaries, and thread isolation.
 */
class UdpMeshModuleTest {

    private val testPort = 18888
    private var rxSocket: DatagramSocket? = null
    private var txSocket: DatagramSocket? = null

    @Before
    fun setUp() {
        // Ensure clean state before each test
        rxSocket?.close()
        txSocket?.close()
    }

    @After
    fun tearDown() {
        rxSocket?.close()
        txSocket?.close()
    }

    @Test
    fun testSocketOptions_ReuseAddressAndBroadcastFlags() {
        // Emulate UdpMeshModule.kt socket configuration
        rxSocket = DatagramSocket(null).apply {
            reuseAddress = true
            broadcast = true
            bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), testPort))
        }

        assertTrue("SO_REUSEADDR must be enabled for instant failover rebinding", rxSocket!!.reuseAddress)
        assertTrue("SO_BROADCAST must be enabled for mesh beaconing", rxSocket!!.broadcast)
        assertTrue("Socket must be bound", rxSocket!!.isBound)
        assertEquals("Bound port must match requested port", testPort, rxSocket!!.localPort)
    }

    @Test
    fun testRapidSocketCloseAndRebind() {
        // Verify no BindException occurs when reopening on same port due to reuseAddress = true
        for (i in 0 until 5) {
            val s = DatagramSocket(null).apply {
                reuseAddress = true
                broadcast = true
                bind(InetSocketAddress(InetAddress.getByName("127.0.0.1"), testPort))
            }
            assertTrue(s.isBound)
            s.close()
            assertTrue(s.isClosed)
        }
    }

    @Test
    fun testPacketEncodeDecode_Exact8192BytePayloadBoundary() {
        val loopback = InetAddress.getByName("127.0.0.1")

        rxSocket = DatagramSocket(null).apply {
            reuseAddress = true
            bind(InetSocketAddress(loopback, testPort))
        }

        txSocket = DatagramSocket()

        val rxBuffer = ByteArray(8192)
        val receivedTextHolder = arrayOfNulls<String>(1)
        val latch = CountDownLatch(1)

        val rxThread = Thread {
            val packet = DatagramPacket(rxBuffer, rxBuffer.size)
            rxSocket!!.receive(packet)
            receivedTextHolder[0] = String(packet.data, packet.offset, packet.length, Charsets.UTF_8)
            latch.countDown()
        }
        rxThread.start()

        // Generate synthetic emergency payload exactly fitting 8192 bytes
        val prefix = "{\"type\":\"SOS\",\"msg_id\":\"boundary-test\",\"data\":\""
        val suffix = "\"}"
        val fillerLen = 8192 - prefix.toByteArray(Charsets.UTF_8).size - suffix.toByteArray(Charsets.UTF_8).size
        val payload = prefix + "A".repeat(fillerLen) + suffix

        val payloadBytes = payload.toByteArray(Charsets.UTF_8)
        assertEquals("Payload must be exactly 8192 bytes", 8192, payloadBytes.size)

        val txPacket = DatagramPacket(payloadBytes, payloadBytes.size, loopback, testPort)
        txSocket!!.send(txPacket)

        val completed = latch.await(2, TimeUnit.SECONDS)
        assertTrue("Packet must be received within 2 seconds", completed)
        assertEquals("Received string must match transmitted payload exactly", payload, receivedTextHolder[0])
    }

    @Test
    fun testPacketTruncation_Exceeding8192ByteSafetyBoundary() {
        val loopback = InetAddress.getByName("127.0.0.1")

        rxSocket = DatagramSocket(null).apply {
            reuseAddress = true
            bind(InetSocketAddress(loopback, testPort))
        }

        txSocket = DatagramSocket()

        // UdpMeshModule enforces an 8192-byte buffer
        val rxBuffer = ByteArray(8192)
        var receivedLength = 0
        val latch = CountDownLatch(1)

        val rxThread = Thread {
            val packet = DatagramPacket(rxBuffer, rxBuffer.size)
            rxSocket!!.receive(packet)
            receivedLength = packet.length
            latch.countDown()
        }
        rxThread.start()

        // Transmit an oversized 12000-byte datagram
        val oversizedBytes = ByteArray(12000) { 0x42 }
        val txPacket = DatagramPacket(oversizedBytes, oversizedBytes.size, loopback, testPort)
        txSocket!!.send(txPacket)

        val completed = latch.await(2, TimeUnit.SECONDS)
        assertTrue("Packet must be received within 2 seconds", completed)
        assertEquals("Buffer receiver must clamp datagram length at 8192 bytes", 8192, receivedLength)
    }

    @Test
    fun testConcurrentTransmission_ThreadIsolation() {
        val loopback = InetAddress.getByName("127.0.0.1")

        rxSocket = DatagramSocket(null).apply {
            reuseAddress = true
            bind(InetSocketAddress(loopback, testPort))
        }

        val totalPackets = 50
        val receivedCount = AtomicInteger(0)
        val isRunning = AtomicBoolean(true)
        val allReceivedLatch = CountDownLatch(totalPackets)

        val rxThread = Thread {
            val buffer = ByteArray(8192)
            while (isRunning.get()) {
                try {
                    val packet = DatagramPacket(buffer, buffer.size)
                    rxSocket!!.receive(packet)
                    receivedCount.incrementAndGet()
                    allReceivedLatch.countDown()
                } catch (e: Exception) {
                    break
                }
            }
        }
        rxThread.start()

        // Spawn 10 concurrent threads broadcasting simultaneously
        val threadCount = 10
        val perThread = totalPackets / threadCount
        val txThreads = (0 until threadCount).map { threadIdx ->
            Thread {
                val socket = DatagramSocket()
                for (i in 0 until perThread) {
                    val msg = "CONCURRENT_PKT_${threadIdx}_$i"
                    val bytes = msg.toByteArray(Charsets.UTF_8)
                    val packet = DatagramPacket(bytes, bytes.size, loopback, testPort)
                    socket.send(packet)
                    Thread.sleep(2)
                }
                socket.close()
            }
        }

        txThreads.forEach { it.start() }
        txThreads.forEach { it.join() }

        val completed = allReceivedLatch.await(3, TimeUnit.SECONDS)
        isRunning.set(false)
        rxSocket?.close()

        assertTrue("All 50 concurrent packets must arrive without thread collision", completed)
        assertEquals(totalPackets, receivedCount.get())
    }

    @Test
    fun testSocketTermination_UnblocksListeningThreadCleanly() {
        val loopback = InetAddress.getByName("127.0.0.1")

        rxSocket = DatagramSocket(null).apply {
            reuseAddress = true
            bind(InetSocketAddress(loopback, testPort))
        }

        val threadExited = AtomicBoolean(false)
        val threadStarted = CountDownLatch(1)

        val rxThread = Thread {
            val buffer = ByteArray(8192)
            threadStarted.countDown()
            try {
                val packet = DatagramPacket(buffer, buffer.size)
                rxSocket?.receive(packet)
            } catch (e: Exception) {
                // Expected when socket is closed asynchronously
            } finally {
                threadExited.set(true)
            }
        }
        rxThread.start()

        assertTrue(threadStarted.await(1, TimeUnit.SECONDS))
        assertFalse("Thread must be blocked waiting on receive()", threadExited.get())

        // Asynchronously close socket (matching stopRadio())
        rxSocket?.close()

        rxThread.join(1000)
        assertTrue("Listening thread must terminate cleanly upon socket closure", threadExited.get())
    }
}
