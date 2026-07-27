import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, freshChannel } from '@/lib/supabase';
import type { Expense, Flight, Group, GroupMember, Hotel, HotelRoom, TripDay } from '@/types';
import { Colors } from '@/constants/theme';

const CATEGORY_ICONS: Record<string, string> = {
  general: '💰',
  transportation: '🚗',
  meal: '🍽',
  activity: '🎯',
};

type HotelWithRooms = Hotel & { rooms: HotelRoom[] };

type Row =
  | { kind: 'day'; day: TripDay | null; index: number; items: Expense[] }
  | { kind: 'hotels'; hotels: HotelWithRooms[] }
  | { kind: 'flights'; flights: Flight[] };

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [hotels, setHotels] = useState<HotelWithRooms[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [payersByExpense, setPayersByExpense] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  // Realtime alone can miss an insert that lands before the channel has
  // fully joined, so also refetch on every focus rather than just once.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchData();
    }, [id])
  );

  useEffect(() => {
    if (!id) return;
    const channel = freshChannel('expenses-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `group_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchData() {
    const [groupRes, daysRes, expRes, memRes, hotelsRes, flightsRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('trip_days').select('*').eq('group_id', id).order('order'),
      supabase.from('expenses').select('*').eq('group_id', id).order('date', { ascending: false }),
      supabase.from('group_members').select('*').eq('group_id', id),
      supabase.from('hotels').select('*').eq('group_id', id).order('check_in'),
      supabase.from('flights').select('*').eq('group_id', id).order('departure_time'),
    ]);
    setGroup(groupRes.data);
    setDays(daysRes.data ?? []);
    const exps = expRes.data ?? [];
    setExpenses(exps);
    setMembers(memRes.data ?? []);
    setFlights(flightsRes.data ?? []);

    const hotelList = hotelsRes.data ?? [];
    const hotelsWithRooms: HotelWithRooms[] = await Promise.all(
      hotelList.map(async (h) => {
        const { data: roomData } = await supabase.from('hotel_rooms').select('*').eq('hotel_id', h.id);
        return { ...h, rooms: roomData ?? [] };
      })
    );
    setHotels(hotelsWithRooms);

    if (exps.length > 0) {
      const { data: payers } = await supabase
        .from('expense_payers')
        .select('*')
        .in('expense_id', exps.map((e) => e.id));
      const grouped: Record<string, string[]> = {};
      (payers ?? []).forEach((p) => {
        grouped[p.expense_id] = [...(grouped[p.expense_id] ?? []), p.member_id];
      });
      setPayersByExpense(grouped);
    } else {
      setPayersByExpense({});
    }

    setLoading(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function payerNames(expenseId: string) {
    const ids = payersByExpense[expenseId] ?? [];
    return ids.length > 0 ? ids.map(memberName).join(', ') : '?';
  }

  function paidByNames(ids: string[]) {
    return ids.length > 0 ? ids.map(memberName).join(', ') : '?';
  }

  function handleDelete(expense: Expense) {
    swipeableRefs.current[expense.id]?.close();
    Alert.alert('Delete Expense', `Delete "${expense.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  }

  function renderExpenseRow(item: Expense) {
    return (
      <Swipeable
        key={item.id}
        ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => (
          <View style={styles.swipeActions}>
            <TouchableOpacity
              style={[styles.swipeAction, styles.editAction]}
              onPress={() => {
                swipeableRefs.current[item.id]?.close();
                router.push(`/group/${id}/expense/${item.id}?edit=1`);
              }}>
              <Text style={styles.swipeActionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.swipeAction, styles.deleteAction]}
              onPress={() => handleDelete(item)}>
              <Text style={styles.swipeActionIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/group/${id}/expense/${item.id}`)}>
          <Text style={styles.icon}>{CATEGORY_ICONS[item.category] ?? '💰'}</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>Paid by {payerNames(item.id)} · {item.date}</Text>
          </View>
          <Text style={styles.cardAmount}>${Number(item.amount).toFixed(2)}</Text>
        </TouchableOpacity>
      </Swipeable>
    );
  }

  const isTrip = group?.type === 'trip';

  const hotelsTotal = hotels.reduce((s, h) => s + h.rooms.reduce((rs, r) => rs + Number(r.cost), 0), 0);
  const flightsTotal = flights.reduce((s, f) => s + Number(f.cost ?? 0), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const total = (expensesTotal + hotelsTotal + flightsTotal).toFixed(2);

  const dayGroups: Row[] = isTrip
    ? days.map((day, i) => ({ kind: 'day' as const, day, index: i, items: expenses.filter((e) => e.day_id === day.id) }))
    : [];
  const unscheduled = isTrip ? expenses.filter((e) => !e.day_id) : [];

  const rows: Row[] = isTrip
    ? [
        ...dayGroups,
        ...(unscheduled.length > 0 ? [{ kind: 'day' as const, day: null, index: -1, items: unscheduled }] : []),
        ...(hotels.length > 0 ? [{ kind: 'hotels' as const, hotels }] : []),
        ...(flights.length > 0 ? [{ kind: 'flights' as const, flights }] : []),
      ]
    : [];

  function rowKey(row: Row, index: number) {
    if (row.kind === 'day') return row.day?.id ?? 'unscheduled';
    return `${row.kind}-${index}`;
  }

  function renderRow({ item }: { item: Row }) {
    if (item.kind === 'hotels') {
      return (
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayNumber}>🏨 Hotels</Text>
            <Text style={styles.daySubtotal}>${hotelsTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.dayItems}>
            {item.hotels.flatMap((hotel) =>
              hotel.rooms.map((room) => (
                <TouchableOpacity
                  key={room.id}
                  style={styles.card}
                  onPress={() => router.push(`/group/${id}/hotels`)}>
                  <Text style={styles.icon}>🏨</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{hotel.name} · {room.room_label}</Text>
                    <Text style={styles.cardMeta}>Paid by {paidByNames(room.paid_by)} · {hotel.check_in}</Text>
                  </View>
                  <Text style={styles.cardAmount}>${Number(room.cost).toFixed(2)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      );
    }

    if (item.kind === 'flights') {
      return (
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayNumber}>✈️ Flights</Text>
            <Text style={styles.daySubtotal}>${flightsTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.dayItems}>
            {item.flights.map((flight) => (
              <TouchableOpacity
                key={flight.id}
                style={styles.card}
                onPress={() => router.push(`/group/${id}/flights`)}>
                <Text style={styles.icon}>✈️</Text>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{flight.departure_airport} → {flight.arrival_airport}</Text>
                  <Text style={styles.cardMeta}>Paid by {paidByNames(flight.paid_by)}</Text>
                </View>
                <Text style={styles.cardAmount}>${Number(flight.cost ?? 0).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    const subtotal = item.items.reduce((s, e) => s + Number(e.amount), 0);
    return (
      <View style={styles.daySection}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayNumber}>{item.day ? `Day ${item.index + 1}` : 'Unscheduled'}</Text>
          {item.day && <Text style={styles.dayDate}>{item.day.date}</Text>}
          {item.day?.label && <Text style={styles.dayLabel}>{item.day.label}</Text>}
          <Text style={styles.daySubtotal}>${subtotal.toFixed(2)}</Text>
        </View>
        {item.items.length === 0 ? (
          <Text style={styles.noExpenses}>No expenses</Text>
        ) : (
          <View style={styles.dayItems}>{item.items.map((e) => renderExpenseRow(e))}</View>
        )}
      </View>
    );
  }

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
      ) : isTrip ? (
        <FlatList
          data={rows}
          keyExtractor={rowKey}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No expenses yet.</Text>
            </View>
          }
          renderItem={renderRow}
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => renderExpenseRow(item)}
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
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  total: { fontSize: 16, fontWeight: '600', color: Colors.dark.tint },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  icon: { fontSize: 24, marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  cardMeta: { fontSize: 12, color: Colors.dark.textSecondary, marginTop: 2 },
  cardAmount: { fontSize: 16, fontWeight: '700', color: Colors.dark.text },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.dark.textSecondary, fontSize: 16 },
  fab: { padding: 16 },
  fabButton: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  daySection: { marginBottom: 20 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  dayNumber: { fontSize: 15, fontWeight: '700', color: Colors.dark.tint },
  dayDate: { fontSize: 13, color: Colors.dark.textSecondary },
  dayLabel: { fontSize: 13, color: Colors.dark.text, flex: 1 },
  daySubtotal: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  noExpenses: { paddingHorizontal: 4, color: Colors.dark.textSecondary, fontSize: 14 },
  dayItems: { gap: 10 },
});
