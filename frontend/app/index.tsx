import React, { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import ViewfinderScreen from '../screens/ViewfinderScreen';
import { AppSettings, FILM_FORMATS } from '../types';

export default function Index() {
  const [settings, setSettings] = useState<AppSettings>({
    focalLength: 50,
    pinholeSize: 0.3,
    filmFormat: FILM_FORMATS[2],
    filmOrientation: 'landscape',
    iso: 100,
    selectedCondition: null,
    useRedFilter: false,
    selectedFilter: 'None',
    useReciprocityFailure: true,
    bracketStops: 0,
  });

  // Reload settings every time the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  // Also load on initial mount for web compatibility
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Ensure we're in browser environment
      if (typeof window === 'undefined') return;
      
      const stored = await AsyncStorage.getItem('app_settings');
      console.log('Loaded settings from storage:', stored);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(prev => ({
          ...prev,
          ...parsedSettings,
          // Ensure filmFormat is properly restored
          filmFormat: parsedSettings.filmFormat || prev.filmFormat,
          filmOrientation: parsedSettings.filmOrientation || 'landscape',
        }));
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

  return <ViewfinderScreen settings={settings} updateSettings={saveSettings} />;
}
