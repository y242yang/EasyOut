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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { DateField } from '@/components/date-field';
import type { Group, GroupMember, ExpenseCategory } from '@/types';
import { Colors } from '@/constants/theme';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '💰' },
  { value: 'transportation', label: 'Transportation', icon: '🚗' },
  { value: 'meal', label: 'Meal', icon: '🍽' },
  { value: 'activity', label: 'Activity', icon: '🎯' },
];

export default function NewExpenseScreen() {
  const { id, day_id, date: dayDate } = useLocalSearchParams<{ id: string; day_id?: string; date?: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('general');
  const [paidBy, setPaidBy] = useState<Set<string>>(new Set());
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(dayDate ?? new Date().toISOString().split('T')[0]);
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
          setPaidBy(new Set([m[0].id]));
          setSplitWith(new Set(m.map((x) => x.id)));
        }
      });
    supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setGroup(data);
        // A hangout is a single day -- every expense in it has to share that
        // day, so there's no independent date to pick.
        if (data.type === 'hangout' && data.start_date) setDate(data.start_date);
      });
  }, [id]);

  const isHangout = group?.type === 'hangout';

  function toggleSplit(memberId: string) {
    setSplitWith((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  function togglePaidBy(memberId: string) {
    setPaidBy((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim() || !amount || paidBy.size === 0 || splitWith.size === 0) {
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
          date,
          notes: notes.trim() || null,
          day_id: day_id ?? null,
        })
        .select()
        .single();

      if (expErr) throw expErr;

      const payers = Array.from(paidBy).map((memberId) => ({ expense_id: expense.id, member_id: memberId }));
      const { error: payerErr } = await supabase.from('expense_payers').insert(payers);
      if (payerErr) throw payerErr;

      // Every member pays the same share, rounded up to the cent -- so
      // nobody's split is 1 cent less than anyone else's, and any rounding
      // slack goes in favor of whoever fronted the money.
      const totalCents = Math.round(total * 100);
      const memberIds = Array.from(splitWith);
      const perPersonCents = Math.ceil(totalCents / memberIds.length);
      const splits = memberIds.map((memberId) => ({
        expense_id: expense.id,
        member_id: memberId,
        amount: perPersonCents / 100,
        is_paid: paidBy.has(memberId),
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          placeholder="e.g. Uber to the airport, Dinner at Nobu"
          placeholderTextColor={Colors.dark.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={Colors.dark.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Date</Text>
        {isHangout ? (
          <View style={[styles.input, styles.inputLocked]}>
            <Text style={styles.inputLockedText}>{date}</Text>
          </View>
        ) : (
          <DateField value={date} onChange={setDate} />
        )}

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

        {category === 'meal' && (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() =>
              router.push({
                pathname: `/group/${id}/expense/scan`,
                params: day_id ? { day_id, date } : { date },
              })
            }>
            <Text style={styles.scanButtonText}>📷 Scan Receipt for Itemized Split</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Paid By</Text>
        <View style={styles.memberRow}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.memberChip, paidBy.has(m.id) && styles.memberChipActive]}
              onPress={() => togglePaidBy(m.id)}>
              <Text style={[styles.memberChipText, paidBy.has(m.id) && styles.memberChipTextActive]}>
                {m.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {paidBy.size > 1 && (
          <Text style={styles.splitPreview}>Split across {paidBy.size} cards -- assumed equal contribution.</Text>
        )}

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

        {splitWith.size > 0 && amount && !isNaN(parseFloat(amount)) && (() => {
          const totalCents = Math.round(parseFloat(amount) * 100);
          const perPersonCents = Math.ceil(totalCents / splitWith.size);
          return (
            <Text style={styles.splitPreview}>
              ${(perPersonCents / 100).toFixed(2)} each ({splitWith.size} people)
            </Text>
          );
        })()}

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Any notes..."
          placeholderTextColor={Colors.dark.textSecondary}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    color: Colors.dark.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
  inputLocked: { justifyContent: 'center' },
  inputLockedText: { color: Colors.dark.textSecondary, fontSize: 16 },
  categoryRow: { flexDirection: 'row', marginBottom: 4 },
  categoryChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    marginRight: 8,
  },
  categoryChipActive: { borderColor: Colors.dark.tint, backgroundColor: Colors.dark.tintSoft },
  categoryIcon: { fontSize: 20, marginBottom: 2 },
  categoryLabel: { fontSize: 11, color: Colors.dark.textSecondary },
  categoryLabelActive: { color: Colors.dark.tint, fontWeight: '600' },
  scanButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.tint,
    backgroundColor: Colors.dark.tintSoft,
    alignItems: 'center',
  },
  scanButtonText: { color: Colors.dark.tint, fontWeight: '600', fontSize: 14 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
  },
  memberChipActive: { borderColor: Colors.dark.tint, backgroundColor: Colors.dark.tintSoft },
  memberChipText: { fontSize: 14, color: Colors.dark.textSecondary },
  memberChipTextActive: { color: Colors.dark.tint, fontWeight: '600' },
  splitPreview: { marginTop: 8, fontSize: 13, color: Colors.dark.tint, fontWeight: '600' },
  button: {
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
