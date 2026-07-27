import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { computeGroupBalances } from '@/lib/balances';
import { settleBalances, type Transaction } from '@/lib/settlement';
import type { GroupMember } from '@/types';
import { Colors } from '@/constants/theme';

export default function BalancesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [paidCents, setPaidCents] = useState<Record<string, number>>({});
  const [balanceCents, setBalanceCents] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchAll();
    }, [id])
  );

  async function fetchAll() {
    const [membersRes, balances] = await Promise.all([
      supabase.from('group_members').select('*').eq('group_id', id),
      computeGroupBalances(id),
    ]);
    setMembers(membersRes.data ?? []);
    setPaidCents(balances.paidCents);
    setBalanceCents(balances.balanceCents);
    setTransactions(settleBalances(balances.balanceCents));
    setLoading(false);
  }

  function memberName(memberId: string) {
    return members.find((m) => m.id === memberId)?.display_name ?? '?';
  }

  if (loading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: Colors.dark.background }} color={Colors.dark.tint} />;
  }

  const sortedByPaid = [...members].sort((a, b) => (paidCents[b.id] ?? 0) - (paidCents[a.id] ?? 0));
  const sortedMembers = [...members].sort((a, b) => (balanceCents[b.id] ?? 0) - (balanceCents[a.id] ?? 0));
  const allSettled = transactions.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Balances</Text>
          <View style={{ width: 60 }} />
        </View>

        <Text style={styles.sectionLabel}>Total Paid</Text>
        {sortedByPaid.map((m) => (
          <View key={m.id} style={styles.balanceRow}>
            <Text style={styles.balanceName}>{m.display_name}</Text>
            <Text style={styles.paidAmount}>${((paidCents[m.id] ?? 0) / 100).toFixed(2)}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Where You Stand</Text>
        {sortedMembers.map((m) => {
          const cents = balanceCents[m.id] ?? 0;
          return (
            <View key={m.id} style={styles.balanceRow}>
              <Text style={styles.balanceName}>{m.display_name}</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  cents > 0 && styles.balancePositive,
                  cents < 0 && styles.balanceNegative,
                ]}>
                {cents === 0 ? 'settled up' : `${cents > 0 ? '+' : '-'}$${(Math.abs(cents) / 100).toFixed(2)}`}
              </Text>
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>Settle Up</Text>
        {allSettled ? (
          <Text style={styles.settledText}>Everyone's settled up — no payments needed.</Text>
        ) : (
          transactions.map((tx, i) => (
            <View key={i} style={styles.txnRow}>
              <Text style={styles.txnText}>
                <Text style={styles.txnName}>{memberName(tx.from)}</Text> pays{' '}
                <Text style={styles.txnName}>{memberName(tx.to)}</Text>
              </Text>
              <Text style={styles.txnAmount}>${(tx.amountCents / 100).toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: 20, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  back: { color: Colors.dark.tint, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.dark.text },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  balanceName: { fontSize: 15, fontWeight: '600', color: Colors.dark.text },
  balanceAmount: { fontSize: 15, fontWeight: '700', color: Colors.dark.textSecondary },
  paidAmount: { fontSize: 15, fontWeight: '700', color: Colors.dark.text },
  balancePositive: { color: '#34C759' },
  balanceNegative: { color: '#FF453A' },
  settledText: { color: Colors.dark.textSecondary, fontSize: 14 },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  txnText: { fontSize: 14, color: Colors.dark.textSecondary, flex: 1 },
  txnName: { color: Colors.dark.text, fontWeight: '700' },
  txnAmount: { fontSize: 15, fontWeight: '700', color: Colors.dark.tint },
});
