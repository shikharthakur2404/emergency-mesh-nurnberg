# Offline Emergency Coordination Mesh (Nürnberg)
### Decentralized Peer-to-Peer Disaster & Blackout Communication Architecture

**Working Title:** Emergency Mesh Nürnberg  
**Target Scenario (Situation A):** Cellular networks & ISP internet down (fiber cuts, overload, cyberattack); residential power grid & phone batteries intact.  
**Constraint:** €0 Infrastructure Budget. Zero cloud servers, zero backend, zero central database.  
**Platform:** Bare React Native (Android MVP).  
**Core Lead:** Shikhar Thakur  

---

## 1. Executive Summary & Philosophy

Unlike generic offline messengers (Briar, Bridgefy, Bitchat), this system is engineered strictly for **Structured Emergency Coordination**. Instead of heavy freeform chat streams, the network communicates via minimal, standardized JSON packets to maximize BLE throughput, minimize packet loss, and prevent network flooding.

### Key Differentiators
1. **Zero-Byte Bandwidth Waste:** Strictly typed payloads (`SAFE`, `SOS`).
2. **Deterministic Mesh Hopping:** Automatic hop-count (TTL) decrementing and seen-message deduplication (`msg_id`).
3. **Targeted Family vs. Public Beaconing:** Cryptographic family hashing for private check-ins vs. unencrypted public SOS heatmaps.
4. **Zero-Cloud Offline Pre-bundling:** Pre-bundled static GeoJSON datasets for Nürnberg emergency services (hospitals, water distribution points, civil protection shelters).

---

## 2. Technical Stack & Hardware Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   React Native UI                      │
│     (Zustand State, Offline Map / Shelter List)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Coordination & Routing Layer             │
│        (TTL Decrement, Msg Deduplication Cache)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Local Offline Storage                    │
│      (react-native-mmkv: Seen IDs, Family Keys)        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                Native P2P Transport                    │
│  (Google Nearby Connections / BLE Dual-Role Wrapper)   │
└────────────────────────────────────────────────────────┘
```

- **Framework:** Bare React Native (Android 12+ target).
- **Transport / Mesh Engine:** Google Nearby Connections API (`mrousavy/react-native-google-nearby-messages` / `react-native-nearby-api`) or dual-role BLE GATT/Advertising layer (`react-native-ble-plx`, `react-native-peripheral`).
- **State Management:** Zustand (reactive, lightweight alert stream).
- **Fast Storage:** `react-native-mmkv` (zero-latency cache for `msg_id` routing tables & offline emergency points).
- **Required Android Permissions:**
  - `android.permission.BLUETOOTH_SCAN`
  - `android.permission.BLUETOOTH_ADVERTISE`
  - `android.permission.BLUETOOTH_CONNECT`
  - `android.permission.ACCESS_FINE_LOCATION`
  - `android.permission.NEARBY_WIFI_DEVICES`

---

## 3. Wire Protocols & Schemas

### Schema A: Targeted "I'm Safe" Broadcast
Traverses unknown peer devices across hops without leaking readable content until matching a device holding the shared `family_id` hash.

```json
{
  "type": "SAFE",
  "msg_id": "8f3a2b",
  "family_id": "hash_of_family_secret",
  "timestamp": 1724884200,
  "ttl": 15,
  "payload": "I am safe at home."
}
```

### Schema B: Public SOS Beacon
Broadcasts unconditionally to all devices in range to form a real-time localized emergency map.

```json
{
  "type": "SOS",
  "msg_id": "c91x4z",
  "sender_id": "anon_8829",
  "timestamp": 1724884205,
  "ttl": 20,
  "category": "MEDICAL",
  "lat": 49.4521,
  "lon": 11.0767
}
```

---

## 4. Execution Roadmap

```text
PHASE 1: Point-to-Point Handshake (Phone A -> Phone B string exchange)
   │
PHASE 2: Mesh Routing Engine (Deduplication table + TTL decrement relay)
   │
PHASE 3: Structured Payload Protocol (SOS & SAFE JSON serialization)
   │
PHASE 4: Cryptographic Family Pairing (Offline QR exchange of shared secrets)
   │
PHASE 5: Nürnberg Offline Geospatial Layer (Static POI bundle & render)
```

1. **Phase 1: Barebones Handshake:** Android manifest permission setup, Nearby/BLE discovery, baseline string transmission between two nodes.
2. **Phase 2: Mesh Hop Routing:** In-memory + MMKV LRU cache for `msg_id`. Dropping duplicates, decrementing `ttl`, re-broadcasting if `ttl > 0`.
3. **Phase 3: Schema Integration:** Wire `SAFE` and `SOS` parsers into state store.
4. **Phase 4: Family Group Cryptography:** QR-code-based out-of-band secret exchange for HMAC/hash verification.
5. **Phase 5: Nürnberg Offline Map:** Bundle static geo-data (Nürnberg Klinikum, THW shelters, Trinkwassernotbrunnen) with `react-native-maps` / fallback list.

---

## 5. Architectural Guardrails & Coding Standards

- **UI Layout:** Strict responsiveness via `respWidth`, `respHeight`, `respFontSize`. Zero hardcoded static layout dimensions.
- **Rendering Performance:** `React.memo`, `useCallback`, `getItemLayout` for emergency log lists.
- **Network Boundaries:** Isolation of transport drivers behind an abstract `MeshTransport` interface to allow seamless hot-swapping between Google Nearby Connections and raw BLE GATT.

---

## 6. Key References & Technical Blueprints

- **Google Nearby Messages RN:** `mrousavy/react-native-google-nearby-messages`
- **DisasterMesh (Android Kotlin):** `raviprasad794063/disaster_mesh` (BLE + Wi-Fi Direct multi-hop reference)
- **LYF SOS:** `lyfmail-official/lyf-sos-android` (Zero-knowledge ephemeral keys & mesh relay)
- **Raw BLE GATT Server / Peripheral:** `petrbela/react-native-peripheral`, `munim-bluetooth`
