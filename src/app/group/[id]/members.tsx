import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MemberAvatar } from '@/components/member-avatar';
import type { GroupMember } from '@/types';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMembers();
  }, [id]);

  async function fetchMembers() {
    const { data } = await supabase.from('group_members').select('*').eq('group_id', id);
    setMembers(data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('group_members').insert({
      group_id: id,
      display_name: newName.trim(),
      user_id: null,
    });
    if (error) Alert.alert('Error', error.message);
    else {
      setNewName('');
      fetchMembers();
    }
    setSaving(false);
  }

  function renderMember({ item, index }: { item: GroupMember; index: number }) {
    return (
      <View style={styles.row}>
        <MemberAvatar member={item} index={index} size={38} />
        <Text style={styles.name}>{item.display_name}</Text>
        {item.user_id && <Text style={styles.linked}>linked</Text>}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Members</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={renderMember}
          contentContainerStyle={styles.list}
        />
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add member by name"
          placeholderTextColor="#999"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!newName.trim() || saving) && styles.addBtnDisabled]}
          onPress={handleAdd}
          disabled={!newName.trim() || saving}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  list: { padding: 16, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '500' },
  linked: { fontSize: 11, color: '#34c759', fontWeight: '600', backgroundColor: '#e8f8ed', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  addRow: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 12, fontSize: 16 },
  addBtn: { backgroundColor: '#007AFF', borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
