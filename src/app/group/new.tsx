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
import { useAuth } from '@/hooks/use-auth';
import type { GroupType } from '@/types';

export default function NewGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<GroupType>('hangout');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !user) return;
    setLoading(true);
    try {
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          type,
          created_by: user.id,
          start_date: type === 'trip' && startDate ? startDate : null,
          end_date: type === 'trip' && endDate ? endDate : null,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as first member
      const { error: memberError } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        display_name: user.email?.split('@')[0] ?? 'Me',
      });

      if (memberError) throw memberError;

      router.replace(`/group/${group.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

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

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Japan Trip, Friday Dinner"
          placeholderTextColor="#999"
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

        {type === 'trip' && (
          <>
            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={startDate}
              onChangeText={setStartDate}
            />
            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={endDate}
              onChangeText={setEndDate}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, !name.trim() && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!name.trim() || loading}>
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
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  typeChipActive: { borderColor: '#007AFF', backgroundColor: '#e8f2ff' },
  typeChipText: { fontSize: 15, color: '#555' },
  typeChipTextActive: { color: '#007AFF', fontWeight: '600' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
