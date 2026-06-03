import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Expense, GroupMember } from '@/types';

const CATEGORY_ICONS: Record<string, string> = {
  general: '💰',
  uber: '🚗',
  meal: '🍽',
  activity: '🎯',
  car_rental: '🚙',
  hotel: '🏨',
  flight: '✈',
};

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchData();

    const channel = supabase
      .channel('expenses-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchData() {
    const [expRes, memRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('group_id', id).order('date', { ascending: false }),
      supabase.from('group_members').select('*').eq('group_id', id),
    ]);
    setExpenses(expRes.data ?? []);
    setMembers(memRes.data ?? []);
    setLoading(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function renderExpense({ item }: { item: Expense }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/group/${id}/expense/${item.id}`)}>
        <Text style={styles.icon}>{CATEGORY_ICONS[item.category] ?? '💰'}</Text>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardMeta}>Paid by {memberName(item.paid_by)} · {item.date}</Text>
        </View>
        <Text style={styles.cardAmount}>${Number(item.amount).toFixed(2)}</Text>
      </TouchableOpacity>
    );
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0).toFixed(2);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.total}>${total}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No expenses yet.</Text>
            </View>
          }
        />
      )}

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  total: { fontSize: 16, fontWeight: '600', color: '#007AFF' },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
  },
  icon: { fontSize: 24, marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: '#333' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 16 },
  fab: { padding: 16 },
  fabButton: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
