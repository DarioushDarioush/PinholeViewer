import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings, LIGHTING_CONDITIONS, FILTER_OPTIONS, FilmOrientation } from '../types';
import { useCameraContext } from '../app/_layout';

// WCAG AA compliant colors
const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';
const CHARCOAL = '#1a1a1a';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#B3B3B3';
const TEXT_MUTED = '#808080';

interface Props {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
}

// IMPORTANT: Camera is now managed ENTIRELY by _layout.tsx
// This screen only renders the UI overlay (header, exposure info, etc.)
// This ensures only ONE camera instance exists across the entire app
export default function ViewfinderScreen({ settings, updateSettings }: Props) {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const { startCountdown } = useCameraContext();

  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const calculateFStop = () => {
    return (settings.focalLength / settings.pinholeSize).toFixed(1);
  };

  // Calculate raw exposure time in seconds (for countdown)
  const calculateExposureSeconds = (): number | null => {
    if (!settings.selectedCondition) return null;
    
    const condition = LIGHTING_CONDITIONS.find(c => c.name === settings.selectedCondition);
    if (!condition) return null;
    
    const actualFStop = parseFloat(calculateFStop());
    const referenceFStop = condition.fStop;
    
    const baseExposure = 1 / settings.iso;
    let exposureTime = baseExposure * Math.pow(actualFStop / referenceFStop, 2);
    
    if (settings.useReciprocityFailure && exposureTime > 1) {
      exposureTime = Math.pow(exposureTime, 1.3);
    }
    
    // Apply filter compensation
    const selectedFilter = settings.selectedFilter || 'None';
    const filterOption = FILTER_OPTIONS.find(f => f.name === selectedFilter);
    if (filterOption && filterOption.stops > 0) {
      exposureTime *= Math.pow(2, filterOption.stops);
    } else if (settings.useRedFilter && selectedFilter === 'None') {
      exposureTime *= 8;
    }
    
    const bracketMultiplier = Math.pow(2, settings.bracketStops);
    exposureTime *= bracketMultiplier;
    
    return exposureTime;
  };

  const calculateExposure = () => {
    const exposureTime = calculateExposureSeconds();
    if (exposureTime === null) return null;
    return formatExposure(exposureTime);
  };

  // Handle long press on exposure panel to start countdown
  const handleExposureLongPress = () => {
    const exposureSeconds = calculateExposureSeconds();
    if (exposureSeconds !== null && exposureSeconds >= 1) {
      startCountdown(exposureSeconds);
    }
  };

  const formatExposure = (seconds: number) => {
    if (seconds < 1) {
      return `1/${Math.round(1 / seconds)}s`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    }
  };

  const handleBracketChange = (value: number) => {
    updateSettings({ ...settings, bracketStops: value });
  };

  const toggleOrientation = () => {
    const newOrientation: FilmOrientation = settings.filmOrientation === 'portrait' ? 'landscape' : 'portrait';
    updateSettings({ ...settings, filmOrientation: newOrientation });
  };

  const calculatedExposure = calculateExposure();
  const filmOrientationLabel = settings.filmOrientation === 'portrait' ? 'Portrait' : 'Landscape';

  // NOTE: Camera is now rendered by _layout.tsx for BOTH portrait and landscape
  // This screen only shows UI overlay elements

  // ========== Info Panel Content (RIGHT side in landscape) ==========
  const renderInfoPanelContent = () => (
    <ScrollView 
      style={styles.infoPanelScroll}
      contentContainerStyle={styles.infoPanelContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.infoPanelTitle}>CAMERA SETTINGS</Text>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Format</Text>
        <Text style={styles.infoValue}>{settings.filmFormat.name}</Text>
      </View>
      
      <TouchableOpacity style={styles.infoRow} onPress={toggleOrientation}>
        <Text style={styles.infoLabel}>Orientation</Text>
        <View style={styles.orientationValue}>
          <Ionicons 
            name={settings.filmOrientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
            size={16} 
            color={AMBER} 
          />
          <Text style={styles.infoValue}>{filmOrientationLabel}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>F-Stop</Text>
        <Text style={styles.infoValueLarge}>f/{calculateFStop()}</Text>
      </View>
      
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>ISO</Text>
        <Text style={styles.infoValue}>{settings.iso}</Text>
      </View>

      {calculatedExposure && (
        <Pressable 
          style={styles.exposureSection}
          onLongPress={handleExposureLongPress}
          delayLongPress={500}
        >
          <Text style={styles.infoPanelTitle}>EXPOSURE</Text>
          <View style={styles.exposureBox}>
            <Text style={styles.exposureValue}>{calculatedExposure}</Text>
            <Text style={styles.exposureCondition}>{settings.selectedCondition}</Text>
            {/* Show modifiers: bracket, filter, reciprocity */}
            {(settings.bracketStops !== 0 || 
              (settings.selectedFilter && settings.selectedFilter !== 'None') || 
              settings.useReciprocityFailure) && (
              <View style={styles.exposureModifiers}>
                {settings.bracketStops !== 0 && (
                  <Text style={styles.exposureModifier}>
                    {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops
                  </Text>
                )}
                {settings.selectedFilter && settings.selectedFilter !== 'None' && (
                  <Text style={[styles.exposureModifier, styles.filterModifier]}>
                    {settings.selectedFilter} Filter
                  </Text>
                )}
                {settings.useReciprocityFailure && (
                  <Text style={[styles.exposureModifier, styles.reciprocityModifier]}>
                    Reciprocity
                  </Text>
                )}
              </View>
            )}
          </View>
          <Text style={styles.longPressHint}>Long press to start timer</Text>
        </Pressable>
      )}

      {calculatedExposure && (
        <View style={styles.bracketSection}>
          <Text style={styles.infoPanelTitle}>BRACKET</Text>
          <Text style={styles.bracketValue}>
            {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={-3}
            maximumValue={3}
            step={1}
            value={settings.bracketStops}
            onValueChange={handleBracketChange}
            minimumTrackTintColor={AMBER}
            maximumTrackTintColor={TEXT_MUTED}
            thumbTintColor={AMBER}
          />
          <View style={styles.bracketMarks}>
            <Text style={[styles.bracketMark, settings.bracketStops === -3 && styles.bracketMarkActive]}>-3</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === -2 && styles.bracketMarkActive]}>-2</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === -1 && styles.bracketMarkActive]}>-1</Text>
            <Text style={[styles.bracketMark, styles.bracketMarkZero, settings.bracketStops === 0 && styles.bracketMarkActive]}>0</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === 1 && styles.bracketMarkActive]}>+1</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === 2 && styles.bracketMarkActive]}>+2</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === 3 && styles.bracketMarkActive]}>+3</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ========== PORTRAIT LAYOUT - UI overlay only (camera is in _layout.tsx) ==========
  const renderPortraitLayout = () => (
    <View style={styles.portraitOverlayContainer}>
      {/* Header bar - positioned at top */}
      <View style={styles.headerBar}>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>FORMAT</Text>
          <Text style={styles.headerValue}>{settings.filmFormat.name}</Text>
        </View>
        <TouchableOpacity style={styles.headerItem} onPress={toggleOrientation}>
          <Text style={styles.headerLabel}>ORIENTATION</Text>
          <View style={styles.headerOrientationRow}>
            <Ionicons 
              name={settings.filmOrientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
              size={14} 
              color={AMBER} 
            />
            <Text style={styles.headerValueSmall}>{filmOrientationLabel}</Text>
          </View>
        </TouchableOpacity>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>F-STOP</Text>
          <Text style={styles.headerValue}>f/{calculateFStop()}</Text>
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>ISO</Text>
          <Text style={styles.headerValue}>{settings.iso}</Text>
        </View>
      </View>

      {/* Spacer - transparent area where camera shows through */}
      <View style={styles.cameraAreaSpacer} />

      {/* Exposure info at bottom - long press to start timer */}
      {calculatedExposure && (
        <Pressable 
          style={styles.portraitExposureBar}
          onLongPress={handleExposureLongPress}
          delayLongPress={500}
        >
          <Text style={styles.portraitExposureLabel}>EXPOSURE</Text>
          <Text style={styles.portraitExposureValue}>{calculatedExposure}</Text>
          <Text style={styles.portraitExposureCondition}>
            {settings.selectedCondition}
            {settings.bracketStops !== 0 && ` (${settings.bracketStops > 0 ? '+' : ''}${settings.bracketStops})`}
          </Text>
          {/* Show active modifiers */}
          {((settings.selectedFilter && settings.selectedFilter !== 'None') || 
            settings.useReciprocityFailure) && (
            <View style={styles.portraitModifiersRow}>
              {settings.selectedFilter && settings.selectedFilter !== 'None' && (
                <View style={styles.portraitModifierBadge}>
                  <Text style={styles.portraitModifierText}>{settings.selectedFilter}</Text>
                </View>
              )}
              {settings.useReciprocityFailure && (
                <View style={[styles.portraitModifierBadge, styles.reciprocityBadge]}>
                  <Text style={styles.portraitModifierText}>Reciprocity</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.longPressHintPortrait}>Long press to start timer</Text>
        </Pressable>
      )}

      {calculatedExposure && (
        <View style={styles.portraitBracketBar}>
          <Text style={styles.portraitBracketLabel}>
            Bracket: {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops
          </Text>
          <Slider
            style={styles.portraitSlider}
            minimumValue={-3}
            maximumValue={3}
            step={1}
            value={settings.bracketStops}
            onValueChange={handleBracketChange}
            minimumTrackTintColor={AMBER}
            maximumTrackTintColor={TEXT_MUTED}
            thumbTintColor={AMBER}
          />
          <View style={styles.portraitBracketMarks}>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === -3 && styles.portraitBracketMarkActive]}>-3</Text>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === -2 && styles.portraitBracketMarkActive]}>-2</Text>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === -1 && styles.portraitBracketMarkActive]}>-1</Text>
            <Text style={[styles.portraitBracketMark, styles.portraitBracketMarkZero, settings.bracketStops === 0 && styles.portraitBracketMarkActive]}>0</Text>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === 1 && styles.portraitBracketMarkActive]}>+1</Text>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === 2 && styles.portraitBracketMarkActive]}>+2</Text>
            <Text style={[styles.portraitBracketMark, settings.bracketStops === 3 && styles.portraitBracketMarkActive]}>+3</Text>
          </View>
        </View>
      )}
    </View>
  );

  // ========== LANDSCAPE LAYOUT: Info Panel only (camera is in parent _layout.tsx) ==========
  const renderLandscapeLayout = () => (
    <View style={styles.landscapeInfoPanelOnly}>
      {renderInfoPanelContent()}
    </View>
  );

  return isLandscape ? renderLandscapeLayout() : renderPortraitLayout();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  
  // Portrait Overlay Container - transparent to show camera behind
  portraitOverlayContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cameraAreaSpacer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  
  // Header Bar (Portrait)
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: CHARCOAL,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: AMBER,
  },
  headerItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  headerLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerValue: {
    color: AMBER,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerValueSmall: {
    color: AMBER,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  headerOrientationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Portrait Exposure Bar
  portraitExposureBar: {
    backgroundColor: AMBER,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  portraitExposureLabel: {
    color: DARK_BG,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  portraitExposureValue: {
    color: DARK_BG,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  portraitExposureCondition: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.85,
  },
  portraitModifiersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  portraitModifierBadge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reciprocityBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  portraitModifierText: {
    color: DARK_BG,
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Portrait Bracket Bar
  portraitBracketBar: {
    backgroundColor: CHARCOAL,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  portraitBracketLabel: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
  portraitSlider: {
    width: '100%',
    height: 40,
  },

  // LANDSCAPE Layout: Info Panel Only (camera is in parent)
  landscapeInfoPanelOnly: {
    flex: 1,
    backgroundColor: CHARCOAL,
  },
  
  // Info Panel (Landscape Right)
  infoPanelScroll: {
    flex: 1,
  },
  infoPanelContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  infoPanelTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
    minHeight: 44,
  },
  infoLabel: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    color: AMBER,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoValueLarge: {
    color: AMBER,
    fontSize: 18,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  orientationValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  
  // Exposure Section (Landscape)
  exposureSection: {
    marginTop: 8,
  },
  exposureBox: {
    backgroundColor: AMBER,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  exposureValue: {
    color: DARK_BG,
    fontSize: 28,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  exposureCondition: {
    color: DARK_BG,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  exposureDetails: {
    color: DARK_BG,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    opacity: 0.8,
  },
  exposureModifiers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  exposureModifier: {
    color: DARK_BG,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  longPressHint: {
    color: DARK_BG,
    fontSize: 9,
    fontWeight: '500',
    marginTop: 8,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  longPressHintPortrait: {
    color: DARK_BG,
    fontSize: 10,
    fontWeight: '500',
    marginTop: 8,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  filterModifier: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  reciprocityModifier: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  
  // Bracket Section (Landscape)
  bracketSection: {
    marginTop: 8,
  },
  bracketValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  bracketMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  bracketMark: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    minWidth: 20,
  },
  bracketMarkZero: {
    fontWeight: '600',
  },
  bracketMarkActive: {
    color: AMBER,
    fontWeight: '700',
  },
  
  // Portrait Bracket Marks
  portraitBracketMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginTop: 4,
  },
  portraitBracketMark: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    minWidth: 24,
  },
  portraitBracketMarkZero: {
    fontWeight: '600',
  },
  portraitBracketMarkActive: {
    color: AMBER,
    fontWeight: '700',
  },
});
