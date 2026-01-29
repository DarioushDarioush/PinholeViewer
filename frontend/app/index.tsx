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
  const [isMetering, setIsMetering] = useState(false);
  const [exposureData, setExposureData] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState('');
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    loadProfiles();
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

  // Calculate optimal pinhole diameter
  const calculateOptimalPinhole = () => {
    const wavelength = 0.00055; // 550nm in mm
    return Math.sqrt(1.9 * wavelength * focalLength).toFixed(2);
  };

  // Calculate field of view dimensions for overlay
  const calculateViewfinderSize = () => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    // Calculate aspect ratio of film format
    const filmAspectRatio = filmFormat.width / filmFormat.height;
    
    // Calculate FOV angle
    const fovRadians = 2 * Math.atan(filmFormat.width / (2 * focalLength));
    const fovDegrees = (fovRadians * 180) / Math.PI;
    
    // Use 70% of screen as max viewfinder area
    let viewfinderWidth = screenWidth * 0.7;
    let viewfinderHeight = viewfinderWidth / filmAspectRatio;
    
    if (viewfinderHeight > screenHeight * 0.5) {
      viewfinderHeight = screenHeight * 0.5;
      viewfinderWidth = viewfinderHeight * filmAspectRatio;
    }
    
    return {
      width: viewfinderWidth,
      height: viewfinderHeight,
      fov: fovDegrees.toFixed(1),
    };
  };

  // Light metering and exposure calculation
  const performLightMeter = async () => {
    setIsMetering(true);
    
    // Simulate light metering (in real app, this would use camera sensor data)
    // For now, we'll use a placeholder calculation
    setTimeout(() => {
      const simulatedEV = 12; // Placeholder - in real app, read from camera
      const exposure = calculateExposure(simulatedEV);
      setExposureData(exposure);
      setIsMetering(false);
    }, 1000);
  };

  const calculateExposure = (ev: number) => {
    const fStop = parseFloat(calculateFStop());
    
    // Base exposure: t = (N^2) / (L * S)
    // Where N = f-number, L = luminance (from EV), S = ISO
    const luminance = Math.pow(2, ev);
    const baseExposure = (fStop * fStop) / (luminance * (iso / 100));
    
    // Apply reciprocity failure (Schwarzschild effect)
    // For most films: t_actual = t_base ^ p, where p ≈ 1.3 for long exposures
    let adjustedExposure = baseExposure;
    if (baseExposure > 1) {
      adjustedExposure = Math.pow(baseExposure, 1.3);
    }
    
    // Apply red filter compensation (typically +2 to +3 stops)
    if (useRedFilter) {
      adjustedExposure *= 8; // +3 stops
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
        return `${minutes}m ${secs}s`;
      }
    };
    
    // Calculate bracketing
    const bracketMinus2 = adjustedExposure / 4;
    const bracketMinus1 = adjustedExposure / 2;
    const bracketPlus1 = adjustedExposure * 2;
    const bracketPlus2 = adjustedExposure * 4;
    
    // Warnings
    const warnings = [];
    if (adjustedExposure > 300) {
      warnings.push('Very long exposure - expect significant reciprocity failure');
    }
    if (adjustedExposure < 0.01) {
      warnings.push('Very short exposure - may be difficult to achieve');
    }
    
    const optimalPinhole = calculateOptimalPinhole();
    const pinholeAdvice =
      Math.abs(pinholeSize - parseFloat(optimalPinhole)) > 0.1
        ? `Consider ${optimalPinhole}mm for optimal sharpness`
        : 'Pinhole size is near optimal';
    
    return {
      ev,
      baseExposure: formatExposure(baseExposure),
      suggestedExposure: formatExposure(adjustedExposure),
      bracketMinus2: formatExposure(bracketMinus2),
      bracketMinus1: formatExposure(bracketMinus1),
      bracketPlus1: formatExposure(bracketPlus1),
      bracketPlus2: formatExposure(bracketPlus2),
      warnings,
      optimalPinhole,
      pinholeAdvice,
    };
  };

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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          ref={cameraRef}
        />
        
        {/* Viewfinder Overlay - Positioned absolutely over camera */}
        <View style={styles.overlayContainer}>
          {/* Top grey area */}
          <View style={styles.greyArea} />
          
          {/* Middle section with viewfinder */}
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
          
          {/* Bottom grey area */}
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
            style={[styles.controlButton, styles.meterButton]}
            onPress={performLightMeter}
            disabled={isMetering}
          >
            <MaterialIcons
              name="light-mode"
              size={28}
              color={isMetering ? '#666' : AMBER}
            />
            <Text style={styles.controlButtonText}>
              {isMetering ? 'Metering...' : 'Meter'}
            </Text>
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

      {/* Exposure Data Display */}
      {exposureData && (
        <View style={styles.exposurePanel}>
          <View style={styles.exposureHeader}>
            <Text style={styles.exposureTitle}>EXPOSURE READING</Text>
            <TouchableOpacity onPress={() => setExposureData(null)}>
              <Ionicons name="close" size={24} color={AMBER} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.exposureMain}>
            <Text style={styles.exposureLabel}>Suggested Exposure:</Text>
            <Text style={styles.exposureValue}>{exposureData.suggestedExposure}</Text>
          </View>
          
          <View style={styles.exposureBracketing}>
            <Text style={styles.bracketTitle}>Bracketing:</Text>
            <View style={styles.bracketRow}>
              <Text style={styles.bracketLabel}>-2:</Text>
              <Text style={styles.bracketValue}>{exposureData.bracketMinus2}</Text>
            </View>
            <View style={styles.bracketRow}>
              <Text style={styles.bracketLabel}>-1:</Text>
              <Text style={styles.bracketValue}>{exposureData.bracketMinus1}</Text>
            </View>
            <View style={styles.bracketRow}>
              <Text style={styles.bracketLabel}>+1:</Text>
              <Text style={styles.bracketValue}>{exposureData.bracketPlus1}</Text>
            </View>
            <View style={styles.bracketRow}>
              <Text style={styles.bracketLabel}>+2:</Text>
              <Text style={styles.bracketValue}>{exposureData.bracketPlus2}</Text>
            </View>
          </View>
          
          <View style={styles.exposureAdvice}>
            <Text style={styles.adviceText}>{exposureData.pinholeAdvice}</Text>
          </View>
          
          {exposureData.warnings.length > 0 && (
            <View style={styles.warningsContainer}>
              {exposureData.warnings.map((warning: string, index: number) => (
                <Text key={index} style={styles.warningText}>
                  ⚠ {warning}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

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
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    alignItems: 'center',
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
});