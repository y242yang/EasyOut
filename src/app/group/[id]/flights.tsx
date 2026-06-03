import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Flight, GroupMember } from '@/types';

export default function FlightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    member_id: '',
    airline: '',
    flight_number: '',
    departure_airport: '',
    arrival_airport: '',
    departure_time: '',
    arrival_time: '',
    cost: '',
  });

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  async function fetchData() {
    const [flightsRes, membersRes] = await Promise.all([
      supabase.from('flights').select('*').eq('group_id', id).order('departure_time'),
      supabase.from('group_members').select('*').eq('group_id', id),
    ]);
    setFlights(flightsRes.data ?? []);
    const mems = membersRes.data ?? [];
    setMembers(mems);
    if (mems.length > 0) setForm((f) => ({ ...f, member_id: mems[0].id }));
    setLoading(false);
  }

  async function handleSave() {
    if (!form.member_id || !form.departure_airport || !form.arrival_airport || !form.departure_time || !form.arrival_time) {
      Alert.alert('Missing fields');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('flights').insert({
      group_id: id,
      member_id: form.member_id,
      airline: form.airline || null,
      flight_number: form.flight_number || null,
      departure_airport: form.departure_airport.toUpperCase(),
      arrival_airport: form.arrival_airport.toUpperCase(),
      departure_time: form.departure_time,
      arrival_time: form.arrival_time,
      cost: form.cost ? parseFloat(form.cost) : null,
    });
    if (error) Alert.alert('Error', error.message);
    else {
      setAdding(false);
      fetchData();
    }
    setSaving(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function renderFlight({ item }: { item: Flight }) {
    return (
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
        <Text style={styles.meta}>Departs: {item.departure_time}</Text>
        <Text style={styles.meta}>Arrives: {item.arrival_time}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Flights</Text>
        <TouchableOpacity onPress={() => setAdding(true)}>
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
            <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.back}>Cancel</Text></TouchableOpacity>
            <Text style={styles.title}>Add Flight</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={[styles.addBtn, saving && { opacity: 0.4 }]}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
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
            {[
              { key: 'departure_airport', label: 'From (airport code)', placeholder: 'JFK' },
              { key: 'arrival_airport', label: 'To (airport code)', placeholder: 'NRT' },
              { key: 'departure_time', label: 'Departure Time', placeholder: '2026-07-01T14:00' },
              { key: 'arrival_time', label: 'Arrival Time', placeholder: '2026-07-02T16:00' },
              { key: 'airline', label: 'Airline (optional)', placeholder: 'ANA' },
              { key: 'flight_number', label: 'Flight # (optional)', placeholder: 'NH010' },
              { key: 'cost', label: 'Cost (optional)', placeholder: '850.00' },
            ].map(({ key, label, placeholder }) => (
              <View key={key}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor="#999"
                  value={(form as any)[key]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  keyboardType={key === 'cost' ? 'decimal-pad' : 'default'}
                />
              </View>
            ))}
          </ScrollView>
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
  list: { padding: 16, gap: 12 },
  card: { padding: 16, backgroundColor: '#f8f8f8', borderRadius: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  passenger: { fontSize: 15, fontWeight: '700' },
  cost: { fontSize: 15, fontWeight: '600', color: '#007AFF' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  airport: { fontSize: 22, fontWeight: '700' },
  arrow: { fontSize: 18, color: '#888' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  formContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 16 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  memberChipActive: { borderColor: '#007AFF', backgroundColor: '#e8f2ff' },
  memberChipText: { fontSize: 14, color: '#555' },
  memberChipTextActive: { color: '#007AFF', fontWeight: '600' },
});
