import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
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
  CloseIcon,
  RadioTowerIcon,
  CrestCastleIcon,
  NurnbergCrestIcon,
  FrankenRechenIcon,
  SchoenerBrunnenIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  MapPinIcon,
  LightbulbIcon,
} from './icons/MeshIcons';

interface EmergencyGuideModalProps {
  visible: boolean;
  onClose: () => void;
  language: Language;
}

export const EmergencyGuideModal: React.FC<EmergencyGuideModalProps> = React.memo(({
  visible,
  onClose,
  language,
}) => {
  const { width, height } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState(0);

  const t = useMemo(() => getTranslations(language), [language]);
  const steps = t.guide.steps;
  const totalSteps = steps.length;

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
      setCurrentStep(0);
    }
  }, [currentStep, totalSteps, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleClose = useCallback(() => {
    onClose();
    setCurrentStep(0);
  }, [onClose]);

  const activeStep = steps[currentStep] || steps[0];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: respWidth(16, width),
        },
        card: {
          width: '100%',
          maxHeight: respHeight(680, height),
          backgroundColor: OLED_PALETTE.kaiserburgCard,
          borderWidth: respWidth(2, width),
          borderColor: OLED_PALETTE.imperialGold,
          borderRadius: respWidth(16, width),
          padding: respWidth(20, width),
          shadowColor: OLED_PALETTE.imperialGold,
          shadowOffset: { width: 0, height: respHeight(4, height) },
          shadowOpacity: 0.3,
          shadowRadius: respWidth(12, width),
          elevation: 10,
        },
        headerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: respWidth(1, width),
          borderBottomColor: OLED_PALETTE.hudGoldBorder,
          paddingBottom: respHeight(12, height),
          marginBottom: respHeight(14, height),
        },
        headerTitle: {
          color: OLED_PALETTE.imperialGold,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(17, width),
          letterSpacing: respWidth(1, width),
        },
        closeIconButton: {
          width: respWidth(34, width),
          height: respHeight(34, height),
          borderRadius: respWidth(17, width),
          backgroundColor: OLED_PALETTE.surfaceBorder,
          justifyContent: 'center',
          alignItems: 'center',
        },
        closeIconText: {
          color: OLED_PALETTE.textPrimary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(16, width),
        },
        stepProgressRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: respHeight(16, height),
        },
        stepCounterText: {
          color: OLED_PALETTE.meshCyan,
          fontFamily: FONTS.monoBold,
          fontSize: respFontSize(13, width),
        },
        dotsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        dot: {
          width: respWidth(8, width),
          height: respHeight(8, height),
          borderRadius: respWidth(4, width),
          backgroundColor: OLED_PALETTE.surfaceBorderActive,
          marginHorizontal: respWidth(4, width),
        },
        dotActive: {
          width: respWidth(22, width),
          backgroundColor: OLED_PALETTE.imperialGold,
        },
        contentScroll: {
          maxHeight: respHeight(380, height),
        },
        badgeBox: {
          alignSelf: 'flex-start',
          paddingHorizontal: respWidth(10, width),
          paddingVertical: respHeight(4, height),
          backgroundColor: OLED_PALETTE.nurnbergRedDark,
          borderRadius: respWidth(4, width),
          borderWidth: respWidth(1.5, width),
          borderColor: OLED_PALETTE.nurnbergRed,
          marginBottom: respHeight(12, height),
        },
        badgeText: {
          color: OLED_PALETTE.franconianWhite,
          fontFamily: FONTS.monoBold,
          fontSize: respFontSize(11, width),
          letterSpacing: respWidth(0.5, width),
        },
        iconHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: respHeight(10, height),
        },
        largeIcon: {
          fontSize: respFontSize(38, width),
          marginRight: respWidth(12, width),
        },
        stepTitle: {
          flex: 1,
          color: OLED_PALETTE.textPrimary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(19, width),
          lineHeight: respHeight(24, height),
        },
        stepDesc: {
          color: OLED_PALETTE.franconianWhite,
          fontFamily: FONTS.displayMedium,
          fontSize: respFontSize(15, width),
          lineHeight: respHeight(22, height),
          marginTop: respHeight(8, height),
          marginBottom: respHeight(14, height),
        },
        tipBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(8, width),
          backgroundColor: OLED_PALETTE.sinwellSlate,
          borderLeftWidth: respWidth(4, width),
          borderLeftColor: OLED_PALETTE.meshCyan,
          padding: respWidth(12, width),
          borderRadius: respWidth(6, width),
          marginVertical: respHeight(8, height),
        },
        civicNoticeBox: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: respWidth(8, width),
          backgroundColor: 'rgba(255, 179, 0, 0.12)',
          borderLeftWidth: respWidth(4, width),
          borderLeftColor: OLED_PALETTE.warningAmber,
          padding: respWidth(12, width),
          borderRadius: respWidth(6, width),
          marginBottom: respHeight(10, height),
        },
        civicNoticeText: {
          flex: 1,
          color: OLED_PALETTE.warningAmber,
          fontFamily: FONTS.monoBold,
          fontSize: respFontSize(12, width),
          lineHeight: respHeight(16, height),
        },
        tipText: {
          flex: 1,
          color: OLED_PALETTE.meshCyan,
          fontFamily: FONTS.monoRegular,
          fontSize: respFontSize(13, width),
          lineHeight: respHeight(18, height),
        },
        iconContainer: {
          width: respWidth(46, width),
          height: respWidth(46, width),
          borderRadius: respWidth(8, width),
          backgroundColor: '#0a101d',
          borderWidth: 1,
          borderColor: OLED_PALETTE.surfaceBorder,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: respWidth(12, width),
        },
        navFooterRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: respHeight(18, height),
          paddingTop: respHeight(12, height),
          borderTopWidth: respWidth(1, width),
          borderTopColor: OLED_PALETTE.hudGoldBorder,
        },
        prevButton: {
          paddingVertical: respHeight(11, height),
          paddingHorizontal: respWidth(18, width),
          borderRadius: respWidth(8, width),
          backgroundColor: OLED_PALETTE.surfaceBorder,
        },
        prevButtonText: {
          color: OLED_PALETTE.textSecondary,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(14, width),
        },
        nextButton: {
          flex: 1,
          marginLeft: respWidth(12, width),
          paddingVertical: respHeight(12, height),
          paddingHorizontal: respWidth(18, width),
          borderRadius: respWidth(8, width),
          backgroundColor:
            currentStep === totalSteps - 1
              ? OLED_PALETTE.safeGreen
              : OLED_PALETTE.imperialGold,
          alignItems: 'center',
        },
        nextButtonText: {
          color: OLED_PALETTE.textInverse,
          fontFamily: FONTS.displayBold,
          fontSize: respFontSize(15, width),
          letterSpacing: respWidth(0.5, width),
        },
      }),
    [width, height, currentStep, totalSteps]
  );

  const renderStepIcon = useCallback((step: number) => {
    switch (step) {
      case 0:
        return <RadioTowerIcon size={respWidth(28, width)} color={OLED_PALETTE.meshCyan} />;
      case 1:
        return <NurnbergCrestIcon size={respWidth(28, width)} color={OLED_PALETTE.imperialGold} />;
      case 2:
        return <AlertTriangleIcon size={respWidth(28, width)} color={OLED_PALETTE.sosRed} />;
      case 3:
        return <FrankenRechenIcon size={respWidth(28, width)} color={OLED_PALETTE.imperialGold} />;
      case 4:
        return <SchoenerBrunnenIcon size={respWidth(28, width)} color={OLED_PALETTE.safeGreen} />;
      default:
        return <RadioTowerIcon size={respWidth(28, width)} color={OLED_PALETTE.meshCyan} />;
    }
  }, [width]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t.guide.modalTitle}</Text>
            <TouchableOpacity
              style={styles.closeIconButton}
              onPress={handleClose}
              accessibilityLabel={t.guide.closeBtn}
            >
              <CloseIcon size={respWidth(16, width)} color={OLED_PALETTE.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Progress / Step indicators */}
          <View style={styles.stepProgressRow}>
            <Text style={styles.stepCounterText}>
              {t.guide.stepCounter(currentStep + 1, totalSteps)}
            </Text>
            <View style={styles.dotsRow}>
              {steps.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={[styles.dot, idx === currentStep && styles.dotActive]}
                />
              ))}
            </View>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.contentScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.badgeBox}>
              <Text style={styles.badgeText}>{activeStep.badge}</Text>
            </View>

            <View style={styles.iconHeaderRow}>
              <View style={styles.iconContainer}>
                {renderStepIcon(currentStep)}
              </View>
              <Text style={styles.stepTitle}>{activeStep.title}</Text>
            </View>

            <Text style={styles.stepDesc}>{activeStep.desc}</Text>

            {currentStep === 0 && (
              <View style={styles.civicNoticeBox}>
                <AlertTriangleIcon size={respWidth(16, width)} color={OLED_PALETTE.warningAmber} />
                <Text style={styles.civicNoticeText}>
                  {language === 'de'
                    ? '⚠️ ZIVILES NOTFALLNETZ: Keine behördliche App der Stadt Nürnberg. Bei funktionierendem Mobilfunk oder Festnetz immer zuerst 112 wählen!'
                    : '⚠️ CIVILIAN EMERGENCY MESH: Not an official app of the City of Nuremberg. If cellular or landline service is available, always dial 112 first!'}
                </Text>
              </View>
            )}

            <View style={styles.tipBox}>
              <LightbulbIcon size={respWidth(16, width)} color={OLED_PALETTE.imperialGold} />
              <Text style={styles.tipText}>{activeStep.tip}</Text>
            </View>
          </ScrollView>

          {/* Navigation Controls */}
          <View style={styles.navFooterRow}>
            {currentStep > 0 ? (
              <TouchableOpacity
                style={styles.prevButton}
                onPress={handlePrev}
                accessibilityLabel={t.guide.prevBtn}
              >
                <Text style={styles.prevButtonText}>{t.guide.prevBtn}</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={styles.nextButton}
              onPress={handleNext}
              accessibilityLabel={
                currentStep === totalSteps - 1 ? t.guide.startBtn : t.guide.nextBtn
              }
            >
              <Text style={styles.nextButtonText}>
                {currentStep === totalSteps - 1
                  ? t.guide.startBtn
                  : t.guide.nextBtn}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});
