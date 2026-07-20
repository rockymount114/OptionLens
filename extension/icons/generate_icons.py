import zlib
import struct
import os

def write_png(width, height, color, filename):
    # PNG signature
    png = bytearray([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    
    # IHDR chunk: Width, Height, Bit depth (8), Color type (6 = RGBA), Compression (0), Filter (0), Interlace (0)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    ihdr = b'IHDR' + ihdr_data
    ihdr_crc = zlib.crc32(ihdr)
    png += struct.pack(">I", len(ihdr_data)) + ihdr + struct.pack(">I", ihdr_crc)
    
    # Raw pixel data: each row starts with a filter byte (0) followed by W pixel values
    row_bytes = bytearray([0])
    for _ in range(width):
        row_bytes.extend(color)
        
    raw_data = bytearray()
    for _ in range(height):
        raw_data.extend(row_bytes)
    
    # Compress raw data into IDAT chunk
    compressed = zlib.compress(raw_data)
    idat = b'IDAT' + compressed
    idat_crc = zlib.crc32(idat)
    png += struct.pack(">I", len(compressed)) + idat + struct.pack(">I", idat_crc)
    
    # IEND chunk
    iend = b'IEND'
    iend_crc = zlib.crc32(iend)
    png += struct.pack(">I", 0) + iend + struct.pack(">I", iend_crc)
    
    dirname = os.path.dirname(filename)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
        
    with open(filename, "wb") as f:
        f.write(png)
    print(f"Created PNG: {filename} ({width}x{height})")

if __name__ == "__main__":
    # Color: RGBA (99, 102, 241, 255) -> Indigo
    color = [99, 102, 241, 255]
    write_png(16, 16, color, "icon16.png")
    write_png(48, 48, color, "icon48.png")
    write_png(128, 128, color, "icon128.png")
