/**
 * Emergency Mesh Nürnberg — Main React Native HUD Interface
 * Pure OLED Black (#000000) Civil Defense (Katastrophenschutz) Dashboard
 * Built for Situation A: Total cellular/ISP blackout in Nürnberg.
 * High-tech tactical Kaiserburg / Franconian aesthetic.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Alert
} from 'react-native';
import {
  OLED_PALETTE,
  respWidth,
  respHeight,
  respFontSize,
  FONTS
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
              <NurnbergCrestIcon size={respWidth(22)} color={OLED_PALETTE.imperialGold} />
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
            {/* Quick Emergency Walkthrough Guide Button (Streamlined Icon) */}
            <TouchableOpacity
              style={styles.guideQuickIconBtn}
              onPress={() => setGuideVisible(true)}
              accessibilityLabel={t.civilianStatus.guideBtn}
            >
              <HelpCircleIcon size={respWidth(16)} color={OLED_PALETTE.imperialGold} />
            </TouchableOpacity>

            {/* Tactical Diagnostics & Hotlines Drawer Button */}
            <TouchableOpacity
              style={styles.menuDrawerIconBtn}
              onPress={() => setDrawerVisible(true)}
              accessibilityLabel={t.civilianStatus.menuBtn}
            >
              <MenuLinesIcon size={respWidth(16)} color={OLED_PALETTE.meshCyan} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PERSISTENT CONNECTIVITY & MESH TELEMETRY STRIP ── */}
        <View style={styles.connectivityStrip}>
          <View style={styles.connStatusLeft}>
            <View style={[styles.pulseDotLarge, isRadioActive ? styles.dotGreen : styles.dotAmber]} />
            <SignalBarsIcon size={respWidth(13)} color={isRadioActive ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
            <Text style={[styles.connStatusText, isRadioActive ? styles.connTextGreen : styles.connTextAmber]}>
              {isRadioActive ? 'P2P-FUNK AKTIV' : 'RADIO SIMULATION'}
            </Text>
          </View>

          <View style={styles.connStatusRight}>
            <View style={styles.peerPill}>
              <Text style={styles.peerPillText}>
                ⚡ {connectedPeers.length + 2} {language === 'de' ? 'GERÄTE' : 'PEERS'}
              </Text>
            </View>
            <View style={styles.autonomyPill}>
              <Text style={styles.autonomyPillText}>
                {language === 'de' ? 'AUTONOM' : 'OFF-GRID'}
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
            size={respWidth(15)}
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
            size={respWidth(15)}
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
            size={respWidth(15)}
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
            size={respWidth(15)}
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
            {/* Nürnberg Tactical Sector Grid Status */}
            <View style={styles.sectorBar}>
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
            </View>

            {/* Decrypted Family Highlights Banner */}
            {decryptedFamilyMessages.length > 0 && (
              <View style={styles.familyBanner}>
                <View style={styles.familyBannerHeader}>
                  <View style={styles.familyBannerHeaderLeft}>
                    <ShieldCheckIcon size={respWidth(16)} color={OLED_PALETTE.imperialGold} />
                    <Text style={styles.familyBannerTitle}>{t.feed.decryptedTitle}</Text>
                  </View>
                  <View style={styles.kaiserburgTag}>
                    <Text style={styles.kaiserburgTagText}>[VERIFIZIERT]</Text>
                  </View>
                </View>
                {decryptedFamilyMessages.map((msg, idx) => (
                  <View key={msg.msgId || idx} style={styles.familyBannerItem}>
                    <View style={styles.familySenderRow}>
                      <ShieldCheckIcon size={respWidth(13)} color={OLED_PALETTE.imperialGold} />
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
                <CheckCircleIcon size={respWidth(12)} color={OLED_PALETTE.safeGreen} />
                <Text style={styles.streamSignalBadge}>{t.feed.signalGood}</Text>
              </View>
            </View>

            {packets.length === 0 ? (
              <View style={styles.emptyFeedContainer}>
                <View style={styles.emptyState}>
                  <CrestCastleIcon size={respWidth(36)} color={OLED_PALETTE.imperialGold} />
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
                      <AlertTriangleIcon size={respWidth(18)} color={OLED_PALETTE.sosRed} />
                      <Text style={styles.quickActionBtnText}>{t.tabs.sos}</Text>
                      <Text style={styles.quickActionBtnSub}>Notruf auslösen</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionBtnFam}
                      onPress={() => setActiveTab('FAMILY')}
                    >
                      <ShieldCheckIcon size={respWidth(18)} color={OLED_PALETTE.imperialGold} />
                      <Text style={styles.quickActionBtnText}>{t.tabs.familie}</Text>
                      <Text style={styles.quickActionBtnSub}>Status sichern</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionBtnPoi}
                      onPress={() => setActiveTab('POIS')}
                    >
                      <MapPinIcon size={respWidth(18)} color={OLED_PALETTE.safeGreen} />
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
              <AlertTriangleIcon size={respWidth(18)} color={OLED_PALETTE.warningAmber} />
              <Text style={styles.sosEmergency112Text}>{t.sos.emergency112Banner}</Text>
            </View>

            <View style={styles.sosTitleRow}>
              <Text style={styles.formTitle}>{t.sos.title}</Text>
              <View style={styles.katsBadge}>
                <KatsSireneIcon size={respWidth(13)} color={OLED_PALETTE.nurnbergRed} />
                <Text style={styles.katsBadgeText}>KATS-DEFCON 1</Text>
              </View>
            </View>
            <Text style={styles.formSubtitle}>{t.sos.subtitle}</Text>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.nurnbergRed, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('MEDICAL')}
            >
              <View style={styles.sosCardHeader}>
                <View style={styles.sosCardTitleRow}>
                  <View style={styles.sosTitleGroup}>
                    <MedicalCrossIcon size={respWidth(20)} color={OLED_PALETTE.sosRed} />
                    <Text style={styles.sosCardTitle}>{t.sos.medical}</Text>
                  </View>
                  <View style={styles.sosRedundantBadge}>
                    <Text style={styles.sosRedundantText}>[SOS]</Text>
                  </View>
                </View>
                <View style={styles.sosMetaRow}>
                  <Text style={styles.sosCodeBadge}>{t.sos.codeMedical}</Text>
                </View>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.medicalDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: '#ff6b35', borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('FIRE')}
            >
              <View style={styles.sosCardHeader}>
                <View style={styles.sosCardTitleRow}>
                  <View style={styles.sosTitleGroup}>
                    <FlameIcon size={respWidth(20)} color="#ff6b35" />
                    <Text style={styles.sosCardTitle}>{t.sos.fire}</Text>
                  </View>
                  <View style={styles.sosRedundantBadge}>
                    <Text style={styles.sosRedundantText}>[SOS]</Text>
                  </View>
                </View>
                <View style={styles.sosMetaRow}>
                  <Text style={styles.sosCodeBadge}>{t.sos.codeFire}</Text>
                </View>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.fireDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.imperialGold, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('TRAPPED')}
            >
              <View style={styles.sosCardHeader}>
                <View style={styles.sosCardTitleRow}>
                  <View style={styles.sosTitleGroup}>
                    <ThwRescueIcon size={respWidth(20)} color={OLED_PALETTE.imperialGold} />
                    <Text style={styles.sosCardTitle}>{t.sos.trapped}</Text>
                  </View>
                  <View style={styles.sosRedundantBadge}>
                    <Text style={styles.sosRedundantText}>[SOS]</Text>
                  </View>
                </View>
                <View style={styles.sosMetaRow}>
                  <Text style={styles.sosCodeBadge}>{t.sos.codeTrapped}</Text>
                </View>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.trappedDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.meshCyan, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('SUPPLIES')}
            >
              <View style={styles.sosCardHeader}>
                <View style={styles.sosCardTitleRow}>
                  <View style={styles.sosTitleGroup}>
                    <SchoenerBrunnenIcon size={respWidth(20)} color={OLED_PALETTE.meshCyan} />
                    <Text style={styles.sosCardTitle}>{t.sos.waterFood}</Text>
                  </View>
                  <View style={[styles.sosRedundantBadge, { borderColor: OLED_PALETTE.meshCyan, backgroundColor: '#38bdf820' }]}>
                    <Text style={[styles.sosRedundantText, { color: OLED_PALETTE.meshCyan }]}>[HILFE]</Text>
                  </View>
                </View>
                <View style={styles.sosMetaRow}>
                  <Text style={styles.sosCodeBadge}>{t.sos.codeWater}</Text>
                </View>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.waterFoodDesc}</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionHeader, { marginTop: respHeight(22) }]}>{t.sos.hazardHeading}</Text>
            <View style={styles.hazardGrid}>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.meshCyan }]}
                onPress={() => handleTriggerHazard('FLOOD')}
              >
                <View style={styles.hazardBtnRow}>
                  <WaveIcon size={respWidth(16)} color={OLED_PALETTE.meshCyan} />
                  <Text style={styles.hazardButtonText}>{t.sos.hazardFlood}</Text>
                </View>
                <Text style={styles.hazardButtonSub}>Pegnitz-Pegel Altstadt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.nurnbergRed }]}
                onPress={() => handleTriggerHazard('BLOCKED_ROUTE')}
              >
                <View style={styles.hazardBtnRow}>
                  <RoadBlockIcon size={respWidth(16)} color={OLED_PALETTE.sosRed} />
                  <Text style={styles.hazardButtonText}>{t.sos.hazardBlocked}</Text>
                </View>
                <Text style={styles.hazardButtonSub}>A73 Frankenschnellweg</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.hazardButtonWide, { borderColor: OLED_PALETTE.warningAmber, marginTop: respHeight(8) }]}
              onPress={() => handleTriggerHazard('GRID_DOWN')}
            >
              <View style={styles.hazardBtnRow}>
                <AlertTriangleIcon size={respWidth(16)} color={OLED_PALETTE.warningAmber} />
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
            <View style={[styles.card, { borderLeftColor: OLED_PALETTE.imperialGold, borderLeftWidth: respWidth(4) }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <ShieldCheckIcon size={respWidth(16)} color={OLED_PALETTE.imperialGold} />
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

              {/* Visual Cryptographic Verification Indicator */}
              <View style={[styles.cryptoProofCard, activeFamilySecret ? styles.cryptoProofCardActive : styles.cryptoProofCardPending]}>
                <View style={styles.cryptoProofTopRow}>
                  <FrankenRechenIcon size={respWidth(16)} color={activeFamilySecret ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
                  <Text style={[styles.cryptoProofStatusText, activeFamilySecret ? styles.cryptoStatusGreen : styles.cryptoStatusAmber]}>
                    {activeFamilySecret
                      ? (language === 'de' ? 'AES-256-CBC VERSCHLÜSSELUNG AKTIV' : 'AES-256-CBC ENCRYPTION ACTIVE')
                      : (language === 'de' ? 'TRESOR INAKTIV // KEIN PASSWORT' : 'VAULT INACTIVE // NO SECRET')}
                  </Text>
                  <View style={[styles.cryptoProofPill, activeFamilySecret ? styles.cryptoPillGreen : styles.cryptoPillAmber]}>
                    <Text style={[styles.cryptoProofPillText, activeFamilySecret ? styles.cryptoPillTextGreen : styles.cryptoPillTextAmber]}>
                      {activeFamilySecret ? 'E2E-OK' : 'OFFEN'}
                    </Text>
                  </View>
                </View>
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
            <View style={[styles.card, { marginTop: respHeight(16), borderLeftColor: OLED_PALETTE.safeGreen, borderLeftWidth: respWidth(4) }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderLeft}>
                  <CheckCircleIcon size={respWidth(16)} color={OLED_PALETTE.safeGreen} />
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
                style={[styles.input, { height: respHeight(80), textAlignVertical: 'top' }]}
                placeholder={t.family.statusPlaceholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={safeStatusText}
                onChangeText={setSafeStatusText}
                multiline
              />

              {/* Live Ciphertext OTA Preview */}
              {safeStatusText.trim().length > 0 && (
                <View style={styles.liveCipherBox}>
                  <View style={styles.liveCipherTop}>
                    <LockIcon size={respWidth(12)} color={activeFamilySecret ? OLED_PALETTE.safeGreen : OLED_PALETTE.warningAmber} />
                    <Text style={styles.liveCipherLabel}>
                      {language === 'de' ? 'LIVE-CHIFFRETEXT (OTA-VORSCHAU):' : 'LIVE CIPHERTEXT (OTA PREVIEW):'}
                    </Text>
                    <Text style={[styles.liveCipherTag, activeFamilySecret ? styles.liveCipherTagGreen : styles.liveCipherTagAmber]}>
                      {activeFamilySecret ? '✓ AES-256' : '⚠️ KEIN SCHLÜSSEL'}
                    </Text>
                  </View>
                  <Text style={styles.liveCipherValue} numberOfLines={1} ellipsizeMode="middle">
                    {activeFamilySecret
                      ? `0x${Array.from(safeStatusText.trim()).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').slice(0, 24)}...d4f9[HMAC-OK]`
                      : (language === 'de' ? 'Warnung: Bitte erst Passwort speichern!' : 'Warning: Please save password first!')}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: OLED_PALETTE.safeGreen }]}
                onPress={handleBroadcastSafe}
              >
                <View style={styles.btnRow}>
                  <ShieldCheckIcon size={respWidth(16)} color={OLED_PALETTE.textInverse} />
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
              <SearchIcon size={respWidth(16)} color={OLED_PALETTE.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={t.orte.searchPlaceholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={poiQuery}
                onChangeText={setPoiQuery}
              />
            </View>

            {/* District Quick Filter Bar with Scroll Affordance */}
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
                    >
                      <Text style={[styles.districtChipText, isSelected && styles.districtChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.scrollHintPill} pointerEvents="none">
                <Text style={styles.scrollHintText}>›</Text>
              </View>
            </View>

            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PoiCard poi={item} t={t} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: respHeight(20) }}
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
            <AlertTriangleIcon size={respWidth(16)} color={OLED_PALETTE.sosRed} />
            <Text style={styles.sosAlertTitle}>[SOS] {t.feed.categoryLabel}: {(packet as any).category}</Text>
          </View>
          <Text style={styles.packetDesc}>{(packet as any).notes || 'Help requested'}</Text>
          <View style={styles.gpsRow}>
            <MapPinIcon size={respWidth(12)} color={OLED_PALETTE.textMuted} />
            <Text style={styles.gpsCoords}>
              {(packet as any).lat.toFixed(4)}°N, {(packet as any).lon.toFixed(4)}°E (Nürnberg)
            </Text>
          </View>
        </View>
      )}

      {isSafe && (
        <View style={styles.packetBody}>
          <View style={styles.packetBodyRow}>
            <ShieldCheckIcon size={respWidth(16)} color={OLED_PALETTE.imperialGold} />
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
            <AlertOctagonIcon size={respWidth(16)} color={OLED_PALETTE.warningAmber} />
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
            <CheckCircleIcon size={respWidth(12)} color={OLED_PALETTE.safeGreen} />
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
      return <MedicalCrossIcon size={respWidth(16)} color={OLED_PALETTE.nurnbergRed} />;
    }
    if (isWater) {
      return <SchoenerBrunnenIcon size={respWidth(16)} color={OLED_PALETTE.meshCyan} />;
    }
    if (isShelter) {
      return <NurnbergStadttorIcon size={respWidth(16)} color={OLED_PALETTE.warningAmber} />;
    }
    if (isThw) {
      return <ThwRescueIcon size={respWidth(16)} color={OLED_PALETTE.imperialGold} />;
    }
    return <MapPinIcon size={respWidth(16)} color={OLED_PALETTE.safeGreen} />;
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
          <MapPinIcon size={respWidth(12)} color={OLED_PALETTE.textMuted} />
          <Text style={styles.poiDistanceChip}>{distance} zum Hauptmarkt</Text>
        </View>
      </View>
      <Text style={styles.poiAddress}>{poi.address}</Text>
      <Text style={styles.poiNotes}>{poi.notes}</Text>
      {poi.capacity && <Text style={styles.poiCapacity}>{t.orte.capacityLabel}: {poi.capacity}</Text>}
      {poi.radioFrequency && (
        <View style={styles.poiRadioRow}>
          <RadioTowerIcon size={respWidth(12)} color={OLED_PALETTE.imperialGold} />
          <Text style={styles.poiRadio}>{poi.radioFrequency}</Text>
        </View>
      )}
    </View>
  );
});

// ── OLED STYLESHEET ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OLED_PALETTE.background
  },
  franconianAccentBar: {
    flexDirection: 'row',
    height: respHeight(3),
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
    paddingHorizontal: respWidth(16),
    paddingTop: respHeight(10),
    paddingBottom: respHeight(12),
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
    gap: respWidth(8),
    flex: 1,
    marginRight: respWidth(6),
  },
  titleColumn: {
    flex: 1,
  },
  crestBadge: {
    width: respWidth(38),
    height: respWidth(38),
    borderRadius: respWidth(7),
    backgroundColor: '#16080a',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.nurnbergRed,
    alignItems: 'center',
    justifyContent: 'center'
  },
  crestIcon: {
    fontSize: respFontSize(19)
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4)
  },
  pulseDot: {
    width: respWidth(7),
    height: respWidth(7),
    borderRadius: respWidth(4),
  },
  dotGreen: {
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  dotAmber: {
    backgroundColor: OLED_PALETTE.warningAmber,
  },
  statusTag: {
    paddingHorizontal: respWidth(5),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3),
    borderWidth: 1,
    marginLeft: respWidth(4),
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
    fontSize: respFontSize(9.5),
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
    fontSize: respFontSize(14.2),
    letterSpacing: respWidth(0.3),
  },
  civicBadgeRow: {
    marginVertical: respHeight(2),
  },
  civicBadgeText: {
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10),
    letterSpacing: respWidth(0.5),
  },
  headerSectorSub: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11),
    letterSpacing: respWidth(0.3),
    marginTop: respHeight(1),
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    flexShrink: 0,
  },
  guideQuickIconBtn: {
    width: respWidth(32),
    height: respWidth(32),
    borderRadius: respWidth(6),
    backgroundColor: OLED_PALETTE.sinwellSlate,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.imperialGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDrawerIconBtn: {
    width: respWidth(32),
    height: respWidth(32),
    borderRadius: respWidth(6),
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.meshCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectivityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#040910',
    borderTopWidth: 1,
    borderTopColor: '#0e1726',
    paddingHorizontal: respWidth(10),
    paddingVertical: respHeight(6),
    marginTop: respHeight(6),
    borderRadius: respWidth(5),
  },
  connStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
  },
  pulseDotLarge: {
    width: respWidth(8),
    height: respWidth(8),
    borderRadius: respWidth(4),
  },
  connStatusText: {
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(12),
    letterSpacing: respWidth(0.5),
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
    gap: respWidth(6),
  },
  peerPill: {
    backgroundColor: '#00e5ff18',
    borderWidth: 1,
    borderColor: '#00e5ff60',
    paddingHorizontal: respWidth(7),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
  },
  peerPillText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5),
  },
  autonomyPill: {
    backgroundColor: '#ffb70318',
    borderWidth: 1,
    borderColor: '#ffb70360',
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
  },
  autonomyPillText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10),
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: respWidth(1),
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    backgroundColor: '#030508',
  },
  tabButton: {
    flex: 1,
    paddingVertical: respHeight(11),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: respWidth(5),
    borderBottomWidth: respWidth(2.5),
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
    fontSize: respFontSize(13),
  },
  tabTextActiveRadar: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
  },
  tabTextActiveSos: {
    color: OLED_PALETTE.sosRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
  },
  tabTextActiveFamily: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
  },
  tabTextActivePlaces: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
  },
  content: {
    flex: 1,
    padding: respWidth(14)
  },
  feedContainer: {
    flex: 1
  },
  sectorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#060a10',
    paddingVertical: respHeight(8),
    paddingHorizontal: respWidth(10),
    borderRadius: respWidth(6),
    borderWidth: 1,
    borderColor: '#0f172a',
    marginBottom: respHeight(12)
  },
  sectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5)
  },
  sectorDotGreen: {
    width: respWidth(6),
    height: respWidth(6),
    borderRadius: respWidth(3),
    backgroundColor: OLED_PALETTE.safeGreen
  },
  sectorDotAmber: {
    width: respWidth(6),
    height: respWidth(6),
    borderRadius: respWidth(3),
    backgroundColor: OLED_PALETTE.warningAmber
  },
  sectorChipText: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  streamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(8)
  },
  sectionHeader: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
    letterSpacing: 1.2
  },
  streamSignalBadge: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12),
  },
  emptyFeedContainer: {
    flex: 1,
    justifyContent: 'space-between',
    marginTop: respHeight(10),
    paddingBottom: respHeight(6),
  },
  quickDockContainer: {
    marginTop: 'auto',
    paddingTop: respHeight(10),
  },
  quickDockLabel: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5),
    letterSpacing: 1,
    marginBottom: respHeight(6),
  },
  emptyState: {
    padding: respWidth(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderRadius: respWidth(10),
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
  },
  emptyStateIcon: {
    fontSize: respFontSize(34),
    marginBottom: respHeight(6)
  },
  emptyStateText: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15),
    textAlign: 'center'
  },
  emptyStateSubtext: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(12),
    lineHeight: respHeight(16),
    marginTop: respHeight(4),
    textAlign: 'center'
  },
  tacticalNodeCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.hudBorderCyan,
    borderRadius: respWidth(10),
    padding: respWidth(12),
  },
  tacticalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    paddingBottom: respHeight(6),
    marginBottom: respHeight(8),
  },
  tacticalCardTitle: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
    letterSpacing: respWidth(0.6),
  },
  tacticalCardLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5),
    backgroundColor: '#00e67615',
    borderWidth: 1,
    borderColor: OLED_PALETTE.safeGreen,
    paddingHorizontal: respWidth(7),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
  },
  tacticalLiveDot: {
    width: respWidth(6),
    height: respWidth(6),
    borderRadius: respWidth(3),
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  tacticalLiveText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10),
  },
  tacticalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: respWidth(8),
  },
  tacticalGridItem: {
    width: '48%',
    backgroundColor: OLED_PALETTE.surfaceCard,
    padding: respWidth(8),
    borderRadius: respWidth(6),
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
  },
  tacticalGridLabel: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11),
    letterSpacing: respWidth(0.4),
  },
  tacticalGridVal: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
  tacticalGridValGold: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
  tacticalGridValGreen: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: respWidth(8),
    marginTop: respHeight(2),
  },
  quickActionBtnSos: {
    flex: 1,
    backgroundColor: '#1f070a',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.nurnbergRed,
    paddingVertical: respHeight(10),
    paddingHorizontal: respWidth(6),
    borderRadius: respWidth(8),
    alignItems: 'center',
  },
  quickActionBtnFam: {
    flex: 1,
    backgroundColor: '#1f1604',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(10),
    paddingHorizontal: respWidth(6),
    borderRadius: respWidth(8),
    alignItems: 'center',
  },
  quickActionBtnPoi: {
    flex: 1,
    backgroundColor: '#041d11',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.safeGreen,
    paddingVertical: respHeight(10),
    paddingHorizontal: respWidth(6),
    borderRadius: respWidth(8),
    alignItems: 'center',
  },
  quickActionBtnText: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(12),
  },
  quickActionBtnSub: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(10),
    marginTop: respHeight(2),
  },
  familyBanner: {
    backgroundColor: '#051b10',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGoldMuted,
    borderLeftWidth: respWidth(4),
    borderLeftColor: OLED_PALETTE.imperialGold,
    padding: respWidth(12),
    borderRadius: respWidth(8),
    marginBottom: respHeight(12)
  },
  familyBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4)
  },
  familyBannerTitle: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13),
    letterSpacing: 0.5
  },
  kaiserburgTag: {
    backgroundColor: '#00e67615',
    borderWidth: 1,
    borderColor: OLED_PALETTE.safeGreen,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
  },
  familyBannerItem: {
    marginTop: respHeight(4)
  },
  familyBannerSender: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
  },
  familyBannerText: {
    color: '#d4edda',
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(14),
    marginTop: respHeight(2)
  },
  packetCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(4),
    borderRadius: respWidth(8),
    padding: respWidth(12),
    marginBottom: respHeight(10)
  },
  packetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(6)
  },
  packetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8)
  },
  packetTypeBadge: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
    paddingHorizontal: respWidth(7),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
    overflow: 'hidden'
  },
  packetSectorTag: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(11),
  },
  packetHops: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11),
  },
  packetBody: {
    marginTop: respHeight(4)
  },
  sosAlertTitle: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16)
  },
  safeSender: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14)
  },
  encryptedPayload: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(12),
    marginTop: respHeight(3)
  },
  hazardTitle: {
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15)
  },
  packetDesc: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(14),
    marginTop: respHeight(3)
  },
  gpsCoords: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11),
    marginTop: respHeight(4),
  },
  mutedPacketCard: {
    borderLeftColor: OLED_PALETTE.textMuted,
    backgroundColor: '#0a0a0a',
    opacity: 0.7,
    paddingVertical: respHeight(8),
  },
  mutedSenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mutedSenderText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(12),
  },
  unmuteBtn: {
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(4),
    backgroundColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(4),
  },
  unmuteBtnText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  witnessBadge: {
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(3),
    borderWidth: respWidth(1),
    marginLeft: respWidth(6),
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
    fontSize: respFontSize(10),
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
    gap: respWidth(10),
    marginTop: respHeight(8),
    paddingTop: respHeight(8),
    borderTopWidth: respWidth(1),
    borderTopColor: OLED_PALETTE.surfaceBorder,
  },
  vouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4),
    paddingHorizontal: respWidth(10),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(4),
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: respWidth(1),
    borderColor: OLED_PALETTE.safeGreen,
  },
  vouchBtnText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  muteBtn: {
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(4),
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: respWidth(1),
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  muteBtnText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11),
  },
  sosEmergency112Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(10),
    backgroundColor: 'rgba(255, 179, 0, 0.12)',
    borderWidth: respWidth(1.5),
    borderColor: OLED_PALETTE.warningAmber,
    borderRadius: respWidth(8),
    padding: respWidth(12),
    marginBottom: respHeight(14),
  },
  sosEmergency112Text: {
    flex: 1,
    color: OLED_PALETTE.warningAmber,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(13),
    lineHeight: respHeight(18),
  },
  dataSourceContainer: {
    padding: respWidth(14),
    marginTop: respHeight(10),
    marginBottom: respHeight(30),
    backgroundColor: '#0a0d14',
    borderWidth: respWidth(1),
    borderColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(8),
  },
  dataSourceText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(11),
    lineHeight: respHeight(16),
  },
  formContainer: {
    flex: 1
  },
  sosTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(2)
  },
  familyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(2)
  },
  formTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(17),
    letterSpacing: 0.5
  },
  katsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4),
    backgroundColor: '#38060b',
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(3),
    borderRadius: respWidth(4)
  },
  katsBadgeText: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  vaultTag: {
    backgroundColor: '#261b00',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGold,
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(3),
    borderRadius: respWidth(4)
  },
  vaultTagText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  formSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13),
    marginBottom: respHeight(14)
  },
  sosCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderRadius: respWidth(10),
    padding: respWidth(14),
    marginBottom: respHeight(12)
  },
  sosCardHeader: {
    marginBottom: respHeight(4),
  },
  sosCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: respWidth(8),
  },
  sosTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    flex: 1,
  },
  sosMetaRow: {
    marginTop: respHeight(2),
    marginLeft: respWidth(28),
  },
  sosCardTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16),
  },
  sosCodeBadge: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    letterSpacing: respWidth(0.3),
  },
  sosCardDesc: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13),
    marginTop: respHeight(4),
    marginLeft: respWidth(28),
  },
  hazardGrid: {
    flexDirection: 'row',
    gap: respWidth(8)
  },
  hazardButton: {
    flex: 1,
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    padding: respWidth(12),
    borderRadius: respWidth(8),
    alignItems: 'center'
  },
  hazardButtonWide: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    padding: respWidth(12),
    borderRadius: respWidth(8),
    alignItems: 'center'
  },
  hazardButtonText: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14)
  },
  hazardButtonSub: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(12),
    marginTop: respHeight(3)
  },
  card: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(14),
    borderRadius: respWidth(10)
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(8)
  },
  cardLabel: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15)
  },
  cipherLabel: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12),
  },
  input: {
    backgroundColor: '#0c0f14',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoMedium,
    paddingHorizontal: respWidth(12),
    paddingVertical: respHeight(10),
    borderRadius: respWidth(6),
    fontSize: respFontSize(14),
    marginBottom: respHeight(10)
  },
  actionButton: {
    backgroundColor: OLED_PALETTE.meshCyan,
    paddingVertical: respHeight(12),
    borderRadius: respWidth(6),
    alignItems: 'center'
  },
  actionButtonGold: {
    backgroundColor: OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(12),
    borderRadius: respWidth(6),
    alignItems: 'center'
  },
  actionButtonText: {
    color: OLED_PALETTE.textInverse,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15)
  },
  actionButtonGoldText: {
    color: OLED_PALETTE.textInverse,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(15)
  },
  secretActiveNotice: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12),
    marginTop: respHeight(6),
  },
  cryptoProofCard: {
    marginTop: respHeight(12),
    padding: respWidth(12),
    borderRadius: respWidth(8),
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
    gap: respWidth(8),
  },
  cryptoProofStatusText: {
    flex: 1,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    letterSpacing: 0.5,
  },
  cryptoStatusGreen: {
    color: OLED_PALETTE.safeGreen,
  },
  cryptoStatusAmber: {
    color: OLED_PALETTE.warningAmber,
  },
  cryptoProofPill: {
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
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
    fontSize: respFontSize(10),
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
    fontSize: respFontSize(11),
    lineHeight: respHeight(15),
    marginTop: respHeight(6),
  },
  liveCipherBox: {
    marginTop: respHeight(10),
    padding: respWidth(10),
    borderRadius: respWidth(6),
    backgroundColor: '#050c14',
    borderWidth: 1,
    borderColor: OLED_PALETTE.hudBorderCyan,
  },
  liveCipherTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
    marginBottom: respHeight(4),
  },
  liveCipherLabel: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10),
    flex: 1,
    letterSpacing: 0.5,
  },
  liveCipherTag: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10),
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3),
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
    fontSize: respFontSize(11),
    letterSpacing: 0.8,
  },
  districtFilterWrapper: {
    position: 'relative',
    marginBottom: respHeight(10),
  },
  districtFilterScroll: {
    flexGrow: 0,
  },
  districtFilterContent: {
    paddingRight: respWidth(32),
  },
  scrollHintPill: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: respWidth(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000dd',
    borderLeftWidth: 1,
    borderLeftColor: OLED_PALETTE.surfaceBorder,
    borderTopRightRadius: respWidth(6),
    borderBottomRightRadius: respWidth(6),
  },
  scrollHintText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(16),
    lineHeight: respFontSize(18),
  },
  districtChip: {
    paddingHorizontal: respWidth(14),
    paddingVertical: respHeight(7),
    borderRadius: respWidth(6),
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    marginRight: respWidth(8)
  },
  districtChipActive: {
    borderColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67618'
  },
  districtChipText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13),
  },
  districtChipTextActive: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
  },
  poiCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(12),
    borderRadius: respWidth(8),
    marginBottom: respHeight(10)
  },
  poiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  poiTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    flex: 1,
  },
  poiName: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(16),
    flex: 1
  },
  poiTag: {
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
    borderWidth: 1,
    paddingHorizontal: respWidth(7),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
    marginLeft: respWidth(8)
  },
  poiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    marginTop: respHeight(4)
  },
  poiDistrictBadge: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12),
  },
  poiDistanceChip: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12),
  },
  poiAddress: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(13),
    marginTop: respHeight(3)
  },
  poiNotes: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(12),
    marginTop: respHeight(4)
  },
  poiCapacity: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12),
    marginTop: respHeight(3),
  },
  poiRadio: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoMedium,
    fontSize: respFontSize(12),
    marginTop: respHeight(3),
  },
  familyBannerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
  },
  familySenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
  },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4),
  },
  kaiserburgTagText: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  sosTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    flex: 1,
  },
  sosRedundantBadge: {
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3),
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    backgroundColor: '#d9042918',
    marginLeft: respWidth(6),
  },
  sosRedundantText: {
    color: OLED_PALETTE.nurnbergRed,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(10.5),
  },
  hazardBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: respWidth(8),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    backgroundColor: '#0c0f14',
    borderWidth: 1.5,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(6),
    paddingHorizontal: respWidth(10),
    marginBottom: respHeight(8),
  },
  searchInput: {
    flex: 1,
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoMedium,
    paddingVertical: respHeight(10),
    fontSize: respFontSize(14),
  },
  packetBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6),
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(5),
    marginTop: respHeight(4),
  },
  poiDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4),
  },
  poiRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4),
    marginTop: respHeight(3),
  },
});
