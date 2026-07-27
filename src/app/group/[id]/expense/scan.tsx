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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { scanReceipt, type ParsedReceipt, type ReceiptItem } from 'receipt-scanner';
import { DateField } from '@/components/date-field';
import type { Group, GroupMember } from '@/types';
import { Colors } from '@/constants/theme';

type Step = 'pick' | 'loading' | 'review';

export default function ScanReceiptScreen() {
  const { id, day_id, date: dayDate } = useLocalSearchParams<{ id: string; day_id?: string; date?: string }>();
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [title, setTitle] = useState('Meal');
  const [date, setDate] = useState(dayDate ?? new Date().toISOString().split('T')[0]);
  const [paidBy, setPaidBy] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [total, setTotal] = useState('0');
  const [claims, setClaims] = useState<Set<string>[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('group_members')
      .select('*')
      .eq('group_id', id)
      .then(({ data }) => {
        const m = data ?? [];
        setMembers(m);
        if (m.length > 0) setPaidBy(new Set([m[0].id]));
      });
    supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setGroup(data);
        if (data.type === 'hangout' && data.start_date) setDate(data.start_date);
      });
  }, [id]);

  const isHangout = group?.type === 'hangout';

  function togglePaidBy(memberId: string) {
    setPaidBy((prev) => {
      const next = new Set(prev);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return next;
    });
  }

  async function pickImage(useCamera: boolean) {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'EasyOut needs access to scan a receipt.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 1 });

    if (result.canceled || !result.assets?.[0]) return;

    const uri = result.assets[0].uri;
    setImageUri(uri);
    setStep('loading');

    try {
      const parsed: ParsedReceipt = await scanReceipt(uri);
      if (parsed.items.length === 0) {
        Alert.alert(
          'No items found',
          "Couldn't read any line items from that photo. Try a clearer, well-lit photo of the receipt."
        );
        setStep('pick');
        return;
      }
      setItems(parsed.items);
      setClaims(parsed.items.map(() => new Set<string>()));
      // Default from whatever OCR read as the total, falling back to
      // subtotal+tax+tip if it didn't find an explicit total line. The user
      // can correct this -- a handwritten tip addition, or a total that
      // doesn't even say "total," is exactly what OCR can't be trusted on.
      setTotal((parsed.total > 0 ? parsed.total : parsed.subtotal + parsed.tax + parsed.tip).toFixed(2));
      setStep('review');
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not read this receipt.');
      setStep('pick');
    }
  }

  function toggleClaim(itemIndex: number, memberId: string) {
    setClaims((prev) => {
      const next = prev.map((s) => new Set(s));
      const set = next[itemIndex];
      set.has(memberId) ? set.delete(memberId) : set.add(memberId);
      return next;
    });
  }

  function updateItemPrice(itemIndex: number, text: string) {
    setItems((prev) => prev.map((it, i) => (i === itemIndex ? { ...it, price: parseFloat(text) || 0 } : it)));
  }

  function updateItemName(itemIndex: number, text: string) {
    setItems((prev) => prev.map((it, i) => (i === itemIndex ? { ...it, name: text } : it)));
  }

  function removeItem(itemIndex: number) {
    setItems((prev) => prev.filter((_, i) => i !== itemIndex));
    setClaims((prev) => prev.filter((_, i) => i !== itemIndex));
  }

  function addItem() {
    setItems((prev) => [...prev, { name: '', price: 0, quantity: 1 }]);
    setClaims((prev) => [...prev, new Set()]);
  }

  // Subtotal is never independently entered -- it's always the sum of the
  // (editable) line items. Total IS independently editable, defaulted from
  // OCR: a handwritten tip addition, or a total that isn't even labeled
  // "total," is exactly what OCR can't be trusted to read correctly.
  // Whatever Total minus Subtotal comes out to (tax, tip, fees, a
  // handwritten adjustment -- doesn't matter which) is prorated across
  // members by their share of the claimed subtotal, same as tax/tip always
  // were.
  const itemsSumCents = Math.round(items.reduce((s, item) => s + item.price, 0) * 100);
  const totalCents = Math.round((parseFloat(total) || 0) * 100);
  const extraCents = totalCents - itemsSumCents;

  // Split each item's price evenly among its claimants (in cents, remainder
  // distributed so it always sums exactly), then prorate the extra
  // (Total - Subtotal) across members by their share of the claimed subtotal.
  function computeMemberTotals(): Record<string, number> {
    const subtotalCents: Record<string, number> = {};
    members.forEach((m) => (subtotalCents[m.id] = 0));

    items.forEach((item, i) => {
      const claimants = Array.from(claims[i] ?? []);
      if (claimants.length === 0) return;
      const priceCents = Math.round(item.price * 100);
      const share = Math.floor(priceCents / claimants.length);
      const remainder = priceCents - share * claimants.length;
      claimants.forEach((memberId, idx) => {
        subtotalCents[memberId] = (subtotalCents[memberId] ?? 0) + share + (idx < remainder ? 1 : 0);
      });
    });

    const claimedTotal = Object.values(subtotalCents).reduce((a, b) => a + b, 0);
    const activeMemberIds = Object.keys(subtotalCents).filter((mid) => subtotalCents[mid] > 0);

    const result: Record<string, number> = {};
    let allocatedExtra = 0;
    activeMemberIds.forEach((mid) => {
      const proportion = claimedTotal > 0 ? subtotalCents[mid] / claimedTotal : 0;
      const extra = Math.round(extraCents * proportion);
      result[mid] = subtotalCents[mid] + extra;
      allocatedExtra += extra;
    });
    const drift = extraCents - allocatedExtra;
    if (drift !== 0 && activeMemberIds.length > 0) {
      const largest = activeMemberIds.reduce((a, b) => (subtotalCents[a] >= subtotalCents[b] ? a : b));
      result[largest] += drift;
    }
    return result;
  }

  const memberTotalsCents = computeMemberTotals();
  const unclaimedItems = items.filter((_, i) => (claims[i]?.size ?? 0) === 0);
  const sumCents = Object.values(memberTotalsCents).reduce((a, b) => a + b, 0);

  async function handleSave() {
    if (!title.trim() || paidBy.size === 0) {
      Alert.alert('Missing fields', 'Fill in title and who paid.');
      return;
    }
    if (unclaimedItems.length > 0) {
      Alert.alert('Unassigned items', `${unclaimedItems.length} item(s) aren't assigned to anyone yet.`);
      return;
    }
    setSaving(true);
    try {
      // Save the amount actually implied by the itemization (items + tax +
      // tip), not the separately-typed Total field -- that field is just an
      // OCR/reference value and can drift from what was actually assigned.
      // This guarantees the splits always sum to the saved expense amount.
      const { data: expense, error: expErr } = await supabase
        .from('expenses')
        .insert({
          group_id: id,
          category: 'meal',
          title: title.trim(),
          amount: sumCents / 100,
          currency: 'USD',
          date,
          day_id: day_id ?? null,
        })
        .select()
        .single();
      if (expErr) throw expErr;

      const payers = Array.from(paidBy).map((memberId) => ({ expense_id: expense.id, member_id: memberId }));
      const { error: payerErr } = await supabase.from('expense_payers').insert(payers);
      if (payerErr) throw payerErr;

      const splits = Object.entries(memberTotalsCents).map(([memberId, cents]) => ({
        expense_id: expense.id,
        member_id: memberId,
        amount: cents / 100,
        is_paid: paidBy.has(memberId),
      }));
      const { error: splitErr } = await supabase.from('expense_splits').insert(splits);
      if (splitErr) throw splitErr;

      router.back();
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Scan Receipt</Text>
        <View style={{ width: 70 }} />
      </View>

      {step === 'pick' && (
        <View style={styles.pickContainer}>
          <Text style={styles.pickHint}>Take a photo of the receipt, or choose one from your library.</Text>
          <TouchableOpacity style={styles.pickButton} onPress={() => pickImage(true)}>
            <Text style={styles.pickButtonText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.pickButton, styles.pickButtonSecondary]} onPress={() => pickImage(false)}>
            <Text style={styles.pickButtonText}>🖼 Choose from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'loading' && (
        <View style={styles.pickContainer}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
          <ActivityIndicator color={Colors.dark.tint} style={{ marginTop: 20 }} />
          <Text style={styles.pickHint}>Reading receipt...</Text>
        </View>
      )}

      {step === 'review' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Date</Text>
          {isHangout ? (
            <View style={[styles.input, styles.inputLocked]}>
              <Text style={styles.inputLockedText}>{date}</Text>
            </View>
          ) : (
            <DateField value={date} onChange={setDate} />
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
            <Text style={styles.savedAmountText}>Split across {paidBy.size} cards -- assumed equal contribution.</Text>
          )}

          <View style={styles.totalsRow}>
            <View style={styles.totalField}>
              <Text style={styles.label}>Subtotal</Text>
              <View style={styles.computedField}>
                <Text style={styles.computedFieldText}>${(itemsSumCents / 100).toFixed(2)}</Text>
              </View>
            </View>
            <View style={styles.totalField}>
              <Text style={styles.label}>Total</Text>
              <TextInput style={styles.input} value={total} onChangeText={setTotal} keyboardType="decimal-pad" />
            </View>
          </View>
          <Text style={styles.computedHint}>
            Subtotal is the sum of the items below — edit those instead. Total defaults to what the receipt
            says, but fix it if there's a handwritten tip or anything else the photo didn't capture.
          </Text>
          <Text style={styles.extraText}>
            Tax, tip &amp; fees to split: {extraCents < 0 ? '-' : ''}${(Math.abs(extraCents) / 100).toFixed(2)}
          </Text>

          <View style={styles.itemsHeader}>
            <Text style={styles.label}>Items — tap who had each one</Text>
            <TouchableOpacity onPress={addItem}>
              <Text style={styles.addItemText}>+ Add item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, i) => (
            <View key={i} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <TextInput
                  style={[styles.input, styles.itemNameInput]}
                  value={item.name}
                  onChangeText={(t) => updateItemName(i, t)}
                  placeholder="Item name"
                  placeholderTextColor={Colors.dark.textSecondary}
                />
                <TextInput
                  style={[styles.input, styles.itemPriceInput]}
                  value={item.price.toFixed(2)}
                  onChangeText={(t) => updateItemPrice(i, t)}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity onPress={() => removeItem(i)}>
                  <Text style={styles.removeItemText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.memberRow}>
                {members.map((m) => {
                  const claimed = claims[i]?.has(m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.memberChip, claimed && styles.memberChipActive]}
                      onPress={() => toggleClaim(i, m.id)}>
                      <Text style={[styles.memberChipText, claimed && styles.memberChipTextActive]}>
                        {m.display_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(claims[i]?.size ?? 0) === 0 && <Text style={styles.unassignedText}>Not assigned to anyone</Text>}
            </View>
          ))}

          <Text style={styles.label}>Per-person total</Text>
          {members
            .filter((m) => (memberTotalsCents[m.id] ?? 0) > 0)
            .map((m) => (
              <View key={m.id} style={styles.summaryRow}>
                <Text style={styles.summaryName}>{m.display_name}</Text>
                <Text style={styles.summaryAmount}>${((memberTotalsCents[m.id] ?? 0) / 100).toFixed(2)}</Text>
              </View>
            ))}
          <Text style={styles.savedAmountText}>
            Saves as a ${(sumCents / 100).toFixed(2)} expense — always exactly the sum of the splits above.
          </Text>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Expense</Text>}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  content: { padding: 20, paddingBottom: 60 },
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
  inputLocked: { justifyContent: 'center' },
  inputLockedText: { color: Colors.dark.textSecondary, fontSize: 16 },
  pickContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14 },
  pickHint: { color: Colors.dark.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  pickButton: {
    width: '100%',
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  pickButtonSecondary: { backgroundColor: Colors.dark.backgroundElement, borderWidth: 1, borderColor: Colors.dark.border },
  pickButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  preview: { width: 200, height: 260, borderRadius: 12, resizeMode: 'cover' },
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
  totalsRow: { flexDirection: 'row', gap: 12 },
  totalField: { flex: 1 },
  computedField: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
  },
  computedFieldText: { color: Colors.dark.textSecondary, fontSize: 16, fontWeight: '600' },
  computedHint: { color: Colors.dark.textSecondary, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  extraText: { color: Colors.dark.tint, fontSize: 13, fontWeight: '600', marginTop: 10 },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  addItemText: { color: Colors.dark.tint, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  itemCard: {
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemNameInput: { flex: 1, padding: 10, fontSize: 14 },
  itemPriceInput: { width: 80, padding: 10, fontSize: 14 },
  removeItemText: { color: '#FF453A', fontSize: 16, paddingHorizontal: 4 },
  unassignedText: { color: '#FF9500', fontSize: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryName: { color: Colors.dark.text, fontSize: 14, fontWeight: '600' },
  summaryAmount: { color: Colors.dark.tint, fontSize: 14, fontWeight: '700' },
  savedAmountText: { color: Colors.dark.textSecondary, fontSize: 12, marginTop: 8 },
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
