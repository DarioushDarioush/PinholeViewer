import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_MUTED = '#808080';

// Film formats for viewfinder calculations
const FILM_FORMATS = [
  { name: '35mm', width: 36, height: 24 },
  { name: '6x4.5', width: 60, height: 45 },
  { name: '6x6', width: 60, height: 60 },
  { name: '6x7', width: 60, height: 70 },
  { name: '6x9', width: 60, height: 90 },
  { name: '6x12', width: 60, height: 120 },
  { name: '6x17', width: 60, height: 170 },
];

// Context to share camera-related data with child screens
interface CameraContextType {
  isLandscape: boolean;
  cameraPermission: { granted: boolean } | null;
  requestCameraPermission: () => Promise<void>;
}

const CameraContext = createContext<CameraContextType>({
  isLandscape: false,
  cameraPermission: null,
  requestCameraPermission: async () => {},
});

export const useCameraContext = () => useContext(CameraContext);

export default function Layout() {
  const [permission, requestPermission] = useCameraPermissions();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [filmFormat, setFilmFormat] = useState(FILM_FORMATS[2]);
  const [filmOrientation, setFilmOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const cameraRef = useRef<any>(null);
  const pathname = usePathname();

  const isLandscape = dimensions.width > dimensions.height;
  const isViewfinderTab = pathname === '/' || pathname === '/index';

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      // No camera key change needed - camera stays mounted
    });
    return () => subscription?.remove();
  }, []);

  // Load settings to get film format for viewfinder overlay
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem('app_settings');
        if (stored) {
          const settings = JSON.parse(stored);
          if (settings.filmFormat) {
            setFilmFormat(settings.filmFormat);
          }
          if (settings.filmOrientation) {
            setFilmOrientation(settings.filmOrientation);
          }
        }
      } catch (error) {
        console.error('Error loading settings in layout:', error);
      }
    };
    loadSettings();

    // Listen for settings changes
    const interval = setInterval(loadSettings, 1000);
    return () => clearInterval(interval);
  }, []);

  const getEffectiveDimensions = () => {
    const { width, height } = filmFormat;
    if (filmOrientation === 'portrait') {
      return { width: height, height: width };
    }
    return { width, height };
  };

  const calculateViewfinderSize = (forLandscape: boolean) => {
    const effectiveDims = getEffectiveDimensions();
    const filmAspectRatio = effectiveDims.width / effectiveDims.height;
    
    let availableWidth: number;
    let availableHeight: number;
    
    if (forLandscape) {
      // In landscape layout, camera takes ~62% of screen width
      availableWidth = dimensions.width * 0.60;
      availableHeight = dimensions.height - 60;
    } else {
      // In portrait, camera is the main area
      availableWidth = dimensions.width - 32;
      availableHeight = dimensions.height * 0.50;
    }
    
    let viewfinderWidth = availableWidth * 0.85;
    let viewfinderHeight = viewfinderWidth / filmAspectRatio;
    
    if (viewfinderHeight > availableHeight * 0.85) {
      viewfinderHeight = availableHeight * 0.85;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
    }
    
    return { width: viewfinderWidth, height: viewfinderHeight };
  };

  // Permission request screen
  const renderPermissionRequest = () => (
    <View style={styles.permissionContainer}>
      <Ionicons name="camera-outline" size={isLandscape ? 48 : 64} color={TEXT_MUTED} />
      <Text style={[styles.permissionTitle, isLandscape && styles.permissionTitleLandscape]}>
        Camera Access Required
      </Text>
      {!isLandscape && (
        <Text style={styles.permissionText}>Grant camera permission to use the viewfinder</Text>
      )}
      <TouchableOpacity
        style={[styles.permissionButton, isLandscape && styles.permissionButtonLandscape]}
        onPress={requestPermission}
      >
        <Text style={styles.permissionButtonText}>Enable Camera</Text>
      </TouchableOpacity>
    </View>
  );

  // Single persistent camera - ALWAYS mounted, never re-keyed
  const renderCamera = () => {
    const viewfinderSize = calculateViewfinderSize(isLandscape);

    if (!permission?.granted) {
      return renderPermissionRequest();
    }

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
        />
        {/* Dark overlay with transparent center for viewfinder */}
        <View style={styles.overlayContainer} pointerEvents="none">
          <View style={styles.overlayDark} />
          <View style={styles.overlayMiddleRow}>
            <View style={styles.overlayDark} />
            <View style={[styles.viewfinderCutout, { width: viewfinderSize.width, height: viewfinderSize.height }]}>
              <View style={styles.viewfinderBorder} />
            </View>
            <View style={styles.overlayDark} />
          </View>
          <View style={styles.overlayDark} />
        </View>
      </View>
    );
  };

  const tabsComponent = (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopColor: AMBER,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: '#666',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Viewfinder',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exposure"
        options={{
          title: 'Exposure',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sunny-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );

  const cameraContextValue: CameraContextType = {
    isLandscape,
    cameraPermission: permission,
    requestCameraPermission: requestPermission,
  };

  // LANDSCAPE MODE: Camera LEFT, Tabs RIGHT
  if (isLandscape) {
    return (
      <CameraContext.Provider value={cameraContextValue}>
        <StatusBar style="light" />
        <View style={styles.landscapeContainer}>
          {/* LEFT: Persistent Live Camera - ALWAYS MOUNTED */}
          <View style={styles.landscapeLeftPanel}>
            {renderCamera()}
          </View>
          {/* RIGHT: Tab Content */}
          <View style={styles.landscapeRightPanel}>
            {tabsComponent}
          </View>
        </View>
      </CameraContext.Provider>
    );
  }

  // PORTRAIT MODE: Standard tabs - ViewfinderScreen will render its own camera
  return (
    <CameraContext.Provider value={cameraContextValue}>
      <StatusBar style="light" />
      {tabsComponent}
    </CameraContext.Provider>
  );
}

const styles = StyleSheet.create({
  // Landscape mode styles
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DARK_BG,
  },
  landscapeLeftPanel: {
    flex: 1,
    backgroundColor: '#000',
  },
  landscapeRightPanel: {
    width: '38%',
    borderLeftWidth: 2,
    borderLeftColor: AMBER,
  },
  
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewfinderCutout: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: AMBER,
  },
  
  // Permission styles
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
    color: TEXT_MUTED,
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
});
