import ExpoModulesCore
import Vision
import UIKit

enum ReceiptScanError: Error, CustomStringConvertible {
  case invalidImage
  case recognitionFailed(String)

  var description: String {
    switch self {
    case .invalidImage:
      return "Could not load the image at the given URI."
    case .recognitionFailed(let message):
      return "Text recognition failed: \(message)"
    }
  }
}

public class ReceiptScannerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptScanner")

    AsyncFunction("scanReceipt") { (imageUri: String) -> [String: Any] in
      guard
        let url = URL(string: imageUri),
        let data = try? Data(contentsOf: url),
        let image = UIImage(data: data),
        let cgImage = image.cgImage
      else {
        throw ReceiptScanError.invalidImage
      }

      let text = try ReceiptScannerModule.recognizeText(in: cgImage)
      let parsed = ReceiptParserBridge.parseReceiptText(text)

      return [
        "items": parsed.items.map {
          ["name": $0.name, "price": $0.price, "quantity": $0.quantity]
        },
        "subtotal": parsed.subtotal,
        "tax": parsed.tax,
        "tip": parsed.tip,
        "total": parsed.total,
      ]
    }
  }

  // Vision reports each recognized text block (e.g. an item name and its
  // price, printed in separate columns) as a *separate* observation, not
  // merged into one line -- and their y-coordinates drift slightly from
  // each other, so a plain sort-by-y interleaves and even misaligns name/
  // price pairs partway down a receipt. Instead, cluster observations
  // whose vertical position is close together into the same row, then
  // order each row left-to-right (x ascending), so "Item Name" and
  // "$X.XX" printed on the same physical line land on the same text line
  // -- which the parser requires, since it looks for a price within each
  // line it reads.
  private static func recognizeText(in cgImage: CGImage) throws -> String {
    var boxes: [(x: CGFloat, y: CGFloat, text: String)] = []
    var recognitionError: Error?

    let request = VNRecognizeTextRequest { request, error in
      if let error = error {
        recognitionError = error
        return
      }
      guard let observations = request.results as? [VNRecognizedTextObservation] else { return }
      for observation in observations {
        if let candidate = observation.topCandidates(1).first {
          boxes.append((
            x: observation.boundingBox.origin.x,
            y: observation.boundingBox.origin.y,
            text: candidate.string
          ))
        }
      }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    if let recognitionError = recognitionError {
      throw ReceiptScanError.recognitionFailed(recognitionError.localizedDescription)
    }

    let sorted = boxes.sorted { $0.y > $1.y }
    var rows: [[(x: CGFloat, y: CGFloat, text: String)]] = []
    let rowTolerance: CGFloat = 0.015

    for box in sorted {
      if let lastRow = rows.last, let anchor = lastRow.first, abs(anchor.y - box.y) < rowTolerance {
        rows[rows.count - 1].append(box)
      } else {
        rows.append([box])
      }
    }

    return rows
      .map { row in row.sorted { $0.x < $1.x }.map { $0.text }.joined(separator: " ") }
      .joined(separator: "\n")
  }
}
