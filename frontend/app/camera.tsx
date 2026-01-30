import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CameraSettingsScreen from '../screens/CameraSettingsScreen';
import { AppSettings, FILM_FORMATS } from './_layout';

export default function Camera() {
  const [settings, setSettings] = useState<AppSettings>({
    focalLength: 50,
    pinholeSize: 0.3,
    filmFormat: FILM_FORMATS[2],
    iso: 100,
    selectedCondition: null,
    useRedFilter: false,
    useReciprocityFailure: true,
    bracketStops: 0,
  });

  useEffect(() => {
    loadSettings();
  }, []);

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

  return <CameraSettingsScreen settings={settings} updateSettings={saveSettings} />;
}
