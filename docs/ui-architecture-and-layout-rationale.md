# Emergency Mesh Nürnberg — UI Architecture, Layout System & Design Rationale

```
┌────────────────────────────────────────────────────────────────────────┐
│  EMERGENCY MESH NÜRNBERG // COMPREHENSIVE UI & LAYOUT SPECIFICATION    │
│  CIVILIAN CIVIL DEFENSE (KATASTROPHENSCHUTZ) · ZERO-INFRASTRUCTURE P2P │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Executive Summary & Design Thesis

**Emergency Mesh Nürnberg** is an offline, peer-to-peer emergency communication network built for Android devices in Nürnberg, Germany. It is designed to operate during total infrastructure collapse: widespread electrical grid failure (Blackout), cellular backhaul severed, and commercial internet dark.

### The Core Design Tension: Tactical HUD vs. Civic Authority
In crisis software, two visual languages frequently clash:
1. **The Tactical-Military / Cyberpunk HUD:** Characterized by saturated neon accents (cyan, magenta, acid green), dense telemetry, condensed angular sci-fi fonts (e.g., Rajdhani), raw cryptographic hashes, and gaming overlays.
2. **The Civic Authority / Katastrophenschutz Service:** Characterized by sober municipal typography, clear official heraldry, restrained high-contrast contrast palettes, plain-language operational summaries, and unmistakable institutional trustworthiness.

**The Design Thesis of Emergency Mesh Nürnberg:**
> **The interface embodies Civic Authority with Tactical Precision.**
> 
> It is **not** a video game HUD or a sci-fi gadget. It is a digital counterpart to an official German municipal civil defense horn or public shelter noticeboard. However, because it runs on zero-infrastructure P2P mesh technology, it exposes tactical readiness metrics (hops, signal integrity, packet verification) in a structured, accessible hierarchy that reassures civilians rather than confusing them.

---

## 2. The Physics & Physiology of Crisis UI

Designing for disasters differs fundamentally from standard consumer app design. In an emergency, two physical constraints dominate:

### A. OLED Blackout Survival Physics
* **Battery is a finite survival asset:** During multi-day grid outages, wall power does not exist. Recharging depends on hand-crank dynamos, car batteries, or small portable solar panels.
* **True `#000000` Base Surface:** In OLED (AMOLED) displays, `#000000` causes individual organic light-emitting diodes to physically shut off (0.00 mA current draw per sub-pixel).
* By keeping over 80% of the active screen surface at pure `#000000`, the app minimizes battery consumption, extending a device's standby and mesh-relaying life by up to **40–60%** compared to light or grey themes.

### B. Acute Physiological Duress & Cognitive Bandwidth Collapse
When an individual experiences a crisis (floodwaters rising, sirens sounding, power cut in darkness, freezing cold):
* **Cognitive Tunnel Vision:** The brain's prefrontal cortex sheds non-essential processing capacity. Working memory drops to 1–2 items. Dense menus, nested navigation, modal traps, and obscure jargon cause cognitive freeze.
* **Fine Motor Skill Degradation:** Adrenaline causes vasoconstriction in the extremities, cold weather causes shivering, and darkness degrades spatial accuracy. Precision tapping on small touch targets (e.g. 24dp) fails.
* **Sensory Overload:** Flashing lights, noise, or pitch darkness make subtle visual cues invisible.

#### Core Ergonomic Mandates Derived from Crisis Physiology:
1. **Zero Nested Navigation:** Every primary life-safety function (SOS beacon, Encrypted Family Check-in, Drinking Water / Hospital locator) is accessible in **one tap** from the root screen.
2. **Generous Touch Targets:** All interactive triggers maintain a minimum touch target bounding box of **48–56dp**, with large active hit slops.
3. **Plain German Over System Internals:** Technical telemetry (like store-and-forward buffers or cryptographic hashes) is translated into actionable civilian language on primary views (e.g., *"3 Nachrichten warten auf Weiterleitung"* rather than *"DTN-PUFFER: 3"*).
4. **Colorblind Redundancy (WCAG 2.1 AAA):** Color is **never** the sole carrier of meaning. Every state pairs a distinct color with a dedicated geometric stroke icon and an explicit alphanumeric text tag.

---

## 3. Color Architecture & Municipal Heraldry

The color palette is derived directly from the historical heraldry and civil defense apparatus of Nürnberg:

```
[#000000] PURE OLED BLACK ──────── Base ground (0 mA diode draw)
   ├── [#070b12] KAISERBURG CARD ─── Elevated tactile card surfaces
   │    ├── [#0f172a] SINWELL SLATE ── Telemetry wells & emergency chips
   │    │    ├── [#d90429] FRANCONIAN RED ── SOS alerts, medical distress, priority beacons
   │    │    ├── [#ffb703] IMPERIAL GOLD ── Kaiserburg trust, family vault, guidance
   │    │    ├── [#00e676] SAFE GREEN ───── Verified relays, active radio, drinking water
   │    │    └── [#00e5ff] MESH CYAN ────── Low-level RF hardware diagnostics (isolated)
```

