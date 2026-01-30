import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';

// Film formats in mm
export const FILM_FORMATS = [
  { name: '35mm', width: 36, height: 24 },
  { name: '6x4.5', width: 60, height: 45 },
  { name: '6x6', width: 60, height: 60 },
  { name: '6x7', width: 60, height: 70 },
  { name: '6x9', width: 60, height: 90 },
  { name: '6x12', width: 60, height: 120 },
  { name: '6x17', width: 60, height: 170 },
];

export const ISO_VALUES = [25, 50, 100, 200, 400, 800, 1600, 3200];

// Lighting conditions for Sunny 16 rule
export const LIGHTING_CONDITIONS = [
  { name: 'Snow/Sandy', fStop: 22, icon: '☀️❄️', description: 'Very bright, snow or beach' },
  { name: 'Clear/Sunny', fStop: 16, icon: '☀️', description: 'Bright sun with distinct shadows' },
  { name: 'Slightly Overcast', fStop: 11, icon: '🌤️', description: 'Hazy sun, soft shadows' },
  { name: 'Overcast', fStop: 8, icon: '☁️', description: 'Cloudy, no shadows' },
  { name: 'Heavy Overcast', fStop: 5.6, icon: '☁️☁️', description: 'Dark clouds' },
  { name: 'Open Shade/Sunset', fStop: 4, icon: '🌅', description: 'Shade or sunset/sunrise' },
];

export interface AppSettings {
  focalLength: number;
  pinholeSize: number;
  filmFormat: typeof FILM_FORMATS[0];
  iso: number;
  selectedCondition: string | null;
  useRedFilter: boolean;
  useReciprocityFailure: boolean;
  bracketStops: number;
}

export default function Layout() {
  return (
    <>
      <StatusBar style="light" />
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
    </>
  );
}
