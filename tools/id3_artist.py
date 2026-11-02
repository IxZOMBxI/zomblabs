"""Bounded, best-effort ID3 artist reader (v1 and v2.2/2.3/2.4), no dependencies."""
def synchsafe(data):
    if len(data) != 4 or any(value & 128 for value in data):
        raise ValueError('Invalid synchsafe integer')
    return sum(value << shift for value, shift in zip(data, (21, 14, 7, 0)))


def decode_text(data):
    codecs = {0: 'latin-1', 1: 'utf-16', 2: 'utf-16-be', 3: 'utf-8'}
    if not data or data[0] not in codecs:
        return ''
    return data[1:].decode(codecs[data[0]], errors='replace').strip('\x00 \t\r\n').replace('\x00', ' / ')


def read_artist(path):
    if path.suffix.lower() != '.mp3':
        return ''
    try:
        with path.open('rb') as stream:
            header = stream.read(10)
            if header[:3] == b'ID3' and header[3] in (2, 3, 4):
                version, flags = header[3], header[5]
                size = synchsafe(header[6:10])
                if size <= 8 * 1024 * 1024 and not (version == 2 and flags & 64):
                    data = stream.read(size)
                    if flags & 128 and version < 4:
                        data = data.replace(b'\xff\x00', b'\xff')
                    offset = 0
                    if flags & 64 and version in (3, 4):
                        offset = int.from_bytes(data[:4], 'big') + 4 if version == 3 else synchsafe(data[:4])
                    frame_header = 6 if version == 2 else 10
                    while offset + frame_header <= len(data):
                        frame = data[offset:offset + frame_header]
                        name = frame[:3] if version == 2 else frame[:4]
                        length = int.from_bytes(frame[3:6], 'big') if version == 2 else synchsafe(frame[4:8]) if version == 4 else int.from_bytes(frame[4:8], 'big')
                        offset += frame_header
                        if not length or offset + length > len(data):
                            break
                        body = data[offset:offset + length]
                        offset += length
                        if name not in (b'TPE1', b'TP1'):
                            continue
                        if version == 3 and frame[9] & 224 or version == 4 and frame[9] & 77:
                            continue  # Compressed/encrypted/grouped frames are not decoded.
                        if version == 4 and (flags & 128 or frame[9] & 2):
                            body = body.replace(b'\xff\x00', b'\xff')
                        artist = decode_text(body)
                        if artist:
                            return artist
            stream.seek(0, 2)
            if stream.tell() >= 128:
                stream.seek(-128, 2)
                tag = stream.read(128)
                if tag[:3] == b'TAG':
                    return tag[33:63].decode('latin-1').strip('\x00 ')
    except (OSError, ValueError, IndexError):
        pass
    return ''
