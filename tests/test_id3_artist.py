import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from id3_artist import read_artist
spec = importlib.util.spec_from_file_location('generator', Path(__file__).resolve().parents[1] / 'tools/generate-media.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def safe(n):
    return bytes((n >> 21 & 127, n >> 14 & 127, n >> 7 & 127, n & 127))


class ArtistTests(unittest.TestCase):
    def test_versions_encodings_and_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'media/tracks'
            folder.mkdir(parents=True)
            track = folder / 'Filename Title.mp3'
            for version in (2, 3, 4):
                for encoding, codec in ((0, 'latin-1'), (1, 'utf-16'), (2, 'utf-16-be'), (3, 'utf-8')):
                    with self.subTest(version=version, encoding=encoding):
                        body = bytes([encoding]) + 'Artiste Café'.encode(codec)
                        frame = (b'TP1' + len(body).to_bytes(3, 'big') if version == 2 else b'TPE1' + (safe(len(body)) if version == 4 else len(body).to_bytes(4, 'big')) + b'\0\0') + body
                        track.write_bytes(b'ID3' + bytes([version, 0, 0]) + safe(len(frame)) + frame)
                        self.assertEqual(read_artist(track), 'Artiste Café')
            self.assertEqual(generator.generate(root)['entries'][0]['artist'], 'Artiste Café')
            track.with_suffix('.mp3.json').write_text(json.dumps({'artist': 'Explicit Artist'}))
            entry = generator.generate(root)['entries'][0]
            self.assertEqual(entry['artist'], 'Explicit Artist')
            self.assertEqual(entry['title'], 'Filename Title')

    def test_legacy_and_malformed(self):
        with tempfile.TemporaryDirectory() as directory:
            track = Path(directory) / 'test.mp3'
            track.write_bytes(b'TAG' + b'Title'.ljust(30, b'\0') + b'Legacy Artist'.ljust(30, b'\0') + b'\0' * 65)
            self.assertEqual(read_artist(track), 'Legacy Artist')
            for data in (b'', b'ID3', b'ID3\x04\0\0\xff\xff\xff\xff', b'not an ID3 tag'):
                track.write_bytes(data)
                self.assertEqual(read_artist(track), '')


if __name__ == '__main__':
    unittest.main()
