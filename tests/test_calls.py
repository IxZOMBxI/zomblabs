import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
spec = importlib.util.spec_from_file_location('generator', Path(__file__).resolve().parents[1] / 'tools/generate-media.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class CallCatalogTests(unittest.TestCase):
    def test_welcome_attempt_rules_survive_regeneration(self):
        root = Path(__file__).resolve().parents[1]
        metadata = json.loads((root / 'media/calls/Welcome to ZOMB LABS.mp3.json').read_text(encoding='utf-8'))
        generated = generator.generate(root)
        committed = json.loads((root / 'media/library.json').read_text(encoding='utf-8'))
        for catalog in [generated, committed]:
            call = next(entry for entry in catalog['entries'] if entry.get('callId') == metadata['callId'])
            self.assertEqual(call['delivery'], metadata['delivery'])
            self.assertEqual(call['delivery']['delaySeconds'], 10)
            self.assertEqual(call['delivery']['onAttempt'], 'consume')
            self.assertEqual(call['delivery']['unlockOn'], ['ringing'])

    def test_call_metadata_artwork_encoding_and_radio_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for folder in ['calls', 'artwork', 'tracks', 'broadcasts']:
                (root / 'media' / folder).mkdir(parents=True)
            name = 'Café & 50% Test'
            call = root / 'media/calls' / (name + '.mp3')
            call.write_bytes(b'test-only fixture')
            (root / 'media/artwork' / (name.upper() + '.png')).write_bytes(b'test-only fixture')
            (root / 'media/tracks/song.mp3').write_bytes(b'test-only fixture')
            (root / 'media/broadcasts/ad.mp3').write_bytes(b'test-only fixture')
            metadata = {'callId': 'stable-test-id', 'caller': 'Test caller', 'extension': '42', 'title': 'Test title', 'delivery': {'event': 'app.open:radio', 'once': True}}
            call.with_suffix('.mp3.json').write_text(json.dumps(metadata), encoding='utf-8')
            catalog = generator.generate(root)
            self.assertEqual([entry['section'] for entry in catalog['entries']], ['music', 'broadcasts', 'calls'])
            entry = catalog['entries'][-1]
            for key in metadata:
                self.assertEqual(entry[key], metadata[key])
            self.assertIn('Caf%C3%A9%20%26%2050%25%20Test.mp3', entry['src'])
            self.assertTrue(entry['artwork'].endswith('.png'))
            metadata['artwork'] = None
            call.with_suffix('.mp3.json').write_text(json.dumps(metadata), encoding='utf-8')
            self.assertIsNone(generator.generate(root)['entries'][-1]['artwork'])
            call.with_suffix('.mp3.json').write_text('{invalid', encoding='utf-8')
            self.assertIsNone(generator.generate(root)['entries'][-1]['delivery'])

    def test_no_calls_is_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(generator.generate(Path(directory))['entries'], [])


if __name__ == '__main__':
    unittest.main()
