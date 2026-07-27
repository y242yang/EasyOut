import { useCallback, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import type { Expense, ExpenseCategory, ExpenseSplit, Group, GroupMember } from '@/types';
import { Colors } from '@/constants/theme';

const CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: 'general', label: 'General', icon: '💰' },
  { value: 'transportation', label: 'Transportation', icon: '🚗' },
  { value: 'meal', label: 'Meal', icon: '🍽' },
  { value: 'activity', label: 'Activity', icon: '🎯' },
];

export default function ExpenseDetailScreen() {
  const { id, expenseId, edit } = useLocalSearchParams<{ id: string; expenseId: string; edit?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(edit === '1');
  const [saving, setSaving] = useState(false);

  const [expense, setExpense] = useState<Expense | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [payerIds, setPayerIds] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('general');
  const [paidBy, setPaidBy] = useState<Set<string>>(new Set());
  const [splitWith, setSplitWith] = useState<Set<string>>(new Set());
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!id || !expenseId) return;
      fetchAll();
    }, [id, expenseId])
  );

  async function fetchAll() {
    const [expenseRes, groupRes, membersRes, splitsRes, payersRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('id', expenseId).single(),
      supabase.from('groups').select('*').eq('id', id).single(),
      supabase.from('group_members').select('*').eq('group_id', id),
      supabase.from('expense_splits').select('*').eq('expense_id', expenseId),
      supabase.from('expense_payers').select('*').eq('expense_id', expenseId),
    ]);

    if (expenseRes.error) {
      Alert.alert('Error', expenseRes.error.message);
      setLoading(false);
      return;
    }

    const exp: Expense = expenseRes.data;
    const mems = membersRes.data ?? [];
    const spl = splitsRes.data ?? [];
    const pay = payersRes.data ?? [];

    setExpense(exp);
    setGroup(groupRes.data);
    setMembers(mems);
    setSplits(spl);
    setPayerIds(pay.map((p) => p.member_id));

    setTitle(exp.title);
    setAmount(String(exp.amount));
    setCategory(exp.category);
    setPaidBy(new Set(pay.map((p) => p.member_id)));
    // A hangout is a single day -- pin to the group's day even if this
    // expense was saved with a mismatched date before that was enforced.
    setDate(groupRes.data?.type === 'hangout' && groupRes.data.start_date ? groupRes.data.start_date : exp.date);
    setNotes(exp.notes ?? '');
    setSplitWith(new Set(spl.map((s) => s.member_id)));

    setLoading(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  function togglePaidBy(memberId: string) {
    setPaidBy((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  function toggleSplit(memberId: string) {
    setSplitWith((prev) => {
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
    setSaving(true);
    try {
      const { error: updateErr } = await supabase
        .from('expenses')
        .update({
          category,
          title: title.trim(),
          amount: total,
          date,
          notes: notes.trim() || null,
        })
        .eq('id', expenseId);
      if (updateErr) throw updateErr;

      const { error: deletePayersErr } = await supabase.from('expense_payers').delete().eq('expense_id', expenseId);
      if (deletePayersErr) throw deletePayersErr;
      const newPayers = Array.from(paidBy).map((memberId) => ({ expense_id: expenseId, member_id: memberId }));
      const { error: payerErr } = await supabase.from('expense_payers').insert(newPayers);
      if (payerErr) throw payerErr;

      const { error: deleteErr } = await supabase.from('expense_splits').delete().eq('expense_id', expenseId);
      if (deleteErr) throw deleteErr;

      // Same uniform, rounded-up-to-the-cent split as creating a new expense.
      const totalCents = Math.round(total * 100);
      const memberIds = Array.from(splitWith);
      const perPersonCents = Math.ceil(totalCents / memberIds.length);
      const newSplits = memberIds.map((memberId) => ({
        expense_id: expenseId,
        member_id: memberId,
        amount: perPersonCents / 100,
        is_paid: paidBy.has(memberId),
      }));
      const { error: insertErr } = await supabase.from('expense_splits').insert(newSplits);
      if (insertErr) throw insertErr;

      setEditing(false);
      await fetchAll();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: Colors.dark.background }} color={Colors.dark.tint} />;
  if (!expense) return null;

  const categoryMeta = CATEGORIES.find((c) => c.value === expense.category);

  if (!editing) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.back}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Expense</Text>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryIcon}>{categoryMeta?.icon ?? '💰'}</Text>
            <Text style={styles.summaryTitle}>{expense.title}</Text>
            <Text style={styles.summaryAmount}>${Number(expense.amount).toFixed(2)}</Text>
            <Text style={styles.summaryMeta}>
              {categoryMeta?.label ?? expense.category} · Paid by {payerIds.map(memberName).join(', ') || '?'} ·{' '}
              {expense.date}
            </Text>
            {expense.notes ? <Text style={styles.notesText}>{expense.notes}</Text> : null}
          </View>

          <Text style={styles.label}>Split</Text>
          {splits.map((s) => (
            <View key={s.id} style={styles.splitRow}>
              <Text style={styles.splitName}>{memberName(s.member_id)}</Text>
              <View style={styles.splitRight}>
                {s.is_paid && <Text style={styles.paidTag}>paid</Text>}
                <Text style={styles.splitAmount}>${Number(s.amount).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setEditing(false)}>
            <Text style={styles.back}>← Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Expense</Text>
          <View style={{ width: 70 }} />
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Amount (USD)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

        <Text style={styles.label}>Date</Text>
        {group?.type === 'hangout' ? (
          <View style={[styles.input, styles.inputLocked]}>
            <Text style={styles.inputLockedText}>{date}</Text>
          </View>
        ) : (
          <TextInput style={styles.input} value={date} onChangeText={setDate} />
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
        <Text style={styles.reSplitNote}>
          Saving splits the amount evenly among whoever's selected above -- an itemized receipt
          split won't be preserved if you edit this expense.
        </Text>

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  editLink: { color: Colors.dark.tint, fontSize: 16, fontWeight: '600' },
  summaryCard: {
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 4,
    marginBottom: 24,
  },
  summaryIcon: { fontSize: 32, marginBottom: 4 },
  summaryTitle: { fontSize: 20, fontWeight: '700', color: Colors.dark.text, textAlign: 'center' },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: Colors.dark.tint, marginTop: 4 },
  summaryMeta: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 6, textAlign: 'center' },
  notesText: { fontSize: 14, color: Colors.dark.text, marginTop: 10, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: Colors.dark.textSecondary, marginBottom: 8, marginTop: 16 },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  splitName: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  splitRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paidTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34c759',
    backgroundColor: '#113322',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  splitAmount: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
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
  reSplitNote: { marginTop: 6, fontSize: 12, color: '#FF9500' },
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
