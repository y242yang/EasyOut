#import "ReceiptParserBridge.h"
#include "receipt_parser.h"

@implementation ReceiptParserItem
@end

@implementation ReceiptParserResult
@end

@implementation ReceiptParserBridge

+ (ReceiptParserResult *)parseReceiptText:(NSString *)text {
    std::string ocrText = text ? std::string([text UTF8String]) : std::string();
    receipt_parser::Receipt r = receipt_parser::parse(ocrText);

    NSMutableArray<ReceiptParserItem *> *items = [NSMutableArray arrayWithCapacity:r.items.size()];
    for (const auto &item : r.items) {
        ReceiptParserItem *obj = [ReceiptParserItem new];
        obj.name = [NSString stringWithUTF8String:item.name.c_str()];
        obj.price = item.price;
        obj.quantity = item.quantity;
        [items addObject:obj];
    }

    ReceiptParserResult *result = [ReceiptParserResult new];
    result.items = items;
    result.subtotal = r.subtotal;
    result.tax = r.tax;
    result.tip = r.tip;
    result.total = r.total;
    return result;
}

@end
