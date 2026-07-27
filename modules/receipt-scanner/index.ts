import { requireNativeModule } from 'expo-modules-core';

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
}

export interface ParsedReceipt {
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}

interface ReceiptScannerNativeModule {
  scanReceipt(imageUri: string): Promise<ParsedReceipt>;
}

const ReceiptScannerModule = requireNativeModule<ReceiptScannerNativeModule>('ReceiptScanner');

export function scanReceipt(imageUri: string): Promise<ParsedReceipt> {
  return ReceiptScannerModule.scanReceipt(imageUri);
}
