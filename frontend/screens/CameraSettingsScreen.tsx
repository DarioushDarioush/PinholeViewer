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

  // Render the settings content (used in both layouts)
  const renderSettingsContent = () => (
    <>
      <Text style={[styles.title, isLandscape && styles.titleLandscape]}>Camera Settings</Text>

      {/* Focal Length */}
      <View style={styles.settingGroup}>
        <Text style={styles.settingLabel}>Focal Length (mm)</Text>
        <TextInput
          style={[styles.input, isLandscape && styles.inputLandscape]}
          value={settings.focalLength.toString()}
          onChangeText={(text) =>
            updateSettings({ ...settings, focalLength: parseFloat(text) || 0 })
          }
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
          onChangeText={(text) =>
            updateSettings({ ...settings, pinholeSize: parseFloat(text) || 0 })
          }
          keyboardType="numeric"
          placeholderTextColor="#666"
        />
        <Text style={styles.hint}>Optimal: {calculateOptimalPinhole()}mm</Text>
      </View>

      {/* F-Stop Display */}
      <View style={[styles.fStopDisplay, isLandscape && styles.fStopDisplayLandscape]}>
        <Text style={styles.fStopLabel}>F-Stop:</Text>
        <Text style={[styles.fStopValue, isLandscape && styles.fStopValueLandscape]}>
          f/{calculateFStop()}
        </Text>
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
              accessible={true}
              accessibilityRole="button"
              accessibilityState={{ selected: settings.filmFormat.name === format.name }}
            >
              <Text
                style={[
                  styles.formatButtonText,
                  isLandscape && styles.formatButtonTextLandscape,
                  settings.filmFormat.name === format.name && styles.formatButtonTextActive,
                ]}
              >
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
            <Ionicons 
              name="phone-landscape-outline" 
              size={isLandscape ? 20 : 28} 
              color={settings.filmOrientation === 'landscape' ? DARK_BG : TEXT_SECONDARY} 
            />
            <Text
              style={[
                styles.orientationText,
                isLandscape && styles.orientationTextLandscape,
                settings.filmOrientation === 'landscape' && styles.orientationTextActive,
              ]}
            >
              Landscape
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.orientationButton,
              isLandscape && styles.orientationButtonLandscape,
              settings.filmOrientation === 'portrait' && styles.orientationButtonActive,
            ]}
            onPress={() => updateSettings({ ...settings, filmOrientation: 'portrait' })}
          >
            <Ionicons 
              name="phone-portrait-outline" 
              size={isLandscape ? 20 : 28} 
              color={settings.filmOrientation === 'portrait' ? DARK_BG : TEXT_SECONDARY} 
            />
            <Text
              style={[
                styles.orientationText,
                isLandscape && styles.orientationTextLandscape,
                settings.filmOrientation === 'portrait' && styles.orientationTextActive,
              ]}
            >
              Portrait
            </Text>
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
              <Text
                style={[
                  styles.formatButtonText,
                  isLandscape && styles.formatButtonTextLandscape,
                  settings.iso === isoValue && styles.formatButtonTextActive,
                ]}
              >
                {isoValue}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Profile Management - Only show in portrait or if expanded in landscape */}
      {(!isLandscape || showProfiles) && (
        <View style={[styles.profileSection, isLandscape && styles.profileSectionLandscape]}>
          <TouchableOpacity
            style={styles.profileToggleButton}
            onPress={() => setShowProfiles(!showProfiles)}
          >
            <Ionicons
              name={showProfiles ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={AMBER}
            />
            <Text style={[styles.profileToggleText, isLandscape && styles.profileToggleTextLandscape]}>
              Camera Profiles
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
                <TouchableOpacity style={[styles.saveButton, isLandscape && styles.saveButtonLandscape]} onPress={saveProfile}>
                  <Ionicons name="save" size={20} color={DARK_BG} />
                </TouchableOpacity>
              </View>

              {profiles.length === 0 ? (
                <Text style={styles.emptyText}>No saved profiles</Text>
              ) : (
                profiles.map((profile) => (
                  <View key={profile.id} style={[styles.profileCard, isLandscape && styles.profileCardLandscape]}>
                    <TouchableOpacity
                      style={styles.profileInfo}
                      onPress={() => loadProfile(profile)}
                    >
                      <Text style={[styles.profileName, isLandscape && styles.profileNameLandscape]}>{profile.name}</Text>
                      <Text style={[styles.profileDetails, isLandscape && styles.profileDetailsLandscape]}>
                        {profile.filmFormat.name} • {profile.focalLength}mm • ISO {profile.iso}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteProfile(profile.id)}>
                      <Ionicons name="trash" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}

      {/* Collapsed profiles button in landscape */}
      {isLandscape && !showProfiles && (
        <TouchableOpacity
          style={styles.profileToggleButtonLandscape}
          onPress={() => setShowProfiles(true)}
        >
          <Ionicons name="folder-outline" size={16} color={AMBER} />
          <Text style={styles.profileToggleTextLandscape}>Profiles</Text>
        </TouchableOpacity>
      )}
    </>
  );

  // LANDSCAPE LAYOUT
  if (isLandscape) {
    return (
      <View style={styles.landscapeContainer}>
        {/* Left side - empty/branding area */}
        <View style={styles.landscapeLeftPanel}>
          <Ionicons name="camera-outline" size={48} color={TEXT_MUTED} />
          <Text style={styles.landscapeBrandText}>Pinhole</Text>
          <Text style={styles.landscapeBrandSubtext}>Camera Setup</Text>
        </View>

        {/* Right side - settings panel */}
        <View style={styles.landscapeRightPanel}>
          <ScrollView 
            style={styles.landscapeScrollView}
            contentContainerStyle={styles.landscapeScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {renderSettingsContent()}
          </ScrollView>
        </View>
      </View>
    );
  }

  // PORTRAIT LAYOUT
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
  // SHARED / PORTRAIT STYLES
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
    marginBottom: 24,
  },
  settingGroup: {
    marginBottom: 20,
  },
  settingLabel: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 8,
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
    fontSize: 12,
    marginTop: 4,
  },
  fStopDisplay: {
    backgroundColor: CHARCOAL,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fStopLabel: {
    color: '#999',
    fontSize: 16,
  },
  fStopValue: {
    color: AMBER,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  formatButton: {
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    marginTop: 8,
    gap: 12,
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
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
    gap: 10,
  },
  orientationButtonActive: {
    backgroundColor: AMBER,
    borderColor: AMBER,
  },
  orientationText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '600',
  },
  orientationTextActive: {
    color: DARK_BG,
    fontWeight: '700',
  },
  profileSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  profileToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileToggleText: {
    color: AMBER,
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  profileContent: {
    marginTop: 12,
  },
  saveProfileRow: {
    flexDirection: 'row',
    marginBottom: 16,
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
    minWidth: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 16,
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: CHARCOAL,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
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

  // LANDSCAPE STYLES
  landscapeContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: DARK_BG,
  },
  landscapeLeftPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 2,
    borderRightColor: AMBER,
    paddingHorizontal: 20,
  },
  landscapeBrandText: {
    color: AMBER,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  landscapeBrandSubtext: {
    color: TEXT_MUTED,
    fontSize: 14,
    marginTop: 4,
  },
  landscapeRightPanel: {
    width: '42%',
    backgroundColor: CHARCOAL,
  },
  landscapeScrollView: {
    flex: 1,
  },
  landscapeScrollContent: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  titleLandscape: {
    fontSize: 20,
    marginBottom: 16,
  },
  inputLandscape: {
    padding: 10,
    fontSize: 14,
  },
  fStopDisplayLandscape: {
    padding: 12,
    marginBottom: 16,
  },
  fStopValueLandscape: {
    fontSize: 20,
  },
  formatGridLandscape: {
    marginTop: 6,
    gap: 6,
  },
  formatButtonLandscape: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
    minHeight: 36,
  },
  formatButtonTextLandscape: {
    fontSize: 12,
  },
  orientationContainerLandscape: {
    gap: 8,
  },
  orientationButtonLandscape: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 6,
  },
  orientationTextLandscape: {
    fontSize: 13,
  },
  profileSectionLandscape: {
    marginTop: 16,
    paddingTop: 16,
  },
  profileToggleTextLandscape: {
    fontSize: 14,
    marginLeft: 8,
  },
  profileToggleButtonLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  saveButtonLandscape: {
    padding: 10,
    minWidth: 40,
  },
  profileCardLandscape: {
    padding: 10,
    marginBottom: 8,
  },
  profileNameLandscape: {
    fontSize: 14,
    marginBottom: 2,
  },
  profileDetailsLandscape: {
    fontSize: 11,
  },
});
