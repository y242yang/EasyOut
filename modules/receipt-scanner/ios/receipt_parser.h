#pragma once

#include <string>
#include <vector>

namespace receipt_parser {

struct LineItem {
    std::string name;
    double price    = 0.0;
    int    quantity = 1;
};

struct Receipt {
    std::vector<LineItem> items;
    double subtotal = 0.0;  // inferred from items if not found on receipt
    double tax      = 0.0;
    double tip      = 0.0;
    double total    = 0.0;
};

// Parse raw OCR text from a receipt photo into a structured Receipt.
Receipt parse(const std::string& ocr_text);

} // namespace receipt_parser
