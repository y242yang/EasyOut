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
import { Colors } from '@/constants/theme';

interface CodeMember {
  group_id: string;
  group_name: string;
  group_type: string;
  member_id: string;
  member_display_name: string;
  member_is_claimed: boolean;
}

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [looking, setLooking] = useState(false);
  const [members, setMembers] = useState<CodeMember[] | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleLookup() {
    if (!code.trim()) return;
    setLooking(true);
    setMembers(null);
    try {
      const { data, error } = await supabase.rpc('find_group_by_code', { p_code: code.trim() });
      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert('Not found', "That code doesn't match a group.");
        return;
      }
      setMembers(data);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLooking(false);
    }
  }

  async function handleClaim(memberId: string) {
    setJoining(true);
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase
        .rpc('claim_member', { p_code: code.trim(), p_member_id: memberId })
        .single<{ group_id: string }>();
      if (error) throw error;
      router.replace(`/group/${data.group_id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setJoining(false);
    }
  }

  async function handleJoinAsNew() {
    if (!newName.trim() || !members) return;
    setJoining(true);
    try {
      await ensureAnonymousSession();
      const { data, error } = await supabase
        .rpc('join_as_new_member', { p_code: code.trim(), p_display_name: newName.trim() })
        .single<{ group_id: string }>();
      if (error) throw error;
      router.replace(`/group/${data.group_id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setJoining(false);
    }
  }

  const group = members?.[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Join a Hangout</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.label}>Join Code</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="e.g. XJ4K9P"
            placeholderTextColor={Colors.dark.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
          />
          <TouchableOpacity
            style={[styles.lookupBtn, !code.trim() && styles.buttonDisabled]}
            onPress={handleLookup}
            disabled={!code.trim() || looking}>
            {looking ? <ActivityIndicator color="#fff" /> : <Text style={styles.lookupBtnText}>Find</Text>}
          </TouchableOpacity>
        </View>

        {group && (
          <>
            <View style={styles.groupCard}>
              <Text style={styles.groupBadge}>{group.group_type === 'trip' ? '✈' : '🍽'}</Text>
              <Text style={styles.groupName}>{group.group_name}</Text>
            </View>

            <Text style={styles.label}>Who are you?</Text>
            {members!.map((m) => (
              <TouchableOpacity
                key={m.member_id}
                style={[styles.memberRow, m.member_is_claimed && styles.memberRowDisabled]}
                onPress={() => !m.member_is_claimed && handleClaim(m.member_id)}
                disabled={m.member_is_claimed || joining}>
                <Text style={styles.memberName}>{m.member_display_name}</Text>
                {m.member_is_claimed ? (
                  <Text style={styles.claimedTag}>already joined</Text>
                ) : (
                  <Text style={styles.claimTag}>I'm this person</Text>
                )}
              </TouchableOpacity>
            ))}

            {!addingNew ? (
              <TouchableOpacity style={styles.addNewRow} onPress={() => setAddingNew(true)}>
                <Text style={styles.addNewText}>+ I'm someone else</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.addNewForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={newName}
                  onChangeText={setNewName}
                />
                <TouchableOpacity
                  style={[styles.button, !newName.trim() && styles.buttonDisabled]}
                  onPress={handleJoinAsNew}
                  disabled={!newName.trim() || joining}>
                  {joining ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Join Hangout</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
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
  codeRow: { flexDirection: 'row', gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    color: Colors.dark.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  codeInput: { flex: 1, letterSpacing: 2 },
  lookupBtn: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  lookupBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginTop: 20,
  },
  groupBadge: { fontSize: 24 },
  groupName: { fontSize: 17, fontWeight: '700', color: Colors.dark.text },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 8,
  },
  memberRowDisabled: { opacity: 0.5 },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  claimTag: { fontSize: 13, color: Colors.dark.tint, fontWeight: '600' },
  claimedTag: { fontSize: 12, color: Colors.dark.textSecondary },
  addNewRow: { padding: 14, alignItems: 'center' },
  addNewText: { color: Colors.dark.tint, fontSize: 14, fontWeight: '600' },
  addNewForm: { marginTop: 8, gap: 12 },
  button: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
