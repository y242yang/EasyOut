import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/time-field';
import type { Flight, GroupMember } from '@/types';
import { Colors } from '@/constants/theme';

function combineDateTime(dateStr: string, time: Date): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const combined = new Date(y, (m ?? 1) - 1, d ?? 1, time.getHours(), time.getMinutes());
  return combined.toISOString();
}

function formatFlightTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function splitDateTime(iso: string): { date: string; time: Date } {
  const d = new Date(iso);
  return { date: toISODate(d), time: d };
}

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    member_id: '',
    airline: '',
    flight_number: '',
    departure_airport: '',
    arrival_airport: '',
    cost: '',
  });
  const [departureDate, setDepartureDate] = useState('');
  const [departureTime, setDepartureTime] = useState(new Date());
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState(new Date());
  const [paidBy, setPaidBy] = useState<Set<string>>(new Set());
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchData();
    }, [id])
  );

  async function fetchData() {
    const [flightsRes, membersRes] = await Promise.all([
      supabase.from('flights').select('*').eq('group_id', id).order('departure_time'),
      supabase.from('group_members').select('*').eq('group_id', id),
    ]);
    setFlights(flightsRes.data ?? []);
    const mems = membersRes.data ?? [];
    setMembers(mems);
    if (mems.length > 0) {
      setForm((f) => ({ ...f, member_id: mems[0].id }));
      setPaidBy(new Set([mems[0].id]));
    }
    setLoading(false);
  }

  function togglePaidBy(memberId: string) {
    setPaidBy((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  function resetForm() {
    setForm((f) => ({ ...f, airline: '', flight_number: '', departure_airport: '', arrival_airport: '', cost: '' }));
    setDepartureDate(''); setDepartureTime(new Date());
    setArrivalDate(''); setArrivalTime(new Date());
    setEditingFlightId(null);
  }

  function openAdd() {
    resetForm();
    if (members.length > 0) {
      setForm((f) => ({ ...f, member_id: members[0].id }));
      setPaidBy(new Set([members[0].id]));
    }
    setAdding(true);
  }

  function openEdit(flight: Flight) {
    swipeableRefs.current[flight.id]?.close();
    setEditingFlightId(flight.id);
    setForm({
      member_id: flight.member_id,
      airline: flight.airline ?? '',
      flight_number: flight.flight_number ?? '',
      departure_airport: flight.departure_airport,
      arrival_airport: flight.arrival_airport,
      cost: flight.cost != null ? String(flight.cost) : '',
    });
    const dep = splitDateTime(flight.departure_time);
    const arr = splitDateTime(flight.arrival_time);
    setDepartureDate(dep.date); setDepartureTime(dep.time);
    setArrivalDate(arr.date); setArrivalTime(arr.time);
    setPaidBy(new Set(flight.paid_by));
    setAdding(true);
  }

  function handleDelete(flight: Flight) {
    swipeableRefs.current[flight.id]?.close();
    Alert.alert('Delete Flight', `Delete this flight? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('flights').delete().eq('id', flight.id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  }

  async function handleSave() {
    if (!form.member_id || !form.departure_airport || !form.arrival_airport || !departureDate || !arrivalDate) {
      Alert.alert('Missing fields');
      return;
    }
    setSaving(true);
    const payload = {
      member_id: form.member_id,
      airline: form.airline || null,
      flight_number: form.flight_number || null,
      departure_airport: form.departure_airport.toUpperCase(),
      arrival_airport: form.arrival_airport.toUpperCase(),
      departure_time: combineDateTime(departureDate, departureTime),
      arrival_time: combineDateTime(arrivalDate, arrivalTime),
      cost: form.cost ? parseFloat(form.cost) : null,
      paid_by: Array.from(paidBy),
    };
    const { error } = editingFlightId
      ? await supabase.from('flights').update(payload).eq('id', editingFlightId)
      : await supabase.from('flights').insert({ group_id: id, ...payload });
    if (error) Alert.alert('Error', error.message);
    else {
      setAdding(false);
      resetForm();
      fetchData();
    }
    setSaving(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function renderFlight({ item }: { item: Flight }) {
    return (
      <Swipeable
        ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => (
          <View style={styles.swipeActions}>
            <TouchableOpacity style={[styles.swipeAction, styles.editAction]} onPress={() => openEdit(item)}>
              <Text style={styles.swipeActionIcon}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.swipeAction, styles.deleteAction]} onPress={() => handleDelete(item)}>
              <Text style={styles.swipeActionIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        )}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.passenger}>{memberName(item.member_id)}</Text>
            {item.cost && <Text style={styles.cost}>${Number(item.cost).toFixed(2)}</Text>}
          </View>
          <View style={styles.routeRow}>
            <Text style={styles.airport}>{item.departure_airport}</Text>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.airport}>{item.arrival_airport}</Text>
          </View>
          {item.airline && (
            <Text style={styles.meta}>{item.airline}{item.flight_number ? ` · ${item.flight_number}` : ''}</Text>
          )}
          <Text style={styles.meta}>Departs: {formatFlightTime(item.departure_time)}</Text>
          <Text style={styles.meta}>Arrives: {formatFlightTime(item.arrival_time)}</Text>
          <Text style={styles.paidBy}>
            Paid by {item.paid_by.length > 0 ? item.paid_by.map(memberName).join(', ') : '?'}
          </Text>
        </View>
      </Swipeable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Flights</Text>
        <TouchableOpacity onPress={openAdd}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={flights}
          keyExtractor={(f) => f.id}
          renderItem={renderFlight}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No flights added yet.</Text></View>}
        />
      )}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { setAdding(false); resetForm(); }}><Text style={styles.back}>Cancel</Text></TouchableOpacity>
            <Text style={styles.title}>{editingFlightId ? 'Edit Flight' : 'Add Flight'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={[styles.addBtn, saving && { opacity: 0.4 }]}>Save</Text></TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Passenger</Text>
            <View style={styles.memberRow}>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChip, form.member_id === m.id && styles.memberChipActive]}
                  onPress={() => setForm((f) => ({ ...f, member_id: m.id }))}>
                  <Text style={[styles.memberChipText, form.member_id === m.id && styles.memberChipTextActive]}>{m.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Paid By</Text>
            <View style={styles.memberRow}>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.memberChip, paidBy.has(m.id) && styles.memberChipActive]}
                  onPress={() => togglePaidBy(m.id)}>
                  <Text style={[styles.memberChipText, paidBy.has(m.id) && styles.memberChipTextActive]}>{m.display_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {[
              { key: 'departure_airport', label: 'From (airport code)', placeholder: 'JFK' },
              { key: 'arrival_airport', label: 'To (airport code)', placeholder: 'NRT' },
            ].map(({ key, label, placeholder }) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={(form as any)[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                />
              </View>
            ))}

            <Text style={styles.label}>Departure Date</Text>
            <DateField value={departureDate} onChange={setDepartureDate} />
            <Text style={styles.label}>Departure Time</Text>
            <TimeField value={departureTime} onChange={setDepartureTime} />

            <Text style={styles.label}>Arrival Date</Text>
            <DateField value={arrivalDate} onChange={setArrivalDate} />
            <Text style={styles.label}>Arrival Time</Text>
            <TimeField value={arrivalTime} onChange={setArrivalTime} />

            {[
              { key: 'airline', label: 'Airline (optional)', placeholder: 'ANA' },
              { key: 'flight_number', label: 'Flight # (optional)', placeholder: 'NH010' },
              { key: 'cost', label: 'Cost (optional)', placeholder: '850.00' },
            ].map(({ key, label, placeholder }) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={(form as any)[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  keyboardType={key === 'cost' ? 'decimal-pad' : 'default'}
                />
              </View>
            ))}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  addBtn: { color: Colors.dark.tint, fontSize: 16, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, backgroundColor: Colors.dark.backgroundElement, borderRadius: 14, borderWidth: 1, borderColor: Colors.dark.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  passenger: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  cost: { fontSize: 15, fontWeight: '600', color: Colors.dark.tint },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  airport: { fontSize: 22, fontWeight: '700', color: Colors.dark.text },
  arrow: { fontSize: 18, color: Colors.dark.textSecondary },
  meta: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2 },
  paidBy: { fontSize: 13, color: Colors.dark.tint, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: Colors.dark.textSecondary, fontSize: 16 },
  modal: { flex: 1, backgroundColor: Colors.dark.background },
  formContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.backgroundElement, color: Colors.dark.text, borderRadius: 12, padding: 14, fontSize: 16 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.dark.border, backgroundColor: Colors.dark.backgroundElement },
  memberChipActive: { borderColor: Colors.dark.tint, backgroundColor: Colors.dark.tintSoft },
  memberChipText: { fontSize: 14, color: Colors.dark.textSecondary },
  memberChipTextActive: { color: Colors.dark.tint, fontWeight: '600' },
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
