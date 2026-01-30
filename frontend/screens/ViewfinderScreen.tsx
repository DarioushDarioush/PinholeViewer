import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings, LIGHTING_CONDITIONS, FilmOrientation } from '../types';

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

export default function ViewfinderScreen({ settings, updateSettings }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [cameraKey, setCameraKey] = useState(0); // Key to force camera remount
  const cameraRef = useRef<any>(null);

  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      // Force camera to remount when orientation changes
      setCameraKey(prev => prev + 1);
    });
    return () => subscription?.remove();
  }, []);

  const calculateFStop = () => {
    return (settings.focalLength / settings.pinholeSize).toFixed(1);
  };

  const getEffectiveDimensions = () => {
    const { width, height } = settings.filmFormat;
    const orientation = settings.filmOrientation || 'landscape';
    
    if (orientation === 'portrait') {
      return { width: height, height: width };
    }
    return { width, height };
  };

  const calculateViewfinderSize = () => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    
    const effectiveDims = getEffectiveDimensions();
    const filmAspectRatio = effectiveDims.width / effectiveDims.height;
    
    let viewfinderWidth: number;
    let viewfinderHeight: number;
    
    if (isLandscape) {
      // Landscape: viewfinder on RIGHT side, use ~58% of screen width
      const availableWidth = screenWidth * 0.56;
      const availableHeight = screenHeight - 80;
      
      viewfinderHeight = availableHeight * 0.85;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
      
      if (viewfinderWidth > availableWidth * 0.9) {
        viewfinderWidth = availableWidth * 0.9;
        viewfinderHeight = viewfinderWidth / filmAspectRatio;
      }
    } else {
      // Portrait: viewfinder centered
      const availableWidth = screenWidth - 32;
      const availableHeight = screenHeight * 0.50;
      
      viewfinderWidth = availableWidth * 0.95;
      viewfinderHeight = viewfinderWidth / filmAspectRatio;
      
      if (viewfinderHeight > availableHeight) {
        viewfinderHeight = availableHeight;
        viewfinderWidth = viewfinderHeight * filmAspectRatio;
      }
    }
    
    return { width: viewfinderWidth, height: viewfinderHeight };
  };

  const calculateExposure = () => {
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
    
    if (settings.useRedFilter) {
      exposureTime *= 8;
    }
    
    const bracketMultiplier = Math.pow(2, settings.bracketStops);
    exposureTime *= bracketMultiplier;
    
    return formatExposure(exposureTime);
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
  const viewfinderSize = calculateViewfinderSize();

  // ========== SHARED: Info Panel Content ==========
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
      
      <TouchableOpacity 
        style={styles.infoRow}
        onPress={toggleOrientation}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Film orientation: ${filmOrientationLabel}. Tap to toggle`}
      >
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

      {/* Exposure Display */}
      {calculatedExposure && (
        <View style={styles.exposureSection}>
          <Text style={styles.infoPanelTitle}>EXPOSURE</Text>
          <View style={styles.exposureBox}>
            <Text style={styles.exposureValue}>{calculatedExposure}</Text>
            <Text style={styles.exposureCondition}>{settings.selectedCondition}</Text>
            {(settings.bracketStops !== 0 || settings.useRedFilter) && (
              <Text style={styles.exposureDetails}>
                {settings.bracketStops !== 0 && `${settings.bracketStops > 0 ? '+' : ''}${settings.bracketStops} stops`}
                {settings.bracketStops !== 0 && settings.useRedFilter && ' • '}
                {settings.useRedFilter && 'Red Filter'}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Bracket Slider */}
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
            <Text style={[styles.bracketMark, settings.bracketStops === 0 && styles.bracketMarkActive]}>0</Text>
            <Text style={[styles.bracketMark, settings.bracketStops === 3 && styles.bracketMarkActive]}>+3</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );

  // ========== SHARED: Camera View with Overlay ==========
  const renderCameraWithOverlay = () => (
    <View style={styles.cameraWrapper}>
      <CameraView
        key={cameraKey}
        style={StyleSheet.absoluteFill}
        facing="back"
        ref={cameraRef}
      />
      {/* Viewfinder Frame Overlay */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={[styles.viewfinderFrame, { width: viewfinderSize.width, height: viewfinderSize.height }]} />
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>
    </View>
  );

  // ========== SHARED: Permission Request ==========
  const renderPermissionRequest = () => (
    <View style={styles.permissionContainer}>
      <Ionicons name="camera-outline" size={isLandscape ? 40 : 64} color={TEXT_MUTED} />
      <Text style={[styles.permissionTitle, isLandscape && styles.permissionTitleLandscape]}>
        Camera Access Required
      </Text>
      {!isLandscape && (
        <Text style={styles.permissionText}>Grant camera permission to use the viewfinder</Text>
      )}
      <TouchableOpacity
        style={[styles.permissionButton, isLandscape && styles.permissionButtonLandscape]}
        onPress={requestPermission}
        accessible={true}
        accessibilityRole="button"
      >
        <Text style={styles.permissionButtonText}>Enable Camera</Text>
      </TouchableOpacity>
    </View>
  );

  // ========== PORTRAIT LAYOUT ==========
  const renderPortraitLayout = () => (
    <View style={styles.container}>
      {/* Header Bar */}
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

      {/* Camera or Permission */}
      {permission?.granted ? renderCameraWithOverlay() : renderPermissionRequest()}

      {/* Exposure Display */}
      {calculatedExposure && (
        <View style={styles.portraitExposureBar}>
          <Text style={styles.portraitExposureLabel}>EXPOSURE</Text>
          <Text style={styles.portraitExposureValue}>{calculatedExposure}</Text>
          <Text style={styles.portraitExposureCondition}>
            {settings.selectedCondition}
            {settings.bracketStops !== 0 && ` (${settings.bracketStops > 0 ? '+' : ''}${settings.bracketStops})`}
          </Text>
        </View>
      )}

      {/* Bracket Slider */}
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
        </View>
      )}
    </View>
  );

  // ========== LANDSCAPE LAYOUT ==========
  const renderLandscapeLayout = () => (
    <View style={styles.landscapeContainer}>
      {/* LEFT: Info Panel */}
      <View style={styles.landscapeLeftPanel}>
        {renderInfoPanelContent()}
      </View>

      {/* RIGHT: Camera/Viewfinder */}
      <View style={styles.landscapeRightPanel}>
        {permission?.granted ? renderCameraWithOverlay() : renderPermissionRequest()}
      </View>
    </View>
  );

  // ========== MAIN RENDER ==========
  if (!permission) {
    return <View style={styles.container} />;
  }

  return isLandscape ? renderLandscapeLayout() : renderPortraitLayout();
}

const styles = StyleSheet.create({
  // ========== CONTAINER ==========
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },

  // ========== PORTRAIT HEADER ==========
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

  // ========== CAMERA WRAPPER ==========
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },

  // ========== OVERLAY ==========
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  viewfinderFrame: {
    borderWidth: 3,
    borderColor: AMBER,
  },

  // ========== PERMISSION ==========
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
    padding: 24,
  },
  permissionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionTitleLandscape: {
    fontSize: 16,
    marginTop: 12,
  },
  permissionText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: AMBER,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginTop: 20,
    minHeight: 48,
  },
  permissionButtonLandscape: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  permissionButtonText: {
    color: DARK_BG,
    fontSize: 16,
    fontWeight: '700',
  },

  // ========== PORTRAIT EXPOSURE BAR ==========
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

  // ========== PORTRAIT BRACKET BAR ==========
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

  // ========== LANDSCAPE LAYOUT ==========
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DARK_BG,
  },
  landscapeLeftPanel: {
    width: '38%',
    backgroundColor: CHARCOAL,
    borderRightWidth: 2,
    borderRightColor: AMBER,
  },
  landscapeRightPanel: {
    flex: 1,
    backgroundColor: '#000',
  },

  // ========== INFO PANEL (LANDSCAPE LEFT) ==========
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

  // ========== EXPOSURE SECTION (LANDSCAPE) ==========
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

  // ========== BRACKET SECTION (LANDSCAPE) ==========
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
    paddingHorizontal: 8,
  },
  bracketMark: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bracketMarkActive: {
    color: AMBER,
    fontWeight: '700',
  },
});
