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
import type { Hotel, HotelRoom, GroupMember } from '@/types';

type HotelWithRooms = Hotel & { rooms: HotelRoom[] };

export default function HotelsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [hotels, setHotels] = useState<HotelWithRooms[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hotelName, setHotelName] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [hotelNotes, setHotelNotes] = useState('');
  const [rooms, setRooms] = useState<{ label: string; cost: string; memberIds: Set<string> }[]>([
    { label: 'Room 1', cost: '', memberIds: new Set() },
  ]);

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

  async function fetchData() {
    const [hotelsRes, membersRes] = await Promise.all([
      supabase.from('hotels').select('*').eq('group_id', id).order('check_in'),
      supabase.from('group_members').select('*').eq('group_id', id),
    ]);
    const hotelList = hotelsRes.data ?? [];
    const mems = membersRes.data ?? [];
    setMembers(mems);

    const withRooms: HotelWithRooms[] = await Promise.all(
      hotelList.map(async (h) => {
        const { data: roomData } = await supabase.from('hotel_rooms').select('*').eq('hotel_id', h.id);
        return { ...h, rooms: roomData ?? [] };
      })
    );
    setHotels(withRooms);
    setLoading(false);
  }

  function addRoom() {
    setRooms((prev) => [...prev, { label: `Room ${prev.length + 1}`, cost: '', memberIds: new Set() }]);
  }

  function toggleRoomMember(roomIdx: number, memberId: string) {
    setRooms((prev) =>
      prev.map((r, i) => {
        if (i !== roomIdx) return r;
        const next = new Set(r.memberIds);
        next.has(memberId) ? next.delete(memberId) : next.add(memberId);
        return { ...r, memberIds: next };
      })
    );
  }

  async function handleSave() {
    if (!hotelName.trim() || !checkIn || !checkOut) { Alert.alert('Missing fields'); return; }
    setSaving(true);
    try {
      const { data: hotel, error: hotelErr } = await supabase
        .from('hotels')
        .insert({ group_id: id, name: hotelName.trim(), check_in: checkIn, check_out: checkOut, notes: hotelNotes || null })
        .select().single();
      if (hotelErr) throw hotelErr;

      for (const room of rooms) {
        if (!room.label.trim()) continue;
        await supabase.from('hotel_rooms').insert({
          hotel_id: hotel.id,
          room_label: room.label.trim(),
          cost: parseFloat(room.cost) || 0,
          member_ids: Array.from(room.memberIds),
        });
      }

      setAdding(false);
      setHotelName(''); setCheckIn(''); setCheckOut(''); setHotelNotes('');
      setRooms([{ label: 'Room 1', cost: '', memberIds: new Set() }]);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function renderHotel({ item }: { item: HotelWithRooms }) {
    const totalCost = item.rooms.reduce((s, r) => s + Number(r.cost), 0);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.hotelName}>🏨 {item.name}</Text>
          {totalCost > 0 && <Text style={styles.totalCost}>${totalCost.toFixed(2)}</Text>}
        </View>
        <Text style={styles.dates}>{item.check_in} → {item.check_out}</Text>
        {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
        {item.rooms.map((room) => (
          <View key={room.id} style={styles.roomRow}>
            <Text style={styles.roomLabel}>{room.room_label}</Text>
            <Text style={styles.roomCost}>${Number(room.cost).toFixed(2)}</Text>
            <Text style={styles.roomMembers}>
              {room.member_ids.length > 0
                ? room.member_ids.map(memberName).join(', ')
                : 'Unassigned'}
              {room.member_ids.length > 1
                ? ` (${(Number(room.cost) / room.member_ids.length).toFixed(2)} each)`
                : ''}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
        <Text style={styles.title}>Hotels</Text>
        <TouchableOpacity onPress={() => setAdding(true)}><Text style={styles.addBtn}>+ Add</Text></TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ flex: 1 }} /> : (
        <FlatList data={hotels} keyExtractor={(h) => h.id} renderItem={renderHotel}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No hotels added yet.</Text></View>} />
      )}

      <Modal visible={adding} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.back}>Cancel</Text></TouchableOpacity>
            <Text style={styles.title}>Add Hotel</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={[styles.addBtn, saving && { opacity: 0.4 }]}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Text style={styles.label}>Hotel Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Park Hyatt Tokyo" placeholderTextColor="#999" value={hotelName} onChangeText={setHotelName} />
            <Text style={styles.label}>Check-In</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#999" value={checkIn} onChangeText={setCheckIn} />
            <Text style={styles.label}>Check-Out</Text>
            <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#999" value={checkOut} onChangeText={setCheckOut} />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput style={[styles.input, { height: 60 }]} placeholderTextColor="#999" value={hotelNotes} onChangeText={setHotelNotes} multiline />

            <View style={styles.roomsHeader}>
              <Text style={styles.sectionTitle}>Rooms</Text>
              <TouchableOpacity onPress={addRoom}><Text style={styles.addBtn}>+ Room</Text></TouchableOpacity>
            </View>

            {rooms.map((room, idx) => (
              <View key={idx} style={styles.roomForm}>
                <Text style={styles.roomFormTitle}>Room {idx + 1}</Text>
                <TextInput style={styles.input} placeholder="Label (e.g. Room 1)" placeholderTextColor="#999"
                  value={room.label} onChangeText={(v) => setRooms((r) => r.map((x, i) => i === idx ? { ...x, label: v } : x))} />
                <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Cost" placeholderTextColor="#999"
                  keyboardType="decimal-pad" value={room.cost}
                  onChangeText={(v) => setRooms((r) => r.map((x, i) => i === idx ? { ...x, cost: v } : x))} />
                <Text style={styles.label}>Who's in this room?</Text>
                <View style={styles.memberRow}>
                  {members.map((m) => (
                    <TouchableOpacity key={m.id}
                      style={[styles.memberChip, room.memberIds.has(m.id) && styles.memberChipActive]}
                      onPress={() => toggleRoomMember(idx, m.id)}>
                      <Text style={[styles.memberChipText, room.memberIds.has(m.id) && styles.memberChipTextActive]}>{m.display_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {room.memberIds.size > 0 && room.cost && (
                  <Text style={styles.splitPreview}>
                    ${(parseFloat(room.cost || '0') / room.memberIds.size).toFixed(2)} each
                  </Text>
                )}
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
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  hotelName: { fontSize: 16, fontWeight: '700' },
  totalCost: { fontSize: 15, fontWeight: '600', color: '#007AFF' },
  dates: { fontSize: 13, color: '#666', marginBottom: 8 },
  notes: { fontSize: 13, color: '#888', marginBottom: 8 },
  roomRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e8e8e8' },
  roomLabel: { fontSize: 14, fontWeight: '600' },
  roomCost: { fontSize: 13, color: '#007AFF', marginTop: 1 },
  roomMembers: { fontSize: 12, color: '#888', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#888', fontSize: 16 },
  modal: { flex: 1, backgroundColor: '#fff' },
  formContent: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 16 },
  roomsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  roomForm: { marginTop: 16, padding: 14, backgroundColor: '#f8f8f8', borderRadius: 12 },
  roomFormTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  memberChipActive: { borderColor: '#007AFF', backgroundColor: '#e8f2ff' },
  memberChipText: { fontSize: 14, color: '#555' },
  memberChipTextActive: { color: '#007AFF', fontWeight: '600' },
  splitPreview: { marginTop: 8, fontSize: 13, color: '#007AFF', fontWeight: '600' },
});
