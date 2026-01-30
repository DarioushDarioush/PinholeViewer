import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';
import { AppSettings, LIGHTING_CONDITIONS } from '../types';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';

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

  // Calculate viewfinder size
  const calculateViewfinderSize = () => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    const isLandscape = screenWidth > screenHeight;
    
    const filmAspectRatio = settings.filmFormat.width / settings.filmFormat.height;
    
    let viewfinderWidth: number;
    let viewfinderHeight: number;
    
    if (isLandscape) {
      const availableHeight = screenHeight - 140;
      viewfinderHeight = availableHeight * 0.95;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
      
      if (viewfinderWidth > screenWidth * 0.9) {
        viewfinderWidth = screenWidth * 0.9;
        viewfinderHeight = viewfinderWidth / filmAspectRatio;
      }
    } else {
      const availableWidth = screenWidth - 32;
      const availableHeight = screenHeight * 0.70;
      
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

  // Calculate exposure before permission checks so it's available for display
  const calculatedExposure = calculateExposure();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {/* Info Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>Format</Text>
            <Text style={styles.headerValue}>{settings.filmFormat.name}</Text>
          </View>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>F-Stop</Text>
            <Text style={styles.headerValue}>f/{calculateFStop()}</Text>
          </View>
          <View style={styles.headerItem}>
            <Text style={styles.headerLabel}>ISO</Text>
            <Text style={styles.headerValue}>{settings.iso}</Text>
          </View>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission required</Text>
          {calculatedExposure && (
            <View style={styles.permissionExposure}>
              <Text style={styles.permissionExposureLabel}>Last Calculated Exposure</Text>
              <Text style={styles.permissionExposureValue}>{calculatedExposure}</Text>
              <Text style={styles.permissionExposureCondition}>{settings.selectedCondition}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  const viewfinderSize = calculateViewfinderSize();
  const calculatedExposure = calculateExposure();

  return (
    <View style={styles.container}>
      {/* Info Header Bar */}
      <View style={styles.headerBar}>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>Format</Text>
          <Text style={styles.headerValue}>{settings.filmFormat.name}</Text>
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>F-Stop</Text>
          <Text style={styles.headerValue}>f/{calculateFStop()}</Text>
        </View>
        <View style={styles.headerItem}>
          <Text style={styles.headerLabel}>ISO</Text>
          <Text style={styles.headerValue}>{settings.iso}</Text>
        </View>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
        />
        
        {/* Viewfinder Overlay */}
        <View style={styles.overlayContainer}>
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
            >
              {/* Exposure Display */}
              {calculatedExposure && (
                <View style={styles.exposureOverlay}>
                  <Text style={styles.exposureValue}>{calculatedExposure}</Text>
                  <Text style={styles.exposureLabel}>
                    {settings.selectedCondition}
                    {settings.bracketStops !== 0 && ` (${settings.bracketStops > 0 ? '+' : ''}${settings.bracketStops})`}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.greyArea} />
          </View>
          <View style={styles.greyArea} />
        </View>
      </View>

      {/* Bracket Slider */}
      {calculatedExposure && (
        <View style={styles.bracketContainer}>
          <Text style={styles.bracketLabel}>Bracket: {settings.bracketStops > 0 ? '+' : ''}{settings.bracketStops} stops</Text>
          <Slider
            style={styles.slider}
            minimumValue={-3}
            maximumValue={3}
            step={1}
            value={settings.bracketStops}
            onValueChange={handleBracketChange}
            minimumTrackTintColor={AMBER}
            maximumTrackTintColor="#333"
            thumbTintColor={AMBER}
          />
          <View style={styles.bracketMarks}>
            <Text style={styles.bracketMark}>-3</Text>
            <Text style={styles.bracketMark}>-2</Text>
            <Text style={styles.bracketMark}>-1</Text>
            <Text style={styles.bracketMark}>0</Text>
            <Text style={styles.bracketMark}>+1</Text>
            <Text style={styles.bracketMark}>+2</Text>
            <Text style={styles.bracketMark}>+3</Text>
          </View>
        </View>
      )}
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
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: AMBER,
  },
  headerItem: {
    alignItems: 'center',
  },
  headerLabel: {
    color: '#666',
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerValue: {
    color: AMBER,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    borderWidth: 2,
    borderColor: AMBER,
    position: 'relative',
    overflow: 'hidden',
  },
  exposureOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: AMBER,
    alignItems: 'center',
  },
  exposureValue: {
    color: AMBER,
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  exposureLabel: {
    color: '#ccc',
    fontSize: 11,
    marginTop: 4,
  },
  bracketContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  bracketLabel: {
    color: AMBER,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  bracketMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  bracketMark: {
    color: '#666',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
  },
  permissionText: {
    color: '#999',
    fontSize: 16,
  },
});
