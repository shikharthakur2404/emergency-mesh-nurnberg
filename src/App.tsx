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

type Tab = 'FEED' | 'SOS' | 'FAMILY' | 'POIS';

const DISTRICT_FILTERS = ['ALL', 'Altstadt', 'Gostenhof', 'Johannis', 'Langwasser', 'Südstadt'] as const;

function calculateDistanceKm(lat: number, lon: number): string {
  // Distance to Nürnberg Hauptmarkt (49.4539, 11.0775)
  const R = 6371;
  const dLat = ((lat - 49.4539) * Math.PI) / 180;
  const dLon = ((lon - 11.0775) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((49.4539 * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return `${d.toFixed(1)} km`;
}

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
    // Default coordinates: Nürnberg Hauptmarkt (49.4539, 11.0775)
    await sendSosBeacon(category, 49.4539, 11.0775, `Emergency assistance requested (${category})`);
    Alert.alert(t.sos.alertTitle, t.sos.alertMessage(category));
    setActiveTab('FEED');
  }, [sendSosBeacon, t]);

  const handleTriggerHazard = useCallback(async (type: HazardType) => {
    await sendHazardAlert(type, 49.4526, 11.0658, `Hazard alert: ${type}`);
    Alert.alert(t.sos.hazardAlertTitle, t.sos.hazardAlertMessage(type));
    setActiveTab('FEED');
  }, [sendHazardAlert, t]);

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

      {/* ── OLED HEADER & HUD STATUS BAR ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            {/* Nürnberg Kaiserburg Emblem */}
            <View style={styles.crestBadge}>
              <Text style={styles.crestIcon}>🏰</Text>
            </View>
            <View style={styles.titleColumn}>
              <View style={styles.titleRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.headerTitle}>
                  {t.header.title}
                </Text>
              </View>
              <Text style={styles.headerSectorSub} numberOfLines={1}>
                {t.header.sectorTag}
              </Text>
            </View>
          </View>

          <View style={styles.headerRightRow}>
            {/* Quick Emergency Walkthrough Guide Button */}
            <TouchableOpacity
              style={styles.guideQuickBtn}
              onPress={() => setGuideVisible(true)}
              accessibilityLabel={t.civilianStatus.guideBtn}
            >
              <Text style={styles.guideQuickBtnText}>{t.civilianStatus.guideBtn}</Text>
            </TouchableOpacity>

            {/* Tactical Diagnostics & Hotlines Drawer Button */}
            <TouchableOpacity
              style={styles.menuDrawerBtn}
              onPress={() => setDrawerVisible(true)}
              accessibilityLabel={t.civilianStatus.menuBtn}
            >
              <Text style={styles.menuDrawerBtnText}>{t.civilianStatus.menuBtn}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.headerSubtitle}>{t.header.subtitle}</Text>

        {/* High-Signal Civilian Emergency Status Banner */}
        <View style={styles.civilianStatusBanner}>
          <View style={styles.civilianStatusLeft}>
            <View style={[styles.civilianStatusDot, isRadioActive ? styles.civilianDotGreen : styles.civilianDotAmber]} />
            <Text style={styles.civilianStatusText}>
              {isRadioActive ? t.civilianStatus.active : t.header.radioSim} · {t.civilianStatus.peersCount(connectedPeers.length + 2)}
            </Text>
          </View>
          <View style={styles.civilianStatusBadge}>
            <Text style={styles.civilianStatusBadgeText}>{t.civilianStatus.noInternet}</Text>
          </View>
        </View>
      </View>

      {/* ── 4-TAB NAVIGATION SEGMENT ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FEED' && styles.tabButtonActiveRadar]}
          onPress={() => setActiveTab('FEED')}
        >
          <Text style={[styles.tabText, activeTab === 'FEED' && styles.tabTextActiveRadar]}>
            📡 {t.tabs.radar}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SOS' && styles.tabButtonActiveSos]}
          onPress={() => setActiveTab('SOS')}
        >
          <Text style={[styles.tabText, activeTab === 'SOS' && styles.tabTextActiveSos]}>
            🚨 {t.tabs.sos}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FAMILY' && styles.tabButtonActiveFamily]}
          onPress={() => setActiveTab('FAMILY')}
        >
          <Text style={[styles.tabText, activeTab === 'FAMILY' && styles.tabTextActiveFamily]}>
            🛡️ {t.tabs.familie}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'POIS' && styles.tabButtonActivePlaces]}
          onPress={() => setActiveTab('POIS')}
        >
          <Text style={[styles.tabText, activeTab === 'POIS' && styles.tabTextActivePlaces]}>
            📍 {t.tabs.orte}
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
                  <Text style={styles.familyBannerTitle}>{t.feed.decryptedTitle}</Text>
                  <Text style={styles.kaiserburgTag}>KAISERBURG VAULT</Text>
                </View>
                {decryptedFamilyMessages.map((msg, idx) => (
                  <View key={msg.msgId || idx} style={styles.familyBannerItem}>
                    <Text style={styles.familyBannerSender}>
                      🛡️ {msg.senderAlias} ({msg.hopCount === 0 ? t.feed.direct : `${msg.hopCount} ${t.feed.hopsSuffix}`}):
                    </Text>
                    <Text style={styles.familyBannerText}>{msg.plaintext}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.streamHeaderRow}>
              <Text style={styles.sectionHeader}>{t.feed.title}</Text>
              <Text style={styles.streamSignalBadge}>● {t.feed.signalGood}</Text>
            </View>

            {packets.length === 0 ? (
              <View style={styles.emptyFeedContainer}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateIcon}>🏰</Text>
                  <Text style={styles.emptyStateText}>{t.feed.emptyTitle}</Text>
                  <Text style={styles.emptyStateSubtext}>{t.feed.emptySubtitle}</Text>
                </View>

                {/* Tactical Live Mesh Node & Channel Telemetry Card */}
                <View style={styles.tacticalNodeCard}>
                  <View style={styles.tacticalCardHeader}>
                    <Text style={styles.tacticalCardTitle}>📡 {t.drawer.telemetryHeader}</Text>
                    <View style={styles.tacticalCardLiveBadge}>
                      <View style={styles.tacticalLiveDot} />
                      <Text style={styles.tacticalLiveText}>AUTO-SCAN</Text>
                    </View>
                  </View>

                  <View style={styles.tacticalGrid}>
                    <View style={styles.tacticalGridItem}>
                      <Text style={styles.tacticalGridLabel}>KANAL</Text>
                      <Text style={styles.tacticalGridVal}>PEGNITZ-8888</Text>
                    </View>
                    <View style={styles.tacticalGridItem}>
                      <Text style={styles.tacticalGridLabel}>GPS-SEKTOR</Text>
                      <Text style={styles.tacticalGridVal}>49.45°N 11.08°E</Text>
                    </View>
                    <View style={styles.tacticalGridItem}>
                      <Text style={styles.tacticalGridLabel}>DTN-PUFFER</Text>
                      <Text style={styles.tacticalGridValGold}>
                        {router ? router.getStats().dtnBufferedCount : 0} AKTIV
                      </Text>
                    </View>
                    <View style={styles.tacticalGridItem}>
                      <Text style={styles.tacticalGridLabel}>KRYPTO-SIG</Text>
                      <Text style={styles.tacticalGridValGreen}>HMAC-SHA256</Text>
                    </View>
                  </View>
                </View>

                {/* Quick Emergency Action Cards */}
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    style={styles.quickActionBtnSos}
                    onPress={() => setActiveTab('SOS')}
                  >
                    <Text style={styles.quickActionBtnText}>🚨 {t.tabs.sos}</Text>
                    <Text style={styles.quickActionBtnSub}>Notruf auslösen</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionBtnFam}
                    onPress={() => setActiveTab('FAMILY')}
                  >
                    <Text style={styles.quickActionBtnText}>🛡️ {t.tabs.familie}</Text>
                    <Text style={styles.quickActionBtnSub}>Status sichern</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionBtnPoi}
                    onPress={() => setActiveTab('POIS')}
                  >
                    <Text style={styles.quickActionBtnText}>📍 {t.tabs.orte}</Text>
                    <Text style={styles.quickActionBtnSub}>Brunnen & Hilfe</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <FlatList
                data={packets}
                keyExtractor={(item) => item.msg_id}
                renderItem={({ item }) => <PacketCard packet={item} t={t} />}
                keyboardShouldPersistTaps="handled"
              />
            )}
          </View>
        )}

        {/* TAB 2: PUBLIC SOS BEACON */}
        {activeTab === 'SOS' && (
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.sosTitleRow}>
              <Text style={styles.formTitle}>{t.sos.title}</Text>
              <View style={styles.katsBadge}>
                <Text style={styles.katsBadgeText}>KATS-DEFCON 1</Text>
              </View>
            </View>
            <Text style={styles.formSubtitle}>{t.sos.subtitle}</Text>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.nurnbergRed, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('MEDICAL')}
            >
              <View style={styles.sosCardTop}>
                <Text style={styles.sosCardTitle}>🚑 {t.sos.medical}</Text>
                <Text style={styles.sosCodeBadge}>{t.sos.codeMedical}</Text>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.medicalDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: '#ff6b35', borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('FIRE')}
            >
              <View style={styles.sosCardTop}>
                <Text style={styles.sosCardTitle}>🔥 {t.sos.fire}</Text>
                <Text style={styles.sosCodeBadge}>{t.sos.codeFire}</Text>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.fireDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.imperialGold, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('TRAPPED')}
            >
              <View style={styles.sosCardTop}>
                <Text style={styles.sosCardTitle}>🏚️ {t.sos.trapped}</Text>
                <Text style={styles.sosCodeBadge}>{t.sos.codeTrapped}</Text>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.trappedDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.meshCyan, borderLeftWidth: respWidth(6) }]}
              onPress={() => handleTriggerSos('SUPPLIES')}
            >
              <View style={styles.sosCardTop}>
                <Text style={styles.sosCardTitle}>💧 {t.sos.waterFood}</Text>
                <Text style={styles.sosCodeBadge}>{t.sos.codeWater}</Text>
              </View>
              <Text style={styles.sosCardDesc}>{t.sos.waterFoodDesc}</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionHeader, { marginTop: respHeight(22) }]}>{t.sos.hazardHeading}</Text>
            <View style={styles.hazardGrid}>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.meshCyan }]}
                onPress={() => handleTriggerHazard('FLOOD')}
              >
                <Text style={styles.hazardButtonText}>🌊 {t.sos.hazardFlood}</Text>
                <Text style={styles.hazardButtonSub}>Pegnitz-Pegel Altstadt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hazardButton, { borderColor: OLED_PALETTE.nurnbergRed }]}
                onPress={() => handleTriggerHazard('BLOCKED_ROUTE')}
              >
                <Text style={styles.hazardButtonText}>⛔ {t.sos.hazardBlocked}</Text>
                <Text style={styles.hazardButtonSub}>A73 Frankenschnellweg</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.hazardButtonWide, { borderColor: OLED_PALETTE.warningAmber, marginTop: respHeight(8) }]}
              onPress={() => handleTriggerHazard('GRID_DOWN')}
            >
              <Text style={styles.hazardButtonText}>⚠️ {t.sos.hazardRing}</Text>
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
                <Text style={styles.cardLabel}>{t.family.step1Title}</Text>
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
            </View>

            {/* Broadcast Status Card */}
            <View style={[styles.card, { marginTop: respHeight(16), borderLeftColor: OLED_PALETTE.safeGreen, borderLeftWidth: respWidth(4) }]}>
              <Text style={styles.cardLabel}>{t.family.step2Title}</Text>
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
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: OLED_PALETTE.safeGreen }]}
                onPress={handleBroadcastSafe}
              >
                <Text style={[styles.actionButtonText, { color: OLED_PALETTE.textInverse }]}>
                  {t.family.sendBtn}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* TAB 4: OFFLINE NÜRNBERG POIS */}
        {activeTab === 'POIS' && (
          <View style={styles.feedContainer}>
            <TextInput
              style={[styles.input, { marginBottom: respHeight(8) }]}
              placeholder={`🔍 ${t.orte.searchPlaceholder}`}
              placeholderTextColor={OLED_PALETTE.textMuted}
              value={poiQuery}
              onChangeText={setPoiQuery}
            />

            {/* District Quick Filter Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.districtFilterScroll}>
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

            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PoiCard poi={item} t={t} />}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: respHeight(20) }}
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

const PacketCard = React.memo(({ packet, t }: { packet: MeshPacket; t: ReturnType<typeof getTranslations> }) => {
  const isSos = packet.type === 'SOS';
  const isSafe = packet.type === 'SAFE';
  const isHazard = packet.type === 'HAZARD';

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
        </View>
        <Text style={styles.packetHops}>
          {packet.hop_count === 0 ? t.feed.direct : `${packet.hop_count} ${t.feed.hopsSuffix}`} · TTL: {packet.ttl}
        </Text>
      </View>

      {isSos && (
        <View style={styles.packetBody}>
          <Text style={styles.sosAlertTitle}>🚨 {t.feed.categoryLabel}: {(packet as any).category}</Text>
          <Text style={styles.packetDesc}>{(packet as any).notes || 'Help requested'}</Text>
          <Text style={styles.gpsCoords}>
            📍 {(packet as any).lat.toFixed(4)}°N, {(packet as any).lon.toFixed(4)}°E (Nürnberg)
          </Text>
        </View>
      )}

      {isSafe && (
        <View style={styles.packetBody}>
          <Text style={styles.safeSender}>🛡️ {t.feed.sender}: {(packet as any).sender_alias || t.feed.anonymous}</Text>
          <Text style={styles.encryptedPayload}>
            {t.feed.encryptedCiphertext}{(packet as any).encrypted_payload.slice(0, 24)}...]
          </Text>
        </View>
      )}

      {isHazard && (
        <View style={styles.packetBody}>
          <Text style={styles.hazardTitle}>⚠️ {t.feed.hazardLabel}: {(packet as any).hazard_type}</Text>
          <Text style={styles.packetDesc}>{(packet as any).description}</Text>
        </View>
      )}
    </View>
  );
});

const PoiCard = React.memo(({ poi, t }: { poi: NurnbergEmergencyPoi; t: ReturnType<typeof getTranslations> }) => {
  const isHospital = poi.category === 'HOSPITAL';
  const isWater = poi.category === 'WATER';

  const tagColor = isHospital
    ? OLED_PALETTE.nurnbergRed
    : isWater
    ? OLED_PALETTE.meshCyan
    : OLED_PALETTE.warningAmber;

  const distance = calculateDistanceKm(poi.lat, poi.lon);

  return (
    <View style={styles.poiCard}>
      <View style={styles.poiHeader}>
        <Text style={styles.poiName}>{poi.name}</Text>
        <Text style={[styles.poiTag, { color: tagColor, borderColor: tagColor }]}>
          {(t.orte.types as any)[poi.category] || poi.category}
        </Text>
      </View>
      <View style={styles.poiMetaRow}>
        <Text style={styles.poiDistrictBadge}>[{poi.district}]</Text>
        <Text style={styles.poiDistanceChip}>📍 {distance} zum Hauptmarkt</Text>
      </View>
      <Text style={styles.poiAddress}>{poi.address}</Text>
      <Text style={styles.poiNotes}>{poi.notes}</Text>
      {poi.capacity && <Text style={styles.poiCapacity}>{t.orte.capacityLabel}: {poi.capacity}</Text>}
      {poi.radioFrequency && <Text style={styles.poiRadio}>📡 {poi.radioFrequency}</Text>}
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
    backgroundColor: OLED_PALETTE.safeGreen
  },
  headerTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14.2),
    letterSpacing: respWidth(0.3),
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
    gap: respWidth(5),
    flexShrink: 0,
  },
  guideQuickBtn: {
    backgroundColor: OLED_PALETTE.sinwellSlate,
    borderWidth: respWidth(1.5),
    borderColor: OLED_PALETTE.imperialGold,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(5),
  },
  guideQuickBtnText: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11),
    letterSpacing: respWidth(0.2),
  },
  menuDrawerBtn: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: respWidth(1.5),
    borderColor: OLED_PALETTE.meshCyan,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(5),
  },
  menuDrawerBtnText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(11),
    letterSpacing: respWidth(0.2),
  },
  headerSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayMedium,
    fontSize: respFontSize(12),
    marginTop: respHeight(5),
  },
  civilianStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: respWidth(1.5),
    borderColor: OLED_PALETTE.safeGreen,
    paddingVertical: respHeight(10),
    paddingHorizontal: respWidth(12),
    borderRadius: respWidth(8),
    marginTop: respHeight(10),
  },
  civilianStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  civilianStatusDot: {
    width: respWidth(9),
    height: respWidth(9),
    borderRadius: respWidth(5),
    marginRight: respWidth(8),
  },
  civilianDotGreen: {
    backgroundColor: OLED_PALETTE.safeGreen,
  },
  civilianDotAmber: {
    backgroundColor: OLED_PALETTE.warningAmber,
  },
  civilianStatusText: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(14),
    letterSpacing: respWidth(0.3),
  },
  civilianStatusBadge: {
    backgroundColor: OLED_PALETTE.sinwellSlate,
    paddingHorizontal: respWidth(9),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(5),
    marginLeft: respWidth(6),
    borderWidth: 1,
    borderColor: OLED_PALETTE.hudBorderCyan,
  },
  civilianStatusBadgeText: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: respWidth(1),
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    backgroundColor: '#030508'
  },
  tabButton: {
    flex: 1,
    paddingVertical: respHeight(11),
    alignItems: 'center',
    borderBottomWidth: respWidth(2.5),
    borderBottomColor: 'transparent'
  },
  tabButtonActiveRadar: {
    borderBottomColor: OLED_PALETTE.meshCyan,
    backgroundColor: '#00e5ff12'
  },
  tabButtonActiveSos: {
    borderBottomColor: OLED_PALETTE.nurnbergRed,
    backgroundColor: '#d9042918'
  },
  tabButtonActiveFamily: {
    borderBottomColor: OLED_PALETTE.imperialGold,
    backgroundColor: '#ffb70318'
  },
  tabButtonActivePlaces: {
    borderBottomColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67612'
  },
  tabText: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13)
  },
  tabTextActiveRadar: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
  },
  tabTextActiveSos: {
    color: OLED_PALETTE.sosRed,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
  },
  tabTextActiveFamily: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
  },
  tabTextActivePlaces: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(13)
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
    gap: respHeight(12),
    marginTop: respHeight(10),
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
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11),
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
  sosCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sosCardTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displayBold,
    fontSize: respFontSize(17)
  },
  sosCodeBadge: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(12),
  },
  sosCardDesc: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(13),
    marginTop: respHeight(4)
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
  districtFilterScroll: {
    flexGrow: 0,
    marginBottom: respHeight(12)
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
  }
});
