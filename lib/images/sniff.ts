export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp";

export type ImageSignature =
  | { ok: true; type: SniffedImageType; width: number; height: number }
  | { ok: false; reason: "unsupported" | "malformed" };

const SOF_MARKERS = new Set<number>([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readU16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32BE(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readU16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32LE(bytes: Uint8Array, offset: number) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string) {
  if (offset < 0 || offset + text.length > bytes.length) {
    return false;
  }
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) {
      return false;
    }
  }
  return true;
}

function fourcc(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );
}

function looksLikeJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function looksLikePng(bytes: Uint8Array) {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function looksLikeWebp(bytes: Uint8Array) {
  return bytes.length >= 12 && matchesAscii(bytes, 0, "RIFF") && matchesAscii(bytes, 8, "WEBP");
}

function skipJpegEntropy(bytes: Uint8Array, offset: number) {
  let index = offset;
  while (index < bytes.length) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    let marker = index + 1;
    while (marker < bytes.length && bytes[marker] === 0xff) {
      marker += 1;
    }
    if (marker >= bytes.length) {
      return -1;
    }
    if (bytes[marker] === 0x00) {
      index = marker + 1;
      continue;
    }
    return index;
  }
  return -1;
}

function parseJpeg(bytes: Uint8Array): ImageSignature | null {
  let offset = 2;
  let width = 0;
  let height = 0;
  let frames = 0;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return null;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= bytes.length) {
      return null;
    }
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9) {
      if (frames !== 1 || width < 1 || height < 1 || offset !== bytes.length) {
        return null;
      }
      return { ok: true, type: "image/jpeg", width, height };
    }

    if (marker === 0x00 || marker === 0xd8) {
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= bytes.length) {
      return null;
    }
    const segmentLength = readU16BE(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }
      const precision = bytes[offset + 2];
      if (precision !== 8 && precision !== 12) {
        return null;
      }
      height = readU16BE(bytes, offset + 3);
      width = readU16BE(bytes, offset + 5);
      if (width < 1 || height < 1) {
        return null;
      }
      frames += 1;
    }

    if (marker === 0xda) {
      const scan = skipJpegEntropy(bytes, offset + segmentLength);
      if (scan < 0) {
        return null;
      }
      offset = scan;
      continue;
    }

    offset += segmentLength;
  }

  return null;
}

function parsePng(bytes: Uint8Array): ImageSignature | null {
  let offset = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;

  while (offset + 12 <= bytes.length) {
    const length = readU32BE(bytes, offset);
    const type = fourcc(bytes, offset + 4);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      return null;
    }
    const next = offset + 8 + length + 4;
    if (length > bytes.length || next > bytes.length) {
      return null;
    }

    if (!sawHeader) {
      if (type !== "IHDR" || length !== 13) {
        return null;
      }
      width = readU32BE(bytes, offset + 8);
      height = readU32BE(bytes, offset + 12);
      if (width < 1 || height < 1) {
        return null;
      }
      sawHeader = true;
    } else if (type === "IHDR") {
      return null;
    } else if (type === "IDAT") {
      if (length < 1) {
        return null;
      }
      sawData = true;
    } else if (type === "IEND") {
      if (!sawData || length !== 0 || next !== bytes.length) {
        return null;
      }
      return { ok: true, type: "image/png", width, height };
    }

    offset = next;
  }

  return null;
}

function webpSize(id: string, bytes: Uint8Array, data: number, size: number) {
  if (id === "VP8 ") {
    if (size < 10 || data + 9 >= bytes.length) {
      return null;
    }
    if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
      return null;
    }
    const width = readU16LE(bytes, data + 6) & 0x3fff;
    const height = readU16LE(bytes, data + 8) & 0x3fff;
    if (width < 1 || height < 1) {
      return null;
    }
    return { width, height };
  }

  if (id === "VP8L") {
    if (size < 5 || bytes[data] !== 0x2f) {
      return null;
    }
    const bits = readU32LE(bytes, data + 1);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    if (width < 1 || height < 1) {
      return null;
    }
    return { width, height };
  }

  if (id === "VP8X") {
    if (size < 10 || data + 9 >= bytes.length) {
      return null;
    }
    const width = 1 + (bytes[data + 4] | (bytes[data + 5] << 8) | (bytes[data + 6] << 16));
    const height = 1 + (bytes[data + 7] | (bytes[data + 8] << 8) | (bytes[data + 9] << 16));
    if (width < 1 || height < 1) {
      return null;
    }
    return { width, height };
  }

  return null;
}

function parseWebp(bytes: Uint8Array): ImageSignature | null {
  const riffSize = readU32LE(bytes, 4);
  if (riffSize < 4 || riffSize + 8 !== bytes.length) {
    return null;
  }

  const end = 8 + riffSize;
  let offset = 12;
  let width = 0;
  let height = 0;
  let sawImage = false;

  while (offset + 8 <= end) {
    const id = fourcc(bytes, offset);
    const size = readU32LE(bytes, offset + 4);
    const data = offset + 8;
    if (size > end - data) {
      return null;
    }
    if (!sawImage) {
      const dimensions = webpSize(id, bytes, data, size);
      if (!dimensions) {
        return null;
      }
      width = dimensions.width;
      height = dimensions.height;
      sawImage = true;
    }
    const padded = size + (size % 2);
    const next = data + padded;
    if (next > end) {
      return null;
    }
    offset = next;
  }

  if (!sawImage || offset !== end) {
    return null;
  }
  return { ok: true, type: "image/webp", width, height };
}

/** Full container signature. Trailing bytes after EOI, IEND, or the RIFF payload are rejected. */
export function inspectImage(bytes: Uint8Array): ImageSignature {
  if (looksLikeJpeg(bytes)) {
    return parseJpeg(bytes) ?? { ok: false, reason: "malformed" };
  }
  if (looksLikePng(bytes)) {
    return parsePng(bytes) ?? { ok: false, reason: "malformed" };
  }
  if (looksLikeWebp(bytes)) {
    return parseWebp(bytes) ?? { ok: false, reason: "malformed" };
  }
  return { ok: false, reason: "unsupported" };
}

export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  const inspected = inspectImage(bytes);
  return inspected.ok ? inspected.type : null;
}

export function extensionForImageType(type: SniffedImageType) {
  if (type === "image/png") {
    return "png";
  }
  if (type === "image/webp") {
    return "webp";
  }
  return "jpg";
}
