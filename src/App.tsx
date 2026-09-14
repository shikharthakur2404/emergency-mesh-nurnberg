/**
 * Emergency Mesh Nürnberg — Main React Native HUD Interface
 * Pure OLED Black (#000000) Civil Defense (Katastrophenschutz) Dashboard
 * Built for Situation A: Total cellular/ISP blackout in Nürnberg.
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
import { VirtualMeshTransport, VirtualNetworkBus } from './core/transport/VirtualMeshTransport';
import {
  MeshPacket,
  SosCategory,
  HazardType,
  NurnbergEmergencyPoi
} from './core/types';
import { searchPois } from './data/nurnberg-emergency-data';
import { getTranslations } from './i18n/translations';

type Tab = 'FEED' | 'SOS' | 'FAMILY' | 'POIS';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('FEED');
  const [familySecretInput, setFamilySecretInput] = useState('');
  const [safeStatusText, setSafeStatusText] = useState('');
  const [senderAlias, setSenderAlias] = useState('');
  const [poiQuery, setPoiQuery] = useState('');

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

  // Initialize Mesh Engine with Virtual Multi-Node RF Simulator on startup
  useEffect(() => {
    const transport = new VirtualMeshTransport(nodeId);
    const meshRouter = new MeshRouter(
      {
        nodeId,
        maxTtl: 15,
        dedupCacheSize: 500,
        familySecrets: ['Nbg-Familie-2026'] // Default test pairing
      },
      transport
    );

    meshRouter.start().then(() => {
      attachRouter(meshRouter);

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

  // Filtered POIs
  const filteredPois = useMemo(() => searchPois(poiQuery), [poiQuery]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={OLED_PALETTE.background} />

      {/* ── OLED HEADER & HUD STATUS BAR ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={styles.pulseDot} />
            <Text style={styles.headerTitle}>{t.header.title}</Text>
          </View>
          <View style={styles.headerRightRow}>
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
            <Text style={styles.nodeBadge}>{nodeId}</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>{t.header.subtitle}</Text>

        {/* Telemetry Metrics Strip */}
        <View style={styles.telemetryStrip}>
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
          style={[styles.tabButton, activeTab === 'FEED' && styles.tabButtonActive]}
          onPress={() => setActiveTab('FEED')}
        >
          <Text style={[styles.tabText, activeTab === 'FEED' && styles.tabTextActive]}>{t.tabs.radar}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SOS' && styles.tabButtonActiveSos]}
          onPress={() => setActiveTab('SOS')}
        >
          <Text style={[styles.tabText, activeTab === 'SOS' && styles.tabTextActiveSos]}>🚨 {t.tabs.sos}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'FAMILY' && styles.tabButtonActiveSafe]}
          onPress={() => setActiveTab('FAMILY')}
        >
          <Text style={[styles.tabText, activeTab === 'FAMILY' && styles.tabTextActiveSafe]}>{t.tabs.familie}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'POIS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('POIS')}
        >
          <Text style={[styles.tabText, activeTab === 'POIS' && styles.tabTextActive]}>{t.tabs.orte}</Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB CONTENT BODY ── */}
      <View style={styles.content}>
        {/* TAB 1: RADAR / LIVE FEED */}
        {activeTab === 'FEED' && (
          <View style={styles.feedContainer}>
            {/* Decrypted Family Highlights Banner */}
            {decryptedFamilyMessages.length > 0 && (
              <View style={styles.familyBanner}>
                <Text style={styles.familyBannerTitle}>{t.feed.decryptedTitle}</Text>
                {decryptedFamilyMessages.map((msg, idx) => (
                  <View key={msg.msgId || idx} style={styles.familyBannerItem}>
                    <Text style={styles.familyBannerSender}>
                      {msg.senderAlias} ({msg.hopCount === 0 ? t.feed.direct : `${msg.hopCount} ${t.feed.hopsSuffix}`}):
                    </Text>
                    <Text style={styles.familyBannerText}>{msg.plaintext}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionHeader}>{t.feed.title}</Text>
            {packets.length === 0 ? (
              <View style={styles.emptyState}>
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
            <Text style={styles.formTitle}>{t.sos.title}</Text>
            <Text style={styles.formSubtitle}>{t.sos.subtitle}</Text>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.sosRed }]}
              onPress={() => handleTriggerSos('MEDICAL')}
            >
              <Text style={styles.sosCardTitle}>🚑 {t.sos.medical}</Text>
              <Text style={styles.sosCardDesc}>{t.sos.medicalDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: '#ff9100' }]}
              onPress={() => handleTriggerSos('FIRE')}
            >
              <Text style={styles.sosCardTitle}>🔥 {t.sos.fire}</Text>
              <Text style={styles.sosCardDesc}>{t.sos.fireDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: '#ffd600' }]}
              onPress={() => handleTriggerSos('TRAPPED')}
            >
              <Text style={styles.sosCardTitle}>🏚️ {t.sos.trapped}</Text>
              <Text style={styles.sosCardDesc}>{t.sos.trappedDesc}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sosCard, { borderColor: OLED_PALETTE.meshCyan }]}
              onPress={() => handleTriggerSos('SUPPLIES')}
            >
              <Text style={styles.sosCardTitle}>💧 {t.sos.waterFood}</Text>
              <Text style={styles.sosCardDesc}>{t.sos.waterFoodDesc}</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionHeader, { marginTop: respHeight(20) }]}>{t.sos.hazardHeading}</Text>
            <View style={styles.hazardRow}>
              <TouchableOpacity
                style={styles.hazardButton}
                onPress={() => handleTriggerHazard('FLOOD')}
              >
                <Text style={styles.hazardButtonText}>🌊 {t.sos.hazardFlood}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hazardButton}
                onPress={() => handleTriggerHazard('BLOCKED_ROUTE')}
              >
                <Text style={styles.hazardButtonText}>⛔ {t.sos.hazardBlocked}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* TAB 3: FAMILY PRIVATE ENCRYPTION */}
        {activeTab === 'FAMILY' && (
          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>{t.family.title}</Text>
            <Text style={styles.formSubtitle}>{t.family.subtitle}</Text>

            {/* Secret Setup Card */}
            <View style={styles.card}>
              <Text style={styles.cardLabel}>{t.family.step1Title}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.family.step1Placeholder}
                placeholderTextColor={OLED_PALETTE.textMuted}
                value={familySecretInput}
                onChangeText={setFamilySecretInput}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.actionButton} onPress={handleSetFamilySecret}>
                <Text style={styles.actionButtonText}>{t.family.step1SaveBtn}</Text>
              </TouchableOpacity>
              {activeFamilySecret ? (
                <Text style={styles.secretActiveNotice}>{t.family.step1SavedBanner(activeFamilySecret)}</Text>
              ) : null}
            </View>

            {/* Broadcast Status Card */}
            <View style={[styles.card, { marginTop: respHeight(16) }]}>
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
              style={[styles.input, { marginBottom: respHeight(12) }]}
              placeholder={`🔍 ${t.orte.searchPlaceholder}`}
              placeholderTextColor={OLED_PALETTE.textMuted}
              value={poiQuery}
              onChangeText={setPoiQuery}
            />

            <FlatList
              data={filteredPois}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <PoiCard poi={item} t={t} />}
              keyboardShouldPersistTaps="handled"
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
    ? OLED_PALETTE.sosRed
    : isSafe
    ? OLED_PALETTE.safeGreen
    : OLED_PALETTE.warningAmber;

  return (
    <View style={[styles.packetCard, { borderLeftColor: borderColor }]}>
      <View style={styles.packetHeader}>
        <Text style={[styles.packetType, { color: borderColor }]}>{packet.type}</Text>
        <Text style={styles.packetHops}>
          {packet.hop_count === 0 ? t.feed.direct : `${packet.hop_count} ${t.feed.hopsSuffix}`} · TTL: {packet.ttl}
        </Text>
      </View>

      {isSos && (
        <View>
          <Text style={styles.sosAlertTitle}>🚨 {t.feed.categoryLabel}: {(packet as any).category}</Text>
          <Text style={styles.packetDesc}>{(packet as any).notes || 'Help requested'}</Text>
          <Text style={styles.gpsCoords}>
            {t.feed.locationLabel}: {(packet as any).lat.toFixed(4)}, {(packet as any).lon.toFixed(4)} (Nürnberg)
          </Text>
        </View>
      )}

      {isSafe && (
        <View>
          <Text style={styles.safeSender}>{t.feed.sender}: {(packet as any).sender_alias || t.feed.anonymous}</Text>
          <Text style={styles.encryptedPayload}>
            {t.feed.encryptedCiphertext}{(packet as any).encrypted_payload.slice(0, 24)}...]
          </Text>
        </View>
      )}

      {isHazard && (
        <View>
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
    ? OLED_PALETTE.sosRed
    : isWater
    ? OLED_PALETTE.meshCyan
    : OLED_PALETTE.warningAmber;

  return (
    <View style={styles.poiCard}>
      <View style={styles.poiHeader}>
        <Text style={styles.poiName}>{poi.name}</Text>
        <Text style={[styles.poiTag, { color: tagColor, borderColor: tagColor }]}>
          {(t.orte.types as any)[poi.category] || poi.category}
        </Text>
      </View>
      <Text style={styles.poiAddress}>{poi.address} ({poi.district})</Text>
      <Text style={styles.poiNotes}>{poi.notes}</Text>
      {poi.capacity && <Text style={styles.poiCapacity}>{t.orte.capacityLabel}: {poi.capacity}</Text>}
    </View>
  );
});

