import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/theme';

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Spinner mode gives separate hour / minute / AM-PM wheels natively -- the
// simplest, least error-prone way to satisfy "type a number then AM or PM"
// without hand-rolling text parsing for something this fiddly to get right.
export function TimeField({ value, onChange }: { value: Date; onChange: (v: Date) => void }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);

  function openPicker() {
    setTemp(value);
    setOpen(true);
  }

  return (
    <>
      <TouchableOpacity style={styles.input} onPress={openPicker}>
        <Text style={styles.valueText}>{formatTime(value)}</Text>
      </TouchableOpacity>

      {Platform.OS === 'android' ? (
        open && (
          <DateTimePicker
            value={temp}
            mode="time"
            display="default"
            onChange={(event, d) => {
              setOpen(false);
              if (event.type === 'set' && d) onChange(d);
            }}
          />
        )
      ) : (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
              <DateTimePicker
                value={temp}
                mode="time"
                display="spinner"
                onChange={(_, d) => { if (d) setTemp(d); }}
                themeVariant="dark"
                style={styles.picker}
              />
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => { onChange(temp); setOpen(false); }}>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.dark.backgroundElement,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  doneBtn: {
    marginTop: 12,
    backgroundColor: Colors.dark.tint,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  picker: { width: '100%', height: 216 },
});
