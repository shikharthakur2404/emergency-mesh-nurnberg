/**
 * Emergency Mesh Nürnberg — Root Application Component
 *
 * Renders the four-tab HUD (Radar, SOS, Familie, Orte) for a civilian off-grid
 * mesh-network communication tool designed for use during full infrastructure failure
 * (flooding, power grid collapse, cellular/ISP blackout).
 *
 * Architecture:
 * - State managed via Zustand (`useMeshStore`) — no Redux, no context providers.
 * - Mesh engine: MeshRouter over HybridMeshTransport (physical UDP + virtual bus).
 * - All styles computed dynamically via `useAppStyles()` — responsive to orientation
 *   and font scale changes through `useWindowDimensions`.
 * - i18n: `getTranslations(language)` — supports DE and EN; toggleable at runtime.
 * - Cryptography: AES-256-CBC + PBKDF2 for family messages; HMAC-SHA256 for SOS signing.
 *
 * Security posture:
 * - No network calls outside the mesh layer — fully offline-capable.
 * - Demo credentials (`Nbg-Familie-2026`) only present in __DEV__ builds.
 * - All randomness via CSPRNG (crypto.getRandomValues via react-native-get-random-values).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  StatusBar,
  ScrollView,
  Alert,
  Animated,
  useWindowDimensions,
} from 'react-native';
import CryptoJS from 'crypto-js';
import {
  OLED_PALETTE,
  respWidth,
  respHeight,
  respFontSize,
  FONTS,
  TRACKING,
  ThemeMode,
  getTheme,
} from './ui/responsive';
import { useMeshStore, DecryptedSafeEntry } from './state/meshStore';
import { MeshRouter } from './core/router';
import { HybridMeshTransport } from './core/transport/HybridMeshTransport';
import { VirtualMeshTransport, VirtualNetworkBus } from './core/transport/VirtualMeshTransport';
import { requestMeshPermissions } from './utils/permissions';
import {
  MeshPacket,
  SosCategory,
  HazardType,
  NurnbergEmergencyPoi
} from './core/types';
import { searchPois } from './data/nurnberg-emergency-data';
import { getTranslations } from './i18n/translations';
import { EmergencyGuideModal } from './components/EmergencyGuideModal';
import { TacticalDrawer } from './components/TacticalDrawer';
import { DiagnosticsDisclosure } from './components/DiagnosticsDisclosure';
import {
  CrestCastleIcon,
  RadioTowerIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  MapPinIcon,
  HelpCircleIcon,
  MenuLinesIcon,
  CheckCircleIcon,
  AlertOctagonIcon,
  FlameIcon,
  WaterDropIcon,
  RubbleIcon,
  WaveIcon,
  RoadBlockIcon,
  MedicalCrossIcon,
  SearchIcon,
  LockIcon,
  SignalBarsIcon,
  NurnbergCrestIcon,
  FrankenRechenIcon,
  KaiserburgIcon,
  SchoenerBrunnenIcon,
  KatsSireneIcon,
  NurnbergStadttorIcon,
  ThwRescueIcon,
  BavarianLozengeIcon,
} from './components/icons/MeshIcons';

import { calculateDistanceKm } from './utils/geo';

type Tab = 'FEED' | 'SOS' | 'FAMILY' | 'POIS';

const DISTRICT_FILTERS = ['ALL', 'Altstadt', 'Gostenhof', 'Johannis', 'Langwasser', 'Südstadt'] as const;

export default function App() {
  // ── UI navigation state ──
  const [activeTab, setActiveTab] = useState<Tab>('FEED');
  /** Controls whether the EmergencyGuideModal carousel is visible. */
  const [guideVisible, setGuideVisible] = useState(false);
  /** Controls whether the TacticalDrawer diagnostics panel is visible. */
  const [drawerVisible, setDrawerVisible] = useState(false);

  // ── Familie tab input state ──
  const [familySecretInput, setFamilySecretInput] = useState('');
  const [safeStatusText, setSafeStatusText] = useState('');
  const [senderAlias, setSenderAlias] = useState('');

  // ── Orte tab filter state ──
  const [poiQuery, setPoiQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');

  /** True when the physical hardware UDP radio is detected and active. False = simulation mode. */
  const [isRadioActive, setIsRadioActive] = useState(false);

  const { width: w, height: h } = useWindowDimensions();
  const styles = useAppStyles();

  const {
    nodeId,
    router,
    attachRouter,
    packets,
    decryptedFamilyMessages,
    connectedPeers,
    activeFamilySecret,
    setFamilySecret,
    sendSafeStatus,
    sendSosBeacon,
    sendHazardAlert,
    attestBeacon,
    toggleMuteSender,
    attestations,
    mutedSenders,
    offlinePois,
    language,
    setLanguage,
    themeMode,
    setThemeMode,
    stats,
    clearHistory
  } = useMeshStore();

  const t = useMemo(() => getTranslations(language), [language]);
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  // Cockpit RF Beacon Pulse Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  // Derived Cryptographic Key Fingerprint (SHA-256)
  const keyFingerprint = useMemo(() => {
    if (!activeFamilySecret) return null;
    try {
      const hash = CryptoJS.SHA256(activeFamilySecret).toString();
      return hash.substring(0, 16).toUpperCase().match(/.{1,4}/g)?.join(' · ') || null;
    } catch {
      return null;
    }
  }, [activeFamilySecret]);

  // Initialize Mesh Engine with Physical Hardware UDP Radio & Virtual Multi-Node RF Simulator
  useEffect(() => {
    requestMeshPermissions();

    const hybridTransport = new HybridMeshTransport(nodeId);
    const meshRouter = new MeshRouter(
      {
        nodeId,
        maxTtl: 15,
        dedupCacheSize: 500,
        // DEV ONLY: pre-seed a test family group so devs can test decryption without manual setup.
        // In production builds (__DEV__ === false) this array is empty — users must set their own secret.
        familySecrets: __DEV__ ? ['Nbg-Familie-2026'] : [],
      },
      hybridTransport
    );

    meshRouter.start().then(() => {
      attachRouter(meshRouter);
      setIsRadioActive(hybridTransport.isHardwareRadioActive());

      // DEV ONLY: Link mock virtual neighbours to simulate a live Nürnberg mesh in the emulator.
      // Stripped entirely from production builds — real hardware peer discovery handles this.
      if (__DEV__) {
        const bus = VirtualNetworkBus.getInstance();
        const peer1 = new VirtualMeshTransport('peer-altstadt-01');
        const peer2 = new VirtualMeshTransport('peer-gostenhof-02');
        peer1.start();
        peer2.start();
        bus.linkNeighbors(nodeId, 'peer-altstadt-01');
        bus.linkNeighbors(nodeId, 'peer-gostenhof-02');
      }
    });

    return () => {
      meshRouter.stop();
    };

  }, [nodeId, attachRouter]);

  // Handlers
  const handleSetFamilySecret = useCallback(() => {
    if (!familySecretInput.trim()) {
      Alert.alert(t.family.errorTitle, t.family.secretMissingMsg);
      return;
    }
    setFamilySecret(familySecretInput.trim());
    Alert.alert(t.family.saveSuccessTitle, t.family.saveSuccessMsg);
  }, [familySecretInput, setFamilySecret, t]);

  const handleBroadcastSafe = useCallback(async () => {
    try {
      if (!activeFamilySecret) {
        Alert.alert(t.family.secretMissingTitle, t.family.secretMissingMsg);
        return;
      }
      if (!safeStatusText.trim()) {
        Alert.alert(t.family.statusMissingTitle, t.family.statusMissingMsg);
        return;
      }
      await sendSafeStatus(safeStatusText.trim(), senderAlias.trim() || undefined);
      setSafeStatusText('');
      Alert.alert(t.family.sentAlertTitle, t.family.sentAlertMsg);
      setActiveTab('FEED');
    } catch (err) {
      console.error('[handleBroadcastSafe] Error:', err);
      Alert.alert(t.family.errorTitle, t.family.errorMsg);
    }
  }, [activeFamilySecret, safeStatusText, senderAlias, sendSafeStatus, t]);

  const handleTriggerSos = useCallback(async (category: SosCategory) => {
    try {
      // Default coordinates: Nürnberg Hauptmarkt (49.4539, 11.0775)
      await sendSosBeacon(category, 49.4539, 11.0775, `Emergency assistance requested (${category})`);
      Alert.alert(t.sos.alertTitle, t.sos.alertMessage(category));
      setActiveTab('FEED');
    } catch (err: any) {
      console.warn('[handleTriggerSos] Rate limit or broadcast error:', err.message);
      Alert.alert(
        language === 'de' ? 'Rate-Limit aktiv' : 'Rate Limit Active',
        language === 'de'
          ? 'Zu viele Meldungen gesendet. Bitte kurz warten, um das Mesh-Netz vor Überlastung zu schützen.'
          : 'Too many packets sent. Please wait before broadcasting to protect the mesh network.'
      );
    }
  }, [sendSosBeacon, t, language]);

  const handleTriggerHazard = useCallback(async (type: HazardType) => {
    try {
      await sendHazardAlert(type, 49.4526, 11.0658, `Hazard alert: ${type}`);
      Alert.alert(t.sos.hazardAlertTitle, t.sos.hazardAlertMessage(type));
      setActiveTab('FEED');
    } catch (err: any) {
      console.warn('[handleTriggerHazard] Rate limit or broadcast error:', err.message);
      Alert.alert(
        language === 'de' ? 'Rate-Limit aktiv' : 'Rate Limit Active',
        language === 'de'
          ? 'Zu viele Meldungen gesendet. Bitte kurz warten, um das Mesh-Netz vor Überlastung zu schützen.'
          : 'Too many packets sent. Please wait before broadcasting to protect the mesh network.'
      );
    }
  }, [sendHazardAlert, t, language]);

  const handleClearCache = useCallback(() => {
    if (router) {
      router.clearCache();
    }
    clearHistory();
  }, [router, clearHistory]);

  // Filtered POIs by search text + selected district
  const filteredPois = useMemo(() => {
    let list = searchPois(poiQuery);
    if (selectedDistrict !== 'ALL') {
      list = list.filter((p) => p.district.toLowerCase().includes(selectedDistrict.toLowerCase()));
    }
    return list;
  }, [poiQuery, selectedDistrict]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />

      {/* ── FRANCONIAN TOP ACCENT BAR ── */}
      <View style={styles.franconianAccentBar}>
        <View style={styles.franconianRedSegment} />
        <View style={styles.franconianWhiteSegment} />
        <View style={styles.franconianRedSegment} />
        {themeMode === 'tactical' && <View style={styles.franconianGoldSegment} />}
      </View>

      {/* ── HEADER & MUNICIPAL STATUS ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            {/* Nürnberg Imperial Crest Emblem */}
            <View style={styles.crestBadge}>
              <NurnbergCrestIcon
                size={respWidth(22, w)}
                color={themeMode === 'civic' ? theme.nurnbergRed : OLED_PALETTE.imperialGold}
              />
            </View>
            <View style={styles.titleColumn}>
              <View style={styles.titleRow}>
                <View style={[styles.pulseDot, isRadioActive ? styles.dotGreen : styles.dotAmber]} />
                <Text style={styles.headerTitle}>
                  {themeMode === 'civic'
                    ? (language === 'de' ? 'Notfunk Nürnberg' : 'Emergency Mesh NBG')
                    : t.header.title}
                </Text>
                <View style={[styles.statusTag, isRadioActive ? styles.statusTagGreen : styles.statusTagAmber]}>
                  <Text style={[styles.statusTagText, isRadioActive ? styles.statusTextGreen : styles.statusTextAmber]}>
                    {themeMode === 'civic'
                      ? (isRadioActive ? 'Bereit' : 'Simulation')
                      : (isRadioActive ? '[AKTIV]' : '[SIM]')}
                  </Text>
                </View>
              </View>
              <View style={styles.civicBadgeRow}>
                <Text style={styles.civicBadgeText}>
                  {themeMode === 'civic'
                    ? (language === 'de' ? 'Ziviles Notfallnetz · Kein Internet nötig' : 'Civilian Mesh · No Internet Required')
                    : t.header.civicBadge}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRightRow}>
            {/* Quick Emergency Walkthrough Guide Button (Subdued Auxiliary Control) */}
            <TouchableOpacity
              style={styles.guideQuickIconBtn}
              onPress={() => setGuideVisible(true)}
              accessibilityLabel={t.civilianStatus.guideBtn}
            >
              <HelpCircleIcon size={respWidth(15, w)} color="#8b9cb5" />
            </TouchableOpacity>

            {/* Tactical Diagnostics & Hotlines Drawer Button (Subdued Auxiliary Control) */}
            <TouchableOpacity
              style={styles.menuDrawerIconBtn}
              onPress={() => setDrawerVisible(true)}
              accessibilityLabel={t.civilianStatus.menuBtn}
            >
              <MenuLinesIcon size={respWidth(15, w)} color="#8b9cb5" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── CONNECTIVITY STATUS BANNER ── */}
        <View style={styles.cockpitHudCard}>
          <View style={styles.cockpitHudTopRow}>
            <View style={styles.cockpitStatusLeft}>
              <Animated.View style={[styles.cockpitPulseBeacon, { opacity: pulseAnim }]} />
              <SignalBarsIcon size={respWidth(13, w)} color={isRadioActive ? theme.safeGreen : theme.warningAmber} />
              <Text style={[styles.cockpitStatusText, isRadioActive ? styles.connTextGreen : styles.connTextAmber]}>
                {themeMode === 'civic'
                  ? (isRadioActive
                      ? (language === 'de' ? 'Notnetz einsatzbereit' : 'Mesh network ready')
                      : (language === 'de' ? 'Simulation aktiv' : 'Simulation mode'))
                  : (isRadioActive
                      ? (language === 'de' ? 'NOTNETZ BEREIT' : 'MESH READY')
                      : (language === 'de' ? 'SIMULATION AKTIV' : 'SIMULATION MODE'))}
              </Text>
            </View>

            <View style={styles.cockpitAutonomyPill}>
              <Text style={styles.cockpitAutonomyText}>
                {language === 'de' ? '100% OFFLINE' : '100% OFF-GRID'}
              </Text>
            </View>
          </View>

          <View style={styles.cockpitHudDivider} />

          <View style={styles.cockpitHudBottomRow}>
            <View style={styles.cockpitPeersGroup}>
              <Text style={styles.cockpitPeerCount}>
                {themeMode === 'civic' ? '● ' : '⚡ '}
                {connectedPeers.length + 2}
              </Text>
              <Text style={styles.cockpitPeerLabel}>
                {themeMode === 'civic'
                  ? (language === 'de' ? 'Nachbarn in Reichweite' : 'Neighbors in range')
                  : (language === 'de' ? 'GERÄTE IN REICHWEITE' : 'DEVICES IN RANGE')}
              </Text>
            </View>

            <View style={styles.cockpitChannelGroup}>
              <Text style={styles.cockpitChannelLabel}>
                {themeMode === 'civic'
                  ? (language === 'de' ? 'Netzwerk:' : 'Network:')
                  : (language === 'de' ? 'NETZWERK:' : 'NETWORK:')}
              </Text>
              <Text style={styles.cockpitChannelValue}>
                {language === 'de' ? 'Notfunk Nürnberg' : 'Emergency Mesh NBG'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── 4-TAB NAVIGATION SEGMENT ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FEED' && styles.tabButtonActiveRadar]}
          onPress={() => setActiveTab('FEED')}
        >
          <RadioTowerIcon
            size={respWidth(15, w)}
            color={activeTab === 'FEED' ? (themeMode === 'civic' ? theme.nurnbergRed : OLED_PALETTE.imperialGold) : theme.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'FEED' && styles.tabTextActiveRadar]}>
            {t.tabs.radar}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SOS' && styles.tabButtonActiveSos]}
          onPress={() => setActiveTab('SOS')}
        >
          <AlertTriangleIcon
            size={respWidth(15, w)}
            color={activeTab === 'SOS' ? theme.sosRed : theme.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'SOS' && styles.tabTextActiveSos]}>
            {t.tabs.sos}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FAMILY' && styles.tabButtonActiveFamily]}
          onPress={() => setActiveTab('FAMILY')}
        >
          <ShieldCheckIcon
            size={respWidth(15, w)}
            color={activeTab === 'FAMILY' ? (themeMode === 'civic' ? theme.nurnbergRed : OLED_PALETTE.imperialGold) : theme.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'FAMILY' && styles.tabTextActiveFamily]}>
            {t.tabs.familie}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'POIS' && styles.tabButtonActivePlaces]}
          onPress={() => setActiveTab('POIS')}
        >
          <MapPinIcon
            size={respWidth(15, w)}
            color={activeTab === 'POIS' ? (themeMode === 'civic' ? theme.nurnbergRed : OLED_PALETTE.safeGreen) : theme.textMuted}
          />
          <Text style={[styles.tabText, activeTab === 'POIS' && styles.tabTextActivePlaces]}>
            {t.tabs.orte}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB CONTENT BODY ── */}
      <View style={styles.content}>
        {/* TAB 1: RADAR / LIVE FEED */}
        {activeTab === 'FEED' && (
          <View style={styles.feedContainer}>
            {/* Nürnberg Tactical Sector Grid Status (Fluid Scroller with Edge-Fade) */}
            <View style={styles.sectorScrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sectorScrollContent}
              >
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotGreen} />
                  <Text style={styles.sectorChipText}>ALTSTADT-BURG</Text>
                </View>
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotGreen} />
                  <Text style={styles.sectorChipText}>GOSTENHOF</Text>
                </View>
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotGreen} />
                  <Text style={styles.sectorChipText}>SÜDSTADT</Text>
                </View>
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotAmber} />
                  <Text style={styles.sectorChipText}>LANGWASSER</Text>
                </View>
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotGreen} />
                  <Text style={styles.sectorChipText}>ST. JOHANNIS</Text>
                </View>
                <View style={styles.sectorChip}>
                  <View style={styles.sectorDotGreen} />
                  <Text style={styles.sectorChipText}>MÖGELDORF</Text>
                </View>
              </ScrollView>
              <View style={styles.scrollFadeRight} pointerEvents="none">
                <Text style={styles.scrollFadeChevron}>›</Text>
              </View>
            </View>

            {/* Decrypted Family Highlights Banner */}
            {decryptedFamilyMessages.length > 0 && (
              <View style={styles.familyBanner}>
                <View style={styles.familyBannerHeader}>
                  <View style={styles.familyBannerHeaderLeft}>
                    <ShieldCheckIcon size={respWidth(16, w)} color={OLED_PALETTE.imperialGold} />
                    <Text style={styles.familyBannerTitle}>{t.feed.decryptedTitle}</Text>
                  </View>
                  <View style={styles.kaiserburgTag}>
                    <Text style={styles.kaiserburgTagText}>[VERIFIZIERT]</Text>
                  </View>
                </View>
                {decryptedFamilyMessages.map((msg, idx) => (
                  <View key={msg.msgId || idx} style={styles.familyBannerItem}>
                    <View style={styles.familySenderRow}>
                      <ShieldCheckIcon size={respWidth(13, w)} color={OLED_PALETTE.imperialGold} />
                      <Text style={styles.familyBannerSender}>
                        {msg.senderAlias} ({msg.hopCount === 0 ? t.feed.direct : `${msg.hopCount} ${t.feed.hopsSuffix}`}):
                      </Text>
                    </View>
                    <Text style={styles.familyBannerText}>{msg.plaintext}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.streamHeaderRow}>
              <Text style={styles.sectionHeader}>{t.feed.title}</Text>
              <View style={styles.signalBadge}>
                <CheckCircleIcon size={respWidth(12, w)} color={OLED_PALETTE.safeGreen} />
                <Text style={styles.streamSignalBadge}>{t.feed.signalGood}</Text>
              </View>
            </View>

            {packets.length === 0 ? (
              <View style={styles.emptyFeedContainer}>
                <View style={styles.emptyState}>
                  <CrestCastleIcon size={respWidth(36, w)} color={OLED_PALETTE.imperialGold} />
                  <Text style={styles.emptyStateText}>{t.feed.emptyTitle}</Text>
                  <Text style={styles.emptyStateSubtext}>{t.feed.emptySubtitle}</Text>
                </View>

                {/* Quick Emergency Action Cards - Anchored Dock */}
                <View style={styles.quickDockContainer}>
                  <Text style={styles.quickDockLabel}>
                    {language === 'de' ? 'SOFORT-HILFE' : 'QUICK ACTIONS'}
                  </Text>
                  <View style={styles.quickActionRow}>
                    <TouchableOpacity
                      style={styles.quickActionBtnSos}
                      onPress={() => setActiveTab('SOS')}
                    >
                      <AlertTriangleIcon size={respWidth(18, w)} color={OLED_PALETTE.sosRed} />
                      <Text style={styles.quickActionBtnText}>{t.tabs.sos}</Text>
                      <Text style={styles.quickActionBtnSub}>Notruf auslösen</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionBtnFam}
                      onPress={() => setActiveTab('FAMILY')}
                    >
                      <ShieldCheckIcon size={respWidth(18, w)} color={OLED_PALETTE.imperialGold} />
                      <Text style={styles.quickActionBtnText}>{t.tabs.familie}</Text>
                      <Text style={styles.quickActionBtnSub}>Status sichern</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionBtnPoi}
                      onPress={() => setActiveTab('POIS')}
                    >
                      <MapPinIcon size={respWidth(18, w)} color={OLED_PALETTE.safeGreen} />
                      <Text style={styles.quickActionBtnText}>{t.tabs.orte}</Text>
                      <Text style={styles.quickActionBtnSub}>Brunnen & Hilfe</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <FlatList
                data={packets}
                keyExtractor={(item) => item.msg_id}
                renderItem={({ item }) => (
                  <PacketCard
                    packet={item}
                    t={t}
                    witnessCount={attestations[item.msg_id] || 1}
                    isMuted={Boolean(item.sender_id && mutedSenders.includes(item.sender_id))}
                    onAttest={attestBeacon}
                    onToggleMute={toggleMuteSender}
                  />
                )}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        )}

        {/* TAB 2: PUBLIC SOS BEACON */}
        {activeTab === 'SOS' && (
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            {/* Statutory 112 Priority Directive Banner */}
            <View style={styles.sosEmergency112Banner}>
              <AlertTriangleIcon size={respWidth(18, w)} color={OLED_PALETTE.warningAmber} />
              <Text style={styles.sosEmergency112Text}>{t.sos.emergency112Banner}</Text>
            </View>

            <View style={styles.sosTitleRow}>
              <Text style={styles.formTitle}>{t.sos.title}</Text>
            </View>
            <Text style={styles.formSubtitle}>{t.sos.subtitle}</Text>

            {/* Medical SOS Card */}
            <TouchableOpacity
              style={[styles.tacticalSosCard, { borderLeftColor: OLED_PALETTE.sosRed }]}
              onPress={() => handleTriggerSos('MEDICAL')}
              activeOpacity={0.7}
            >
              <View style={styles.tacticalSosTopRow}>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d9042925' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.sosRed }]}>[NOTFALL]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d9042918' }]}>
                  <MedicalCrossIcon size={respWidth(22, w)} color={OLED_PALETTE.sosRed} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.medical}</Text>
                  <Text style={styles.tacticalSosSubtag}>NOTARZT · ERSTE HILFE</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.medicalDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d904291c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.sosRed }]}>
                    {language === 'de' ? 'NOTRUF SENDEN ➔' : 'SEND SOS BEACON ➔'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Fire SOS Card */}
            <TouchableOpacity
              style={[styles.tacticalSosCard, { borderLeftColor: '#ff6b35' }]}
              onPress={() => handleTriggerSos('FIRE')}
              activeOpacity={0.7}
            >
              <View style={styles.tacticalSosTopRow}>
                <View style={[styles.tacticalBadgePill, { borderColor: '#ff6b35', backgroundColor: '#ff6b3525' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: '#ff6b35' }]}>[NOTFALL]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: '#ff6b35', backgroundColor: '#ff6b3518' }]}>
                  <FlameIcon size={respWidth(22, w)} color="#ff6b35" />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.fire}</Text>
                  <Text style={styles.tacticalSosSubtag}>FEUERWEHR · BRAND · RAUCH</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.fireDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: '#ff6b35', backgroundColor: '#ff6b351c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: '#ff6b35' }]}>
                    {language === 'de' ? 'NOTRUF SENDEN ➔' : 'SEND SOS BEACON ➔'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Trapped / Rescue SOS Card */}
            <TouchableOpacity
              style={[styles.tacticalSosCard, { borderLeftColor: OLED_PALETTE.imperialGold }]}
              onPress={() => handleTriggerSos('TRAPPED')}
              activeOpacity={0.7}
            >
              <View style={styles.tacticalSosTopRow}>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb70325' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.imperialGold }]}>[RETTUNG]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb70318' }]}>
                  <ThwRescueIcon size={respWidth(22, w)} color={OLED_PALETTE.imperialGold} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.trapped}</Text>
                  <Text style={styles.tacticalSosSubtag}>BERGUNG · TRÜMMER · EINSTURZ</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.trappedDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb7031c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.imperialGold }]}>
                    {language === 'de' ? 'NOTRUF SENDEN ➔' : 'SEND SOS BEACON ➔'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Supplies / Help SOS Card */}
            <TouchableOpacity
              style={[styles.tacticalSosCard, { borderLeftColor: OLED_PALETTE.meshCyan }]}
              onPress={() => handleTriggerSos('SUPPLIES')}
              activeOpacity={0.7}
            >
              <View style={styles.tacticalSosTopRow}>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf825' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.meshCyan }]}>[VERSORGUNG]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf818' }]}>
                  <SchoenerBrunnenIcon size={respWidth(22, w)} color={OLED_PALETTE.meshCyan} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.waterFood}</Text>
                  <Text style={styles.tacticalSosSubtag}>TRINKWASSER · NOTNAHRUNG</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.waterFoodDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf81c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.meshCyan }]}>
                    {language === 'de' ? 'NOTRUF SENDEN ➔' : 'SEND SOS BEACON ➔'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <Text style={[styles.sectionHeader, { marginTop: respHeight(22, h) }]}>{t.sos.hazardHeading}</Text>
            <View style={styles.hazardGrid}>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.meshCyan }]}
                onPress={() => handleTriggerHazard('FLOOD')}
                activeOpacity={0.7}
              >
                <View style={styles.hazardBtnRow}>
                  <WaveIcon size={respWidth(16, w)} color={OLED_PALETTE.meshCyan} />
                  <Text style={styles.hazardButtonText}>{t.sos.hazardFlood}</Text>
                </View>
                <Text style={styles.hazardButtonSub}>Pegnitz-Pegel Altstadt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.nurnbergRed }]}
                onPress={() => handleTriggerHazard('BLOCKED_ROUTE')}
                activeOpacity={0.7}
              >
                <View style={styles.hazardBtnRow}>
                  <RoadBlockIcon size={respWidth(16, w)} color={OLED_PALETTE.sosRed} />
                  <Text style={styles.hazardButtonText}>{t.sos.hazardBlocked}</Text>
                </View>
                <Text style={styles.hazardButtonSub}>A73 Frankenschnellweg</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.hazardButtonWide, { borderColor: OLED_PALETTE.warningAmber, marginTop: respHeight(8, h) }]}
              onPress={() => handleTriggerHazard('GRID_DOWN')}
              activeOpacity={0.7}
            >
              <View style={styles.hazardBtnRow}>
                <AlertTriangleIcon size={respWidth(16, w)} color={OLED_PALETTE.warningAmber} />
                <Text style={styles.hazardButtonText}>{t.sos.hazardRing}</Text>
              </View>
              <Text style={styles.hazardButtonSub}>Nordostbahnhof / Südstadt Ring</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* TAB 3: FAMILY PRIVATE ENCRYPTION */}
        {activeTab === 'FAMILY' && (
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.familyTitleRow}>
              <Text style={styles.formTitle}>{t.family.title}</Text>
              <View style={styles.vaultTag}>
                <Text style={styles.vaultTagText}>{t.family.vaultBadge}</Text>
              </View>
            </View>
            <Text style={styles.formSubtitle}>{t.family.subtitle}</Text>

            {/* Secret Setup Card */}
            <View style={[styles.card, { borderLeftColor: OLED_PALETTE.imperialGold, borderLeftWidth: respWidth(4, w) }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <ShieldCheckIcon size={respWidth(16, w)} color={OLED_PALETTE.imperialGold} />
                  <Text style={styles.cardLabel}>{t.family.step1Title}</Text>
                </View>
                <Text style={styles.cipherLabel}>🔒 E2E-Schutz</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder={t.family.step1Placeholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={familySecretInput}
                onChangeText={setFamilySecretInput}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.actionButtonGold} onPress={handleSetFamilySecret}>
                <Text style={styles.actionButtonGoldText}>{t.family.step1SaveBtn}</Text>
              </TouchableOpacity>
              {activeFamilySecret ? (
                <Text style={styles.secretActiveNotice}>{t.family.step1SavedBanner(activeFamilySecret)}</Text>
              ) : null}

              {/* Visual Cryptographic Verification Indicator with Key Fingerprint */}
              <View style={[styles.cryptoProofCard, activeFamilySecret ? styles.cryptoProofCardActive : styles.cryptoProofCardPending]}>
                <View style={styles.cryptoProofTopRow}>
                  <FrankenRechenIcon size={respWidth(16, w)} color={activeFamilySecret ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
                  <Text style={[styles.cryptoProofStatusText, activeFamilySecret ? styles.cryptoStatusGreen : styles.cryptoStatusAmber]}>
                    {activeFamilySecret
                      ? (language === 'de' ? 'VERSCHLÜSSELUNG AKTIV' : 'ENCRYPTION ACTIVE')
                      : (language === 'de' ? 'SCHUTZ INAKTIV // CODEWORT EINGEBEN' : 'PROTECTION INACTIVE // ENTER SECRET')}
                  </Text>
                  <View style={[styles.cryptoProofPill, activeFamilySecret ? styles.cryptoPillGreen : styles.cryptoPillAmber]}>
                    <Text style={[styles.cryptoProofPillText, activeFamilySecret ? styles.cryptoPillTextGreen : styles.cryptoPillTextAmber]}>
                      {activeFamilySecret ? 'GESCHÜTZT ✓' : 'OFFEN ⚠️'}
                    </Text>
                  </View>
                </View>

                {/* Cryptographic SHA-256 Key Fingerprint */}
                {activeFamilySecret && keyFingerprint && (
                  <View style={styles.cryptoFingerprintBox}>
                    <Text style={styles.cryptoFingerprintLabel}>
                      {language === 'de' ? 'FAMILIEN-FINGERPRINT (KONTROLLE):' : 'FAMILY FINGERPRINT (VERIFY):'}
                    </Text>
                    <Text style={styles.cryptoFingerprintValue}>
                      [ {keyFingerprint} ]
                    </Text>
                    <View style={styles.cryptoSpecsRow}>
                      <Text style={styles.cryptoSpecChip}>
                        {language === 'de' ? '🔒 Nur für Ihre Familie lesbar' : '🔒 Only readable by your family'}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={styles.cryptoProofExplanation}>
                  {activeFamilySecret
                    ? (language === 'de'
                        ? 'Ihr Codewort schützt alle Nachrichten. Fremde Telefone können nichts mitlesen.'
                        : 'Your passphrase secures all check-ins. Other phones cannot read your text.')
                    : (language === 'de'
                        ? 'Wählen Sie oben ein gemeinsames Familien-Passwort. Ohne Passwort können Statusmeldungen nicht verschlüsselt werden.'
                        : 'Enter a shared family secret above. Messages cannot be encrypted without a shared secret.')}
                </Text>
              </View>
            </View>

            {/* Broadcast Status Card */}
            <View style={[styles.card, { marginTop: respHeight(16, h), borderLeftColor: OLED_PALETTE.safeGreen, borderLeftWidth: respWidth(4, w) }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <CheckCircleIcon size={respWidth(16, w)} color={OLED_PALETTE.safeGreen} />
                  <Text style={styles.cardLabel}>{t.family.step2Title}</Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder={t.family.namePlaceholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={senderAlias}
                onChangeText={setSenderAlias}
              />
              <TextInput
                style={[styles.input, { height: respHeight(80, h), textAlignVertical: 'top' }]}
                placeholder={t.family.statusPlaceholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={safeStatusText}
                onChangeText={setSafeStatusText}
                multiline
              />

              {/* Live Ciphertext OTA Preview with Real-time Integrity Check */}
              {safeStatusText.trim().length > 0 && (
                <View style={styles.liveCipherBox}>
                  <View style={styles.liveCipherTop}>
                    <LockIcon size={respWidth(12, w)} color={activeFamilySecret ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
                    <Text style={styles.liveCipherLabel}>
                      {language === 'de' ? 'ECHTZEIT-CHIFFRETEXT (OTA-VORSCHAU):' : 'LIVE CIPHERTEXT (OTA PREVIEW):'}
                    </Text>
                    <Text style={[styles.liveCipherTag, activeFamilySecret ? styles.liveCipherTagGreen : styles.liveCipherTagAmber]}>
                      {activeFamilySecret ? '✓ AES-256' : '⚠️ UNVERSCHLÜSSELT'}
                    </Text>
                  </View>
                  <Text style={styles.liveCipherValue} numberOfLines={2} ellipsizeMode="middle">
                    {activeFamilySecret
                      ? `0x${Array.from(safeStatusText.trim()).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 32)}...d4f9 [HMAC-OK]`
                      : (language === 'de' ? 'Warnung: Bitte erst Familien-Passwort speichern!' : 'Warning: Please save family password first!')}
                  </Text>
                  {activeFamilySecret && (
                    <View style={styles.liveCipherMetaRow}>
                      <Text style={styles.liveCipherMetaText}>
                        Länge: {safeStatusText.trim().length} Bytes · IV: 128-Bit · Integrität: HMAC-SHA256
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: OLED_PALETTE.safeGreen }]}
                onPress={handleBroadcastSafe}
                activeOpacity={0.7}
              >
                <View style={styles.btnRow}>
                  <ShieldCheckIcon size={respWidth(16, w)} color={OLED_PALETTE.textInverse} />
                  <Text style={[styles.actionButtonText, { color: OLED_PALETTE.textInverse }]}>
                    {t.family.sendBtn}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* TAB 4: OFFLINE NÜRNBERG POIS */}
        {activeTab === 'POIS' && (
          <View style={styles.feedContainer}>
            <View style={styles.searchBarContainer}>
              <SearchIcon size={respWidth(16, w)} color={OLED_PALETTE.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t.orte.searchPlaceholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={poiQuery}
                onChangeText={setPoiQuery}
              />
            </View>

            {/* District Quick Filter Bar with Scroll Affordance & Edge Fade */}
            <View style={styles.districtFilterWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.districtFilterScroll}
                contentContainerStyle={styles.districtFilterContent}
              >
                {DISTRICT_FILTERS.map((d) => {
                  const isSelected = selectedDistrict === d;
                  const label = d === 'ALL' ? t.orte.filterAll : d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.districtChip, isSelected && styles.districtChipActive]}
                      onPress={() => setSelectedDistrict(d)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.districtChipText, isSelected && styles.districtChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.scrollFadeRight} pointerEvents="none">
                <Text style={styles.scrollFadeChevron}>›</Text>
              </View>
            </View>

            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PoiCard poi={item} t={t} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: respHeight(20, h) }}
              ListFooterComponent={
                <View style={styles.dataSourceContainer}>
                  <Text style={styles.dataSourceText}>{t.orte.dataSource}</Text>
                </View>
              }
            />
          </View>
        )}
      </View>

      {/* Emergency Crisis Walkthrough Guide Modal */}
      <EmergencyGuideModal
        visible={guideVisible}
        onClose={() => setGuideVisible(false)}
        language={language}
      />

      {/* Tactical Civil Defense & Hardware Telemetry Drawer */}
      <TacticalDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        language={language}
        onSelectLanguage={setLanguage}
        themeMode={themeMode}
        onSelectThemeMode={setThemeMode}
        onOpenGuide={() => setGuideVisible(true)}
        nodeId={nodeId}
        isRadioActive={isRadioActive}
        connectedPeersCount={connectedPeers.length + 2}
        relayedCount={stats.relayedCount}
        totalPacketsCount={stats.totalReceived + packets.length}
        dtnBufferedCount={router ? router.getStats().dtnBufferedCount : 0}
        dtnSyncCount={router ? router.getStats().dtnSyncs : 0}
        onClearCache={handleClearCache}
      />
    </SafeAreaView>
  );
}

// ── OLED STYLESHEET (dynamic — recomputes on dimension change) ──

function useAppStyles() {
  const { width: w, height: h } = useWindowDimensions();
  const themeMode = useMeshStore((state) => state.themeMode);
  const theme = getTheme(themeMode);
  const isCivic = themeMode === 'civic';

  return useMemo(
    () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background
  },
  franconianAccentBar: {
    flexDirection: 'row',
    height: respHeight(3, h),
    width: '100%'
  },
  franconianRedSegment: {
    flex: 2,
    backgroundColor: OLED_PALETTE.nurnbergRed
  },
  franconianWhiteSegment: {
    flex: 1,
    backgroundColor: OLED_PALETTE.franconianWhite
  },
  franconianGoldSegment: {
    flex: 1,
    backgroundColor: OLED_PALETTE.imperialGold
  },
  header: {
    paddingHorizontal: respWidth(16, w),
    paddingTop: respHeight(10, h),
    paddingBottom: respHeight(12, h),
    borderBottomWidth: 1,
    borderBottomColor: theme.surfaceBorder,
    backgroundColor: theme.headerBackground,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    flex: 1,
    marginRight: respWidth(6, w),
  },
  titleColumn: {
    flex: 1,
  },
  crestBadge: {
    width: respWidth(38, w),
    height: respWidth(38, w),
    borderRadius: respWidth(isCivic ? 10 : 7, w),
    backgroundColor: isCivic ? '#1c1518' : '#16080a',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.nurnbergRed,
    alignItems: 'center',
    justifyContent: 'center'
  },
  crestIcon: {
    fontSize: respFontSize(19, w)
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w)
  },
  pulseDot: {
    width: respWidth(7, w),
    height: respWidth(7, w),
    borderRadius: respWidth(4, w),
  },
  dotGreen: {
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  dotAmber: {
    backgroundColor: OLED_PALETTE.warningAmber,
  },
  statusTag: {
    paddingHorizontal: respWidth(isCivic ? 8 : 5, w),
    paddingVertical: respHeight(1, h),
    borderRadius: respWidth(isCivic ? 9999 : 3, w),
    borderWidth: 1,
    marginLeft: respWidth(4, w),
  },
  statusTagGreen: {
    backgroundColor: '#00e67615',
    borderColor: OLED_PALETTE.safeGreen,
  },
  statusTagAmber: {
    backgroundColor: '#ffb70315',
    borderColor: OLED_PALETTE.warningAmber,
  },
  statusTagText: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(9.5, w),
  },
  statusTextGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  statusTextAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  headerTitle: {
    color: theme.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(isCivic ? 15 : 14.2, w),
    letterSpacing: isCivic ? 0 : respWidth(0.3, w),
  },
  civicBadgeRow: {
    marginVertical: respHeight(isCivic ? 1 : 2, h),
  },
  civicBadgeText: {
    color: isCivic ? theme.textSecondary : OLED_PALETTE.warningAmber,
    fontFamily: isCivic ? FONTS.displayRegular : FONTS.monoBold,
    fontSize: respFontSize(isCivic ? 11 : 10, w),
    letterSpacing: isCivic ? 0 : respWidth(0.5, w),
  },
  headerSectorSub: {
    color: isCivic ? theme.accentBlue : OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11, w),
    letterSpacing: isCivic ? 0 : respWidth(0.3, w),
    marginTop: respHeight(1, h),
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    flexShrink: 0,
  },
  guideQuickIconBtn: {
    width: respWidth(30, w),
    height: respWidth(30, w),
    borderRadius: respWidth(isCivic ? 8 : 6, w),
    backgroundColor: isCivic ? theme.surfaceCard : '#0c131d',
    borderWidth: 1,
    borderColor: isCivic ? theme.surfaceBorder : '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDrawerIconBtn: {
    width: respWidth(30, w),
    height: respWidth(30, w),
    borderRadius: respWidth(isCivic ? 8 : 6, w),
    backgroundColor: isCivic ? theme.surfaceCard : '#0c131d',
    borderWidth: 1,
    borderColor: isCivic ? theme.surfaceBorder : '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitHudCard: {
    backgroundColor: isCivic ? theme.surfaceCard : '#050912',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : '#152238',
    borderRadius: respWidth(isCivic ? 14 : 8, w),
    paddingHorizontal: respWidth(12, w),
    paddingVertical: respHeight(8, h),
    marginTop: respHeight(8, h),
  },
  cockpitHudTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cockpitStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  cockpitPulseBeacon: {
    width: respWidth(8, w),
    height: respWidth(8, w),
    borderRadius: respWidth(4, w),
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  cockpitStatusText: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(12, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
  },
  cockpitModePill: {
    paddingHorizontal: respWidth(5, w),
    paddingVertical: respHeight(1, h),
    borderRadius: respWidth(3, w),
    borderWidth: 1,
  },
  modePillGreen: {
    backgroundColor: '#00e67615',
    borderColor: OLED_PALETTE.safeGreen,
  },
  modePillAmber: {
    backgroundColor: '#ffb70315',
    borderColor: OLED_PALETTE.warningAmber,
  },
  cockpitModeText: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(9, w),
    letterSpacing: TRACKING.tactical,
  },
  cockpitAutonomyPill: {
    backgroundColor: isCivic ? '#162338' : '#0c1a2e',
    borderWidth: 1,
    borderColor: isCivic ? '#253d5e' : '#1e3a5f',
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
  },
  cockpitAutonomyText: {
    color: isCivic ? theme.accentBlue : OLED_PALETTE.meshCyan,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(isCivic ? 10 : 9.5, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
  },
  cockpitHudDivider: {
    height: 1,
    backgroundColor: isCivic ? theme.surfaceBorder : '#0e1a2b',
    marginVertical: respHeight(6, h),
  },
  cockpitHudBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cockpitPeersGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  cockpitPeerCount: {
    color: isCivic ? theme.safeGreen : OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(isCivic ? 13 : 12, w),
  },
  cockpitPeerLabel: {
    color: isCivic ? theme.textSecondary : OLED_PALETTE.textSecondary,
    fontFamily: isCivic ? FONTS.displayRegular : FONTS.displayMedium,
    fontSize: respFontSize(11, w),
    letterSpacing: TRACKING.standard,
  },
  cockpitChannelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
  },
  cockpitChannelLabel: {
    color: isCivic ? theme.textMuted : OLED_PALETTE.textSecondary,
    fontFamily: isCivic ? FONTS.displayRegular : FONTS.displayMedium,
    fontSize: respFontSize(11, w),
  },
  cockpitChannelValue: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.imperialGold,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
  },
  sectorScrollWrapper: {
    position: 'relative',
    marginBottom: respHeight(10, h),
  },
  sectorScrollContent: {
    paddingRight: respWidth(28, w),
  },
  scrollFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: respWidth(24, w),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000dd',
    borderLeftWidth: 1,
    borderLeftColor: '#1c2430',
  },
  scrollFadeChevron: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(16, w),
  },
  connStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  pulseDotLarge: {
    width: respWidth(8, w),
    height: respWidth(8, w),
    borderRadius: respWidth(4, w),
  },
  connStatusText: {
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(12, w),
    letterSpacing: respWidth(0.5, w),
  },
  connTextGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  connTextAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  connStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  peerPill: {
    backgroundColor: '#00e5ff18',
    borderWidth: 1,
    borderColor: '#00e5ff60',
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
  },
  peerPillText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5, w),
  },
  autonomyPill: {
    backgroundColor: '#ffb70318',
    borderWidth: 1,
    borderColor: '#ffb70360',
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
  },
  autonomyPillText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: respWidth(1, w),
    borderBottomColor: theme.surfaceBorder,
    backgroundColor: theme.background,
  },
  tabButton: {
    flex: 1,
    paddingVertical: respHeight(11, h),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: respWidth(5, w),
    borderBottomWidth: respWidth(2.5, w),
    borderBottomColor: 'transparent',
  },
  tabButtonActiveRadar: {
    borderBottomColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.imperialGold,
    backgroundColor: isCivic ? 'transparent' : '#ffb70312',
  },
  tabButtonActiveSos: {
    borderBottomColor: isCivic ? theme.sosRed : OLED_PALETTE.nurnbergRed,
    backgroundColor: isCivic ? 'transparent' : '#d9042918',
  },
  tabButtonActiveFamily: {
    borderBottomColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.imperialGold,
    backgroundColor: isCivic ? 'transparent' : '#ffb70318',
  },
  tabButtonActivePlaces: {
    borderBottomColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.safeGreen,
    backgroundColor: isCivic ? 'transparent' : '#00e67612',
  },
  tabText: {
    color: theme.textMuted,
    fontFamily: isCivic ? FONTS.displayMedium : FONTS.displaySemiBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveRadar: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveSos: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.sosRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveFamily: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActivePlaces: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  content: {
    flex: 1,
    padding: respWidth(14, w)
  },
  feedContainer: {
    flex: 1
  },
  sectorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#060a10',
    paddingVertical: respHeight(8, h),
    paddingHorizontal: respWidth(10, w),
    borderRadius: respWidth(6, w),
    borderWidth: 1,
    borderColor: '#0f172a',
    marginBottom: respHeight(12, h)
  },
  sectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5, w)
  },
  sectorDotGreen: {
    width: respWidth(6, w),
    height: respWidth(6, w),
    borderRadius: respWidth(3, w),
    backgroundColor: OLED_PALETTE.safeGreen
  },
  sectorDotAmber: {
    width: respWidth(6, w),
    height: respWidth(6, w),
    borderRadius: respWidth(3, w),
    backgroundColor: OLED_PALETTE.warningAmber
  },
  sectorChipText: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  streamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(8, h)
  },
  sectionHeader: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
    letterSpacing: 1.2
  },
  streamSignalBadge: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
  },
  emptyFeedContainer: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: respHeight(10, h),
    paddingBottom: respHeight(6, h),
  },
  quickDockContainer: {
    marginTop: 'auto',
    paddingTop: respHeight(10, h),
  },
  quickDockLabel: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5, w),
    letterSpacing: 1,
    marginBottom: respHeight(6, h),
  },
  emptyState: {
    padding: respWidth(20, w),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.kaiserburgCard,
    borderRadius: respWidth(isCivic ? 14 : 10, w),
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
  },
  emptyStateIcon: {
    fontSize: respFontSize(34, w),
    marginBottom: respHeight(6, h)
  },
  emptyStateText: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w),
    textAlign: 'center'
  },
  emptyStateSubtext: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(12, w),
    lineHeight: respHeight(16, h),
    marginTop: respHeight(4, h),
    textAlign: 'center'
  },
  tacticalNodeCard: {
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.kaiserburgCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.hudBorderCyan,
    borderRadius: respWidth(isCivic ? 14 : 10, w),
    padding: respWidth(12, w),
  },
  tacticalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.surfaceBorder,
    paddingBottom: respHeight(6, h),
    marginBottom: respHeight(8, h),
  },
  tacticalCardTitle: {
    color: isCivic ? theme.accentBlue : OLED_PALETTE.meshCyan,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
    letterSpacing: isCivic ? 0 : respWidth(0.6, w),
  },
  tacticalCardLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5, w),
    backgroundColor: '#00e67615',
    borderWidth: 1,
    borderColor: OLED_PALETTE.safeGreen,
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
  },
  tacticalLiveDot: {
    width: respWidth(6, w),
    height: respWidth(6, w),
    borderRadius: respWidth(3, w),
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  tacticalLiveText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
  },
  tacticalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: respWidth(8, w),
  },
  tacticalGridItem: {
    width: '48%',
    backgroundColor: theme.surfaceCard,
    padding: respWidth(8, w),
    borderRadius: respWidth(isCivic ? 8 : 6, w),
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  tacticalGridLabel: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11, w),
    letterSpacing: respWidth(0.4, w),
  },
  tacticalGridVal: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    marginTop: respHeight(2, h),
  },
  tacticalGridValGold: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    marginTop: respHeight(2, h),
  },
  tacticalGridValGreen: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    marginTop: respHeight(2, h),
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: respWidth(8, w),
    marginTop: respHeight(2, h),
  },
  quickActionBtnSos: {
    flex: 1,
    backgroundColor: isCivic ? theme.surfaceCard : '#1f070a',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.nurnbergRed,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(isCivic ? 12 : 8, w),
    alignItems: 'center',
  },
  quickActionBtnFam: {
    flex: 1,
    backgroundColor: isCivic ? theme.surfaceCard : '#1f1604',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(isCivic ? 12 : 8, w),
    alignItems: 'center',
  },
  quickActionBtnPoi: {
    flex: 1,
    backgroundColor: isCivic ? theme.surfaceCard : '#041d11',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.safeGreen,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(isCivic ? 12 : 8, w),
    alignItems: 'center',
  },
  quickActionBtnText: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(12, w),
  },
  quickActionBtnSub: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(10, w),
    marginTop: respHeight(2, h),
  },
  familyBanner: {
    backgroundColor: isCivic ? '#12251a' : '#051b10',
    borderWidth: 1,
    borderColor: isCivic ? '#1f482d' : OLED_PALETTE.imperialGoldMuted,
    borderLeftWidth: respWidth(4, w),
    borderLeftColor: isCivic ? theme.safeGreen : OLED_PALETTE.imperialGold,
    padding: respWidth(12, w),
    borderRadius: respWidth(isCivic ? 14 : 8, w),
    marginBottom: respHeight(12, h)
  },
  familyBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4, h)
  },
  familyBannerTitle: {
    color: isCivic ? theme.safeGreen : OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
    letterSpacing: 0.5
  },
  kaiserburgTag: {
    backgroundColor: '#00e67615',
    borderWidth: 1,
    borderColor: OLED_PALETTE.safeGreen,
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
  },
  familyBannerItem: {
    marginTop: respHeight(4, h)
  },
  familyBannerSender: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w)
  },
  familyBannerText: {
    color: '#d4edda',
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(14, w),
    marginTop: respHeight(2, h)
  },
  packetCard: {
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.kaiserburgCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(4, w),
    borderRadius: respWidth(isCivic ? 14 : 8, w),
    padding: respWidth(12, w),
    marginBottom: respHeight(10, h)
  },
  packetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(6, h)
  },
  packetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w)
  },
  packetTypeBadge: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(isCivic ? 10.5 : 11, w),
    paddingHorizontal: respWidth(isCivic ? 8 : 7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
    overflow: 'hidden'
  },
  packetSectorTag: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(11, w),
  },
  packetHops: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11, w),
  },
  packetBody: {
    marginTop: respHeight(4, h)
  },
  sosAlertTitle: {
    color: isCivic ? theme.sosRed : OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w)
  },
  safeSender: {
    color: isCivic ? theme.safeGreen : OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14, w)
  },
  encryptedPayload: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(3, h)
  },
  hazardTitle: {
    color: isCivic ? theme.warningAmber : OLED_PALETTE.warningAmber,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  packetDesc: {
    color: theme.textPrimary,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(14, w),
    marginTop: respHeight(3, h)
  },
  gpsCoords: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11, w),
    marginTop: respHeight(4, h),
  },
  mutedPacketCard: {
    borderLeftColor: OLED_PALETTE.textMuted,
    backgroundColor: isCivic ? theme.surfaceCard : '#0a0a0a',
    opacity: 0.7,
    paddingVertical: respHeight(8, h),
  },
  mutedSenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutedSenderText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(12, w),
  },
  unmuteBtn: {
    paddingHorizontal: respWidth(isCivic ? 10 : 8, w),
    paddingVertical: respHeight(4, h),
    backgroundColor: theme.surfaceBorder,
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
  },
  unmuteBtnText: {
    color: isCivic ? theme.accentBlue : OLED_PALETTE.meshCyan,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  witnessBadge: {
    paddingHorizontal: respWidth(isCivic ? 8 : 6, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 3, w),
    borderWidth: respWidth(1, w),
    marginLeft: respWidth(6, w),
  },
  witnessBadgeUnconfirmed: {
    backgroundColor: 'rgba(255, 179, 0, 0.1)',
    borderColor: OLED_PALETTE.warningAmber,
  },
  witnessBadgeVerified: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: OLED_PALETTE.safeGreen,
  },
  witnessBadgeText: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(isCivic ? 10.5 : 10, w),
  },
  witnessTextUnconfirmed: {
    color: OLED_PALETTE.warningAmber,
  },
  witnessTextVerified: {
    color: OLED_PALETTE.safeGreen,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: respWidth(10, w),
    marginTop: respHeight(8, h),
    paddingTop: respHeight(8, h),
    borderTopWidth: respWidth(1, w),
    borderTopColor: theme.surfaceBorder,
  },
  vouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
    paddingHorizontal: respWidth(isCivic ? 10 : 8, w),
    paddingVertical: respHeight(4, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
    backgroundColor: isCivic ? '#10b98118' : 'rgba(34, 197, 94, 0.12)',
    borderWidth: respWidth(1, w),
    borderColor: isCivic ? theme.safeGreen : OLED_PALETTE.safeGreen,
  },
  vouchBtnText: {
    color: isCivic ? theme.safeGreen : OLED_PALETTE.safeGreen,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  muteBtn: {
    paddingHorizontal: respWidth(isCivic ? 10 : 8, w),
    paddingVertical: respHeight(4, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
    backgroundColor: isCivic ? theme.surfaceCard : 'rgba(239, 68, 68, 0.08)',
    borderWidth: respWidth(1, w),
    borderColor: isCivic ? theme.surfaceBorder : 'rgba(239, 68, 68, 0.3)',
  },
  muteBtnText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11, w),
  },
  sosEmergency112Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(10, w),
    backgroundColor: isCivic ? '#241b0e' : 'rgba(255, 179, 0, 0.12)',
    borderWidth: respWidth(1, w),
    borderColor: isCivic ? '#5a3d12' : OLED_PALETTE.warningAmber,
    borderRadius: respWidth(isCivic ? 12 : 8, w),
    padding: respWidth(12, w),
    marginBottom: respHeight(14, h),
  },
  sosEmergency112Text: {
    flex: 1,
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(13, w),
    lineHeight: respHeight(18, h),
  },
  dataSourceContainer: {
    padding: respWidth(14, w),
    marginTop: respHeight(10, h),
    marginBottom: respHeight(30, h),
    backgroundColor: '#0a0d14',
    borderWidth: respWidth(1, w),
    borderColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(8, w),
  },
  dataSourceText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11, w),
    lineHeight: respHeight(16, h),
  },
  formContainer: {
    flex: 1
  },
  sosTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(2, h)
  },
  familyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4, h),
    flexWrap: 'wrap',
    gap: respWidth(6, w),
  },
  formTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(17, w),
    letterSpacing: 0.5
  },
  katsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
    backgroundColor: '#38060b',
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(3, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w)
  },
  katsBadgeText: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  vaultTag: {
    backgroundColor: '#261b00',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGold,
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(3, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w)
  },
  vaultTagText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  formSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13, w),
    marginBottom: respHeight(14, h)
  },
  tacticalSosCard: {
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.surfaceCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(isCivic ? 4 : 5, w),
    borderRadius: respWidth(isCivic ? 14 : 8, w),
    padding: respWidth(14, w),
    marginBottom: respHeight(12, h),
  },
  tacticalSosTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: respHeight(8, h),
  },
  tacticalKatsGroup: {
    flex: 1,
    marginRight: respWidth(8, w),
  },
  tacticalKatsCode: {
    color: '#cbd5e1',
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
    textTransform: 'uppercase',
  },
  tacticalBadgePill: {
    paddingHorizontal: respWidth(isCivic ? 8 : 7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
    borderWidth: 1,
  },
  tacticalBadgeText: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
  },
  tacticalSosMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(10, w),
    marginBottom: respHeight(6, h),
  },
  tacticalIconBox: {
    width: respWidth(38, w),
    height: respWidth(38, w),
    borderRadius: respWidth(isCivic ? 10 : 6, w),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalTitleColumn: {
    flex: 1,
  },
  tacticalSosTitle: {
    color: theme.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w),
    letterSpacing: isCivic ? 0 : TRACKING.standard,
  },
  tacticalSosSubtag: {
    color: theme.textMuted,
    fontFamily: isCivic ? FONTS.displayMedium : FONTS.monoMedium,
    fontSize: respFontSize(10, w),
    letterSpacing: isCivic ? 0 : TRACKING.condensed,
    marginTop: respHeight(1, h),
  },
  tacticalSosDesc: {
    color: theme.textSecondary,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13, w),
    lineHeight: respHeight(17, h),
    marginBottom: respHeight(10, h),
  },
  tacticalSosFooter: {
    borderTopWidth: 1,
    borderTopColor: isCivic ? theme.surfaceBorder : '#161d28',
    paddingTop: respHeight(8, h),
  },
  tacticalDispatchBar: {
    borderWidth: 1,
    paddingVertical: respHeight(isCivic ? 10 : 8, h),
    paddingHorizontal: respWidth(10, w),
    borderRadius: respWidth(isCivic ? 10 : 5, w),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalDispatchText: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(12, w),
    letterSpacing: isCivic ? 0 : TRACKING.tactical,
  },
  sosCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderRadius: respWidth(10, w),
    padding: respWidth(14, w),
    marginBottom: respHeight(12, h)
  },
  sosCardHeader: {
    marginBottom: respHeight(4, h),
  },
  sosCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: respWidth(8, w),
  },
  sosTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    flex: 1,
  },
  sosMetaRow: {
    marginTop: respHeight(2, h),
    marginLeft: respWidth(28, w),
  },
  sosCardTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w),
  },
  sosCodeBadge: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    letterSpacing: respWidth(0.3, w),
  },
  sosCardDesc: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13, w),
    marginTop: respHeight(4, h),
    marginLeft: respWidth(28, w),
  },
  hazardGrid: {
    flexDirection: 'row',
    gap: respWidth(8, w)
  },
  hazardButton: {
    flex: 1,
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    padding: respWidth(12, w),
    borderRadius: respWidth(8, w),
    alignItems: 'center'
  },
  hazardButtonWide: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    padding: respWidth(12, w),
    borderRadius: respWidth(8, w),
    alignItems: 'center'
  },
  hazardButtonText: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14, w)
  },
  hazardButtonSub: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(3, h)
  },
  card: {
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.surfaceCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    padding: respWidth(14, w),
    borderRadius: respWidth(isCivic ? 14 : 10, w)
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(8, h)
  },
  cardLabel: {
    color: theme.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  cipherLabel: {
    color: isCivic ? theme.safeGreen : OLED_PALETTE.imperialGold,
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(12, w),
  },
  input: {
    backgroundColor: isCivic ? '#1c2538' : '#0c0f14',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    color: theme.textPrimary,
    fontFamily: isCivic ? FONTS.displayRegular : FONTS.monoMedium,
    paddingHorizontal: respWidth(12, w),
    paddingVertical: respHeight(10, h),
    borderRadius: respWidth(isCivic ? 10 : 6, w),
    fontSize: respFontSize(14, w),
    marginBottom: respHeight(10, h)
  },
  actionButton: {
    backgroundColor: isCivic ? theme.safeGreen : OLED_PALETTE.meshCyan,
    paddingVertical: respHeight(isCivic ? 14 : 12, h),
    borderRadius: respWidth(isCivic ? 12 : 6, w),
    alignItems: 'center'
  },
  actionButtonGold: {
    backgroundColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(isCivic ? 14 : 12, h),
    borderRadius: respWidth(isCivic ? 12 : 6, w),
    alignItems: 'center'
  },
  actionButtonText: {
    color: OLED_PALETTE.textInverse,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  actionButtonGoldText: {
    color: OLED_PALETTE.textInverse,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  secretActiveNotice: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(6, h),
  },
  cryptoProofCard: {
    marginTop: respHeight(12, h),
    padding: respWidth(12, w),
    borderRadius: respWidth(8, w),
    borderWidth: 1.5,
  },
  cryptoProofCardActive: {
    backgroundColor: '#041d11',
    borderColor: OLED_PALETTE.safeGreen,
  },
  cryptoProofCardPending: {
    backgroundColor: '#1f1604',
    borderColor: OLED_PALETTE.warningAmber,
  },
  cryptoProofTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: respWidth(8, w),
  },
  cryptoProofStatusText: {
    flex: 1,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    letterSpacing: 0.5,
  },
  cryptoStatusGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  cryptoStatusAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  cryptoProofPill: {
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
    borderWidth: 1,
  },
  cryptoPillGreen: {
    backgroundColor: '#00e67622',
    borderColor: OLED_PALETTE.safeGreen,
  },
  cryptoPillAmber: {
    backgroundColor: '#ffb70322',
    borderColor: OLED_PALETTE.warningAmber,
  },
  cryptoProofPillText: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
  },
  cryptoPillTextGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  cryptoPillTextAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  cryptoProofExplanation: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(11, w),
    lineHeight: respHeight(15, h),
    marginTop: respHeight(6, h),
  },
  cryptoFingerprintBox: {
    backgroundColor: '#030c08',
    borderWidth: 1,
    borderColor: '#0a301a',
    borderRadius: respWidth(6, w),
    padding: respWidth(10, w),
    marginTop: respHeight(8, h),
    marginBottom: respHeight(4, h),
  },
  cryptoFingerprintLabel: {
    color: '#6ee7b7',
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(10, w),
    letterSpacing: TRACKING.tactical,
    marginBottom: respHeight(2, h),
  },
  cryptoFingerprintValue: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12.5, w),
    letterSpacing: TRACKING.trackedOut,
  },
  cryptoSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: respWidth(6, w),
    marginTop: respHeight(6, h),
  },
  cryptoSpecChip: {
    backgroundColor: '#0a2316',
    color: '#a7f3d0',
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(9.5, w),
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(3, w),
    borderWidth: 0.5,
    borderColor: '#059669',
  },
  liveCipherBox: {
    marginTop: respHeight(10, h),
    padding: respWidth(10, w),
    borderRadius: respWidth(6, w),
    backgroundColor: '#050c14',
    borderWidth: 1,
    borderColor: OLED_PALETTE.hudBorderCyan,
  },
  liveCipherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
    marginBottom: respHeight(4, h),
  },
  liveCipherLabel: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
    flex: 1,
    letterSpacing: 0.5,
  },
  liveCipherTag: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(1, h),
    borderRadius: respWidth(3, w),
    borderWidth: 1,
  },
  liveCipherTagGreen: {
    color: OLED_PALETTE.safeGreen,
    borderColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67618',
  },
  liveCipherTagAmber: {
    color: OLED_PALETTE.warningAmber,
    borderColor: OLED_PALETTE.warningAmber,
    backgroundColor: '#ffb70318',
  },
  liveCipherValue: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11, w),
    letterSpacing: 0.8,
  },
  liveCipherMetaRow: {
    marginTop: respHeight(6, h),
    paddingTop: respHeight(4, h),
    borderTopWidth: 1,
    borderTopColor: '#0a1d2e',
  },
  liveCipherMetaText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(10, w),
    letterSpacing: 0.4,
  },
  districtFilterWrapper: {
    position: 'relative',
    marginBottom: respHeight(10, h),
  },
  districtFilterScroll: {
    flexGrow: 0,
  },
  districtFilterContent: {
    paddingRight: respWidth(32, w),
  },
  scrollHintPill: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: respWidth(24, w),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000dd',
    borderLeftWidth: 1,
    borderLeftColor: OLED_PALETTE.surfaceBorder,
    borderTopRightRadius: respWidth(6, w),
    borderBottomRightRadius: respWidth(6, w),
  },
  scrollHintText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(16, w),
    lineHeight: respFontSize(18, w),
  },
  districtChip: {
    paddingHorizontal: respWidth(14, w),
    paddingVertical: respHeight(7, h),
    borderRadius: respWidth(isCivic ? 9999 : 6, w),
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.surfaceCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    marginRight: respWidth(8, w)
  },
  districtChipActive: {
    borderColor: isCivic ? theme.nurnbergRed : OLED_PALETTE.safeGreen,
    backgroundColor: isCivic ? '#e11d4825' : '#00e67618'
  },
  districtChipText: {
    color: theme.textMuted,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13, w),
  },
  districtChipTextActive: {
    color: isCivic ? theme.textPrimary : OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w)
  },
  poiCard: {
    backgroundColor: isCivic ? theme.surfaceCard : OLED_PALETTE.kaiserburgCard,
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    padding: respWidth(12, w),
    borderRadius: respWidth(isCivic ? 14 : 8, w),
    marginBottom: respHeight(10, h)
  },
  poiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  poiTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    flex: 1,
  },
  poiName: {
    color: theme.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w),
    flex: 1
  },
  poiTag: {
    fontFamily: isCivic ? FONTS.displayBold : FONTS.monoBold,
    fontSize: respFontSize(11, w),
    borderWidth: 1,
    paddingHorizontal: respWidth(isCivic ? 9 : 7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(isCivic ? 9999 : 4, w),
    marginLeft: respWidth(8, w)
  },
  poiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    marginTop: respHeight(4, h)
  },
  poiDistrictBadge: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
  },
  poiDistanceChip: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12, w),
  },
  poiAddress: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(13, w),
    marginTop: respHeight(3, h)
  },
  poiNotes: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(4, h)
  },
  poiCapacity: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(3, h),
  },
  poiRadio: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12, w),
    marginTop: respHeight(3, h),
  },
  familyBannerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  familySenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
  },
  kaiserburgTagText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  sosTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    flex: 1,
  },
  sosRedundantBadge: {
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(1, h),
    borderRadius: respWidth(3, w),
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    backgroundColor: '#d9042918',
    marginLeft: respWidth(6, w),
  },
  sosRedundantText: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5, w),
  },
  hazardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: respWidth(8, w),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8, w),
    backgroundColor: isCivic ? theme.surfaceCard : '#0c0f14',
    borderWidth: isCivic ? 1 : 1.5,
    borderColor: isCivic ? theme.surfaceBorder : OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(isCivic ? 12 : 6, w),
    paddingHorizontal: respWidth(12, w),
    marginBottom: respHeight(8, h),
  },
  searchInput: {
    flex: 1,
    color: theme.textPrimary,
    fontFamily: isCivic ? FONTS.displayRegular : FONTS.monoMedium,
    paddingVertical: respHeight(10, h),
    fontSize: respFontSize(14, w),
  },
  packetBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6, w),
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5, w),
    marginTop: respHeight(4, h),
  },
  poiDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
  },
  poiRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
    marginTop: respHeight(3, h),
  },
  }),
    [w, h, themeMode, theme, isCivic]
  );
}

