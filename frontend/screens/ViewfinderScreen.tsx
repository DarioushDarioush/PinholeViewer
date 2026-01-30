import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
  AccessibilityInfo,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings, LIGHTING_CONDITIONS, FilmOrientation } from '../types';

// WCAG AA compliant colors - minimum 4.5:1 contrast ratio
const AMBER = '#F59E0B';
const AMBER_DARK = '#D97706'; // For better contrast on light backgrounds
const DARK_BG = '#0a0a0a';
const CHARCOAL = '#1a1a1a';
const TEXT_PRIMARY = '#FFFFFF'; // 21:1 contrast on dark
const TEXT_SECONDARY = '#B3B3B3'; // 7:1 contrast on dark
const TEXT_MUTED = '#808080'; // 4.5:1 contrast on dark

interface Props {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
}

export default function ViewfinderScreen({ settings, updateSettings }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Calculate f-stop
  const calculateFStop = () => {
    return (settings.focalLength / settings.pinholeSize).toFixed(1);
  };

  // Get effective dimensions based on orientation
  const getEffectiveDimensions = () => {
    const { width, height } = settings.filmFormat;
    const orientation = settings.filmOrientation || 'landscape';
    
    if (orientation === 'portrait') {
      return { width: height, height: width };
    }
    return { width, height };
  };

  // Calculate viewfinder size with orientation support
  const calculateViewfinderSize = () => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    const isScreenLandscape = screenWidth > screenHeight;
    
    const effectiveDims = getEffectiveDimensions();
    const filmAspectRatio = effectiveDims.width / effectiveDims.height;
    
    let viewfinderWidth: number;
    let viewfinderHeight: number;
    
    if (isScreenLandscape) {
      const availableHeight = screenHeight - 200;
      viewfinderHeight = availableHeight * 0.85;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
      
      if (viewfinderWidth > screenWidth * 0.85) {
        viewfinderWidth = screenWidth * 0.85;
        viewfinderHeight = viewfinderWidth / filmAspectRatio;
      }
    } else {
      const availableWidth = screenWidth - 48;
      const availableHeight = screenHeight * 0.55;
      
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

  // Calculate exposure with bracketing
  const calculateExposure = () => {
    if (!settings.selectedCondition) return null;
    
    const condition = LIGHTING_CONDITIONS.find(c => c.name === settings.selectedCondition);
    if (!condition) return null;
    
    const actualFStop = parseFloat(calculateFStop());
    const referenceFStop = condition.fStop;
    
    const baseExposure = 1 / settings.iso;
    let exposureTime = baseExposure * Math.pow(actualFStop / referenceFStop, 2);
    
    // Apply reciprocity failure if enabled
    if (settings.useReciprocityFailure && exposureTime > 1) {
      exposureTime = Math.pow(exposureTime, 1.3);
    }
    
    // Apply red filter
    if (settings.useRedFilter) {
      exposureTime *= 8;
    }
    
    // Apply bracketing
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

  // Calculate exposure before permission checks
  const calculatedExposure = calculateExposure();
  const effectiveDims = getEffectiveDimensions();
  const orientationLabel = settings.filmOrientation === 'portrait' ? 'Portrait' : 'Landscape';

  // Render header bar (reusable)
  const renderHeaderBar = () => (
    <View 
      style={styles.headerBar}
      accessible={true}
      accessibilityRole="toolbar"
      accessibilityLabel="Camera settings summary"
    >
      <View style={styles.headerItem}>
        <Text style={styles.headerLabel} accessibilityRole="text">FORMAT</Text>
        <Text style={styles.headerValue} accessibilityLabel={`Film format: ${settings.filmFormat.name}`}>
          {settings.filmFormat.name}
        </Text>
      </View>
      <TouchableOpacity 
        style={styles.headerItem}
        onPress={toggleOrientation}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Orientation: ${orientationLabel}. Tap to toggle`}
        accessibilityHint="Switches between landscape and portrait orientation"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.headerLabel}>ORIENTATION</Text>
        <View style={styles.orientationRow}>
          <Ionicons 
            name={settings.filmOrientation === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'} 
            size={16} 
            color={AMBER} 
          />
          <Text style={styles.headerValueSmall}>{orientationLabel}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.headerItem}>
        <Text style={styles.headerLabel} accessibilityRole="text">F-STOP</Text>
        <Text style={styles.headerValue} accessibilityLabel={`F-stop: f/${calculateFStop()}`}>
          f/{calculateFStop()}
        </Text>
      </View>
      <View style={styles.headerItem}>
        <Text style={styles.headerLabel} accessibilityRole="text">ISO</Text>
        <Text style={styles.headerValue} accessibilityLabel={`ISO: ${settings.iso}`}>
          {settings.iso}
        </Text>
      </View>
    </View>
  );

  // Render exposure display (reusable)
  const renderExposureDisplay = () => {
    if (!calculatedExposure) return null;
    
    return (
      <View 
        style={styles.exposureContainer}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={`Calculated exposure: ${calculatedExposure}. Lighting condition: ${settings.selectedCondition}${settings.bracketStops !== 0 ? `. Bracket: ${settings.bracketStops > 0 ? 'plus' : 'minus'} ${Math.abs(settings.bracketStops)} stops` : ''}`}
      >
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

  // Render bracket slider
  const renderBracketSlider = () => {
    if (!calculatedExposure) return null;
    
    return (
      <View 
        style={styles.bracketContainer}
        accessible={true}
        accessibilityRole="adjustable"
        accessibilityLabel={`Exposure bracket: ${settings.bracketStops > 0 ? 'plus' : ''}${settings.bracketStops} stops`}
        accessibilityHint="Swipe up or down to adjust bracket stops"
      >
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
          accessibilityLabel="Bracket stops slider"
        />
        <View style={styles.bracketMarks} accessibilityElementsHidden={true}>
          {[-3, -2, -1, 0, 1, 2, 3].map((mark) => (
            <Text 
              key={mark} 
              style={[
                styles.bracketMark,
                settings.bracketStops === mark && styles.bracketMarkActive
              ]}
            >
              {mark > 0 ? `+${mark}` : mark}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {renderHeaderBar()}
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={TEXT_MUTED} />
          <Text 
            style={styles.permissionTitle}
            accessibilityRole="header"
          >
            Camera Access Required
          </Text>
          <Text style={styles.permissionText}>
            Grant camera permission to use the viewfinder
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Enable camera access"
          >
            <Text style={styles.permissionButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          {renderExposureDisplay()}
        </View>
        {renderBracketSlider()}
      </View>
    );
  }

  const viewfinderSize = calculateViewfinderSize();

  return (
    <View style={styles.container}>
      {renderHeaderBar()}

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
              accessibilityLabel={`Viewfinder showing ${settings.filmFormat.name} format in ${orientationLabel} orientation. Aspect ratio ${effectiveDims.width}:${effectiveDims.height}`}
            />
            <View style={styles.greyArea} />
          </View>
          <View style={styles.greyArea} />
        </View>
      </View>

      {/* Exposure Display - Below Viewfinder */}
      {renderExposureDisplay()}

      {/* Bracket Slider */}
      {renderBracketSlider()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
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
  viewfinder: {
    borderWidth: 3,
    borderColor: AMBER,
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
    height: 44, // WCAG minimum touch target
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
    minHeight: 48, // WCAG minimum touch target
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionButtonText: {
    color: DARK_BG,
    fontSize: 17,
    fontWeight: '700',
  },
});
