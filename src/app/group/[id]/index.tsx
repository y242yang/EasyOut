import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MemberAvatar } from '@/components/member-avatar';
import type { Group, GroupMember, Expense } from '@/types';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchAll();
  }, [id]);

  async function fetchAll() {
    const [groupRes, membersRes, expensesRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*').eq('group_id', id),
      supabase.from('expenses').select('*').eq('group_id', id).order('date', { ascending: false }),
    ]);

    if (groupRes.error) Alert.alert('Error', groupRes.error.message);
    else setGroup(groupRes.data);
    setMembers(membersRes.data ?? []);
    setExpenses(expensesRes.data ?? []);
    setLoading(false);
  }

  function totalSpend() {
    return expenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2);
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!group) return null;

  const isTrip = group.type === 'trip';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.groupName}>{group.name}</Text>
          {isTrip && group.start_date && (
            <Text style={styles.dates}>{group.start_date} — {group.end_date ?? '?'}</Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${totalSpend()}</Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{expenses.length}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
        </View>

        <View style={styles.memberAvatarRow}>
          {members.map((m, i) => (
            <MemberAvatar key={m.id} member={m} index={i} size={40} />
          ))}
        </View>

        <View style={styles.actionsGrid}>
          <ActionButton label="Expenses" onPress={() => router.push(`/group/${id}/expenses`)} />
          {isTrip && (
            <>
              <ActionButton label="Itinerary" onPress={() => router.push(`/group/${id}/itinerary`)} />
              <ActionButton label="Flights" onPress={() => router.push(`/group/${id}/flights`)} />
              <ActionButton label="Hotels" onPress={() => router.push(`/group/${id}/hotels`)} />
              <ActionButton label="Wish List" onPress={() => router.push(`/group/${id}/wishlist`)} />
            </>
          )}
          <ActionButton label="Members" onPress={() => router.push(`/group/${id}/members`)} />
        </View>
      </ScrollView>

      <View style={styles.fab}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push(`/group/${id}/expense/new`)}>
          <Text style={styles.fabText}>+ Add Expense</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 20, gap: 4 },
  back: { color: '#007AFF', fontSize: 16, marginBottom: 8 },
  groupName: { fontSize: 26, fontWeight: '700' },
  dates: { fontSize: 14, color: '#888', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#888' },
  memberAvatarRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: -8,
  },
  actionsGrid: { paddingHorizontal: 20, gap: 12 },
  actionButton: {
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
  },
  actionButtonText: { fontSize: 16, fontWeight: '500', color: '#333' },
  fab: { padding: 16 },
  fabButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
