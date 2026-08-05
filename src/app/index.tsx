import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, freshChannel } from '@/lib/supabase';
import type { Group } from '@/types';
import { Colors } from '@/constants/theme';
import { getGroupStatus, daysUntilExpiry } from '@/lib/group-status';

function byStartDate(a: Group, b: Group) {
  // Undated (legacy) groups sort last rather than clumping at the top.
  return (a.start_date ?? '9999-99-99').localeCompare(b.start_date ?? '9999-99-99');
}

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  // Realtime alone isn't reliable right after the channel is created -- an
  // insert that lands before the subscription has fully joined is silently
  // missed, and the list only catches up whenever the *next* change fires a
  // refetch. Refetching on every focus (not just once on mount) makes the
  // list correct regardless of that race.
  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [])
  );

  useEffect(() => {
    const channel = freshChannel('groups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, fetchGroups)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchGroups() {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) Alert.alert('Error', error.message);
    else setGroups(data ?? []);
    setLoading(false);
  }

  function handleDelete(group: Group) {
    swipeableRefs.current[group.id]?.close();
    Alert.alert(
      'Delete Group',
      `Delete "${group.name}"? This removes all its expenses and members for everyone. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('groups').delete().eq('id', group.id);
            if (error) Alert.alert('Error', error.message);
            else fetchGroups();
          },
        },
      ]
    );
  }

  function showExpiryInfo() {
    Alert.alert(
      'Auto-delete',
      'Groups are automatically deleted 30 days after they end, along with all their expenses and members, to keep things tidy. Swipe left to delete one sooner.'
    );
  }

  function renderGroup({ item }: { item: Group }) {
    const isPast = getGroupStatus(item) === 'past';
    const daysLeft = isPast ? daysUntilExpiry(item) : null;

    return (
      <Swipeable
        ref={(ref) => { swipeableRefs.current[item.id] = ref; }}
        renderRightActions={() => (
          <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteActionIcon}>✕</Text>
          </TouchableOpacity>
        )}>
        <TouchableOpacity
          style={styles.groupCard}
          onPress={() => router.push(`/group/${item.id}`)}>
          <View style={styles.groupCardLeft}>
            <Text style={styles.groupBadge}>{item.type === 'trip' ? '✈' : '🍽'}</Text>
          </View>
          <View style={styles.groupCardContent}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>
              {item.type === 'trip' && item.start_date
                ? `${item.start_date}${item.end_date ? ` → ${item.end_date}` : ''}`
                : item.start_date ?? item.type}
            </Text>
            {daysLeft !== null && (
              <Text style={styles.expiryText}>
                {daysLeft > 0 ? `Expires in ${daysLeft}d` : 'Expired'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandBanner}>
        <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} />
        <Text style={styles.brandText}>
          Easy<Text style={styles.brandTextAccent}>Out</Text>
        </Text>
        <View style={styles.brandSpacer} />
        <TouchableOpacity onPress={() => router.push('/settings')} hitSlop={8}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.joinButton} onPress={() => router.push('/join')}>
            <Text style={styles.joinButtonText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newButton} onPress={() => router.push('/group/new')}>
            <Text style={styles.newButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No groups yet.</Text>
          <Text style={styles.emptySubtext}>Create a hangout or trip, or join one with a code.</Text>
        </View>
      ) : (
        <SectionList
          sections={[
            { title: 'Current', data: groups.filter((g) => getGroupStatus(g) === 'current').sort(byStartDate) },
            { title: 'Future', data: groups.filter((g) => getGroupStatus(g) === 'future').sort(byStartDate) },
            { title: 'Past', data: groups.filter((g) => getGroupStatus(g) === 'past').sort(byStartDate) },
          ]}
          keyExtractor={(g) => g.id}
          renderItem={renderGroup}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
              {section.title === 'Past' && (
                <TouchableOpacity onPress={showExpiryInfo} hitSlop={8}>
                  <Text style={styles.infoIcon}>ⓘ</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.emptySectionText}>No {section.title.toLowerCase()} groups.</Text>
            ) : null
          }
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  brandBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  logo: { width: 34, height: 34, borderRadius: 9 },
  brandText: { fontSize: 19, fontWeight: '800', color: Colors.dark.text, letterSpacing: 0.2 },
  brandTextAccent: { color: Colors.dark.tint },
  brandSpacer: { flex: 1 },
  settingsIcon: { fontSize: 20, color: Colors.dark.textSecondary },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 28, fontWeight: '700', color: Colors.dark.text },
  headerActions: { flexDirection: 'row', gap: 8 },
  joinButton: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: { color: Colors.dark.text, fontWeight: '600' },
  newButton: {
    backgroundColor: Colors.dark.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  newButtonText: { color: '#fff', fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptySectionText: { fontSize: 13, color: Colors.dark.textSecondary, marginBottom: 8 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  groupCardLeft: { marginRight: 14 },
  groupBadge: { fontSize: 28 },
  groupCardContent: { flex: 1 },
  groupName: { fontSize: 17, fontWeight: '600', marginBottom: 2, color: Colors.dark.text },
  groupMeta: { fontSize: 13, color: Colors.dark.textSecondary, textTransform: 'capitalize' },
  expiryText: { fontSize: 12, fontWeight: '600', color: '#FF9500', marginTop: 4 },
  infoIcon: { fontSize: 13, color: Colors.dark.textSecondary },
  loader: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.dark.text },
  emptySubtext: { fontSize: 14, color: Colors.dark.textSecondary },
  deleteAction: {
    width: 64,
    marginLeft: 8,
    backgroundColor: '#FF453A',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionIcon: { fontSize: 18, color: '#fff' },
});
