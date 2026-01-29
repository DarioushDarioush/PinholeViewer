import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';
const CHARCOAL = '#1a1a1a';

// Film formats in mm
const FILM_FORMATS = [
  { name: '35mm', width: 36, height: 24 },
  { name: '6x4.5', width: 60, height: 45 },
  { name: '6x6', width: 60, height: 60 },
  { name: '6x7', width: 60, height: 70 },
  { name: '6x9', width: 60, height: 90 },
  { name: '6x12', width: 60, height: 120 },
  { name: '6x17', width: 60, height: 170 },
];

const ISO_VALUES = [25, 50, 100, 200, 400, 800, 1600, 3200];

interface Profile {
  id: string;
  name: string;
  focalLength: number;
  pinholeSize: number;
  filmFormat: typeof FILM_FORMATS[0];
  iso: number;
  useRedFilter: boolean;
}

export default function Index() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focalLength, setFocalLength] = useState(50);
  const [pinholeSize, setPinholeSize] = useState(0.3);
  const [filmFormat, setFilmFormat] = useState(FILM_FORMATS[2]); // 6x6 default
  const [iso, setIso] = useState(100);
  const [useRedFilter, setUseRedFilter] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [showExposure, setShowExposure] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [calculatedExposure, setCalculatedExposure] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const cameraRef = useRef<any>(null);

  // Lighting conditions for Sunny 16 rule
  const lightingConditions = [
    { name: 'Snow/Sandy', fStop: 22, icon: '☀️❄️', description: 'Very bright, snow or beach' },
    { name: 'Clear/Sunny', fStop: 16, icon: '☀️', description: 'Bright sun with distinct shadows' },
    { name: 'Slightly Overcast', fStop: 11, icon: '🌤️', description: 'Hazy sun, soft shadows' },
    { name: 'Overcast', fStop: 8, icon: '☁️', description: 'Cloudy, no shadows' },
    { name: 'Heavy Overcast', fStop: 5.6, icon: '☁️☁️', description: 'Dark clouds' },
    { name: 'Open Shade/Sunset', fStop: 4, icon: '🌅', description: 'Shade or sunset/sunrise' },
  ];

  useEffect(() => {
    loadProfiles();
    
    // Listen for orientation changes
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const loadProfiles = async () => {
    try {
      const stored = await AsyncStorage.getItem('pinhole_profiles');
      if (stored) {
        setProfiles(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    }
  };

  const saveProfile = async () => {
    if (!profileName.trim()) {
      Alert.alert('Error', 'Please enter a profile name');
      return;
    }

    const newProfile: Profile = {
      id: Date.now().toString(),
      name: profileName,
      focalLength,
      pinholeSize,
      filmFormat,
      iso,
      useRedFilter,
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    await AsyncStorage.setItem('pinhole_profiles', JSON.stringify(updatedProfiles));
    setProfileName('');
    Alert.alert('Success', 'Profile saved!');
  };

  const loadProfile = (profile: Profile) => {
    setFocalLength(profile.focalLength);
    setPinholeSize(profile.pinholeSize);
    setFilmFormat(profile.filmFormat);
    setIso(profile.iso);
    setUseRedFilter(profile.useRedFilter);
    setShowProfiles(false);
  };

  const deleteProfile = async (id: string) => {
    const updatedProfiles = profiles.filter((p) => p.id !== id);
    setProfiles(updatedProfiles);
    await AsyncStorage.setItem('pinhole_profiles', JSON.stringify(updatedProfiles));
  };

  // Calculate f-stop
  const calculateFStop = () => {
    return (focalLength / pinholeSize).toFixed(1);
  };

  // Calculate exposure using Sunny 16 rule
  const calculateSunny16Exposure = (condition: typeof lightingConditions[0]) => {
    const actualFStop = parseFloat(calculateFStop());
    const referenceFStop = condition.fStop;
    
    // Sunny 16 rule: Base exposure at f/16 = 1/ISO
    const baseExposure = 1 / iso;
    
    // Adjust for actual f-stop vs reference f-stop
    // Exposure time = base × (actual_f_stop / reference_f_stop)²
    let exposureTime = baseExposure * Math.pow(actualFStop / referenceFStop, 2);
    
    // Apply red filter compensation if enabled (+3 stops = 8x exposure)
    if (useRedFilter) {
      exposureTime *= 8;
    }
    
    // Format exposure time
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
    
    return formatExposure(exposureTime);
  };

  const handleConditionSelect = (condition: typeof lightingConditions[0]) => {
    setSelectedCondition(condition.name);
    const exposure = calculateSunny16Exposure(condition);
    setCalculatedExposure(exposure);
  };

  // Calculate optimal pinhole diameter
  const calculateOptimalPinhole = () => {
    const wavelength = 0.00055; // 550nm in mm
    return Math.sqrt(1.9 * wavelength * focalLength).toFixed(2);
  };

  // Calculate field of view dimensions for overlay - orientation aware
  const calculateViewfinderSize = () => {
    const screenWidth = dimensions.width;
    const screenHeight = dimensions.height;
    const isLandscape = screenWidth > screenHeight;
    
    // Calculate aspect ratio of film format
    const filmAspectRatio = filmFormat.width / filmFormat.height;
    
    // Calculate FOV angle
    const fovRadians = 2 * Math.atan(filmFormat.width / (2 * focalLength));
    const fovDegrees = (fovRadians * 180) / Math.PI;
    
    // Maximize viewfinder size with proper padding
    let viewfinderWidth: number;
    let viewfinderHeight: number;
    
    if (isLandscape) {
      // Landscape: Use left 65% for camera, maximize viewfinder within that
      const cameraWidth = screenWidth * 0.65;
      const availableHeight = screenHeight - 40; // Padding from top/bottom
      
      viewfinderHeight = availableHeight * 0.95; // Use 95% of available height
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
      
      // If too wide, constrain by width
      if (viewfinderWidth > cameraWidth * 0.9) {
        viewfinderWidth = cameraWidth * 0.9;
        viewfinderHeight = viewfinderWidth / filmAspectRatio;
      }
    } else {
      // Portrait: Maximize width with padding, constrain by height for controls
      const availableWidth = screenWidth - 32; // 16px padding on each side
      const availableHeight = screenHeight * 0.65; // Leave room for top/bottom controls
      
      viewfinderWidth = availableWidth * 0.95; // Use 95% of available width
      viewfinderHeight = viewfinderWidth / filmAspectRatio;
      
      // If too tall, constrain by height
      if (viewfinderHeight > availableHeight) {
        viewfinderHeight = availableHeight;
        viewfinderWidth = viewfinderHeight * filmAspectRatio;
      }
    }
    
    return {
      width: viewfinderWidth,
      height: viewfinderHeight,
      fov: fovDegrees.toFixed(1),
      isLandscape,
    };
  };

  // Light metering functionality removed

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera permission required</Text>
        <Text style={styles.errorSubtext}>Please enable camera access</Text>
        <TouchableOpacity 
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const viewfinderSize = calculateViewfinderSize();
  const isLandscape = viewfinderSize.isLandscape;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {isLandscape ? (
        // Landscape Layout: Viewfinder Left, Info Right
        <View style={styles.landscapeContainer}>
          {/* Camera View on Left */}
          <View style={styles.landscapeCameraSection}>
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
                />
                <View style={styles.greyArea} />
              </View>
              <View style={styles.greyArea} />
            </View>
          </View>

          {/* Info Panel on Right */}
          <View style={styles.landscapeInfoPanel}>
            <ScrollView 
              style={styles.landscapeInfoScroll}
              contentContainerStyle={styles.landscapeInfoContent}
            >
              {/* Camera Info */}
              <View style={styles.landscapeInfoSection}>
                <Text style={styles.landscapeSectionTitle}>CAMERA INFO</Text>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>Format:</Text>
                  <Text style={styles.infoValue}>{filmFormat.name}</Text>
                </View>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>Focal Length:</Text>
                  <Text style={styles.infoValue}>{focalLength}mm</Text>
                </View>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>F-Stop:</Text>
                  <Text style={styles.infoValue}>f/{calculateFStop()}</Text>
                </View>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>ISO:</Text>
                  <Text style={styles.infoValue}>{iso}</Text>
                </View>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>Pinhole:</Text>
                  <Text style={styles.infoValue}>{pinholeSize}mm</Text>
                </View>
                <View style={styles.landscapeInfoRow}>
                  <Text style={styles.infoLabel}>FOV:</Text>
                  <Text style={styles.infoValue}>{viewfinderSize.fov}°</Text>
                </View>
                {useRedFilter && (
                  <View style={[styles.redFilterBadge, { marginTop: 8 }]}>
                    <Text style={styles.redFilterText}>RED FILTER</Text>
                  </View>
                )}
              </View>

              {/* Control Buttons */}
              <View style={styles.landscapeControlSection}>
                <TouchableOpacity
                  style={styles.landscapeButton}
                  onPress={() => setShowSettings(true)}
                >
                  <Ionicons name="settings-outline" size={24} color={AMBER} />
                  <Text style={styles.landscapeButtonText}>Settings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.landscapeButton}
                  onPress={() => setShowProfiles(true)}
                >
                  <MaterialIcons name="bookmark-outline" size={24} color={AMBER} />
                  <Text style={styles.landscapeButtonText}>Profiles</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        // Portrait Layout: Original
        <>
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
                />
                <View style={styles.greyArea} />
              </View>
              <View style={styles.greyArea} />
            </View>
          </View>

          {/* Top Info Bar */}
          <View style={styles.topBar}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Format: </Text>
              <Text style={styles.infoValue}>{filmFormat.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Focal: </Text>
              <Text style={styles.infoValue}>{focalLength}mm</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>f/</Text>
              <Text style={styles.infoValue}>{calculateFStop()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ISO: </Text>
              <Text style={styles.infoValue}>{iso}</Text>
            </View>
          </View>

          {/* Bottom Control Bar */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomInfo}>
              <Text style={styles.bottomLabel}>Pinhole: {pinholeSize}mm</Text>
              <Text style={styles.bottomLabel}>FOV: {viewfinderSize.fov}°</Text>
              {useRedFilter && (
                <View style={styles.redFilterBadge}>
                  <Text style={styles.redFilterText}>RED FILTER</Text>
                </View>
              )}
            </View>

            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setShowSettings(true)}
              >
                <Ionicons name="settings-outline" size={24} color={AMBER} />
                <Text style={styles.controlButtonText}>Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setShowProfiles(true)}
              >
                <MaterialIcons name="bookmark-outline" size={24} color={AMBER} />
                <Text style={styles.controlButtonText}>Profiles</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* Exposure data display removed */}

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Camera Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={28} color={AMBER} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Focal Length */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Focal Length (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={focalLength.toString()}
                  onChangeText={(text) => setFocalLength(parseFloat(text) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
              </View>

              {/* Pinhole Size */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Pinhole Diameter (mm)</Text>
                <TextInput
                  style={styles.input}
                  value={pinholeSize.toString()}
                  onChangeText={(text) => setPinholeSize(parseFloat(text) || 0)}
                  keyboardType="numeric"
                  placeholderTextColor="#666"
                />
                <Text style={styles.hint}>
                  Optimal: {calculateOptimalPinhole()}mm
                </Text>
              </View>

              {/* Film Format */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Film Format</Text>
                <View style={styles.formatGrid}>
                  {FILM_FORMATS.map((format) => (
                    <TouchableOpacity
                      key={format.name}
                      style={[
                        styles.formatButton,
                        filmFormat.name === format.name && styles.formatButtonActive,
                      ]}
                      onPress={() => setFilmFormat(format)}
                    >
                      <Text
                        style={[
                          styles.formatButtonText,
                          filmFormat.name === format.name &&
                            styles.formatButtonTextActive,
                        ]}
                      >
                        {format.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ISO */}
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>ISO</Text>
                <View style={styles.formatGrid}>
                  {ISO_VALUES.map((isoValue) => (
                    <TouchableOpacity
                      key={isoValue}
                      style={[
                        styles.formatButton,
                        iso === isoValue && styles.formatButtonActive,
                      ]}
                      onPress={() => setIso(isoValue)}
                    >
                      <Text
                        style={[
                          styles.formatButtonText,
                          iso === isoValue && styles.formatButtonTextActive,
                        ]}
                      >
                        {isoValue}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Red Filter */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setUseRedFilter(!useRedFilter)}
              >
                <View style={styles.checkbox}>
                  {useRedFilter && (
                    <Ionicons name="checkmark" size={18} color={AMBER} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Red Filter (+3 stops)</Text>
              </TouchableOpacity>

              {/* Light meter calibration removed */}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Profiles Modal */}
      <Modal
        visible={showProfiles}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProfiles(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Profiles</Text>
              <TouchableOpacity onPress={() => setShowProfiles(false)}>
                <Ionicons name="close" size={28} color={AMBER} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Save Current Profile */}
              <View style={styles.saveProfileSection}>
                <Text style={styles.settingLabel}>Save Current Settings</Text>
                <View style={styles.saveProfileRow}>
                  <TextInput
                    style={[styles.input, styles.profileNameInput]}
                    value={profileName}
                    onChangeText={setProfileName}
                    placeholder="Profile name"
                    placeholderTextColor="#666"
                  />
                  <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                    <Ionicons name="save" size={24} color={DARK_BG} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Profile List */}
              <View style={styles.profileList}>
                {profiles.length === 0 ? (
                  <Text style={styles.emptyText}>No saved profiles</Text>
                ) : (
                  profiles.map((profile) => (
                    <View key={profile.id} style={styles.profileCard}>
                      <TouchableOpacity
                        style={styles.profileInfo}
                        onPress={() => loadProfile(profile)}
                      >
                        <Text style={styles.profileName}>{profile.name}</Text>
                        <Text style={styles.profileDetails}>
                          {profile.filmFormat.name} • {profile.focalLength}mm •
                          f/{(profile.focalLength / profile.pinholeSize).toFixed(1)} •
                          ISO {profile.iso}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteProfile(profile.id)}
                        style={styles.deleteButton}
                      >
                        <MaterialIcons name="delete" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Light meter calibration modal removed */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
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
    borderStyle: 'solid',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  topBarLandscape: {
    top: 20,
    flexDirection: 'row',
    paddingVertical: 8,
  },
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  landscapeCameraSection: {
    flex: 2,
    position: 'relative',
  },
  landscapeInfoPanel: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderLeftWidth: 2,
    borderLeftColor: AMBER,
    marginRight: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  landscapeInfoScroll: {
    flex: 1,
  },
  landscapeInfoContent: {
    padding: 24,
    paddingTop: 32,
  },
  landscapeInfoSection: {
    marginBottom: 30,
  },
  landscapeSectionTitle: {
    color: AMBER,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 16,
  },
  landscapeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
  },
  landscapeControlSection: {
    marginTop: 20,
    gap: 16,
  },
  landscapeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHARCOAL,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: AMBER,
  },
  landscapeButtonText: {
    color: AMBER,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    color: '#999',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoValue: {
    color: AMBER,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  bottomBarLandscape: {
    paddingBottom: 16,
    paddingTop: 12,
  },
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    alignItems: 'center',
  },
  bottomInfoLandscape: {
    marginBottom: 8,
  },
  bottomLabel: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  redFilterBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  redFilterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  controlButtonsLandscape: {
    justifyContent: 'center',
    gap: 40,
  },
  controlButton: {
    alignItems: 'center',
    padding: 8,
  },
  meterButton: {
    backgroundColor: CHARCOAL,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  controlButtonText: {
    color: AMBER,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  exposurePanel: {
    position: 'absolute',
    bottom: 180,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: AMBER,
  },
  exposureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exposureTitle: {
    color: AMBER,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  exposureMain: {
    marginBottom: 12,
  },
  exposureLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
  },
  exposureValue: {
    color: AMBER,
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  exposureBracketing: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 12,
  },
  bracketTitle: {
    color: '#999',
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  bracketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bracketLabel: {
    color: '#999',
    fontSize: 13,
  },
  bracketValue: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  exposureAdvice: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  adviceText: {
    color: AMBER,
    fontSize: 12,
  },
  warningsContainer: {
    marginTop: 4,
  },
  warningText: {
    color: '#fbbf24',
    fontSize: 11,
    marginBottom: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CHARCOAL,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: AMBER,
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalScroll: {
    padding: 20,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  hint: {
    color: AMBER,
    fontSize: 12,
    marginTop: 4,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  formatButton: {
    backgroundColor: DARK_BG,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  formatButtonActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  formatButtonText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  formatButtonTextActive: {
    color: DARK_BG,
    fontWeight: 'bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: AMBER,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    color: '#ccc',
    fontSize: 16,
  },
  saveProfileSection: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  saveProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileNameInput: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: AMBER,
    padding: 12,
    borderRadius: 8,
  },
  profileList: {
    marginTop: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 20,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: DARK_BG,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: AMBER,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileDetails: {
    color: '#999',
    fontSize: 13,
  },
  deleteButton: {
    padding: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  errorSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  permissionButton: {
    backgroundColor: AMBER,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  permissionButtonText: {
    color: DARK_BG,
    fontSize: 16,
    fontWeight: 'bold',
  },
});