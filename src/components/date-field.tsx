import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/theme';

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromISODate(s: string) {
  if (!s) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  // ISO date string (e.g. a hotel's check-in) that this field can't precede.
  minimumDate?: string;
}) {
  const [open, setOpen] = useState(false);
  const min = minimumDate ? fromISODate(minimumDate) : undefined;

  function initialValue() {
    const current = fromISODate(value);
    return min && current < min ? min : current;
  }

  const [temp, setTemp] = useState(initialValue);

  function openPicker() {
    setTemp(initialValue());
    setOpen(true);
  }

  return (
    <>
      <TouchableOpacity style={styles.input} onPress={openPicker}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value || placeholder}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' ? (
        open && (
          <DateTimePicker
            value={temp}
            mode="date"
            display="default"
            minimumDate={min}
            onChange={(event, d) => {
              setOpen(false);
              if (event.type === 'set' && d) onChange(toISODate(d));
            }}
          />
        )
      ) : (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={temp}
                mode="date"
                display="inline"
                minimumDate={min}
                onChange={(_, d) => { if (d) setTemp(d); }}
                themeVariant="dark"
                accentColor={Colors.dark.tint}
                style={styles.picker}
              />
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => { onChange(toISODate(temp)); setOpen(false); }}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
  valueText: { color: Colors.dark.text, fontSize: 16 },
  placeholderText: { color: Colors.dark.textSecondary, fontSize: 16 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.dark.backgroundElement,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  picker: { width: '100%', height: 360 },
  doneBtn: {
    marginTop: 12,
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
