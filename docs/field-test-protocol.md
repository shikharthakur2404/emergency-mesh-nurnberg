# Emergency Mesh Nürnberg — Multi-Device Physical Field Test Protocol

> **Specification Level:** Life-Safety Critical / Katastrophenschutz Standard  
> **Target System:** Android Physical Hardware Radio Layer (`UdpMeshModule.kt`)  
> **Operating Environment:** Situation A — Total Municipal Grid Collapse (Zero Cellular, Zero ISP, Zero Cloud)

---

## 1. Hardware Matrix & Test Bed Setup

### Minimum Equipment Matrix
To evaluate cross-OEM radio concurrency and aggressive background process kill policies, testing requires at least **3 physical Android smartphones** representing the primary hardware variants:

| Role | Device Make / Model | Android Version | OS Flavor | Radio Concurrency Notes |
|---|---|---|---|---|
| **Node A (Distress Beacon)** | Google Pixel 7 / 8 | Android 14 / 15 | Stock AOSP | Standard Doze handling, fast raw UDP broadcast |
| **Node B (Relay / Carrier)** | Samsung Galaxy S21 / S23 / A54 | Android 13 / 14 | One UI 5 / 6 | Aggressive memory management ("Sleeping Apps"), Knox security |
| **Node C (Civilian Shelter)** | Xiaomi Redmi Note 11 / 12 | Android 12 / 13 | MIUI / HyperOS | Extreme battery optimizer, UDP multicast packet throttling |

### Pre-Test Device Configuration (Zero-Network Quarantine)
Perform on **all participating devices** before initiating field trials:
1. **Enable Airplane Mode** (Disables GSM, LTE, 5G cellular basebands).
2. **Manually Toggle Wi-Fi ON** (Leaves cellular turned OFF).
3. **Connect to Shared Zero-Uplink Hotspot** or assign one phone as offline Portable Hotspot (AP Mode) with 0 internet connection.
4. **Disable Battery Optimization**:
   - `Settings -> Apps -> Emergency Mesh -> Battery -> Unrestricted`.
5. **Grant Runtime Permissions**:
   - Location: `Allow all the time` (or `Allow while using app`).
   - Nearby Devices: `Allow`.
   - Notifications: `Allow` (Mandatory for persistent Foreground Service).

---

## 2. Test Execution Protocol

### Protocol 2.1: Point-to-Point Direct Over-The-Air Verification (Node A ⟷ Node B)

- **Distance:** 10 meters direct line-of-sight (LOS).
- **Objective:** Verify raw datagram broadcast, JSON serialization, and cryptographic verification.

| Step | Action | Expected Result | Verification Check |
|---|---|---|---|
| 2.1.1 | Launch app on Node A and Node B. | Header shows `[AKTIV] OTA RADIO ONLINE`, connected peers badge updates to `1 PEER`. | [ ] Pass / [ ] Fail |
| 2.1.2 | On Node A, navigate to **SOS** tab, select `MEDIZINISCHER NOTFALL`, press **NOTRUF SENDEN**. | Broadcast transmits via UDP port 8888. Screen renders active red beacon HUD. | [ ] Pass / [ ] Fail |
| 2.1.3 | Observe Node B within 250ms. | Immediate vibration/haptic alert. Top of feed displays `[SOS] MEDIZINISCHER NOTFALL` with sender ID and `[VERIFIED]` HMAC-SHA256 signature indicator. | [ ] Pass / [ ] Fail |
| 2.1.4 | On Node A, navigate to **FAMILIE** tab, pair key `Kaiserburg2026`, broadcast status: *"Alle unverletzt im Sebald Bunker"*. | Node A feed shows encrypted payload snippet (`[AES-256: ...]`)| [ ] Pass / [ ] Fail |
| 2.1.5 | On Node B with key `Kaiserburg2026` paired: | Node B feed instantly decrypts payload: *"Alle unverletzt im Sebald Bunker"*. | [ ] Pass / [ ] Fail |
| 2.1.6 | On Node C with **NO key** paired: | Node C feed displays encrypted hex ciphertext only; plaintext is 100% inaccessible. | [ ] Pass / [ ] Fail |

---

### Protocol 2.2: Multi-Hop Relay & Loop Prevention (Node A ⟶ Node B ⟶ Node C)

- **Geometry:** Linear arrangement: `Node A` <--- 100m ---> `Node B` <--- 100m ---> `Node C`.
- **Node A and Node C are completely out of radio range of each other.**
- **Objective:** Verify autonomous packet hop forwarding, TTL decrementing, and deduplication cache suppression.

```
[ Node A (Sender) ] <----- 100m -----> [ Node B (Relay) ] <----- 100m -----> [ Node C (Target) ]
      (TX)                               (RX & Forward)                           (Final RX)
```

| Step | Action | Expected Result | Verification Check |
|---|---|---|---|
| 2.2.1 | Position Node A, B, and C along line. Verify A cannot ping or see C directly. | Peer list on A shows B only; peer list on C shows B only. | [ ] Pass / [ ] Fail |
| 2.2.2 | Node A originates SOS beacon with `TTL = 15`. | Datagram dispatched over Wi-Fi broadcast. | [ ] Pass / [ ] Fail |
| 2.2.3 | Node B receives packet. | Diagnostics Drawer on B shows `Relayed Pakete: +1`. TTL is decremented to 14, hop count incremented to 1. | [ ] Pass / [ ] Fail |
| 2.2.4 | Node C receives forwarded packet from Node B. | Feed on Node C renders `[SOS]` beacon with `Hops: 1`. | [ ] Pass / [ ] Fail |
| 2.2.5 | Node A re-broadcasts identical packet (`msg_id` collision test). | Node B drops packet at deduplication layer; `Verworfene Duplikate` counter increments by 1. Zero extra packet reached C. | [ ] Pass / [ ] Fail |

