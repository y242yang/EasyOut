import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { MemberAvatar } from '@/components/member-avatar';
import type { Group, GroupMember, Expense } from '@/types';
import { Colors } from '@/constants/theme';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchAll();
    }, [id])
  );

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

  function shareCode() {
    Share.share({
      message: `Join "${group!.name}" on EasyOut with code ${group!.join_code}`,
    });
  }

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
          <TouchableOpacity style={styles.codeRow} onPress={shareCode}>
            <Text style={styles.codeText}>Code: {group.join_code}</Text>
            <Text style={styles.codeShare}>Share</Text>
          </TouchableOpacity>
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

        <Text style={styles.sectionLabel}>Money</Text>
        <View style={styles.actionsGrid}>
          <ActionCard icon="💰" label="Expenses" onPress={() => router.push(`/group/${id}/expenses`)} />
          <ActionCard icon="⚖️" label="Balances" onPress={() => router.push(`/group/${id}/balances`)} />
        </View>

        {isTrip && (
          <>
            <Text style={styles.sectionLabel}>Trip Planning</Text>
            <View style={styles.actionsRowThree}>
              <ActionCard compact icon="🗓️" label="Itinerary" onPress={() => router.push(`/group/${id}/itinerary`)} />
              <ActionCard compact icon="✈️" label="Flights" onPress={() => router.push(`/group/${id}/flights`)} />
              <ActionCard compact icon="🏨" label="Hotels" onPress={() => router.push(`/group/${id}/hotels`)} />
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Group</Text>
        <View style={styles.actionsGrid}>
          <ActionCard icon="👥" label="Members" onPress={() => router.push(`/group/${id}/members`)} wide />
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

function ActionCard({
  icon,
  label,
  onPress,
  wide,
  compact,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  wide?: boolean;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, wide && styles.actionCardWide, compact && styles.actionCardCompact]}
      onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={[styles.actionLabel, compact && styles.actionLabelCompact]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { padding: 20, gap: 4 },
  back: { color: Colors.dark.tint, fontSize: 16, marginBottom: 8 },
  groupName: { fontSize: 26, fontWeight: '700', color: Colors.dark.text },
  dates: { fontSize: 14, color: Colors.dark.textSecondary, marginTop: 2 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: Colors.dark.tintSoft,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  codeText: { fontSize: 13, fontWeight: '700', color: Colors.dark.tint, letterSpacing: 1 },
  codeShare: { fontSize: 12, fontWeight: '600', color: Colors.dark.tint },
  statsRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: { fontSize: 20, fontWeight: '700', marginBottom: 2, color: Colors.dark.text },
  statLabel: { fontSize: 11, color: Colors.dark.textSecondary },
  memberAvatarRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: -8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 6,
  },
  actionCardWide: { flexBasis: '100%' },
  actionsRowThree: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionCardCompact: {
    flex: 1,
    flexBasis: 'auto',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 16, fontWeight: '500', color: Colors.dark.text },
  actionLabelCompact: { fontSize: 13, textAlign: 'center' },
  fab: { padding: 16 },
  fabButton: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
