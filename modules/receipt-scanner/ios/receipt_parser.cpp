#include "receipt_parser.h"

#include <algorithm>
#include <cctype>
#include <numeric>
#include <regex>
#include <sstream>

namespace receipt_parser {

// ── String helpers ────────────────────────────────────────────────────────────

static std::string trim(const std::string& s) {
    auto start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return {};
    auto end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

static std::string to_lower(const std::string& s) {
    std::string r = s;
    std::transform(r.begin(), r.end(), r.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    return r;
}

// ── Price extraction ──────────────────────────────────────────────────────────

// Requires exactly 2 decimal places to avoid matching years, table numbers, etc.
static const std::regex PRICE_RE(R"(\$?\s*(-?\d{1,3}(?:,\d{3})*\.\d{1,2}))");

static double extract_last_price(const std::string& line) {
    double last = -1.0;
    auto it = line.cbegin();
    std::smatch m;
    while (std::regex_search(it, line.cend(), m, PRICE_RE)) {
        std::string num = m[1].str();
        num.erase(std::remove(num.begin(), num.end(), ','), num.end());
        try { last = std::stod(num); } catch (...) {}
        it = m.suffix().first;
    }
    return last;
}

// ── Line classification ───────────────────────────────────────────────────────

enum class FieldType { ITEM, SUBTOTAL, TAX, TIP, TOTAL };

static FieldType classify(const std::string& lower) {
    // Subtotal must be checked before total (it contains "total" as substring)
    if (lower.find("subtotal")  != std::string::npos ||
        lower.find("sub total") != std::string::npos ||
        lower.find("sub-total") != std::string::npos)
        return FieldType::SUBTOTAL;

    if (lower.find("tax") != std::string::npos ||
        lower.find("hst") != std::string::npos ||
        lower.find("gst") != std::string::npos ||
        lower.find("vat") != std::string::npos)
        return FieldType::TAX;

    if (lower.find("tip")            != std::string::npos ||
        lower.find("gratuity")       != std::string::npos ||
        lower.find("service charge") != std::string::npos ||
        lower.find("fee")            != std::string::npos)
        return FieldType::TIP;

    if (lower.find("total")       != std::string::npos ||
        lower.find("amount due")  != std::string::npos ||
        lower.find("balance due") != std::string::npos)
        return FieldType::TOTAL;

    return FieldType::ITEM;
}

// ── Item name / quantity extraction ──────────────────────────────────────────

static const std::regex TRAILING_PRICE_RE(R"(\s*\$?\s*-?\d{1,3}(?:,\d{3})*\.\d{1,2}\s*$)");
static const std::regex QUANTITY_PREFIX_RE(R"(^(\d+)\s*[xX@]?\s+)");

static std::string extract_name(const std::string& line) {
    std::string name = std::regex_replace(line, TRAILING_PRICE_RE, "");
    name = std::regex_replace(name, QUANTITY_PREFIX_RE, "");
    return trim(name);
}

static int extract_quantity(const std::string& line) {
    std::smatch m;
    if (std::regex_search(line, m, QUANTITY_PREFIX_RE)) {
        try { return std::stoi(m[1].str()); } catch (...) {}
    }
    return 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

Receipt parse(const std::string& ocr_text) {
    Receipt receipt;

    std::istringstream stream(ocr_text);
    std::string line;

    while (std::getline(stream, line)) {
        line = trim(line);
        if (line.empty()) continue;

        double price = extract_last_price(line);
        if (price < 0.0) continue; // no valid price on this line

        switch (classify(to_lower(line))) {
            case FieldType::SUBTOTAL:
                receipt.subtotal = price;
                break;
            case FieldType::TAX:
                receipt.tax = price;
                break;
            case FieldType::TIP:
                receipt.tip = price;
                break;
            case FieldType::TOTAL:
                // Keep the largest total seen (handles duplicate/intermediate total lines)
                if (price > receipt.total) receipt.total = price;
                break;
            case FieldType::ITEM: {
                std::string name = extract_name(line);
                if (name.empty()) break; // skip price-only lines (e.g. barcodes)
                receipt.items.push_back({name, price, extract_quantity(line)});
                break;
            }
        }
    }

    // Infer subtotal from line items when the receipt doesn't print one
    if (receipt.subtotal <= 0.0 && !receipt.items.empty()) {
        receipt.subtotal = std::accumulate(
            receipt.items.begin(), receipt.items.end(), 0.0,
            [](double sum, const LineItem& item) { return sum + item.price; });
    }

    return receipt;
}

} // namespace receipt_parser
