import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { deleteAccount } from '@/hooks/use-auth';
import { Colors } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [hasAccount, setHasAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // No account exists until the first group is created or joined, so there's
  // nothing to offer deleting before then.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setHasAccount(!!session));
  }, []);

  function confirmDelete() {
    Alert.alert(
      'Delete Account',
      "This deletes your account and any group where you're the only real user -- " +
        'including groups where you added people by typing their names. Groups that ' +
        "other people joined with the app will stay, and your name remains on what you've " +
        "already paid or owe so they can still settle up. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ]
    );
  }

  async function runDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      setHasAccount(false);
      // Back to a clean home screen -- the group list refetches on focus and
      // will come back empty now that the session is gone.
      router.replace('/');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete your account.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            {hasAccount
              ? 'EasyOut signs you in anonymously the first time you create or join a group. ' +
                'There is no email or password -- your groups are tied to this device.'
              : 'No account yet. One is created anonymously the first time you create or join a group.'}
          </Text>
        </View>

        {hasAccount && (
          <TouchableOpacity
            style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
            onPress={confirmDelete}
            disabled={deleting}>
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.version}>
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  back: { color: Colors.dark.tint, fontSize: 16, width: 60 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.dark.text },
  content: { padding: 16, gap: 12 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  card: {
    padding: 16,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardText: { fontSize: 14, lineHeight: 20, color: Colors.dark.textSecondary },
  deleteButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#FF453A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonDisabled: { opacity: 0.6 },
  deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  version: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
});
