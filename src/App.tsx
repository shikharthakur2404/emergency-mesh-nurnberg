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
  respFontSize
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
    stats
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
            <View>
              <View style={styles.titleRow}>
                <View style={styles.pulseDot} />
                <Text style={styles.headerTitle}>{t.header.title}</Text>
              </View>
              <Text style={styles.headerSectorSub}>{t.header.sectorTag}</Text>
            </View>
          </View>

          <View style={styles.headerRightRow}>
            {/* Bilingual Switcher */}
            <View style={styles.langSelector}>
              <TouchableOpacity
                style={[styles.langBtn, language === 'de' && styles.langBtnActive]}
                onPress={() => setLanguage('de')}
              >
                <Text style={[styles.langBtnText, language === 'de' && styles.langBtnTextActive]}>DE</Text>
              </TouchableOpacity>
              <View style={styles.langDivider} />
              <TouchableOpacity
                style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
                onPress={() => setLanguage('en')}
              >
                <Text style={[styles.langBtnText, language === 'en' && styles.langBtnTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>

            {/* Tactical Node Badge */}
            <View style={styles.nodeBadgeContainer}>
              <Text style={styles.nodeBadgePrefix}>NODE</Text>
              <Text style={styles.nodeBadge}>{nodeId}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.headerSubtitle}>{t.header.subtitle}</Text>

        {/* Hardware OTA Radio & Frequency Indicator */}
        <View style={styles.radioStatusBar}>
          <View style={styles.radioStatusLeft}>
            <View style={[styles.radioStatusDot, isRadioActive ? styles.radioDotGreen : styles.radioDotAmber]} />
            <Text style={styles.radioStatusText}>
              {isRadioActive ? t.header.radioOta : t.header.radioSim}
            </Text>
          </View>
          <View style={styles.channelBadge}>
            <Text style={styles.channelBadgeText}>{t.header.frequencyTag}</Text>
          </View>
        </View>

        {/* Telemetry Metrics Strip */}
        <View style={styles.telemetryStrip}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>SEKTOR</Text>
            <Text style={styles.telemetryValueGold}>NBG-01</Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>{t.header.peers}</Text>
            <Text style={styles.telemetryValueCyan}>{connectedPeers.length + 2} {t.header.peersActive}</Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>{t.header.relayed}</Text>
            <Text style={styles.telemetryValue}>{stats.relayedCount} {t.header.hops}</Text>
          </View>
          <View style={styles.telemetryDivider} />
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>{t.header.packets}</Text>
            <Text style={styles.telemetryValue}>{stats.totalReceived + packets.length}</Text>
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
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🏰</Text>
                <Text style={styles.emptyStateText}>{t.feed.emptyTitle}</Text>
                <Text style={styles.emptyStateSubtext}>{t.feed.emptySubtitle}</Text>
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
    gap: respWidth(8)
  },
  crestBadge: {
    width: respWidth(34),
    height: respWidth(34),
    borderRadius: respWidth(6),
    backgroundColor: '#16080a',
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    alignItems: 'center',
    justifyContent: 'center'
  },
  crestIcon: {
    fontSize: respFontSize(18)
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6)
  },
  pulseDot: {
    width: respWidth(7),
    height: respWidth(7),
    borderRadius: respWidth(4),
    backgroundColor: OLED_PALETTE.safeGreen
  },
  headerTitle: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '900',
    fontSize: respFontSize(13),
    letterSpacing: 0.8
  },
  headerSectorSub: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(9),
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: respHeight(1)
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6)
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0f',
    borderRadius: respWidth(4),
    borderWidth: 1,
    borderColor: '#1f242e',
    overflow: 'hidden'
  },
  langBtn: {
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(3)
  },
  langBtnActive: {
    backgroundColor: '#00e5ff22'
  },
  langDivider: {
    width: 1,
    height: respHeight(14),
    backgroundColor: '#1f242e'
  },
  langBtnText: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  langBtnTextActive: {
    color: OLED_PALETTE.meshCyan,
    fontWeight: '900'
  },
  nodeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#051b24',
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
    borderWidth: 1,
    borderColor: '#0a3a4c',
    gap: respWidth(4)
  },
  nodeBadgePrefix: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(8),
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  nodeBadge: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: 'monospace',
    fontSize: respFontSize(10),
    fontWeight: '800'
  },
  headerSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    marginTop: respHeight(4)
  },
  radioStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: respHeight(6),
    backgroundColor: '#070b10',
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(4),
    borderWidth: 1,
    borderColor: '#0f172a'
  },
  radioStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  radioStatusDot: {
    width: respWidth(6),
    height: respWidth(6),
    borderRadius: respWidth(3),
    marginRight: respWidth(6)
  },
  radioDotGreen: {
    backgroundColor: OLED_PALETTE.safeGreen
  },
  radioDotAmber: {
    backgroundColor: OLED_PALETTE.warningAmber
  },
  radioStatusText: {
    color: OLED_PALETTE.textPrimary,
    fontSize: respFontSize(9),
    fontWeight: '700',
    letterSpacing: 0.3
  },
  channelBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3)
  },
  channelBadgeText: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(8),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OLED_PALETTE.surfaceCard,
    paddingVertical: respHeight(6),
    paddingHorizontal: respWidth(8),
    borderRadius: respWidth(6),
    marginTop: respHeight(6),
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center'
  },
  telemetryDivider: {
    width: 1,
    height: respHeight(18),
    backgroundColor: OLED_PALETTE.surfaceBorder
  },
  telemetryLabel: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(8),
    fontWeight: '800',
    letterSpacing: 0.5
  },
  telemetryValue: {
    color: OLED_PALETTE.textPrimary,
    fontSize: respFontSize(11),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  telemetryValueCyan: {
    color: OLED_PALETTE.meshCyan,
    fontSize: respFontSize(11),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  telemetryValueGold: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(11),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: OLED_PALETTE.surfaceBorder,
    backgroundColor: '#030508'
  },
  tabButton: {
    flex: 1,
    paddingVertical: respHeight(9),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabButtonActiveRadar: {
    borderBottomColor: OLED_PALETTE.meshCyan,
    backgroundColor: '#00e5ff0d'
  },
  tabButtonActiveSos: {
    borderBottomColor: OLED_PALETTE.nurnbergRed,
    backgroundColor: '#d9042915'
  },
  tabButtonActiveFamily: {
    borderBottomColor: OLED_PALETTE.imperialGold,
    backgroundColor: '#ffb70312'
  },
  tabButtonActivePlaces: {
    borderBottomColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e6760d'
  },
  tabText: {
    color: OLED_PALETTE.textMuted,
    fontWeight: '700',
    fontSize: respFontSize(11)
  },
  tabTextActiveRadar: {
    color: OLED_PALETTE.meshCyan,
    fontWeight: '900'
  },
  tabTextActiveSos: {
    color: OLED_PALETTE.sosRed,
    fontWeight: '900'
  },
  tabTextActiveFamily: {
    color: OLED_PALETTE.imperialGold,
    fontWeight: '900'
  },
  tabTextActivePlaces: {
    color: OLED_PALETTE.safeGreen,
    fontWeight: '900'
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
    paddingVertical: respHeight(4),
    paddingHorizontal: respWidth(6),
    borderRadius: respWidth(4),
    borderWidth: 1,
    borderColor: '#0f172a',
    marginBottom: respHeight(10)
  },
  sectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(4)
  },
  sectorDotGreen: {
    width: respWidth(5),
    height: respWidth(5),
    borderRadius: respWidth(3),
    backgroundColor: OLED_PALETTE.safeGreen
  },
  sectorDotAmber: {
    width: respWidth(5),
    height: respWidth(5),
    borderRadius: respWidth(3),
    backgroundColor: OLED_PALETTE.warningAmber
  },
  sectorChipText: {
    color: OLED_PALETTE.textSecondary,
    fontSize: respFontSize(8),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  streamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(6)
  },
  sectionHeader: {
    color: OLED_PALETTE.textSecondary,
    fontWeight: '800',
    fontSize: respFontSize(10),
    letterSpacing: 1
  },
  streamSignalBadge: {
    color: OLED_PALETTE.safeGreen,
    fontSize: respFontSize(9),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  emptyState: {
    padding: respWidth(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderRadius: respWidth(10),
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    marginTop: respHeight(20)
  },
  emptyStateIcon: {
    fontSize: respFontSize(28),
    marginBottom: respHeight(8)
  },
  emptyStateText: {
    color: OLED_PALETTE.textSecondary,
    fontSize: respFontSize(12),
    fontWeight: '700',
    textAlign: 'center'
  },
  emptyStateSubtext: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    marginTop: respHeight(4),
    textAlign: 'center'
  },
  familyBanner: {
    backgroundColor: '#051b10',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGoldMuted,
    borderLeftWidth: respWidth(4),
    borderLeftColor: OLED_PALETTE.imperialGold,
    padding: respWidth(10),
    borderRadius: respWidth(6),
    marginBottom: respHeight(10)
  },
  familyBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4)
  },
  familyBannerTitle: {
    color: OLED_PALETTE.imperialGold,
    fontWeight: '900',
    fontSize: respFontSize(10),
    letterSpacing: 0.5
  },
  kaiserburgTag: {
    color: OLED_PALETTE.safeGreen,
    fontSize: respFontSize(8),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  familyBannerItem: {
    marginTop: respHeight(2)
  },
  familyBannerSender: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '700',
    fontSize: respFontSize(11)
  },
  familyBannerText: {
    color: '#d4edda',
    fontSize: respFontSize(12),
    marginTop: respHeight(1)
  },
  packetCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderLeftWidth: respWidth(4),
    borderRadius: respWidth(6),
    padding: respWidth(10),
    marginBottom: respHeight(8)
  },
  packetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4)
  },
  packetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(6)
  },
  packetTypeBadge: {
    fontWeight: '900',
    fontSize: respFontSize(10),
    paddingHorizontal: respWidth(5),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3),
    overflow: 'hidden'
  },
  packetSectorTag: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  packetHops: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    fontFamily: 'monospace'
  },
  packetBody: {
    marginTop: respHeight(2)
  },
  sosAlertTitle: {
    color: OLED_PALETTE.nurnbergRed,
    fontWeight: '800',
    fontSize: respFontSize(12)
  },
  safeSender: {
    color: OLED_PALETTE.imperialGold,
    fontWeight: '800',
    fontSize: respFontSize(11)
  },
  encryptedPayload: {
    color: OLED_PALETTE.textMuted,
    fontFamily: 'monospace',
    fontSize: respFontSize(10),
    marginTop: respHeight(2)
  },
  hazardTitle: {
    color: OLED_PALETTE.warningAmber,
    fontWeight: '800',
    fontSize: respFontSize(12)
  },
  packetDesc: {
    color: OLED_PALETTE.textPrimary,
    fontSize: respFontSize(12),
    marginTop: respHeight(2)
  },
  gpsCoords: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    marginTop: respHeight(3),
    fontFamily: 'monospace'
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
    fontWeight: '900',
    fontSize: respFontSize(14),
    letterSpacing: 0.5
  },
  katsBadge: {
    backgroundColor: '#38060b',
    borderWidth: 1,
    borderColor: OLED_PALETTE.nurnbergRed,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(3)
  },
  katsBadgeText: {
    color: OLED_PALETTE.nurnbergRed,
    fontSize: respFontSize(8),
    fontWeight: '900',
    fontFamily: 'monospace'
  },
  vaultTag: {
    backgroundColor: '#261b00',
    borderWidth: 1,
    borderColor: OLED_PALETTE.imperialGold,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(3)
  },
  vaultTagText: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(8),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  formSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginBottom: respHeight(12)
  },
  sosCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderRadius: respWidth(8),
    padding: respWidth(12),
    marginBottom: respHeight(10)
  },
  sosCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sosCardTitle: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '800',
    fontSize: respFontSize(13)
  },
  sosCodeBadge: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  sosCardDesc: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginTop: respHeight(3)
  },
  hazardGrid: {
    flexDirection: 'row',
    gap: respWidth(8)
  },
  hazardButton: {
    flex: 1,
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    padding: respWidth(10),
    borderRadius: respWidth(6),
    alignItems: 'center'
  },
  hazardButtonWide: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    padding: respWidth(10),
    borderRadius: respWidth(6),
    alignItems: 'center'
  },
  hazardButtonText: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '800',
    fontSize: respFontSize(11)
  },
  hazardButtonSub: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    marginTop: respHeight(2)
  },
  card: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(12),
    borderRadius: respWidth(8)
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(6)
  },
  cardLabel: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '700',
    fontSize: respFontSize(12)
  },
  cipherLabel: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(9),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  input: {
    backgroundColor: '#0c0f14',
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    color: OLED_PALETTE.textPrimary,
    paddingHorizontal: respWidth(10),
    paddingVertical: respHeight(7),
    borderRadius: respWidth(5),
    fontSize: respFontSize(12),
    marginBottom: respHeight(8)
  },
  actionButton: {
    backgroundColor: OLED_PALETTE.meshCyan,
    paddingVertical: respHeight(9),
    borderRadius: respWidth(5),
    alignItems: 'center'
  },
  actionButtonGold: {
    backgroundColor: OLED_PALETTE.imperialGold,
    paddingVertical: respHeight(9),
    borderRadius: respWidth(5),
    alignItems: 'center'
  },
  actionButtonText: {
    color: OLED_PALETTE.textInverse,
    fontWeight: '800',
    fontSize: respFontSize(12)
  },
  actionButtonGoldText: {
    color: OLED_PALETTE.textInverse,
    fontWeight: '900',
    fontSize: respFontSize(12)
  },
  secretActiveNotice: {
    color: OLED_PALETTE.safeGreen,
    fontSize: respFontSize(10),
    marginTop: respHeight(6),
    fontFamily: 'monospace'
  },
  districtFilterScroll: {
    flexGrow: 0,
    marginBottom: respHeight(10)
  },
  districtChip: {
    paddingHorizontal: respWidth(10),
    paddingVertical: respHeight(4),
    borderRadius: respWidth(4),
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    marginRight: respWidth(6)
  },
  districtChipActive: {
    borderColor: OLED_PALETTE.safeGreen,
    backgroundColor: '#00e67615'
  },
  districtChipText: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    fontWeight: '700'
  },
  districtChipTextActive: {
    color: OLED_PALETTE.safeGreen,
    fontWeight: '900'
  },
  poiCard: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(10),
    borderRadius: respWidth(6),
    marginBottom: respHeight(8)
  },
  poiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  poiName: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '800',
    fontSize: respFontSize(12),
    flex: 1
  },
  poiTag: {
    fontSize: respFontSize(8),
    fontWeight: '800',
    borderWidth: 1,
    paddingHorizontal: respWidth(5),
    paddingVertical: respHeight(1),
    borderRadius: respWidth(3),
    marginLeft: respWidth(6)
  },
  poiMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8),
    marginTop: respHeight(2)
  },
  poiDistrictBadge: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(9),
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  poiDistanceChip: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(9),
    fontFamily: 'monospace'
  },
  poiAddress: {
    color: OLED_PALETTE.textSecondary,
    fontSize: respFontSize(11),
    marginTop: respHeight(2)
  },
  poiNotes: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    marginTop: respHeight(3)
  },
  poiCapacity: {
    color: OLED_PALETTE.meshCyan,
    fontSize: respFontSize(9),
    marginTop: respHeight(2),
    fontWeight: '700'
  },
  poiRadio: {
    color: OLED_PALETTE.imperialGold,
    fontSize: respFontSize(9),
    marginTop: respHeight(2),
    fontFamily: 'monospace'
  }
});
