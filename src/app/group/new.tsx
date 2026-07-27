import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { ensureAnonymousSession } from '@/hooks/use-auth';
import type { GroupType, Group } from '@/types';
import { Colors } from '@/constants/theme';

export default function NewGroupScreen() {
  const router = useRouter();
  const [yourName, setYourName] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('hangout');
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !yourName.trim()) return;
    setLoading(true);
    try {
      await ensureAnonymousSession();

      const { data: group, error } = await supabase
        .rpc('create_group_with_creator', {
          p_name: name.trim(),
          p_type: type,
          p_start_date: type === 'trip' ? startDate : date,
          p_end_date: type === 'trip' ? endDate : date,
          p_creator_display_name: yourName.trim(),
        })
        .single<Group>();

      if (error) throw error;

      router.replace(`/group/${group.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    name.trim() &&
    yourName.trim() &&
    (type === 'trip' ? startDate.trim() && endDate.trim() : date.trim());

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New Group</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Ann"
          placeholderTextColor={Colors.dark.textSecondary}
          value={yourName}
          onChangeText={setYourName}
        />

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Japan Trip, Friday Dinner"
          placeholderTextColor={Colors.dark.textSecondary}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {(['hangout', 'trip'] as GroupType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeChip, type === t && styles.typeChipActive]}
              onPress={() => setType(t)}>
              <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                {t === 'hangout' ? '🍽 Hangout' : '✈ Trip'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'trip' ? (
          <>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.dark.textSecondary}
              value={startDate}
              onChangeText={setStartDate}
            />
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.dark.textSecondary}
              value={endDate}
              onChangeText={setEndDate}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.dark.textSecondary}
              value={date}
              onChangeText={setDate}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit || loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    color: Colors.dark.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeChip: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    alignItems: 'center',
  },
  typeChipActive: { borderColor: Colors.dark.tint, backgroundColor: Colors.dark.tintSoft },
  typeChipText: { fontSize: 15, color: Colors.dark.textSecondary },
  typeChipTextActive: { color: Colors.dark.tint, fontWeight: '600' },
  button: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