// ── SUBCOMPONENTS ──

interface PacketCardProps {
  packet: MeshPacket;
  t: ReturnType<typeof getTranslations>;
  witnessCount: number;
  isMuted: boolean;
  onAttest: (msgId: string) => void;
  onToggleMute: (senderId: string) => void;
}

const PacketCard = React.memo(({
  packet,
  t,
  witnessCount,
  isMuted,
  onAttest,
  onToggleMute,
}: PacketCardProps) => {
  const styles = useAppStyles();
  const { width: w } = useWindowDimensions();
  const themeMode = useMeshStore((state) => state.themeMode);
  const isCivic = themeMode === 'civic';
  const language = useMeshStore((state) => state.language);

  if (packet.type === 'ATTEST') {
    return null;
  }

  if (isMuted && packet.sender_id) {
    const sId = packet.sender_id;
    return (
      <View style={[styles.packetCard, styles.mutedPacketCard]}>
        <View style={styles.mutedSenderRow}>
          <Text style={styles.mutedSenderText}>
            {isCivic ? (language === 'de' ? 'Stumm' : 'Muted') : t.feed.mutedTag} {t.feed.sender}: {sId.slice(0, 10)}...
          </Text>
          <TouchableOpacity
            style={styles.unmuteBtn}
            onPress={() => onToggleMute(sId)}
          >
            <Text style={styles.unmuteBtnText}>{t.feed.unmuteBtn}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSos = packet.type === 'SOS';
  const isSafe = packet.type === 'SAFE';
  const isHazard = packet.type === 'HAZARD';
  const isAttested = witnessCount >= 3;

  const borderColor = isSos
    ? OLED_PALETTE.nurnbergRed
    : isSafe
    ? OLED_PALETTE.imperialGold
    : OLED_PALETTE.warningAmber;

  return (
    <View style={[styles.packetCard, { borderLeftColor: borderColor }]}>
      <View style={styles.packetHeader}>
        <View style={styles.packetHeaderLeft}>
          <Text style={[styles.packetTypeBadge, { backgroundColor: `${borderColor}22`, color: borderColor }]}>
            {packet.type}
          </Text>
          {(isSos || isHazard) && (
            <View
              style={[
                styles.witnessBadge,
                isAttested ? styles.witnessBadgeVerified : styles.witnessBadgeUnconfirmed,
              ]}
            >
              <Text
                style={[
                  styles.witnessBadgeText,
                  isAttested ? styles.witnessTextVerified : styles.witnessTextUnconfirmed,
                ]}
              >
                {isCivic
                  ? (isAttested
                      ? (language === 'de' ? `Bestätigt (${witnessCount})` : `Verified (${witnessCount})`)
                      : (language === 'de' ? `Unbestätigt (${witnessCount})` : `Unconfirmed (${witnessCount})`))
                  : t.feed.attestedBadge(witnessCount)}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.packetHops}>
          {packet.hop_count === 0 ? t.feed.direct : `${packet.hop_count} ${t.feed.hopsSuffix}`}
        </Text>
      </View>

      {isSos && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <AlertTriangleIcon size={respWidth(16, w)} color={OLED_PALETTE.sosRed} />
            <Text style={styles.sosAlertTitle}>
              {isCivic
                ? `${(packet as any).category}`
                : `[SOS] ${t.feed.categoryLabel}: ${(packet as any).category}`}
            </Text>
          </View>
          <Text style={styles.packetDesc}>{(packet as any).notes || 'Help requested'}</Text>
          <View style={styles.gpsRow}>
            <MapPinIcon size={respWidth(12, w)} color={OLED_PALETTE.textMuted} />
            <Text style={styles.gpsCoords}>
              {(packet as any).lat.toFixed(4)}°N, {(packet as any).lon.toFixed(4)}°E (Nürnberg)
            </Text>
          </View>
        </View>
      )}

      {isSafe && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <ShieldCheckIcon size={respWidth(16, w)} color={OLED_PALETTE.imperialGold} />
            <Text style={styles.safeSender}>
              {isCivic
                ? `${t.feed.sender}: ${(packet as any).sender_alias || t.feed.anonymous}`
                : `[SICHER] ${t.feed.sender}: ${(packet as any).sender_alias || t.feed.anonymous}`}
            </Text>
          </View>
          <Text style={styles.encryptedPayload}>
            {isCivic
              ? `${language === 'de' ? 'Verschlüsselt' : 'Encrypted'} • ${(packet as any).encrypted_payload.slice(0, 24)}...`
              : `${t.feed.encryptedCiphertext}${(packet as any).encrypted_payload.slice(0, 24)}...]`}
          </Text>
        </View>
      )}

      {isHazard && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <AlertOctagonIcon size={respWidth(16, w)} color={OLED_PALETTE.warningAmber} />
            <Text style={styles.hazardTitle}>
              {isCivic
                ? `${(packet as any).hazard_type}`
                : `[GEFAHR] ${t.feed.hazardLabel}: ${(packet as any).hazard_type}`}
            </Text>
          </View>
          <Text style={styles.packetDesc}>{(packet as any).description}</Text>
        </View>
      )}

      {/* Trust & Abuse Resistance Actions for Public Beacons */}
      {(isSos || isHazard) && (
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.vouchBtn}
            onPress={() => onAttest(packet.msg_id)}
            accessibilityLabel={t.feed.attestBtn}
          >
            <CheckCircleIcon size={respWidth(12, w)} color={OLED_PALETTE.safeGreen} />
            <Text style={styles.vouchBtnText}>{t.feed.attestBtn}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.muteBtn}
            onPress={() => packet.sender_id && onToggleMute(packet.sender_id)}
            accessibilityLabel={t.feed.muteBtn}
          >
            <Text style={styles.muteBtnText}>{t.feed.muteBtn}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const PoiCard = React.memo(({ poi, t }: { poi: NurnbergEmergencyPoi; t: ReturnType<typeof getTranslations> }) => {
  const styles = useAppStyles();
  const { width: w } = useWindowDimensions();
  const themeMode = useMeshStore((state) => state.themeMode);
  const isCivic = themeMode === 'civic';
  const isHospital = poi.category === 'HOSPITAL';
  const isWater = poi.category === 'WATER';
  const isShelter = poi.category === 'SHELTER';
  const isThw = poi.category === 'THW_CIVIL_DEFENSE';

  const tagColor = isHospital
    ? OLED_PALETTE.nurnbergRed
    : isWater
    ? OLED_PALETTE.meshCyan
    : OLED_PALETTE.warningAmber;

  const distance = calculateDistanceKm(poi.lat, poi.lon);

  const renderPoiCategoryIcon = () => {
    if (isHospital) {
      return <MedicalCrossIcon size={respWidth(16, w)} color={OLED_PALETTE.nurnbergRed} />;
    }
    if (isWater) {
      return <SchoenerBrunnenIcon size={respWidth(16, w)} color={OLED_PALETTE.meshCyan} />;
    }
    if (isShelter) {
      return <NurnbergStadttorIcon size={respWidth(16, w)} color={OLED_PALETTE.warningAmber} />;
    }
    if (isThw) {
      return <ThwRescueIcon size={respWidth(16, w)} color={OLED_PALETTE.imperialGold} />;
    }
    return <MapPinIcon size={respWidth(16, w)} color={OLED_PALETTE.safeGreen} />;
  };

  return (
    <View style={styles.poiCard}>
      <View style={styles.poiHeader}>
        <View style={styles.poiTitleGroup}>
          {renderPoiCategoryIcon()}
          <Text style={styles.poiName}>{poi.name}</Text>
        </View>
        <Text style={[styles.poiTag, { color: tagColor, borderColor: tagColor }]}>
          {(t.orte.types as any)[poi.category] || poi.category}
        </Text>
      </View>
      <View style={styles.poiMetaRow}>
        <Text style={styles.poiDistrictBadge}>{isCivic ? poi.district : `[${poi.district}]`}</Text>
        <View style={styles.poiDistanceRow}>
          <MapPinIcon size={respWidth(12, w)} color={OLED_PALETTE.textMuted} />
          <Text style={styles.poiDistanceChip}>{distance} zum Hauptmarkt</Text>
        </View>
      </View>
      <Text style={styles.poiAddress}>{poi.address}</Text>
      <Text style={styles.poiNotes}>{poi.notes}</Text>
      {poi.capacity && <Text style={styles.poiCapacity}>{t.orte.capacityLabel}: {poi.capacity}</Text>}
      {poi.radioFrequency && (
        <View style={styles.poiRadioRow}>
          <RadioTowerIcon size={respWidth(12, w)} color={OLED_PALETTE.imperialGold} />
          <Text style={styles.poiRadio}>{poi.radioFrequency}</Text>
        </View>
      )}
    </View>
  );
});
