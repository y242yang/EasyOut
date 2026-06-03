import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { Group } from '@/types';

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchGroups();

    const channel = supabase
      .channel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function fetchGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setGroups(data ?? []);
    setLoading(false);
  }

  function renderGroup({ item }: { item: Group }) {
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => router.push(`/group/${item.id}`)}>
        <View style={styles.groupCardLeft}>
          <Text style={styles.groupBadge}>{item.type === 'trip' ? '✈' : '🍽'}</Text>
        </View>
        <View style={styles.groupCardContent}>
          <Text style={styles.groupName}>{item.name}</Text>
          <Text style={styles.groupMeta}>
            {item.type === 'trip' && item.start_date
              ? `${item.start_date}${item.end_date ? ` → ${item.end_date}` : ''}`
              : item.type}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity style={styles.newButton} onPress={() => router.push('/group/new')}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No groups yet.</Text>
          <Text style={styles.emptySubtext}>Create a hangout or trip to get started.</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 28, fontWeight: '700' },
  newButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
  },
  groupCardLeft: { marginRight: 14 },
  groupBadge: { fontSize: 28 },
  groupCardContent: { flex: 1 },
  groupName: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  groupMeta: { fontSize: 13, color: '#888', textTransform: 'capitalize' },
  loader: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubtext: { fontSize: 14, color: '#888' },
});
