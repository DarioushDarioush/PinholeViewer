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

// WCAG AA compliant colors - minimum 4.5:1 contrast ratio
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
  const cameraRef = useRef<any>(null);

  // Detect device orientation (landscape vs portrait)
  const isDeviceLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
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

  // Calculate viewfinder size based on device orientation
  const calculateViewfinderSize = () => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    
    const effectiveDims = getEffectiveDimensions();
    const filmAspectRatio = effectiveDims.width / effectiveDims.height;
    
    let viewfinderWidth: number;
    let viewfinderHeight: number;
    
    if (isDeviceLandscape) {
      // Landscape device: viewfinder on left, use ~60% of screen width
      const availableWidth = screenWidth * 0.58;
      const availableHeight = screenHeight - 20;
      
      viewfinderHeight = availableHeight * 0.92;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
      
      if (viewfinderWidth > availableWidth) {
        viewfinderWidth = availableWidth;
        viewfinderHeight = viewfinderWidth / filmAspectRatio;
      }
    } else {
      // Portrait device: viewfinder on top
      const availableWidth = screenWidth - 32;
      const availableHeight = screenHeight * 0.50;
      
      viewfinderWidth = availableWidth * 0.95;
      viewfinderHeight = viewfinderWidth / filmAspectRatio;
      
      if (viewfinderHeight > availableHeight) {
        viewfinderHeight = availableHeight;
        viewfinderWidth = viewfinderHeight * filmAspectRatio;
      }
    }
    
    return {
      width: viewfinderWidth,
      height: viewfinderHeight,
    };
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
  const effectiveDims = getEffectiveDimensions();
  const filmOrientationLabel = settings.filmOrientation === 'portrait' ? 'Portrait' : 'Landscape';

  // ============ PORTRAIT MODE COMPONENTS ============
  
  const renderPortraitHeaderBar = () => (
    <View style={styles.headerBar} accessible={true} accessibilityRole="toolbar">
      <View style={styles.headerItem}>
        <Text style={styles.headerLabel}>FORMAT</Text>
        <Text style={styles.headerValue}>{settings.filmFormat.name}</Text>
      </View>
      <TouchableOpacity 
        style={styles.headerItem}
        onPress={toggleOrientation}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Film orientation: ${filmOrientationLabel}. Tap to toggle`}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.headerLabel}>ORIENTATION</Text>
        <View style={styles.orientationRow}>
          <Ionicons 
            name={settings.filmOrientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
            size={16} 
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
  );

  const renderPortraitExposureDisplay = () => {
    if (!calculatedExposure) return null;
    
    return (
      <View style={styles.exposureContainer} accessible={true} accessibilityRole="text">
        <Text style={styles.exposureLabel}>CALCULATED EXPOSURE</Text>
        <Text style={styles.exposureValue}>{calculatedExposure}</Text>
        <Text style={styles.exposureCondition}>
          {settings.selectedCondition}
          {settings.bracketStops !== 0 && ` (${settings.bracketStops > 0 ? '+' : ''}${settings.bracketStops} stops)`}
          {settings.useRedFilter && ' • Red Filter'}
        </Text>
      </View>
    );
  };

  const renderPortraitBracketSlider = () => {
    if (!calculatedExposure) return null;
    
    return (
      <View style={styles.bracketContainer} accessible={true} accessibilityRole="adjustable">
        <Text style={styles.bracketLabel}>
          Bracket: {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops
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
          {[-3, -2, -1, 0, 1, 2, 3].map((mark) => (
            <Text 
              key={mark} 
              style={[styles.bracketMark, settings.bracketStops === mark && styles.bracketMarkActive]}
            >
              {mark > 0 ? `+${mark}` : mark}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  // ============ LANDSCAPE MODE COMPONENTS ============

  const renderLandscapeInfoPanel = () => (
    <View style={styles.landscapeInfoPanel}>
      <ScrollView 
        style={styles.landscapeScrollView}
        contentContainerStyle={styles.landscapeScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings Info */}
        <View style={styles.landscapeInfoSection}>
          <Text style={styles.landscapeSectionTitle}>CAMERA SETTINGS</Text>
          
          <View style={styles.landscapeInfoRow}>
            <Text style={styles.landscapeInfoLabel}>Format</Text>
            <Text style={styles.landscapeInfoValue}>{settings.filmFormat.name}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.landscapeInfoRow}
            onPress={toggleOrientation}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Film orientation: ${filmOrientationLabel}. Tap to toggle`}
          >
            <Text style={styles.landscapeInfoLabel}>Orientation</Text>
            <View style={styles.landscapeOrientationValue}>
              <Ionicons 
                name={settings.filmOrientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
                size={18} 
                color={AMBER} 
              />
              <Text style={styles.landscapeInfoValue}>{filmOrientationLabel}</Text>
            </View>
          </TouchableOpacity>
          
          <View style={styles.landscapeInfoRow}>
            <Text style={styles.landscapeInfoLabel}>F-Stop</Text>
            <Text style={styles.landscapeInfoValueLarge}>f/{calculateFStop()}</Text>
          </View>
          
          <View style={styles.landscapeInfoRow}>
            <Text style={styles.landscapeInfoLabel}>ISO</Text>
            <Text style={styles.landscapeInfoValue}>{settings.iso}</Text>
          </View>
        </View>

        {/* Exposure Display */}
        {calculatedExposure && (
          <View style={styles.landscapeExposureSection}>
            <Text style={styles.landscapeSectionTitle}>EXPOSURE</Text>
            <View style={styles.landscapeExposureBox}>
              <Text style={styles.landscapeExposureValue}>{calculatedExposure}</Text>
              <Text style={styles.landscapeExposureCondition}>
                {settings.selectedCondition}
              </Text>
              {(settings.bracketStops !== 0 || settings.useRedFilter) && (
                <Text style={styles.landscapeExposureDetails}>
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
          <View style={styles.landscapeBracketSection}>
            <Text style={styles.landscapeSectionTitle}>BRACKET</Text>
            <Text style={styles.landscapeBracketValue}>
              {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops
            </Text>
            <Slider
              style={styles.landscapeSlider}
              minimumValue={-3}
              maximumValue={3}
              step={1}
              value={settings.bracketStops}
              onValueChange={handleBracketChange}
              minimumTrackTintColor={AMBER}
              maximumTrackTintColor={TEXT_MUTED}
              thumbTintColor={AMBER}
            />
            <View style={styles.landscapeBracketMarks}>
              <Text style={[styles.landscapeBracketMark, settings.bracketStops === -3 && styles.bracketMarkActive]}>-3</Text>
              <Text style={[styles.landscapeBracketMark, settings.bracketStops === 0 && styles.bracketMarkActive]}>0</Text>
              <Text style={[styles.landscapeBracketMark, settings.bracketStops === 3 && styles.bracketMarkActive]}>+3</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );

  // ============ PERMISSION SCREENS ============

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    if (isDeviceLandscape) {
      // Landscape permission screen
      return (
        <View style={styles.landscapeContainer}>
          <View style={styles.landscapeViewfinderArea}>
            <View style={styles.permissionContainerLandscape}>
              <Ionicons name="camera-outline" size={48} color={TEXT_MUTED} />
              <Text style={styles.permissionTitleLandscape}>Camera Access Required</Text>
              <TouchableOpacity
                style={styles.permissionButtonLandscape}
                onPress={requestPermission}
                accessible={true}
                accessibilityRole="button"
              >
                <Text style={styles.permissionButtonText}>Enable Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
          {renderLandscapeInfoPanel()}
        </View>
      );
    } else {
      // Portrait permission screen
      return (
        <View style={styles.container}>
          {renderPortraitHeaderBar()}
          <View style={styles.permissionContainer}>
            <Ionicons name="camera-outline" size={64} color={TEXT_MUTED} />
            <Text style={styles.permissionTitle}>Camera Access Required</Text>
            <Text style={styles.permissionText}>Grant camera permission to use the viewfinder</Text>
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={requestPermission}
              accessible={true}
              accessibilityRole="button"
            >
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </TouchableOpacity>
            {renderPortraitExposureDisplay()}
          </View>
          {renderPortraitBracketSlider()}
        </View>
      );
    }
  }

  const viewfinderSize = calculateViewfinderSize();

  // ============ LANDSCAPE LAYOUT ============
  if (isDeviceLandscape) {
    return (
      <View style={styles.landscapeContainer}>
        {/* Left: Camera/Viewfinder - Unobstructed */}
        <View style={styles.landscapeViewfinderArea}>
          <CameraView
            style={styles.landscapeCamera}
            facing="back"
            ref={cameraRef}
          />
          {/* Viewfinder Frame Overlay */}
          <View style={styles.landscapeOverlay} pointerEvents="none">
            <View style={styles.landscapeGreyTop} />
            <View style={styles.landscapeMiddleRow}>
              <View style={styles.landscapeGreySide} />
              <View
                style={[
                  styles.viewfinder,
                  {
                    width: viewfinderSize.width,
                    height: viewfinderSize.height,
                  },
                ]}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel={`Viewfinder: ${settings.filmFormat.name} ${filmOrientationLabel}`}
              />
              <View style={styles.landscapeGreySide} />
            </View>
            <View style={styles.landscapeGreyBottom} />
          </View>
        </View>

        {/* Right: Info Panel */}
        {renderLandscapeInfoPanel()}
      </View>
    );
  }

  // ============ PORTRAIT LAYOUT ============
  return (
    <View style={styles.container}>
      {renderPortraitHeaderBar()}

      {/* Camera View with Viewfinder */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
        />
        
        {/* Viewfinder Overlay */}
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.greyArea} />
          <View style={styles.middleSection}>
            <View style={styles.greyArea} />
            <View
              style={[
                styles.viewfinder,
                {
                  width: viewfinderSize.width,
                  height: viewfinderSize.height,
                },
              ]}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`Viewfinder: ${settings.filmFormat.name} ${filmOrientationLabel}`}
            />
            <View style={styles.greyArea} />
          </View>
          <View style={styles.greyArea} />
        </View>
      </View>

      {/* Exposure Display - Below Viewfinder */}
      {renderPortraitExposureDisplay()}

      {/* Bracket Slider */}
      {renderPortraitBracketSlider()}
    </View>
  );
}

const styles = StyleSheet.create({
  // ============ SHARED STYLES ============
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  viewfinder: {
    borderWidth: 3,
    borderColor: AMBER,
  },

  // ============ PORTRAIT STYLES ============
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
    paddingHorizontal: 4,
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
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerValueSmall: {
    color: AMBER,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  orientationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
  },
  greyArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  middleSection: {
    flexDirection: 'row',
  },
  exposureContainer: {
    backgroundColor: AMBER,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  exposureLabel: {
    color: DARK_BG,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  exposureValue: {
    color: DARK_BG,
    fontSize: 36,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  exposureCondition: {
    color: DARK_BG,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.85,
  },
  bracketContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: CHARCOAL,
    borderTopWidth: 1,
    borderTopColor: TEXT_MUTED,
  },
  bracketLabel: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 44,
  },
  bracketMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  bracketMark: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '500',
  },
  bracketMarkActive: {
    color: AMBER,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: AMBER,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 24,
    marginBottom: 32,
    minWidth: 200,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: DARK_BG,
    fontSize: 17,
    fontWeight: '700',
  },

  // ============ LANDSCAPE STYLES ============
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DARK_BG,
  },
  landscapeViewfinderArea: {
    flex: 1,
    position: 'relative',
    borderRightWidth: 2,
    borderRightColor: AMBER,
  },
  landscapeCamera: {
    flex: 1,
  },
  landscapeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  landscapeGreyTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  landscapeMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landscapeGreySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  landscapeGreyBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  landscapeInfoPanel: {
    width: '38%',
    backgroundColor: CHARCOAL,
  },
  landscapeScrollView: {
    flex: 1,
  },
  landscapeScrollContent: {
    padding: 16,
    paddingTop: 12,
  },
  landscapeInfoSection: {
    marginBottom: 20,
  },
  landscapeSectionTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  landscapeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.3)',
    minHeight: 44,
  },
  landscapeInfoLabel: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '500',
  },
  landscapeInfoValue: {
    color: AMBER,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  landscapeInfoValueLarge: {
    color: AMBER,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  landscapeOrientationValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  landscapeExposureSection: {
    marginBottom: 20,
  },
  landscapeExposureBox: {
    backgroundColor: AMBER,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  landscapeExposureValue: {
    color: DARK_BG,
    fontSize: 32,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  landscapeExposureCondition: {
    color: DARK_BG,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  landscapeExposureDetails: {
    color: DARK_BG,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.8,
  },
  landscapeBracketSection: {
    marginBottom: 16,
  },
  landscapeBracketValue: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  landscapeSlider: {
    width: '100%',
    height: 44,
  },
  landscapeBracketMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  landscapeBracketMark: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  permissionContainerLandscape: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
  },
  permissionTitleLandscape: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
  },
  permissionButtonLandscape: {
    backgroundColor: AMBER,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
