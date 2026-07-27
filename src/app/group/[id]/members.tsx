import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

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

  function startEdit(member: GroupMember) {
    swipeableRefs.current[member.id]?.close();
    setEditingId(member.id);
    setName(member.display_name);
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
  }

  function handleDelete(member: GroupMember) {
    swipeableRefs.current[member.id]?.close();
    Alert.alert('Remove Member', `Remove "${member.display_name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('group_members').delete().eq('id', member.id);
          if (error) Alert.alert('Error', error.message);
          else fetchMembers();
        },
      },
    ]);
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    const { error } = editingId
      ? await supabase.from('group_members').update({ display_name: name.trim() }).eq('id', editingId)
      : await supabase.from('group_members').insert({ group_id: id, display_name: name.trim(), user_id: null });
    if (error) Alert.alert('Error', error.message);
    else {
      setName('');
      setEditingId(null);
      fetchMembers();
    }
    setSaving(false);
  }

  function renderMember({ item, index }: { item: GroupMember; index: number }) {
    return (
      <Swipeable
        ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => (
          <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeAction, styles.editAction]} onPress={() => startEdit(item)}>
              <Text style={styles.swipeActionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, styles.deleteAction]} onPress={() => handleDelete(item)}>
              <Text style={styles.swipeActionIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}>
        <View style={styles.row}>
          <MemberAvatar member={item} index={index} size={38} />
          <Text style={styles.name}>{item.display_name}</Text>
          {item.user_id && <Text style={styles.linked}>linked</Text>}
        </View>
      </Swipeable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        {editingId && (
          <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          placeholder="Add member by name"
          placeholderTextColor={Colors.dark.textSecondary}
          value={name}
          onChangeText={setName}
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[styles.addBtn, (!name.trim() || saving) && styles.addBtnDisabled]}
          onPress={handleSubmit}
          disabled={!name.trim() || saving}>
          <Text style={styles.addBtnText}>{editingId ? 'Save' : 'Add'}</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 12,
    backgroundColor: Colors.dark.background,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '500', color: Colors.dark.text },
  linked: { fontSize: 11, color: '#34c759', fontWeight: '600', backgroundColor: '#113322', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  addRow: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: Colors.dark.border, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, borderRadius: 12, padding: 12, fontSize: 16 },
  addBtn: { backgroundColor: Colors.dark.tint, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center', paddingVertical: 12 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  cancelBtn: { paddingHorizontal: 4 },
  cancelBtnText: { color: Colors.dark.textSecondary, fontSize: 15 },
  swipeActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  swipeAction: {
    width: 56,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    marginLeft: 6,
  },
  editAction: { backgroundColor: Colors.dark.tint },
  deleteAction: { backgroundColor: '#FF453A' },
  swipeActionIcon: { fontSize: 18 },
});
