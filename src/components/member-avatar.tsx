import { View, Text, StyleSheet } from 'react-native';
import { memberColor } from '@/constants/theme';
import type { GroupMember } from '@/types';

interface Props {
  member: GroupMember;
  index: number;
  size?: number;
}

export function MemberAvatar({ member, index, size = 36 }: Props) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: memberColor(index),
        },
      ]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {member.display_name[0].toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '700' },
});