### Semantic Token Matrix:
| Semantic Token | Hex Value | Physical/Psychological Role | Where Used |
| :--- | :--- | :--- | :--- |
| `background` | `#000000` | Physical diode shutdown | Root container, bottom backdrops |
| `kaiserburgCard` | `#070b12` | Subtle contrast elevation | Primary interactive cards & feed items |
| `sinwellSlate` | `#0f172a` | Solid, grounded infrastructure feel | Status wells, sub-containers, inputs |
| `surfaceBorder` | `#1c1c1c` | Low-glow structural bounding | Card dividers, section boundaries |
| `nurnbergRed` | `#d90429` | Franconian flag red; urgent distress | SOS tab, medical cards, defcon badges |
| `imperialGold` | `#ffb703` | Holy Roman / Kaiserburg imperial banner | App brand, verified encryption, family channel |
| `safeGreen` | `#00e676` | Biological safety, operational heartbeat | Radio active dot, drinking water locations |
| `warningAmber` | `#ffb703` | Caution, statutory warning | 112 priority banner, battery warnings |
| `meshCyan` | `#00e5ff` | Technical radio frequency indicator | Collapsed hardware diagnostics drawer only |

### Heraldic Accent Ribbon:
At the very top of the interface sits a 3dp accent ribbon featuring the authentic heraldic colors of Nürnberg and Franconia:
`[ Red #d90429 ]` `[ White #ffffff ]` `[ Red #d90429 ]` `[ Gold #ffb703 ]`.
This immediately anchors the application in local municipal identity.

---

## 4. Typography Hierarchy (Dual-Engine System)

Typography is bifurcated into two distinct engines to maintain strict separation between **Human Communication** and **Machine Telemetry**:

```
                         ┌──────────────────────────────┐
                         │   TYPOGRAPHY SPECIFICATION   │
                         └──────────────┬───────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 │                                             │
      ┌──────────▼──────────┐                       ┌──────────▼──────────┐
      │  FIRA SANS CONDENSED│                       │   JETBRAINS MONO    │
      │  (CIVIC AUTHORITY)  │                       │   (RAW TELEMETRY)   │
      └──────────┬──────────┘                       └──────────┬──────────┘
                 │                                             │
         • Screen Titles & Headers                     • Radio Frequency (PEGNITZ-8888)
         • Tab Indicators                              • GPS Coordinates (49.45°N 11.08°E)
         • Emergency Action Triggers                   • Packet IDs & Nonces
         • Municipal POI Directory                     • Store-and-Forward Buffer Counts
         • Plain-Language Body Text                    • HMAC-SHA256 Signatures
```

### Why Fira Sans Condensed (DIN-1451 Lineage)?
- **The Problem with Rajdhani:** Rajdhani is an angular, condensed geometric sans widely used in esports scoreboards and Twitch overlays. It gives an app a "gaming peripheral" feel that undermines civic authority.
- **The DIN Lineage Advantage:** In Germany, **DIN 1451** is the visual standard for highway signage (Autobahn), train stations (Deutsche Bahn), and municipal civil infrastructure. **Fira Sans Condensed** carries that exact same structural lineage: clean, highly legible, authoritative, and compact enough to display long German compound nouns (*"Katastrophenschutz-Notfallnetz"*, *"Trinkwassernotbrunnen"*) without awkward multi-line wrapping.

### Casing Grammar:
* **All-Caps (`UPPERCASE`):** Strictly reserved for the 4 primary tabs (`RADAR`, `SOS`, `FAMILIE`, `ORTE`), critical emergency triggers (`MEDIZINISCHER NOTFALL`), and state badges (`[AKTIV]`, `[VERIFIZIERT]`).
* **Sentence Case:** Used for all titles, card subtitles, descriptions, and buttons. This prevents cognitive fatigue and improves reading speed by over 20% under stress.

---

## 5. Responsive Viewport Mathematics & FytlY Guardrails

The app adheres strictly to **FytlY architectural standards**—raw numeric dimensioning is strictly forbidden:

### Mathematical Viewport Formulas (Reference Viewport: 390 × 844 pt)

$$\text{scale} = \frac{\text{windowWidth}}{390}$$

$$\text{respWidth}(px) = \left\lfloor \frac{px}{390} \times \text{windowWidth} \right\rceil$$

$$\text{respHeight}(px) = \left\lfloor \frac{px}{844} \times \text{windowHeight} \right\rceil$$