// ── OLED STYLESHEET ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OLED_PALETTE.background
  },
  header: {
    paddingHorizontal: respWidth(16),
    paddingVertical: respHeight(12),
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
  pulseDot: {
    width: respWidth(8),
    height: respWidth(8),
    borderRadius: respWidth(4),
    backgroundColor: OLED_PALETTE.safeGreen
  },
  headerTitle: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '900',
    fontSize: respFontSize(14),
    letterSpacing: 1
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: respWidth(8)
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
    paddingHorizontal: respWidth(7),
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
    fontSize: respFontSize(10),
    fontWeight: '700',
    fontFamily: 'monospace'
  },
  langBtnTextActive: {
    color: OLED_PALETTE.meshCyan,
    fontWeight: '900'
  },
  nodeBadge: {
    color: OLED_PALETTE.meshCyan,
    fontFamily: 'monospace',
    fontSize: respFontSize(11),
    backgroundColor: '#051b24',
    paddingHorizontal: respWidth(8),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
    borderWidth: 1,
    borderColor: '#0a3a4c'
  },
  headerSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginTop: respHeight(4)
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OLED_PALETTE.surfaceCard,
    paddingVertical: respHeight(6),
    paddingHorizontal: respWidth(12),
    borderRadius: respWidth(8),
    marginTop: respHeight(8),
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
    fontSize: respFontSize(9),
    fontWeight: '700'
  },
  telemetryValue: {
    color: OLED_PALETTE.textPrimary,
    fontSize: respFontSize(12),
    fontWeight: '800'
  },
  telemetryValueCyan: {
    color: OLED_PALETTE.meshCyan,
    fontSize: respFontSize(12),
    fontWeight: '800'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: OLED_PALETTE.surfaceBorder
  },
  tabButton: {
    flex: 1,
    paddingVertical: respHeight(10),
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabButtonActive: {
    borderBottomColor: OLED_PALETTE.meshCyan
  },
  tabButtonActiveSos: {
    borderBottomColor: OLED_PALETTE.sosRed
  },
  tabButtonActiveSafe: {
    borderBottomColor: OLED_PALETTE.safeGreen
  },
  tabText: {
    color: OLED_PALETTE.textMuted,
    fontWeight: '700',
    fontSize: respFontSize(12)
  },
  tabTextActive: {
    color: OLED_PALETTE.meshCyan
  },
  tabTextActiveSos: {
    color: OLED_PALETTE.sosRed
  },
  tabTextActiveSafe: {
    color: OLED_PALETTE.safeGreen
  },
  content: {
    flex: 1,
    padding: respWidth(16)
  },
  feedContainer: {
    flex: 1
  },
  sectionHeader: {
    color: OLED_PALETTE.textSecondary,
    fontWeight: '800',
    fontSize: respFontSize(11),
    letterSpacing: 1,
    marginBottom: respHeight(8)
  },
  emptyState: {
    padding: respWidth(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderRadius: respWidth(12),
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    marginTop: respHeight(20)
  },
  emptyStateText: {
    color: OLED_PALETTE.textSecondary,
    fontSize: respFontSize(13),
    fontWeight: '600',
    textAlign: 'center'
  },
  emptyStateSubtext: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginTop: respHeight(4),
    textAlign: 'center'
  },
  familyBanner: {
    backgroundColor: '#032414',
    borderWidth: 1,
    borderColor: '#0b5b35',
    padding: respWidth(12),
    borderRadius: respWidth(10),
    marginBottom: respHeight(14)
  },
  familyBannerTitle: {
    color: OLED_PALETTE.safeGreen,
    fontWeight: '800',
    fontSize: respFontSize(11),
    marginBottom: respHeight(6)
  },
  familyBannerItem: {
    marginTop: respHeight(4)
  },
  familyBannerSender: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '700',
    fontSize: respFontSize(12)
  },
  familyBannerText: {
    color: '#d4edda',
    fontSize: respFontSize(13),
    marginTop: respHeight(2)
  },
  packetCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderLeftWidth: 4,
    borderRadius: respWidth(8),
    padding: respWidth(12),
    marginBottom: respHeight(10)
  },
  packetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: respHeight(4)
  },
  packetType: {
    fontWeight: '900',
    fontSize: respFontSize(12)
  },
  packetHops: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(10),
    fontFamily: 'monospace'
  },
  sosAlertTitle: {
    color: OLED_PALETTE.sosRed,
    fontWeight: '800',
    fontSize: respFontSize(13)
  },
  safeSender: {
    color: OLED_PALETTE.safeGreen,
    fontWeight: '700',
    fontSize: respFontSize(12)
  },
  encryptedPayload: {
    color: OLED_PALETTE.textMuted,
    fontFamily: 'monospace',
    fontSize: respFontSize(11),
    marginTop: respHeight(2)
  },
  hazardTitle: {
    color: OLED_PALETTE.warningAmber,
    fontWeight: '800',
    fontSize: respFontSize(13)
  },
  packetDesc: {
    color: OLED_PALETTE.textPrimary,
    fontSize: respFontSize(13),
    marginTop: respHeight(2)
  },
  gpsCoords: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginTop: respHeight(4),
    fontFamily: 'monospace'
  },
  formContainer: {
    flex: 1
  },
  formTitle: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '900',
    fontSize: respFontSize(16),
    marginBottom: respHeight(4)
  },
  formSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(12),
    marginBottom: respHeight(16)
  },
  sosCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderRadius: respWidth(10),
    padding: respWidth(14),
    marginBottom: respHeight(12)
  },
  sosCardTitle: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '800',
    fontSize: respFontSize(14)
  },
  sosCardDesc: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(12),
    marginTop: respHeight(2)
  },
  hazardRow: {
    flexDirection: 'row',
    gap: respWidth(10)
  },
  hazardButton: {
    flex: 1,
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.warningAmber,
    padding: respWidth(12),
    borderRadius: respWidth(8),
    alignItems: 'center'
  },
  hazardButtonText: {
    color: OLED_PALETTE.warningAmber,
    fontWeight: '700',
    fontSize: respFontSize(12)
  },
  card: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(14),
    borderRadius: respWidth(10)
  },
  cardLabel: {
    color: OLED_PALETTE.textPrimary,
    fontWeight: '700',
    fontSize: respFontSize(13),
    marginBottom: respHeight(8)
  },
  input: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    color: OLED_PALETTE.textPrimary,
    paddingHorizontal: respWidth(12),
    paddingVertical: respHeight(8),
    borderRadius: respWidth(6),
    fontSize: respFontSize(13),
    marginBottom: respHeight(10)
  },
  actionButton: {
    backgroundColor: OLED_PALETTE.meshCyan,
    paddingVertical: respHeight(10),
    borderRadius: respWidth(6),
    alignItems: 'center'
  },
  actionButtonText: {
    color: OLED_PALETTE.textInverse,
    fontWeight: '800',
    fontSize: respFontSize(13)
  },
  secretActiveNotice: {
    color: OLED_PALETTE.safeGreen,
    fontSize: respFontSize(11),
    marginTop: respHeight(8),
    fontFamily: 'monospace'
  },
  poiCard: {
    backgroundColor: OLED_PALETTE.surfaceCard,
    borderWidth: 1,
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
    fontWeight: '800',
    fontSize: respFontSize(13),
    flex: 1
  },
  poiTag: {
    fontSize: respFontSize(9),
    fontWeight: '800',
    borderWidth: 1,
    paddingHorizontal: respWidth(6),
    paddingVertical: respHeight(2),
    borderRadius: respWidth(4),
    marginLeft: respWidth(6)
  },
  poiAddress: {
    color: OLED_PALETTE.textSecondary,
    fontSize: respFontSize(12),
    marginTop: respHeight(2)
  },
  poiNotes: {
    color: OLED_PALETTE.textMuted,
    fontSize: respFontSize(11),
    marginTop: respHeight(4)
  },
  poiCapacity: {
    color: OLED_PALETTE.meshCyan,
    fontSize: respFontSize(10),
    marginTop: respHeight(2),
    fontWeight: '700'
  }
});
