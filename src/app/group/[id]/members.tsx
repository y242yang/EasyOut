import { useCallback, useState } from 'react';
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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MemberAvatar } from '@/components/member-avatar';
import type { GroupMember } from '@/types';
import { Colors } from '@/constants/theme';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchMembers();
    }, [id])
  );

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
          placeholderTextColor={Colors.dark.textSecondary}
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
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  list: { padding: 16, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 12,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.dark.text },
  linked: { fontSize: 11, color: '#34c759', fontWeight: '600', backgroundColor: '#113322', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  addRow: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.dark.border },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, borderRadius: 12, padding: 12, fontSize: 16 },
  addBtn: { backgroundColor: Colors.dark.tint, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
