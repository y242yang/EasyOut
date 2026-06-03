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
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { WishListItem, GroupMember } from '@/types';

export default function WishListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<WishListItem[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchData();

    const channel = supabase
      .channel('wishlist-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wish_list_items', filter: `group_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchData() {
    const [itemsRes, membersRes] = await Promise.all([
      supabase.from('wish_list_items').select('*').eq('group_id', id).order('created_at', { ascending: false }),
      supabase.from('group_members').select('*').eq('group_id', id),
    ]);
    setItems(itemsRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setLoading(false);
  }

  function myMember() {
    return members.find((m) => m.user_id === user?.id);
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    const me = myMember();
    if (!me) return;
    setSaving(true);
    const { error } = await supabase.from('wish_list_items').insert({
      group_id: id,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      location: newLocation.trim() || null,
      added_by: me.id,
      votes: [],
      is_completed: false,
    });
    if (error) Alert.alert('Error', error.message);
    else {
      setNewTitle('');
      setNewLocation('');
      setNewDesc('');
      setAdding(false);
    }
    setSaving(false);
  }

  async function handleVote(item: WishListItem) {
    const me = myMember();
    if (!me) return;
    const alreadyVoted = item.votes.includes(me.id);
    const newVotes = alreadyVoted
      ? item.votes.filter((v) => v !== me.id)
      : [...item.votes, me.id];
    await supabase.from('wish_list_items').update({ votes: newVotes }).eq('id', item.id);
  }

  async function handleComplete(item: WishListItem) {
    await supabase.from('wish_list_items').update({ is_completed: !item.is_completed }).eq('id', item.id);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function renderItem({ item }: { item: WishListItem }) {
    const me = myMember();
    const voted = me ? item.votes.includes(me.id) : false;
    return (
      <View style={[styles.card, item.is_completed && styles.cardCompleted]}>
        <View style={styles.cardMain}>
          <Text style={[styles.cardTitle, item.is_completed && styles.strikethrough]}>{item.title}</Text>
          {item.location && <Text style={styles.cardLocation}>📍 {item.location}</Text>}
          {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
          <Text style={styles.cardMeta}>Added by {memberName(item.added_by)}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleVote(item)} style={styles.voteButton}>
            <Text style={[styles.voteText, voted && styles.voteTextActive]}>
              {voted ? '❤' : '♡'} {item.votes.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleComplete(item)}>
            <Text style={styles.checkmark}>{item.is_completed ? '✅' : '⬜'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Wish List</Text>
        <TouchableOpacity onPress={() => setAdding(true)}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No wish list items yet.</Text>
            </View>
          }
        />
      )}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAdding(false)}>
              <Text style={styles.back}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Add Place</Text>
            <TouchableOpacity onPress={handleAdd} disabled={saving || !newTitle.trim()}>
              <Text style={[styles.addBtn, (!newTitle.trim() || saving) && { opacity: 0.4 }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.label}>Place Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. Senso-ji Temple" placeholderTextColor="#999" value={newTitle} onChangeText={setNewTitle} />
            <Text style={styles.label}>Location</Text>
            <TextInput style={styles.input} placeholder="e.g. Asakusa, Tokyo" placeholderTextColor="#999" value={newLocation} onChangeText={setNewLocation} />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, { height: 80 }]} placeholder="Why you want to go..." placeholderTextColor="#999" value={newDesc} onChangeText={setNewDesc} multiline />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  addBtn: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  card: { padding: 14, backgroundColor: '#f8f8f8', borderRadius: 14, flexDirection: 'row', gap: 12 },
  cardCompleted: { opacity: 0.5 },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  strikethrough: { textDecorationLine: 'line-through' },
  cardLocation: { fontSize: 13, color: '#555', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#888', marginBottom: 4 },
  cardMeta: { fontSize: 11, color: '#aaa' },
  cardActions: { alignItems: 'center', gap: 8 },
  voteButton: { padding: 4 },
  voteText: { fontSize: 14, color: '#888' },
  voteTextActive: { color: '#e74c3c', fontWeight: '700' },
  checkmark: { fontSize: 20 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  modalContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 16 },
});
