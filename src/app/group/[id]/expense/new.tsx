import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { GroupMember, ExpenseCategory } from '@/types';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '💰' },
  { value: 'meal', label: 'Meal', icon: '🍽' },
  { value: 'uber', label: 'Uber', icon: '🚗' },
  { value: 'activity', label: 'Activity', icon: '🎯' },
  { value: 'car_rental', label: 'Car Rental', icon: '🚙' },
  { value: 'hotel', label: 'Hotel', icon: '🏨' },
  { value: 'flight', label: 'Flight', icon: '✈' },
];

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('general');
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('group_members')
      .select('*')
      .eq('group_id', id)
      .then(({ data }) => {
        const m = data ?? [];
        setMembers(m);
        if (m.length > 0) {
          setPaidBy(m[0].id);
          setSplitWith(new Set(m.map((x) => x.id)));
        }
      });
  }, [id]);

  function toggleSplit(memberId: string) {
    setSplitWith((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim() || !amount || !paidBy || splitWith.size === 0) {
      Alert.alert('Missing fields', 'Fill in all required fields.');
      return;
    }
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) {
      Alert.alert('Invalid amount');
      return;
    }
    setLoading(true);
    try {
      const { data: expense, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: id,
          category,
          title: title.trim(),
          amount: total,
          currency: 'USD',
          paid_by: paidBy,
          date,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (expErr) throw expErr;

      const splitAmount = total / splitWith.size;
      const splits = Array.from(splitWith).map((memberId) => ({
        expense_id: expense.id,
        member_id: memberId,
        amount: parseFloat(splitAmount.toFixed(2)),
        is_paid: memberId === paidBy,
      }));

      const { error: splitErr } = await supabase.from('expense_splits').insert(splits);
      if (splitErr) throw splitErr;

      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Expense</Text>
          <View style={{ width: 70 }} />
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dinner at Nobu"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#999"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#999"
          value={date}
          onChangeText={setDate}
        />

        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.value}
              style={[styles.categoryChip, category === c.value && styles.categoryChipActive]}
              onPress={() => setCategory(c.value)}>
              <Text style={styles.categoryIcon}>{c.icon}</Text>
              <Text style={[styles.categoryLabel, category === c.value && styles.categoryLabelActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Paid By</Text>
        <View style={styles.memberRow}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberChip, paidBy === m.id && styles.memberChipActive]}
              onPress={() => setPaidBy(m.id)}>
              <Text style={[styles.memberChipText, paidBy === m.id && styles.memberChipTextActive]}>
                {m.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Split With</Text>
        <View style={styles.memberRow}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberChip, splitWith.has(m.id) && styles.memberChipActive]}
              onPress={() => toggleSplit(m.id)}>
              <Text style={[styles.memberChipText, splitWith.has(m.id) && styles.memberChipTextActive]}>
                {m.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {splitWith.size > 0 && amount && !isNaN(parseFloat(amount)) && (
          <Text style={styles.splitPreview}>
            ${(parseFloat(amount) / splitWith.size).toFixed(2)} each ({splitWith.size} people)
          </Text>
        )}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any notes..."
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Expense</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  back: { color: '#007AFF', fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', marginBottom: 4 },
  categoryChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  categoryChipActive: { borderColor: '#007AFF', backgroundColor: '#e8f2ff' },
  categoryIcon: { fontSize: 20, marginBottom: 2 },
  categoryLabel: { fontSize: 11, color: '#555' },
  categoryLabelActive: { color: '#007AFF', fontWeight: '600' },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  memberChipActive: { borderColor: '#007AFF', backgroundColor: '#e8f2ff' },
  memberChipText: { fontSize: 14, color: '#555' },
  memberChipTextActive: { color: '#007AFF', fontWeight: '600' },
  splitPreview: { marginTop: 8, fontSize: 13, color: '#007AFF', fontWeight: '600' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
