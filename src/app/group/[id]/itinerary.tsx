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
import type { TripDay, Expense } from '@/types';

type DayWithExpenses = TripDay & { expenses: Expense[] };

const CATEGORY_ICONS: Record<string, string> = {
  general: '💰', uber: '🚗', meal: '🍽', activity: '🎯',
  car_rental: '🚙', hotel: '🏨', flight: '✈',
};

export default function ItineraryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [days, setDays] = useState<DayWithExpenses[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  async function fetchData() {
    const [daysRes, expensesRes] = await Promise.all([
      supabase.from('trip_days').select('*').eq('group_id', id).order('order'),
      supabase.from('expenses').select('*').eq('group_id', id).not('day_id', 'is', null),
    ]);

    const allExpenses = expensesRes.data ?? [];
    const daysWithExpenses: DayWithExpenses[] = (daysRes.data ?? []).map((day) => ({
      ...day,
      expenses: allExpenses.filter((e) => e.day_id === day.id),
    }));
    setDays(daysWithExpenses);
    setLoading(false);
  }

  function renderDay({ item, index }: { item: DayWithExpenses; index: number }) {
    const dayTotal = item.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return (
      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayNumber}>Day {index + 1}</Text>
          <Text style={styles.dayDate}>{item.date}</Text>
          {item.label && <Text style={styles.dayLabel}>{item.label}</Text>}
          {dayTotal > 0 && <Text style={styles.dayTotal}>${dayTotal.toFixed(2)}</Text>}
        </View>

        {item.expenses.length === 0 ? (
          <Text style={styles.noExpenses}>No expenses</Text>
        ) : (
          item.expenses.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={styles.expenseRow}
              onPress={() => router.push(`/group/${id}/expense/${e.id}`)}>
              <Text style={styles.expenseIcon}>{CATEGORY_ICONS[e.category] ?? '💰'}</Text>
              <Text style={styles.expenseTitle}>{e.title}</Text>
              <Text style={styles.expenseAmount}>${Number(e.amount).toFixed(2)}</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={styles.addExpenseRow}
          onPress={() => router.push({ pathname: `/group/${id}/expense/new`, params: { day_id: item.id } })}>
          <Text style={styles.addExpenseText}>+ Add expense to this day</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Itinerary</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : days.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No days set up yet.</Text>
          <Text style={styles.emptySubtext}>Days are auto-generated from your trip start/end dates.</Text>
        </View>
      ) : (
        <FlatList
          data={days}
          keyExtractor={(d) => d.id}
          renderItem={renderDay}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  list: { padding: 16 },
  daySection: {
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#f8f8f8',
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#eef4ff',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayNumber: { fontSize: 15, fontWeight: '700', color: '#007AFF' },
  dayDate: { fontSize: 13, color: '#555' },
  dayLabel: { fontSize: 13, color: '#333', flex: 1 },
  dayTotal: { fontSize: 14, fontWeight: '700', color: '#007AFF' },
  noExpenses: { padding: 14, color: '#aaa', fontSize: 14 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#ececec', gap: 10 },
  expenseIcon: { fontSize: 18 },
  expenseTitle: { flex: 1, fontSize: 14, fontWeight: '500' },
  expenseAmount: { fontSize: 14, fontWeight: '600', color: '#333' },
  addExpenseRow: { padding: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#ececec' },
  addExpenseText: { color: '#007AFF', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#333' },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center' },
});
