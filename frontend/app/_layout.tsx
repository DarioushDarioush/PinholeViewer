import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';

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
