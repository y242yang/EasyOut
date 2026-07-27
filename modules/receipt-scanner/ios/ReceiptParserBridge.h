#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ReceiptParserItem : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic) double price;
@property (nonatomic) NSInteger quantity;
@end

@interface ReceiptParserResult : NSObject
@property (nonatomic, copy) NSArray<ReceiptParserItem *> *items;
@property (nonatomic) double subtotal;
@property (nonatomic) double tax;
@property (nonatomic) double tip;
@property (nonatomic) double total;
@end

// Objective-C++ wrapper around the easyout-receipt-parser C++ library so its
// classes are visible to Swift within the same CocoaPods framework target
// (Swift can't import C++ directly, and bridging headers aren't supported
// for framework/module targets -- this is exposed as a public header instead).
@interface ReceiptParserBridge : NSObject
+ (ReceiptParserResult *)parseReceiptText:(NSString *)text;
@end

NS_ASSUME_NONNULL_END
