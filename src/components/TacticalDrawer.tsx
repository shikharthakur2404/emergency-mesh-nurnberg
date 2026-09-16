import React, { useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import {
  OLED_PALETTE,
  respWidth,
  respHeight,
  respFontSize,
  FONTS,
} from '../ui/responsive';
import { getTranslations, Language } from '../i18n/translations';
import {
  SettingsIcon,
  CloseIcon,
  PhoneIcon,
  RadioTowerIcon,
  TruckIcon,
  HelpCircleIcon,
  AlertTriangleIcon,
  NurnbergCrestIcon,
} from './icons/MeshIcons';

/**
 * TacticalDrawer — Civil Defense Diagnostics & Control Panel
 *
 * A full-screen modal drawer rendered over the main HUD. Serves three purposes:
 *   1. **Hotlines** — pre-loaded Nürnberg emergency numbers (112, 110, DLRG, etc.)
 *      accessible offline without any network lookup.
 *   2. **Telemetry** — live RF radio status, DTN buffer stats, node ID, and peer count
 *      for operators diagnosing mesh health.
 *   3. **Actions** — language switch, guide re-opener, and mesh cache reset.
 *
 * Opened via the `≡` header icon in App.tsx. Can also be triggered programmatically
 * by setting `drawerVisible` state in the parent.
 */

/** Props for the TacticalDrawer component. */
interface TacticalDrawerProps {
  /** Controls drawer visibility. */
  visible: boolean;
  /** Called when the user closes the drawer (close button or backdrop press). */
  onClose: () => void;
  /** Active UI language — passed down so hotline labels render in the correct locale. */
  language: Language;
  /** Callback to switch the app language. Updates `language` state in App. */
  onSelectLanguage: (lang: Language) => void;
  /** Callback to open the EmergencyGuideModal from within the drawer. */
  onOpenGuide: () => void;
  /** This node's anonymised mesh ID (e.g. `anon_4f2a`). Displayed in telemetry panel. */
  nodeId: string;
  /** Whether hardware UDP radio is active. Determines telemetry status colour. */
  isRadioActive: boolean;
  /** Number of directly connected mesh peers. */
  connectedPeersCount: number;
  /** Packets relayed on behalf of other nodes (routing contribution metric). */
  relayedCount: number;
  /** Total packets received since session start. */
  totalPacketsCount: number;
  /** DTN store-and-forward buffer depth — how many packets are awaiting delivery. */
  dtnBufferedCount?: number;
  /** Number of epidemic DTN sync rounds completed. */
  dtnSyncCount?: number;
  /** Clears the mesh dedup cache and local history (useful after network partition events). */
  onClearCache: () => void;
}


const NURNBERG_HOTLINES = [
  { name: 'Feuerwehr & Rettungsdienst', number: '112', type: 'EMERGENCY' },
  { name: 'Polizei Notruf', number: '110', type: 'EMERGENCY' },
  { name: 'Ärztlicher Bereitschaftsdienst', number: '116 117', type: 'MEDICAL' },
  { name: 'Bürgertelefon Katastrophenschutz Nbg', number: '0911 / 231-0', type: 'CITY' },
  { name: 'Giftnotruf Bayern', number: '089 / 19240', type: 'POISON' },
  { name: 'DLRG Wasserrettung Nürnberg', number: '0911 / 44 22 22', type: 'WATER' },
];

export const TacticalDrawer: React.FC<TacticalDrawerProps> = React.memo(({
  visible,
  onClose,
  language,
  onSelectLanguage,
  onOpenGuide,
  nodeId,
  isRadioActive,
  connectedPeersCount,
  relayedCount,
  totalPacketsCount,
  dtnBufferedCount = 0,
  dtnSyncCount = 0,
  onClearCache,
}) => {
  const { width, height } = useWindowDimensions();
  const t = useMemo(() => getTranslations(language), [language]);

  const handleClearCache = useCallback(() => {
    onClearCache();
    Alert.alert(t.drawer.actionsHeader, t.drawer.cacheClearedAlert);
  }, [onClearCache, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'flex-end',
        },
        drawerContainer: {
          width: '100%',
          maxHeight: respHeight(760, height),
          backgroundColor: OLED_PALETTE.kaiserburgCard,
          borderTopLeftRadius: respWidth(20, width),
          borderTopRightRadius: respWidth(20, width),
          borderTopWidth: respWidth(2, width),
          borderLeftWidth: respWidth(1, width),
          borderRightWidth: respWidth(1, width),
          borderColor: OLED_PALETTE.imperialGold,
          paddingHorizontal: respWidth(20, width),
          paddingTop: respHeight(16, height),
          paddingBottom: respHeight(28, height),
        },
        dragHandleBar: {
          width: respWidth(48, width),
          height: respHeight(4, height),
          backgroundColor: OLED_PALETTE.surfaceBorderActive,
          borderRadius: respWidth(2, width),
          alignSelf: 'center',
          marginBottom: respHeight(12, height),
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: respWidth(1, width),
          borderBottomColor: OLED_PALETTE.hudGoldBorder,
          paddingBottom: respHeight(12, height),
          marginBottom: respHeight(16, height),
        },
        headerTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(8, width),
        },
        headerTitle: {
          color: OLED_PALETTE.imperialGold,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(18, width),
          letterSpacing: respWidth(1, width),
        },
        closeBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(6, width),
          paddingVertical: respHeight(7, height),
          paddingHorizontal: respWidth(12, width),
          backgroundColor: OLED_PALETTE.surfaceBorder,
          borderRadius: respWidth(6, width),
        },
        closeBtnText: {
          color: OLED_PALETTE.textPrimary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(13, width),
        },
        btnRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: respWidth(8, width),
        },
        scrollContent: {
          maxHeight: respHeight(620, height),
        },
        sectionHeadingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(7, width),
          marginTop: respHeight(16, height),
          marginBottom: respHeight(6, height),
        },
        sectionHeading: {
          color: OLED_PALETTE.meshCyan,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(15, width),
          letterSpacing: respWidth(0.8, width),
        },
        sectionSub: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displayRegular,
          fontSize: respFontSize(13, width),
          marginBottom: respHeight(10, height),
        },
        hotlineCard: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: OLED_PALETTE.sinwellSlate,
          paddingVertical: respHeight(12, height),
          paddingHorizontal: respWidth(14, width),
          borderRadius: respWidth(8, width),
          borderWidth: respWidth(1.5, width),
          borderColor: OLED_PALETTE.surfaceBorder,
          marginBottom: respHeight(8, height),
        },
        hotlineName: {
          color: OLED_PALETTE.textPrimary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(15, width),
          flex: 1,
        },
        hotlineNumberBadge: {
          backgroundColor: OLED_PALETTE.nurnbergRedDark,
          borderWidth: respWidth(1.5, width),
          borderColor: OLED_PALETTE.nurnbergRed,
          paddingVertical: respHeight(5, height),
          paddingHorizontal: respWidth(12, width),
          borderRadius: respWidth(6, width),
          marginLeft: respWidth(8, width),
        },
        hotlineNumberText: {
          color: OLED_PALETTE.franconianWhite,
          fontFamily: FONTS.monoBold,
          fontSize: respFontSize(14, width),
          letterSpacing: respWidth(0.5, width),
        },
        telemetryBox: {
          backgroundColor: OLED_PALETTE.surfaceCard,
          borderWidth: respWidth(1.5, width),
          borderColor: OLED_PALETTE.hudBorderCyan,
          borderRadius: respWidth(8, width),
          padding: respWidth(14, width),
          marginBottom: respHeight(12, height),
        },
        telemetryRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: respHeight(6, height),
        },
        telemetryDivider: {
          height: respHeight(1, height),
          backgroundColor: OLED_PALETTE.surfaceBorder,
          marginVertical: respHeight(4, height),
        },
        telemetryLabel: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displaySemiBold,
          fontSize: respFontSize(14, width),
        },
        telemetryValue: {
          color: OLED_PALETTE.textPrimary,
          fontSize: respFontSize(13, width),
          fontFamily: FONTS.monoBold,
        },
        telemetryValueActive: {
          color: OLED_PALETTE.safeGreen,
          fontSize: respFontSize(13, width),
          fontFamily: FONTS.monoBold,
        },
        telemetryValueGold: {
          color: OLED_PALETTE.imperialGold,
          fontSize: respFontSize(13, width),
          fontFamily: FONTS.monoBold,
        },
        actionButtonGold: {
          backgroundColor: OLED_PALETTE.imperialGold,
          paddingVertical: respHeight(13, height),
          borderRadius: respWidth(8, width),
          alignItems: 'center',
          marginTop: respHeight(8, height),
        },
        actionButtonGoldText: {
          color: OLED_PALETTE.textInverse,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(15, width),
          letterSpacing: respWidth(0.5, width),
        },
        actionButtonMuted: {
          backgroundColor: OLED_PALETTE.surfaceBorder,
          paddingVertical: respHeight(12, height),
          borderRadius: respWidth(8, width),
          alignItems: 'center',
          marginTop: respHeight(8, height),
          marginBottom: respHeight(16, height),
        },
        actionButtonMutedText: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(14, width),
        },
        civicDisclaimerBox: {
          backgroundColor: 'rgba(255, 179, 0, 0.08)',
          borderColor: OLED_PALETTE.warningAmber,
          borderWidth: respWidth(1, width),
          borderRadius: respWidth(8, width),
          padding: respWidth(12, width),
          marginBottom: respHeight(14, height),
        },
        civicDisclaimerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(6, width),
          marginBottom: respHeight(6, height),
        },
        civicDisclaimerTitle: {
          color: OLED_PALETTE.warningAmber,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(13, width),
        },
        civicDisclaimerText: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displayRegular,
          fontSize: respFontSize(12, width),
          lineHeight: respHeight(16, height),
        },
        langSwitchRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: OLED_PALETTE.sinwellSlate,
          padding: respWidth(12, width),
          borderRadius: respWidth(8, width),
          marginTop: respHeight(6, height),
        },
        langLabel: {
          color: OLED_PALETTE.textPrimary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(14, width),
        },
        langBtns: {
          flexDirection: 'row',
        },
        langBtnItem: {
          paddingVertical: respHeight(6, height),
          paddingHorizontal: respWidth(14, width),
          borderRadius: respWidth(5, width),
          backgroundColor: OLED_PALETTE.surfaceBorder,
          marginLeft: respWidth(6, width),
        },
        langBtnItemActive: {
          backgroundColor: OLED_PALETTE.meshCyan,
        },
        langBtnItemText: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(13, width),
        },
        langBtnItemTextActive: {
          color: OLED_PALETTE.textInverse,
        },
      }),
    [width, height]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.drawerContainer}>
          <View style={styles.dragHandleBar} />

          {/* Drawer Top Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <NurnbergCrestIcon size={respWidth(18, width)} color={OLED_PALETTE.imperialGold} />
              <Text style={styles.headerTitle}>{t.drawer.title}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel={t.drawer.closeBtn}
            >
              <CloseIcon size={respWidth(14, width)} color={OLED_PALETTE.textPrimary} />
              <Text style={styles.closeBtnText}>{t.drawer.closeBtn}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Civic Independence & Emergency 112 Notice */}
            <View style={styles.civicDisclaimerBox}>
              <View style={styles.civicDisclaimerHeader}>
                <AlertTriangleIcon size={respWidth(16, width)} color={OLED_PALETTE.warningAmber} />
                <Text style={styles.civicDisclaimerTitle}>{t.drawer.civicNoticeTitle}</Text>
              </View>
              <Text style={styles.civicDisclaimerText}>{t.drawer.civicNoticeBody}</Text>
            </View>

            {/* Guide Quick Access */}
            <TouchableOpacity
              style={styles.actionButtonGold}
              onPress={() => {
                onClose();
                onOpenGuide();
              }}
            >
              <View style={styles.btnRow}>
                <HelpCircleIcon size={respWidth(18, width)} color={OLED_PALETTE.textInverse} />
                <Text style={styles.actionButtonGoldText}>
                  {t.drawer.openGuideBtn}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Language Selection */}
            <View style={styles.langSwitchRow}>
              <Text style={styles.langLabel}>{t.drawer.languageLabel}</Text>
              <View style={styles.langBtns}>
                <TouchableOpacity
                  style={[
                    styles.langBtnItem,
                    language === 'de' && styles.langBtnItemActive,
                  ]}
                  onPress={() => onSelectLanguage('de')}
                >
                  <Text
                    style={[
                      styles.langBtnItemText,
                      language === 'de' && styles.langBtnItemTextActive,
                    ]}
                  >
                    Deutsch
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.langBtnItem,
                    language === 'en' && styles.langBtnItemActive,
                  ]}
                  onPress={() => onSelectLanguage('en')}
                >
                  <Text
                    style={[
                      styles.langBtnItemText,
                      language === 'en' && styles.langBtnItemTextActive,
                    ]}
                  >
                    English
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Nürnberg Hotlines Section */}
            <View style={styles.sectionHeadingRow}>
              <PhoneIcon size={respWidth(16, width)} color={OLED_PALETTE.meshCyan} />
              <Text style={styles.sectionHeading}>{t.drawer.hotlinesHeader}</Text>
            </View>
            <Text style={styles.sectionSub}>{t.drawer.hotlinesNote}</Text>

            {NURNBERG_HOTLINES.map((h, i) => (
              <View key={`hotline-${i}`} style={styles.hotlineCard}>
                <Text style={styles.hotlineName}>{h.name}</Text>
                <View style={styles.hotlineNumberBadge}>
                  <Text style={styles.hotlineNumberText}>{h.number}</Text>
                </View>
              </View>
            ))}

            {/* Hardware Telemetry Section */}
            <View style={styles.sectionHeadingRow}>
              <RadioTowerIcon size={respWidth(16, width)} color={OLED_PALETTE.meshCyan} />
              <Text style={styles.sectionHeading}>{t.drawer.telemetryHeader}</Text>
            </View>
            <View style={styles.telemetryBox}>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.nodeId}</Text>
                <Text style={styles.telemetryValueGold}>{nodeId}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.hardwareRadio}</Text>
                <Text style={styles.telemetryValueActive}>
                  {isRadioActive ? t.drawer.statusActive : 'Virtual'}
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.connectedPeers}</Text>
                <Text style={styles.telemetryValue}>
                  {connectedPeersCount} aktiv
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.relayedCount}</Text>
                <Text style={styles.telemetryValue}>
                  {relayedCount} {t.drawer.hopsSuffix}
                </Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.totalPackets}</Text>
                <Text style={styles.telemetryValue}>{totalPacketsCount}</Text>
              </View>
            </View>

            {/* Delay-Tolerant Carrier Mesh (DTN) Section */}
            <View style={styles.sectionHeadingRow}>
              <TruckIcon size={respWidth(16, width)} color={OLED_PALETTE.meshCyan} />
              <Text style={styles.sectionHeading}>{t.drawer.dtnHeader}</Text>
            </View>
            <Text style={styles.sectionSub}>{t.drawer.dtnSubhead}</Text>
            <View style={styles.telemetryBox}>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.dtnBuffered}</Text>
                <Text style={styles.telemetryValueGold}>{dtnBufferedCount}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.dtnSyncs}</Text>
                <Text style={styles.telemetryValueActive}>{dtnSyncCount}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.foregroundService}</Text>
                <Text style={styles.telemetryValueActive}>{t.drawer.foregroundServiceActive}</Text>
              </View>
              <View style={styles.telemetryDivider} />
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>{t.drawer.sigSecurity}</Text>
                <Text style={styles.telemetryValueActive}>{t.drawer.sigSecurityVal}</Text>
              </View>
            </View>

            {/* Maintenance / Cache Tools */}
            <View style={styles.sectionHeadingRow}>
              <SettingsIcon size={respWidth(16, width)} color={OLED_PALETTE.meshCyan} />
              <Text style={styles.sectionHeading}>{t.drawer.actionsHeader}</Text>
            </View>
            <TouchableOpacity
              style={styles.actionButtonMuted}
              onPress={handleClearCache}
            >
              <Text style={styles.actionButtonMutedText}>
                {t.drawer.clearCacheBtn}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
