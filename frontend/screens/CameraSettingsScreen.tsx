import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings, FILM_FORMATS, ISO_VALUES, FilmOrientation } from '../types';

// WCAG AA compliant colors
const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';
const CHARCOAL = '#1a1a1a';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#B3B3B3';
const TEXT_MUTED = '#808080';

interface Profile {
  id: string;
  name: string;
  focalLength: number;
  pinholeSize: number;
  filmFormat: typeof FILM_FORMATS[0];
  filmOrientation: FilmOrientation;
  iso: number;
}

interface Props {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
}

export default function CameraSettingsScreen({ settings, updateSettings }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [showProfiles, setShowProfiles] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  const isLandscape = dimensions.width > dimensions.height;

  useEffect(() => {
    loadProfiles();
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const loadProfiles = async () => {
    try {
      const stored = await AsyncStorage.getItem('camera_profiles');
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
      focalLength: settings.focalLength,
      pinholeSize: settings.pinholeSize,
      filmFormat: settings.filmFormat,
      filmOrientation: settings.filmOrientation || 'landscape',
      iso: settings.iso,
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);
    await AsyncStorage.setItem('camera_profiles', JSON.stringify(updatedProfiles));
    setProfileName('');
    Alert.alert('Success', 'Profile saved!');
  };

  const loadProfile = (profile: Profile) => {
    updateSettings({
      ...settings,
      focalLength: profile.focalLength,
      pinholeSize: profile.pinholeSize,
      filmFormat: profile.filmFormat,
      filmOrientation: profile.filmOrientation || 'landscape',
      iso: profile.iso,
    });
    setShowProfiles(false);
    Alert.alert('Success', 'Profile loaded!');
  };

  const deleteProfile = async (id: string) => {
    const updatedProfiles = profiles.filter((p) => p.id !== id);
    setProfiles(updatedProfiles);
    await AsyncStorage.setItem('camera_profiles', JSON.stringify(updatedProfiles));
  };

  const calculateFStop = () => {
    return (settings.focalLength / settings.pinholeSize).toFixed(1);
  };

  const calculateOptimalPinhole = () => {
    const wavelength = 0.00055;
    return Math.sqrt(1.9 * wavelength * settings.focalLength).toFixed(2);
  };

  // ========== Settings Content ==========
  const renderSettingsContent = () => (
    <>
      <Text style={[styles.title, isLandscape && styles.titleLandscape]}>Camera Settings</Text>

      {/* Focal Length */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Focal Length (mm)</Text>
        <TextInput
          style={[styles.input, isLandscape && styles.inputLandscape]}
          value={settings.focalLength.toString()}
          onChangeText={(text) => updateSettings({ ...settings, focalLength: parseFloat(text) || 0 })}
          keyboardType="numeric"
          placeholderTextColor="#666"
        />
      </View>

      {/* Pinhole Size */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Pinhole Diameter (mm)</Text>
        <TextInput
          style={[styles.input, isLandscape && styles.inputLandscape]}
          value={settings.pinholeSize.toString()}
          onChangeText={(text) => updateSettings({ ...settings, pinholeSize: parseFloat(text) || 0 })}
          keyboardType="numeric"
          placeholderTextColor="#666"
        />
        <Text style={styles.hint}>Optimal: {calculateOptimalPinhole()}mm</Text>
      </View>

      {/* F-Stop Display */}
      <View style={[styles.fStopDisplay, isLandscape && styles.fStopDisplayLandscape]}>
        <Text style={styles.fStopLabel}>F-Stop:</Text>
        <Text style={[styles.fStopValue, isLandscape && styles.fStopValueLandscape]}>f/{calculateFStop()}</Text>
      </View>

      {/* Film Format */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Film Format</Text>
        <View style={[styles.formatGrid, isLandscape && styles.formatGridLandscape]}>
          {FILM_FORMATS.map((format) => (
            <TouchableOpacity
              key={format.name}
              style={[
                styles.formatButton,
                isLandscape && styles.formatButtonLandscape,
                settings.filmFormat.name === format.name && styles.formatButtonActive,
              ]}
              onPress={() => updateSettings({ ...settings, filmFormat: format })}
            >
              <Text style={[
                styles.formatButtonText,
                isLandscape && styles.formatButtonTextLandscape,
                settings.filmFormat.name === format.name && styles.formatButtonTextActive,
              ]}>
                {format.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Film Orientation */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Film Orientation</Text>
        <View style={[styles.orientationContainer, isLandscape && styles.orientationContainerLandscape]}>
          <TouchableOpacity
            style={[
              styles.orientationButton,
              isLandscape && styles.orientationButtonLandscape,
              settings.filmOrientation === 'landscape' && styles.orientationButtonActive,
            ]}
            onPress={() => updateSettings({ ...settings, filmOrientation: 'landscape' })}
          >
            <Ionicons name="phone-landscape-outline" size={isLandscape ? 18 : 24} 
              color={settings.filmOrientation === 'landscape' ? DARK_BG : TEXT_SECONDARY} />
            <Text style={[
              styles.orientationText,
              isLandscape && styles.orientationTextLandscape,
              settings.filmOrientation === 'landscape' && styles.orientationTextActive,
            ]}>Land</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.orientationButton,
              isLandscape && styles.orientationButtonLandscape,
              settings.filmOrientation === 'portrait' && styles.orientationButtonActive,
            ]}
            onPress={() => updateSettings({ ...settings, filmOrientation: 'portrait' })}
          >
            <Ionicons name="phone-portrait-outline" size={isLandscape ? 18 : 24}
              color={settings.filmOrientation === 'portrait' ? DARK_BG : TEXT_SECONDARY} />
            <Text style={[
              styles.orientationText,
              isLandscape && styles.orientationTextLandscape,
              settings.filmOrientation === 'portrait' && styles.orientationTextActive,
            ]}>Port</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ISO */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>ISO</Text>
        <View style={[styles.formatGrid, isLandscape && styles.formatGridLandscape]}>
          {ISO_VALUES.map((isoValue) => (
            <TouchableOpacity
              key={isoValue}
              style={[
                styles.formatButton,
                isLandscape && styles.formatButtonLandscape,
                settings.iso === isoValue && styles.formatButtonActive,
              ]}
              onPress={() => updateSettings({ ...settings, iso: isoValue })}
            >
              <Text style={[
                styles.formatButtonText,
                isLandscape && styles.formatButtonTextLandscape,
                settings.iso === isoValue && styles.formatButtonTextActive,
              ]}>
                {isoValue}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Profile Management */}
      <View style={[styles.profileSection, isLandscape && styles.profileSectionLandscape]}>
        <TouchableOpacity style={styles.profileToggleButton} onPress={() => setShowProfiles(!showProfiles)}>
          <Ionicons name={showProfiles ? 'chevron-up' : 'folder-outline'} size={18} color={AMBER} />
          <Text style={[styles.profileToggleText, isLandscape && styles.profileToggleTextLandscape]}>
            {isLandscape ? 'Profiles' : 'Camera Profiles'}
          </Text>
        </TouchableOpacity>

        {showProfiles && (
          <View style={styles.profileContent}>
            <View style={styles.saveProfileRow}>
              <TextInput
                style={[styles.input, styles.profileNameInput, isLandscape && styles.inputLandscape]}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Profile name"
                placeholderTextColor="#666"
              />
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                <Ionicons name="save" size={18} color={DARK_BG} />
              </TouchableOpacity>
            </View>

            {profiles.length === 0 ? (
              <Text style={styles.emptyText}>No saved profiles</Text>
            ) : (
              profiles.map((profile) => (
                <View key={profile.id} style={styles.profileCard}>
                  <TouchableOpacity style={styles.profileInfo} onPress={() => loadProfile(profile)}>
                    <Text style={styles.profileName}>{profile.name}</Text>
                    <Text style={styles.profileDetails}>
                      {profile.filmFormat.name} • {profile.focalLength}mm
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteProfile(profile.id)}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    </>
  );

  // ========== LANDSCAPE LAYOUT: Settings Panel only (camera is in parent _layout.tsx) ==========
  if (isLandscape) {
    return (
      <View style={styles.landscapeSettingsPanelOnly}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.landscapeScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderSettingsContent()}
        </ScrollView>
      </View>
    );
  }

  // ========== PORTRAIT LAYOUT ==========
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {renderSettingsContent()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: AMBER,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingGroup: {
    marginBottom: 18,
  },
  settingLabel: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  hint: {
    color: AMBER,
    fontSize: 11,
    marginTop: 4,
  },
  fStopDisplay: {
    backgroundColor: CHARCOAL,
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  fStopLabel: {
    color: '#999',
    fontSize: 14,
  },
  fStopValue: {
    color: AMBER,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  formatButton: {
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
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
  orientationContainer: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 10,
  },
  orientationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    gap: 8,
  },
  orientationButtonActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  orientationText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
  },
  orientationTextActive: {
    color: DARK_BG,
    fontWeight: '700',
  },
  profileSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  profileToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileToggleText: {
    color: AMBER,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  profileContent: {
    marginTop: 10,
  },
  saveProfileRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  profileNameInput: {
    flex: 1,
    marginRight: 8,
  },
  saveButton: {
    backgroundColor: AMBER,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 44,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 12,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: CHARCOAL,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: AMBER,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  profileDetails: {
    color: '#999',
    fontSize: 12,
  },

  // LANDSCAPE Layout: Settings Panel Only (camera is in parent)
  landscapeSettingsPanelOnly: {
    flex: 1,
    backgroundColor: CHARCOAL,
  },
  landscapeScrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  titleLandscape: {
    fontSize: 18,
    marginBottom: 14,
  },
  inputLandscape: {
    padding: 10,
    fontSize: 14,
  },
  fStopDisplayLandscape: {
    padding: 10,
    marginBottom: 14,
  },
  fStopValueLandscape: {
    fontSize: 18,
  },
  formatGridLandscape: {
    gap: 4,
  },
  formatButtonLandscape: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    minHeight: 36,
  },
  formatButtonTextLandscape: {
    fontSize: 12,
  },
  orientationContainerLandscape: {
    gap: 6,
  },
  orientationButtonLandscape: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 40,
    gap: 6,
  },
  orientationTextLandscape: {
    fontSize: 12,
  },
  profileSectionLandscape: {
    marginTop: 14,
    paddingTop: 14,
  },
  profileToggleTextLandscape: {
    fontSize: 13,
    marginLeft: 8,
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
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DARK_BG,
    padding: 24,
  },
  permissionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: AMBER,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    minHeight: 44,
  },
  permissionButtonText: {
    color: DARK_BG,
    fontSize: 14,
    fontWeight: '700',
  },
});
