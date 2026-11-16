import sharp from "sharp";

export interface IcoEntryInfo {
  width: number;
  height: number;
  byteLength: number;
  offset: number;
}

export async function createMultiSizeIco(
  sourcePng: Buffer,
  sizes: number[] = [16, 32, 48]
): Promise<Buffer> {
  const pngBuffers: { size: number; buf: Buffer }[] = [];

  for (const size of sizes) {
    const buf = await sharp(sourcePng)
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const totalHeaderSize = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(totalHeaderSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(count, 4); // Number of images

  let currentOffset = totalHeaderSize;
  pngBuffers.forEach(({ size, buf }, idx) => {
    const entryOffset = headerSize + idx * dirEntrySize;
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 0); // Width
    header.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1); // Height
    header.writeUInt8(0, entryOffset + 2); // Color palette
    header.writeUInt8(0, entryOffset + 3); // Reserved
    header.writeUInt16LE(1, entryOffset + 4); // Color planes
    header.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    header.writeUInt32LE(buf.length, entryOffset + 8); // Image byte size
    header.writeUInt32LE(currentOffset, entryOffset + 12); // Offset in file
    currentOffset += buf.length;
  });

  return Buffer.concat([header, ...pngBuffers.map((p) => p.buf)]);
}

export function parseIcoSizes(icoBuffer: Buffer): IcoEntryInfo[] {
  if (icoBuffer.length < 6) {
    throw new Error("Ficheiro ICO demasiado curto");
  }
  const reserved = icoBuffer.readUInt16LE(0);
  const type = icoBuffer.readUInt16LE(2);
  const count = icoBuffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1 || count < 1) {
    throw new Error("Cabeçalho ICO inválido");
  }

  const entries: IcoEntryInfo[] = [];
  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    const wByte = icoBuffer.readUInt8(base + 0);
    const hByte = icoBuffer.readUInt8(base + 1);
    const byteLength = icoBuffer.readUInt32LE(base + 8);
    const offset = icoBuffer.readUInt32LE(base + 12);
    entries.push({
      width: wByte === 0 ? 256 : wByte,
      height: hByte === 0 ? 256 : hByte,
      byteLength,
      offset,
    });
  }
  return entries;
}
