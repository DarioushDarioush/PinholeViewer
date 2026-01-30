import React, { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import ExposureSettingsScreen from '../screens/ExposureSettingsScreen';
import { AppSettings, FILM_FORMATS } from '../types';

export default function Exposure() {
  const [settings, setSettings] = useState<AppSettings>({
    focalLength: 50,
    pinholeSize: 0.3,
    filmFormat: FILM_FORMATS[2],
    filmOrientation: 'landscape',
    iso: 100,
    selectedCondition: null,
    useRedFilter: false,
    useReciprocityFailure: true,
    bracketStops: 0,
  });

  // Reload settings every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('app_settings');
      if (stored) {
        setSettings({ ...settings, ...JSON.parse(stored) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return <ExposureSettingsScreen settings={settings} updateSettings={saveSettings} />;
}
