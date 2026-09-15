import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  OLED_PALETTE,
  FONTS,
  respWidth,
  respHeight,
  respFontSize,
} from '../ui/responsive';
import { ChevronDownIcon, ChevronUpIcon } from './icons/MeshIcons';

interface DiagnosticsDisclosureProps {
  channelName: string;
  gpsCoords: string;
  dtnBufferedCount: number;
  dtnSyncCount: number;
  nodeId: string;
  isRadioActive: boolean;
}

export const DiagnosticsDisclosure: React.FC<DiagnosticsDisclosureProps> = React.memo(({
  channelName,
  gpsCoords,
  dtnBufferedCount,
  dtnSyncCount,
  nodeId,
  isRadioActive,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Diagnose und Funk-Status anzeigen"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Diagnose & Funk-Status</Text>
          <Text style={styles.headerSubtitle}>
            {isRadioActive ? 'Hardware-Funk aktiv' : 'Simulationsmodus'} · {channelName}
          </Text>
        </View>
        <View style={styles.iconBox}>
          {isExpanded ? (
            <ChevronUpIcon size={respWidth(16)} color={OLED_PALETTE.textSecondary} />
          ) : (
            <ChevronDownIcon size={respWidth(16)} color={OLED_PALETTE.textSecondary} />
          )}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <View style={styles.telemetryGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Funkkanal (UDP)</Text>
              <Text style={styles.gridValue}>{channelName}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>GPS-Sektor</Text>
              <Text style={styles.gridValue}>{gpsCoords}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Knoten-ID</Text>
              <Text style={styles.gridValueGold}>{nodeId}</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Krypto-Signatur</Text>
              <Text style={styles.gridValueGreen}>HMAC-SHA256</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>DTN-Speicher</Text>
              <Text style={styles.gridValue}>{dtnBufferedCount} Pakete gepuffert</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Relay-Syncs</Text>
              <Text style={styles.gridValueGreen}>{dtnSyncCount} synchronisiert</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: OLED_PALETTE.kaiserburgCard,
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    borderRadius: respWidth(8),
    overflow: 'hidden',
    marginTop: respHeight(10),
  },
  headerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: respHeight(10),
    paddingHorizontal: respWidth(12),
    backgroundColor: '#0a0e17',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.displaySemiBold,
    fontSize: respFontSize(13),
  },
  headerSubtitle: {
    color: OLED_PALETTE.textMuted,
    fontFamily: FONTS.monoRegular,
    fontSize: respFontSize(10.5),
    marginTop: respHeight(2),
  },
  iconBox: {
    marginLeft: respWidth(8),
    padding: respWidth(4),
  },
  expandedContent: {
    padding: respWidth(12),
    borderTopWidth: 1,
    borderTopColor: OLED_PALETTE.surfaceBorder,
    backgroundColor: OLED_PALETTE.surfaceCard,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: respWidth(8),
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#070b12',
    borderWidth: 1,
    borderColor: OLED_PALETTE.surfaceBorder,
    padding: respWidth(8),
    borderRadius: respWidth(6),
  },
  gridLabel: {
    color: OLED_PALETTE.textSecondary,
    fontFamily: FONTS.displayRegular,
    fontSize: respFontSize(11),
  },
  gridValue: {
    color: OLED_PALETTE.textPrimary,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
  gridValueGold: {
    color: OLED_PALETTE.imperialGold,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
  gridValueGreen: {
    color: OLED_PALETTE.safeGreen,
    fontFamily: FONTS.monoBold,
    fontSize: respFontSize(11.5),
    marginTop: respHeight(2),
  },
});