---

### Protocol 2.3: Delay-Tolerant (DTN) Epidemic Physical Carrier Walk

- **Scenario:** Two isolated bomb shelters (Shelter 1 at Kaiserburg, Shelter 2 at Lorenzkirche) separated by 800m of rubble without radio connectivity.
- **Node A:** Stationary phone in Shelter 1.
- **Node B:** Physical carrier volunteer walking between shelters.
- **Node C:** Stationary phone in Shelter 2.

```
[ Shelter 1 (Node A) ]
         │
    (Link & Sync)
         ▼
[ Carrier (Node B) ] ── (Walks 800m through blackout zone) ──► [ Carrier (Node B) ]
                                                                      │
                                                                 (Link & Sync)
                                                                      ▼
                                                            [ Shelter 2 (Node C) ]
```

| Step | Action | Expected Result | Verification Check |
|---|---|---|---|
| 2.3.1 | Node A and Node B are connected in Shelter 1. Node A triggers SOS and 2 SAFE check-ins. | Node B stores all 3 packets into local DTN Vault (`DTN-Gepuffert: 3`). | [ ] Pass / [ ] Fail |
| 2.3.2 | Carrier with Node B disconnects from Shelter 1 Wi-Fi and walks out of range. | Node B retains bundles in RAM/durable store. | [ ] Pass / [ ] Fail |
| 2.3.3 | Verify Node C in Shelter 2 has 0 knowledge of Shelter 1's packets. | Feed on C is clean (`DTN-Gepuffert: 0`). | [ ] Pass / [ ] Fail |
| 2.3.4 | Carrier with Node B arrives at Shelter 2 and associates with Shelter 2 Wi-Fi. | Node B discovers Node C as direct peer. | [ ] Pass / [ ] Fail |
| 2.3.5 | In Diagnostics Drawer on Node B or C, press **DTN-SYNCHRONISATION ERZWINGEN**. | `SYNC_INV` vector exchanged ⟶ `SYNC_DATA` transmitted ⟶ Shelter C imports all 3 bundles. | [ ] Pass / [ ] Fail |
| 2.3.6 | Check Shelter C Feed. | All 3 emergency messages from Shelter 1 display chronologically with `[DTN-GEPUFFERT]` badge. | [ ] Pass / [ ] Fail |

---

### Protocol 2.4: Urban Obstacle & Structural Attenuation Testing

- **Location:** Nürnberg Altstadt (sandstone walls, subterranean cellar).
- **Objective:** Measure maximum penetration distance and packet reception fidelity through structural attenuation.

| Test Environment | Structure Type | Distance | Packet Arrival Rate (10 SOS Bursts) | Result |
|---|---|---|---|---|
| **Kaiserburg Felsengänge** | Solid Keuper Sandstone (> 1.5m thick) | 25m underground | Expect ≥ 80% with direct LOS, ≤ 30% around 90° rock bends | [ ] ___ % |
| **Altstadt Residential** | Pre-war brick / timber masonry | 45m through 2 closed walls | Expect ≥ 90% arrival | [ ] ___ % |
| **Modern Concrete Core** | Reinforced concrete basement ceiling | 1 floor separation | Expect ≥ 70% arrival | [ ] ___ % |

---

### Protocol 2.5: 24-Hour Battery Soak & Android Doze Survival

- **Objective:** Ensure continuous background packet reception without being killed by Android OEM task killers or battery optimizations.

1. **Pre-test State:** Charge all test devices to 100%. Unplug at 08:00.
2. **Backgrounding:**
   - Launch app on Node A, B, and C.
   - Lock screen (Display OFF).
   - Place devices in stationary position for 4 hours to induce Android Deep Doze.
3. **Hourly Inbound Beacon Test:**
   - Every 2 hours, transmit 1 SOS packet from an external node.
   - Verify device wakes audio/vibrator notification without requiring screen unlock.
4. **Pass Criteria (24h continuous operation):**
   - Device remaining battery after 24h: **≥ 55%** (Hourly drain < 1.9%).
   - Zero process crashes or OS force-quits (`EmergencyMeshService` remains visible in persistent notification shade).
   - 100% of emergency packets received and logged.

---

## 3. Post-Test Telemetry & Sign-Off Checklist

- [ ] All HMAC-SHA256 signatures validated with 0 false positives.
- [ ] No plaintext leakage across untrusted relays on family encrypted channels.
- [ ] Deduplication cache successfully rejected 100% of duplicate packet echoes.
- [ ] Carrier DTN synchronization delivered 100% of stored bundles to secondary cluster.
- [ ] Battery consumption adhered to low-power blackout requirements (< 2% / hr screen-off).

**Test Lead Sign-Off:** ___________________________  
**Date / Location:** ___________________________  
**Firmware / Build:** `emergency-mesh-nurnberg-v1.0-release.apk`