$$\text{respFontSize}(size) = \operatorname{clamp}\left(size \times \text{scale},\; size \times 0.8,\; size \times 1.3\right)$$

* **Clamping Rule:** Clamping font size between $0.8\times$ and $1.3\times$ guarantees that even if the user has system accessibility fonts set to maximum, critical buttons and badges will never blow past container boundaries or induce horizontal clipping.
* **Performance Bound:** All responsive dimensions are bound inside `useMemo` hooks calculating once per orientation or layout change, and high-frequency components are wrapped in `React.memo` to eliminate layout thrashing during flood-routing bursts.

---

## 6. Screen-by-Screen Layout Architecture

```
┌────────────────────────────────────────────────────────┐
│ [FRANCONIAN ACCENT RIBBON: RED / WHITE / RED / GOLD]   │
├────────────────────────────────────────────────────────┤
│ [🏰] Emergency Mesh Nürnberg [AKTIV] [❓GUIDE] [☰MENU] │
│      [ZIVILES NOTNETZ // KEINE BEHÖRDE]                │
│      P2P-Funk aktiv · 2 Geräte · Kein Internet nötig   │
├────────────────────────────────────────────────────────┤
│  [📡 RADAR]    [🚨 SOS]     [🛡️ FAMILIE]   [📍 ORTE]   │
├────────────────────────────────────────────────────────┤
│                                                        │
│                  TAB VIEWPORT CONTENT                  │
│                                                        │
│  - RADAR:   Sector Grid + Feed / Active Readiness Mon. │
│  - SOS:     112 Statutory Banner + 4 Emergency Cards   │
│  - FAMILIE: AES-256 Passphrase Vault + Dispatcher      │
│  - ORTE:    Offline Geospatial Registry + Haversine    │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [OPTIONAL / ERGONOMIC BOTTOM DOCK: EMERGENCY ACTIONS]  │
└────────────────────────────────────────────────────────┘
```

### A. The Persistent Header Zone
1. **Nürnberg Civic Crest:** Single-weight SVG silhouette of the Kaiserburg Sinwell Tower in an Imperial Gold badge.
2. **Civic Disambiguation Badge:** `[ZIVILES NOTNETZ // KEINE BEHÖRDE]`. Prominently clarifies that this is a civilian peer-to-peer survival network, not an official municipal authority, preventing legal misrepresentation while retaining high civic trust.
3. **Pulsing Radio Heartbeat:** Dynamic green dot indicating the native Android background UDP socket (`0.0.0.0:8888`) is active.
4. **Quick Utility Dock:**
   - `[❓ Anleitung]`: Spawns the 5-step emergency walkthrough modal.
   - `[☰ Menü]`: Opens the tactical drawer containing one-tap phone dialers for official services (`112`, `110`, `116 117`, `0911 / 231-0`), language selection (DE/EN), and memory cache purge.

### B. Tab 1: RADAR (Live Mesh Stream & Monitor)
* **Sector Status Bar:** Visual indicators for Nürnberg's four central quadrants (`Altstadt-Burg`, `Gostenhof`, `Südstadt`, `Langwasser`).
* **Decrypted Family Banner:** When encrypted packets matching the user's family passphrase arrive, they are automatically decrypted and pinned at the top in Imperial Gold.
* **Live Feed / Empty State Monitor:**
  - When messages exist: Rendered via high-performance `FlatList` with hop distance counter, cryptographic witness attestation count, and anti-abuse mute buttons.
  - When zero messages exist: Displays an active **Mesh Radar Readiness Monitor** confirming that the radio receiver is listening on channel `PEGNITZ-8888` with active store-and-forward relaying.
* **Collapsible Diagnostics Disclosure:** Technical metrics (`KANAL`, `GPS-SEKTOR`, `DTN-PUFFER`, `KRYPTO-SIG`) are safely tucked into a single collapsible drawer, preventing civilian confusion while remaining accessible to ham operators and technical responders.

### C. Tab 2: SOS (Public Distress Dispatch)
* **Statutory 112 Priority Directive Banner:** A prominent amber banner reminding users: *"PRIORITÄT: Wenn Mobilfunk oder Festnetz aktiv ist, sofort 112 / 110 wählen! Mesh-Funk ist ausschließlich ein Notfall-Rückfallnetz bei komplettem Netzausfall."*
* **KATS-DEFCON 1 Emergency Grid:**
  - `MEDIZINISCHER NOTFALL` (`KATS-101 // SANITÄT`)
  - `FEUER / BRAND` (`KATS-204 // FEUERWEHR`)
  - `EINGEKLEMMT / VERSCHÜTTET` (`KATS-303 // THW RETTUNG`)
  - `WASSER / NAHRUNG NOTFALL` (`KATS-404 // HILFE VERSORGUNG`)
