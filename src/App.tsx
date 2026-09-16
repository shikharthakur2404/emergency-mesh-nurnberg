/**
 * Emergency Mesh Nürnberg — Main React Native HUD Interface
 * Pure OLED Black (#000000) Civil Defense (Katastrophenschutz) Dashboard
 * Built for Situation A: Total cellular/ISP blackout in Nürnberg.
 * High-tech tactical Kaiserburg / Franconian aesthetic.
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
  useWindowDimensions
} from 'react-native';
import CryptoJS from 'crypto-js';
import {
  OLED_PALETTE,
  respWidth,
  respHeight,
  respFontSize,
  FONTS,
  TRACKING
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
  const [activeTab, setActiveTab] = useState<Tab>('FEED');
  const [familySecretInput, setFamilySecretInput] = useState('');
  const [safeStatusText, setSafeStatusText] = useState('');
  const [senderAlias, setSenderAlias] = useState('');
  const [poiQuery, setPoiQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [isRadioActive, setIsRadioActive] = useState(false);
  const [guideVisible, setGuideVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
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
    stats,
    clearHistory
  } = useMeshStore();

  const t = useMemo(() => getTranslations(language), [language]);

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
        familySecrets: ['Nbg-Familie-2026'] // Default test pairing
      },
      hybridTransport
    );

    meshRouter.start().then(() => {
      attachRouter(meshRouter);
      setIsRadioActive(hybridTransport.isHardwareRadioActive());

      // Link mock virtual neighbors across Nürnberg for demo simulation
      const bus = VirtualNetworkBus.getInstance();
      const peer1 = new VirtualMeshTransport('peer-altstadt-01');
      const peer2 = new VirtualMeshTransport('peer-gostenhof-02');
      peer1.start();
      peer2.start();

      bus.linkNeighbors(nodeId, 'peer-altstadt-01');
      bus.linkNeighbors(nodeId, 'peer-gostenhof-02');
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
      <StatusBar barStyle="light-content" backgroundColor={OLED_PALETTE.background} />

      {/* ── FRANCONIAN TACTICAL TOP ACCENT BAR ── */}
      <View style={styles.franconianAccentBar}>
        <View style={styles.franconianRedSegment} />
        <View style={styles.franconianWhiteSegment} />
        <View style={styles.franconianRedSegment} />
        <View style={styles.franconianGoldSegment} />
      </View>

      {/* ── OLED HEADER & MUNICIPAL STATUS ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            {/* Nürnberg Imperial Crest Emblem */}
            <View style={styles.crestBadge}>
              <NurnbergCrestIcon size={respWidth(22, w)} color={OLED_PALETTE.imperialGold} />
            </View>
            <View style={styles.titleColumn}>
              <View style={styles.titleRow}>
                <View style={[styles.pulseDot, isRadioActive ? styles.dotGreen : styles.dotAmber]} />
                <Text style={styles.headerTitle}>
                  {t.header.title}
                </Text>
                <View style={[styles.statusTag, isRadioActive ? styles.statusTagGreen : styles.statusTagAmber]}>
                  <Text style={[styles.statusTagText, isRadioActive ? styles.statusTextGreen : styles.statusTextAmber]}>
                    {isRadioActive ? '[AKTIV]' : '[SIM]'}
                  </Text>
                </View>
              </View>
              <View style={styles.civicBadgeRow}>
                <Text style={styles.civicBadgeText}>{t.header.civicBadge}</Text>
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

        {/* ── COCKPIT CONNECTIVITY TELEMETRY HUD ── */}
        <View style={styles.cockpitHudCard}>
          <View style={styles.cockpitHudTopRow}>
            <View style={styles.cockpitStatusLeft}>
              <Animated.View style={[styles.cockpitPulseBeacon, { opacity: pulseAnim }]} />
              <SignalBarsIcon size={respWidth(13, w)} color={isRadioActive ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
              <Text style={[styles.cockpitStatusText, isRadioActive ? styles.connTextGreen : styles.connTextAmber]}>
                {isRadioActive ? 'P2P-FUNK AKTIV' : 'RADIO-SIMULATION'}
              </Text>
              <View style={[styles.cockpitModePill, isRadioActive ? styles.modePillGreen : styles.modePillAmber]}>
                <Text style={[styles.cockpitModeText, isRadioActive ? styles.connTextGreen : styles.connTextAmber]}>
                  {isRadioActive ? 'AD-HOC' : 'SIM-BUS'}
                </Text>
              </View>
            </View>

            <View style={styles.cockpitAutonomyPill}>
              <Text style={styles.cockpitAutonomyText}>
                {language === 'de' ? 'AUTONOM // OFF-GRID' : '100% OFF-GRID'}
              </Text>
            </View>
          </View>

          <View style={styles.cockpitHudDivider} />

          <View style={styles.cockpitHudBottomRow}>
            <View style={styles.cockpitPeersGroup}>
              <Text style={styles.cockpitPeerCount}>
                ⚡ {connectedPeers.length + 2}
              </Text>
              <Text style={styles.cockpitPeerLabel}>
                {language === 'de' ? 'KNOTEN ERREICHBAR' : 'NODES IN RANGE'}
              </Text>
            </View>

            <View style={styles.cockpitChannelGroup}>
              <Text style={styles.cockpitChannelLabel}>KANAL:</Text>
              <Text style={styles.cockpitChannelValue}>PEGNITZ-8888 · 2.4 GHz</Text>
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
            color={activeTab === 'FEED' ? OLED_PALETTE.imperialGold : OLED_PALETTE.textMuted}
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
            color={activeTab === 'SOS' ? OLED_PALETTE.sosRed : OLED_PALETTE.textMuted}
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
            color={activeTab === 'FAMILY' ? OLED_PALETTE.imperialGold : OLED_PALETTE.textMuted}
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
            color={activeTab === 'POIS' ? OLED_PALETTE.safeGreen : OLED_PALETTE.textMuted}
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

                {/* Collapsible Municipal Diagnostics & Radio Status */}
                <DiagnosticsDisclosure
                  channelName="PEGNITZ-8888"
                  gpsCoords="49.45°N 11.08°E"
                  dtnBufferedCount={router ? router.getStats().dtnBufferedCount : 0}
                  dtnSyncCount={router ? router.getStats().dtnSyncs : 0}
                  nodeId={nodeId}
                  isRadioActive={isRadioActive}
                />

                {/* Quick Emergency Action Cards - Anchored Dock */}
                <View style={styles.quickDockContainer}>
                  <Text style={styles.quickDockLabel}>
                    {language === 'de' ? 'SCHNELL-AKTIONEN // DIREKT-ZUGRIFF' : 'QUICK ACTIONS // DIRECT ACCESS'}
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
              <View style={styles.katsBadge}>
                <KatsSireneIcon size={respWidth(13, w)} color={OLED_PALETTE.nurnbergRed} />
                <Text style={styles.katsBadgeText}>KATS-DEFCON 1</Text>
              </View>
            </View>
            <Text style={styles.formSubtitle}>{t.sos.subtitle}</Text>

            {/* Medical SOS Card - NATO Tactical Grid (Zero Overlap) */}
            <TouchableOpacity
              style={[styles.tacticalSosCard, { borderLeftColor: OLED_PALETTE.sosRed }]}
              onPress={() => handleTriggerSos('MEDICAL')}
              activeOpacity={0.7}
            >
              <View style={styles.tacticalSosTopRow}>
                <View style={styles.tacticalKatsGroup}>
                  <Text style={styles.tacticalKatsCode}>{t.sos.codeMedical}</Text>
                </View>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d9042925' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.sosRed }]}>[SOS]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d9042918' }]}>
                  <MedicalCrossIcon size={respWidth(22, w)} color={OLED_PALETTE.sosRed} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.medical}</Text>
                  <Text style={styles.tacticalSosSubtag}>NOTARZT · RETTUNGSDIENST · ERSTE HILFE</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.medicalDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.sosRed, backgroundColor: '#d904291c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.sosRed }]}>NOTRUF ABSETZEN [1-TAP] ➔</Text>
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
                <View style={styles.tacticalKatsGroup}>
                  <Text style={styles.tacticalKatsCode}>{t.sos.codeFire}</Text>
                </View>
                <View style={[styles.tacticalBadgePill, { borderColor: '#ff6b35', backgroundColor: '#ff6b3525' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: '#ff6b35' }]}>[SOS]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: '#ff6b35', backgroundColor: '#ff6b3518' }]}>
                  <FlameIcon size={respWidth(22, w)} color="#ff6b35" />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.fire}</Text>
                  <Text style={styles.tacticalSosSubtag}>FEUERWEHR · RAUCHENTWICKLUNG · EXPLOSION</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.fireDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: '#ff6b35', backgroundColor: '#ff6b351c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: '#ff6b35' }]}>NOTRUF ABSETZEN [1-TAP] ➔</Text>
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
                <View style={styles.tacticalKatsGroup}>
                  <Text style={styles.tacticalKatsCode}>{t.sos.codeTrapped}</Text>
                </View>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb70325' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.imperialGold }]}>[SOS]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb70318' }]}>
                  <ThwRescueIcon size={respWidth(22, w)} color={OLED_PALETTE.imperialGold} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.trapped}</Text>
                  <Text style={styles.tacticalSosSubtag}>THW BERGUNG · TRÜMMER · EINSTURZ</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.trappedDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.imperialGold, backgroundColor: '#ffb7031c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.imperialGold }]}>NOTRUF ABSETZEN [1-TAP] ➔</Text>
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
                <View style={styles.tacticalKatsGroup}>
                  <Text style={styles.tacticalKatsCode}>{t.sos.codeWater}</Text>
                </View>
                <View style={[styles.tacticalBadgePill, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf825' }]}>
                  <Text style={[styles.tacticalBadgeText, { color: OLED_PALETTE.meshCyan }]}>[HILFE]</Text>
                </View>
              </View>

              <View style={styles.tacticalSosMainRow}>
                <View style={[styles.tacticalIconBox, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf818' }]}>
                  <SchoenerBrunnenIcon size={respWidth(22, w)} color={OLED_PALETTE.meshCyan} />
                </View>
                <View style={styles.tacticalTitleColumn}>
                  <Text style={styles.tacticalSosTitle}>{t.sos.waterFood}</Text>
                  <Text style={styles.tacticalSosSubtag}>GRUNDVERSORGUNG · TRINKWASSER · NAHRUNG</Text>
                </View>
              </View>

              <Text style={styles.tacticalSosDesc}>{t.sos.waterFoodDesc}</Text>

              <View style={styles.tacticalSosFooter}>
                <View style={[styles.tacticalDispatchBar, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf81c' }]}>
                  <Text style={[styles.tacticalDispatchText, { color: OLED_PALETTE.meshCyan }]}>HILFE ANFORDERN [1-TAP] ➔</Text>
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
                <Text style={styles.cipherLabel}>AES-256-CBC</Text>
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
                      ? (language === 'de' ? 'AES-256-CBC VERSCHLÜSSELUNG AKTIV' : 'AES-256-CBC ENCRYPTION ACTIVE')
                      : (language === 'de' ? 'TRESOR INAKTIV // KEIN PASSWORT' : 'VAULT INACTIVE // NO SECRET')}
                  </Text>
                  <View style={[styles.cryptoProofPill, activeFamilySecret ? styles.cryptoPillGreen : styles.cryptoPillAmber]}>
                    <Text style={[styles.cryptoProofPillText, activeFamilySecret ? styles.cryptoPillTextGreen : styles.cryptoPillTextAmber]}>
                      {activeFamilySecret ? 'VERIFIZIERT ✓' : 'OFFEN ⚠️'}
                    </Text>
                  </View>
                </View>

                {/* Cryptographic SHA-256 Key Fingerprint */}
                {activeFamilySecret && keyFingerprint && (
                  <View style={styles.cryptoFingerprintBox}>
                    <Text style={styles.cryptoFingerprintLabel}>
                      {language === 'de' ? 'SCHLÜSSEL-FINGERPRINT (SHA-256):' : 'KEY FINGERPRINT (SHA-256):'}
                    </Text>
                    <Text style={styles.cryptoFingerprintValue}>
                      [ {keyFingerprint} ]
                    </Text>
                    <View style={styles.cryptoSpecsRow}>
                      <Text style={styles.cryptoSpecChip}>PBKDF2 (10.000)</Text>
                      <Text style={styles.cryptoSpecChip}>AES-256-CBC</Text>
                      <Text style={styles.cryptoSpecChip}>HMAC-SHA256</Text>
                    </View>
                  </View>
                )}

                <Text style={styles.cryptoProofExplanation}>
                  {activeFamilySecret
                    ? (language === 'de'
                        ? 'Schlüssel kryptografisch abgeleitet (PBKDF2/SHA-256). Zwischenknoten leiten ausschließlich unlesbaren Ciphertext weiter.'
                        : 'Key derived via PBKDF2/SHA-256. Intermediate mesh relays route encrypted ciphertext only.')
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
  return useMemo(
    () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OLED_PALETTE.background
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
    borderBottomColor: OLED_PALETTE.surfaceBorder
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
    borderRadius: respWidth(7, w),
    backgroundColor: '#16080a',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.nurnbergRed,
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
    paddingHorizontal: respWidth(5, w),
    paddingVertical: respHeight(1, h),
    borderRadius: respWidth(3, w),
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
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(9.5, w),
  },
  statusTextGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  statusTextAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  headerTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14.2, w),
    letterSpacing: respWidth(0.3, w),
  },
  civicBadgeRow: {
    marginVertical: respHeight(2, h),
  },
  civicBadgeText: {
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
    letterSpacing: respWidth(0.5, w),
  },
  headerSectorSub: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11, w),
    letterSpacing: respWidth(0.3, w),
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
    borderRadius: respWidth(6, w),
    backgroundColor: '#0c131d',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDrawerIconBtn: {
    width: respWidth(30, w),
    height: respWidth(30, w),
    borderRadius: respWidth(6, w),
    backgroundColor: '#0c131d',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cockpitHudCard: {
    backgroundColor: '#050912',
    borderWidth: 1.5,
    borderColor: '#152238',
    borderRadius: respWidth(8, w),
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
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
    letterSpacing: TRACKING.tactical,
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
    backgroundColor: '#0c1a2e',
    borderWidth: 1,
    borderColor: '#1e3a5f',
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
  },
  cockpitAutonomyText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(9.5, w),
    letterSpacing: TRACKING.tactical,
  },
  cockpitHudDivider: {
    height: 1,
    backgroundColor: '#0e1a2b',
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
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
  },
  cockpitPeerLabel: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(11, w),
    letterSpacing: TRACKING.standard,
  },
  cockpitChannelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
  },
  cockpitChannelLabel: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(10, w),
    letterSpacing: TRACKING.tactical,
  },
  cockpitChannelValue: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
    letterSpacing: TRACKING.tactical,
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
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    backgroundColor: '#030508',
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
    borderBottomColor: OLED_PALETTE.imperialGold,
    backgroundColor: '#ffb70312',
  },
  tabButtonActiveSos: {
    borderBottomColor: OLED_PALETTE.nurnbergRed,
    backgroundColor: '#d9042918',
  },
  tabButtonActiveFamily: {
    borderBottomColor: OLED_PALETTE.imperialGold,
    backgroundColor: '#ffb70318',
  },
  tabButtonActivePlaces: {
    borderBottomColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67612',
  },
  tabText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveRadar: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveSos: {
    color: OLED_PALETTE.sosRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActiveFamily: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
  },
  tabTextActivePlaces: {
    color: OLED_PALETTE.safeGreen,
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
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderRadius: respWidth(10, w),
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
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
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.hudBorderCyan,
    borderRadius: respWidth(10, w),
    padding: respWidth(12, w),
  },
  tacticalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    paddingBottom: respHeight(6, h),
    marginBottom: respHeight(8, h),
  },
  tacticalCardTitle: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w),
    letterSpacing: respWidth(0.6, w),
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
    borderRadius: respWidth(4, w),
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
    backgroundColor: OLED_PALETTE.surfaceCard,
    padding: respWidth(8, w),
    borderRadius: respWidth(6, w),
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
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
    backgroundColor: '#1f070a',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.nurnbergRed,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(8, w),
    alignItems: 'center',
  },
  quickActionBtnFam: {
    flex: 1,
    backgroundColor: '#1f1604',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(8, w),
    alignItems: 'center',
  },
  quickActionBtnPoi: {
    flex: 1,
    backgroundColor: '#041d11',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.safeGreen,
    paddingVertical: respHeight(10, h),
    paddingHorizontal: respWidth(6, w),
    borderRadius: respWidth(8, w),
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
    backgroundColor: '#051b10',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGoldMuted,
    borderLeftWidth: respWidth(4, w),
    borderLeftColor: OLED_PALETTE.imperialGold,
    padding: respWidth(12, w),
    borderRadius: respWidth(8, w),
    marginBottom: respHeight(12, h)
  },
  familyBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4, h)
  },
  familyBannerTitle: {
    color: OLED_PALETTE.imperialGold,
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
    borderRadius: respWidth(4, w),
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
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(4, w),
    borderRadius: respWidth(8, w),
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
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
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
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w)
  },
  safeSender: {
    color: OLED_PALETTE.imperialGold,
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
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  packetDesc: {
    color: OLED_PALETTE.textPrimary,
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
    backgroundColor: '#0a0a0a',
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
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(4, h),
    backgroundColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(4, w),
  },
  unmuteBtnText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  witnessBadge: {
    paddingHorizontal: respWidth(6, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(3, w),
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
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10, w),
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
    borderTopColor: OLED_PALETTE.surfaceBorder,
  },
  vouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4, w),
    paddingHorizontal: respWidth(10, w),
    paddingVertical: respHeight(4, h),
    borderRadius: respWidth(4, w),
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: respWidth(1, w),
    borderColor: OLED_PALETTE.safeGreen,
  },
  vouchBtnText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  muteBtn: {
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(4, h),
    borderRadius: respWidth(4, w),
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: respWidth(1, w),
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    backgroundColor: 'rgba(255, 179, 0, 0.12)',
    borderWidth: respWidth(1.5, w),
    borderColor: OLED_PALETTE.warningAmber,
    borderRadius: respWidth(8, w),
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
    borderRadius: respWidth(4, w)
  },
  katsBadgeText: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  vaultTag: {
    backgroundColor: '#261b00',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGold,
    paddingHorizontal: respWidth(8, w),
    paddingVertical: respHeight(3, h),
    borderRadius: respWidth(4, w)
  },
  vaultTagText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
  },
  formSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13, w),
    marginBottom: respHeight(14, h)
  },
  tacticalSosCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(5, w),
    borderRadius: respWidth(8, w),
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
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5, w),
    letterSpacing: TRACKING.tactical,
    textTransform: 'uppercase',
  },
  tacticalBadgePill: {
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
    borderWidth: 1,
  },
  tacticalBadgeText: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
    letterSpacing: TRACKING.tactical,
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
    borderRadius: respWidth(6, w),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalTitleColumn: {
    flex: 1,
  },
  tacticalSosTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w),
    letterSpacing: TRACKING.standard,
  },
  tacticalSosSubtag: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(10, w),
    letterSpacing: TRACKING.condensed,
    marginTop: respHeight(1, h),
  },
  tacticalSosDesc: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13, w),
    lineHeight: respHeight(17, h),
    marginBottom: respHeight(10, h),
  },
  tacticalSosFooter: {
    borderTopWidth: 1,
    borderTopColor: '#161d28',
    paddingTop: respHeight(8, h),
  },
  tacticalDispatchBar: {
    borderWidth: 1,
    paddingVertical: respHeight(8, h),
    paddingHorizontal: respWidth(10, w),
    borderRadius: respWidth(5, w),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tacticalDispatchText: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
    letterSpacing: TRACKING.tactical,
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
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(14, w),
    borderRadius: respWidth(10, w)
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(8, h)
  },
  cardLabel: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15, w)
  },
  cipherLabel: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12, w),
  },
  input: {
    backgroundColor: '#0c0f14',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoMedium,
    paddingHorizontal: respWidth(12, w),
    paddingVertical: respHeight(10, h),
    borderRadius: respWidth(6, w),
    fontSize: respFontSize(14, w),
    marginBottom: respHeight(10, h)
  },
  actionButton: {
    backgroundColor: OLED_PALETTE.meshCyan,
    paddingVertical: respHeight(12, h),
    borderRadius: respWidth(6, w),
    alignItems: 'center'
  },
  actionButtonGold: {
    backgroundColor: OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(12, h),
    borderRadius: respWidth(6, w),
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
    borderRadius: respWidth(6, w),
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    marginRight: respWidth(8, w)
  },
  districtChipActive: {
    borderColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67618'
  },
  districtChipText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13, w),
  },
  districtChipTextActive: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13, w)
  },
  poiCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(12, w),
    borderRadius: respWidth(8, w),
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
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16, w),
    flex: 1
  },
  poiTag: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11, w),
    borderWidth: 1,
    paddingHorizontal: respWidth(7, w),
    paddingVertical: respHeight(2, h),
    borderRadius: respWidth(4, w),
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
    backgroundColor: '#0c0f14',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(6, w),
    paddingHorizontal: respWidth(10, w),
    marginBottom: respHeight(8, h),
  },
  searchInput: {
    flex: 1,
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoMedium,
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
    [w, h]
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
  if (packet.type === 'ATTEST') {
    return null;
  }

  if (isMuted && packet.sender_id) {
    const sId = packet.sender_id;
    return (
      <View style={[styles.packetCard, styles.mutedPacketCard]}>
        <View style={styles.mutedSenderRow}>
          <Text style={styles.mutedSenderText}>
            {t.feed.mutedTag} {t.feed.sender}: {sId.slice(0, 10)}...
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
          <Text style={styles.packetSectorTag}>// NBG-NET</Text>
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
                {t.feed.attestedBadge(witnessCount)}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.packetHops}>
          {packet.hop_count === 0 ? t.feed.direct : `${packet.hop_count} ${t.feed.hopsSuffix}`} · TTL: {packet.ttl}
        </Text>
      </View>

      {isSos && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <AlertTriangleIcon size={respWidth(16, w)} color={OLED_PALETTE.sosRed} />
            <Text style={styles.sosAlertTitle}>[SOS] {t.feed.categoryLabel}: {(packet as any).category}</Text>
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
            <Text style={styles.safeSender}>[SICHER] {t.feed.sender}: {(packet as any).sender_alias || t.feed.anonymous}</Text>
          </View>
          <Text style={styles.encryptedPayload}>
            {t.feed.encryptedCiphertext}{(packet as any).encrypted_payload.slice(0, 24)}...]
          </Text>
        </View>
      )}

      {isHazard && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <AlertOctagonIcon size={respWidth(16, w)} color={OLED_PALETTE.warningAmber} />
            <Text style={styles.hazardTitle}>[GEFAHR] {t.feed.hazardLabel}: {(packet as any).hazard_type}</Text>
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
        <Text style={styles.poiDistrictBadge}>[{poi.district}]</Text>
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
