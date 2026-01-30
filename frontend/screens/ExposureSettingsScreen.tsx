import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppSettings, LIGHTING_CONDITIONS } from '../types';

const AMBER = '#F59E0B';
const DARK_BG = '#0a0a0a';
const CHARCOAL = '#1a1a1a';

interface Props {
  settings: AppSettings;
  updateSettings: (settings: AppSettings) => void;
}

export default function ExposureSettingsScreen({ settings, updateSettings }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  const calculateFStop = () => {
    return (settings.focalLength / settings.pinholeSize).toFixed(1);
  };

  // Calculate exposure with all compensations
  const calculateExposure = () => {
    if (!settings.selectedCondition) return null;
    
    const condition = LIGHTING_CONDITIONS.find(c => c.name === settings.selectedCondition);
    if (!condition) return null;
    
    const actualFStop = parseFloat(calculateFStop());
    const referenceFStop = condition.fStop;
    
    const baseExposure = 1 / settings.iso;
    let exposureTime = baseExposure * Math.pow(actualFStop / referenceFStop, 2);
    
    // Apply reciprocity failure if enabled
    if (settings.useReciprocityFailure && exposureTime > 1) {
      exposureTime = Math.pow(exposureTime, 1.3);
    }
    
    // Apply red filter
    if (settings.useRedFilter) {
      exposureTime *= 8;
    }
    
    // Apply bracketing
    const bracketMultiplier = Math.pow(2, settings.bracketStops);
    exposureTime *= bracketMultiplier;
    
    return formatExposure(exposureTime);
  };

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

  const handleConditionSelect = (conditionName: string) => {
    updateSettings({ ...settings, selectedCondition: conditionName, bracketStops: 0 });
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const calculatedExposure = calculateExposure();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} ref={scrollRef}>
        <View style={styles.content}>
          <Text style={styles.title}>Exposure Settings</Text>
          <Text style={styles.subtitle}>Sunny 16 Rule Calculator</Text>

          {/* Camera Info */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ISO:</Text>
              <Text style={styles.infoValue}>{settings.iso}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>F-Stop:</Text>
              <Text style={styles.infoValue}>f/{calculateFStop()}</Text>
            </View>
          </View>

          {/* Red Filter Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updateSettings({ ...settings, useRedFilter: !settings.useRedFilter })}
          >
            <View style={styles.checkbox}>
              {settings.useRedFilter && <Ionicons name="checkmark" size={18} color={AMBER} />}
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Red Filter Compensation</Text>
              <Text style={styles.toggleNote}>Adds +3 stops to exposure time</Text>
            </View>
          </TouchableOpacity>

          {/* Reciprocity Failure Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() =>
              updateSettings({
                ...settings,
                useReciprocityFailure: !settings.useReciprocityFailure,
              })
            }
          >
            <View style={styles.checkbox}>
              {settings.useReciprocityFailure && <Ionicons name="checkmark" size={18} color={AMBER} />}
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleLabel}>Reciprocity Failure Compensation</Text>
              <Text style={styles.toggleNote}>Adjusts for long exposures (>1 second)</Text>
            </View>
          </TouchableOpacity>

          {/* Lighting Conditions */}
          <Text style={styles.sectionTitle}>Select Lighting Conditions</Text>
          <View style={styles.conditionsGrid}>
            {LIGHTING_CONDITIONS.map((condition, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.conditionCard,
                  settings.selectedCondition === condition.name && styles.conditionCardSelected,
                ]}
                onPress={() => handleConditionSelect(condition.name)}
              >
                <Text style={styles.conditionIcon}>{condition.icon}</Text>
                <Text style={styles.conditionName}>{condition.name}</Text>
                <Text style={styles.conditionDesc}>{condition.description}</Text>
                <Text style={styles.conditionFStop}>f/{condition.fStop}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    marginBottom: 8,
  },
  subtitle: {
    color: '#999',
    fontSize: 14,
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: CHARCOAL,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#999',
    fontSize: 14,
  },
  infoValue: {
    color: AMBER,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CHARCOAL,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    color: '#ccc',
    fontSize: 16,
  },
  toggleNote: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 14,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  conditionsGrid: {
    gap: 12,
  },
  conditionCard: {
    backgroundColor: CHARCOAL,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  conditionCardSelected: {
    borderColor: AMBER,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  conditionIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  conditionName: {
    color: AMBER,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  conditionDesc: {
    color: '#999',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  conditionFStop: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