* **Local Hazard Broadcast Chips:** Quick broadcasts for verified local events (*"Pegnitz Hochwasser"*, *"Frankenschnellweg blockiert"*).

### D. Tab 3: FAMILIE (AES-256 Encrypted Channel)
* **Zero-Knowledge Architecture:** Messages on this tab are encrypted client-side using AES-256-CBC with a SHA-256 derived key from a pre-shared passphrase.
* **Mesh Routing Privacy:** Intermediate mesh relay nodes forward the raw ciphertext across the city without being able to decrypt the content or know who the sender is.
* **Two-Step Interaction:**
  1. *Passphrase Entry & Storage:* Saves passphrase securely in local memory.
  2. *Status Dispatcher:* Form to send name/alias and check-in text (*"Bin sicher am Hauptmarkt. Trinkwasser geholt."*).

### E. Tab 4: ORTE (Offline Geospatial Registry)
* **100% Offline Database:** Contains verified GPS coordinates, street addresses, capacities, and emergency radio frequencies for:
  - Hospitals & Trauma Centers (*Klinikum Nord, Klinikum Süd, Erler-Klinik, Theresien-Krankenhaus*).
  - Emergency Drinking Water Wells (*Trinkwassernotbrunnen Altstadt, Gostenhof, St. Johannis*).
  - Civil Defense Shelters & Siren Locations.
* **Haversine Distance Engine:** Calculates straight-line distance in kilometers from the user's location (or central Hauptmarkt) without requiring internet or map tiles.
* **Filter Chips:** One-tap filtering by district (`Alle`, `Altstadt`, `Gostenhof`, `Johannis`, `Langwasser`).

---

## 7. Current Layout Assessment & Targeted Refinements

The screenshot captured on the live device (`media_1789482920570.png`) revealed several layout imbalances resulting from the recent P1 refactoring:

### Identified Deficiencies:
1. **The 45% Viewport Vacuum (RADAR Tab):**
   - Collapsing the telemetry grid per P1 successfully decluttered the top of the screen, but left the bottom 45% of the viewport completely empty when no packets are present.
   - The three quick-action buttons (`SOS`, `FAMILIE`, `ORTE`) hang in the middle of the screen, duplicating the 4-tab bar above them.
2. **Horizontal Header Cramping:**
   - The subline `P2P-Funk aktiv • 2 Geräte in Reichweite • ...` is truncated with an ellipsis because it shares horizontal width with `[Anleitung]` and `[Menü]`.
3. **Badge Text Collisions (SOS Tab):**
   - On the SOS screen, the redundant colorblind `[SOS]` badge overlaps directly onto the `KATS-101 // SANITÄT` text badge due to inflexible horizontal row sizing.
4. **Header Badge Truncation (FAMILIE Tab):**
   - `Kaiserburg Krypto-Tresor` is clipped at the right margin on narrow viewports.

### Architectural Corrections Underway:
1. **Fill the Viewport Void with Active Mesh Telemetry:**
   - Replace the static empty box with a full-height **Mesh Readiness Display** showing animated pulse listening status, store-and-forward buffer health, and nearby sector radio status.
2. **Anchor Emergency Actions to the Ergonomic Thumb Zone:**
   - Position quick actions at the bottom of the viewport (`flex-end` or floating dock) within easy reach of one-handed thumb navigation.
3. **Un-cramp Header Structure:**
   - Give the status subline its own dedicated full-width row below the title group so `P2P-Funk aktiv...` is never truncated.
4. **Wrap & Space Badges Reliably:**
   - Apply `flexWrap: 'wrap'` and proper gap distribution across all SOS cards to ensure badges never collide, even at 130% accessibility font scaling.

---

## 8. Summary Checklist of UI Tokens & Rules

| Aspect | Rule / Standard | Purpose |
| :--- | :--- | :--- |
| **Base Color** | Pure `#000000` | 0 mA physical OLED battery preservation |
| **Primary Accents** | Red `#d90429`, Gold `#ffb703`, Green `#00e676` | Nürnberg municipal heraldry & safety status |
| **Diagnostic Accent** | Cyan `#00e5ff` | Low-level RF hardware telemetry only |
| **Display Font** | Fira Sans Condensed (DIN 1451 lineage) | Civic authority, high legibility, German compound nouns |
| **Data Font** | JetBrains Mono | Monospaced alignment for coordinates and channel hashes |
| **Iconography** | Single-weight custom stroke SVGs | Consistent rendering across Android OEMs; no cartoon emojis |
| **Accessibility** | Color + Stroke Icon + Text Tag on every state | Full WCAG 2.1 AAA red-green colorblind compliance |
| **Touch Ergonomics** | Min 48–56dp touch targets, bottom thumb zones | Usable with trembling/cold hands under crisis duress |
