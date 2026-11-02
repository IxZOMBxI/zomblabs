"""Generate a deterministic, dependency-free catalog; bad sidecars never stop a scan."""
import json
import pathlib
import sys
import unicodedata
from urllib.parse import quote
from id3_artist import read_artist

def matching_stem(value):
    return unicodedata.normalize('NFC', value).casefold()


SUPPORTED = {'.mp3', '.ogg', '.wav', '.m4a'}


def generate(root):
    media = root / 'media'
    entries = []
    covers = {}
    for image in sorted((media / 'artwork').rglob('*')):
        if image.is_file() and not image.is_symlink() and image.suffix.lower() == '.png':
            covers.setdefault(matching_stem(image.stem), []).append(image)

    for folder, section in [('tracks', 'music'), ('broadcasts', 'broadcasts')]:
        for path in sorted((media / folder).rglob('*')):
            if not path.is_file() or path.is_symlink() or path.suffix.lower() not in SUPPORTED:
                continue
            if path.stat().st_size == 0:
                print(f'Skipping empty audio: {path.name}', file=sys.stderr)
                continue
            metadata = {}
            sidecar = path.with_suffix(path.suffix + '.json')
            if sidecar.exists():
                try:
                    metadata = json.loads(sidecar.read_text())
                    if not isinstance(metadata, dict):
                        raise ValueError('expected an object')
                except (ValueError, OSError) as error:
                    print(f'Ignoring invalid metadata {sidecar.name}: {error}', file=sys.stderr)
                    metadata = {}
            def text(key, fallback=''):
                value = metadata.get(key)
                return value.strip() if isinstance(value, str) and value.strip() else fallback
            artwork = None
            candidate = text('artwork')
            if candidate:
                image = (media / 'artwork' / candidate).resolve()
                if image.is_relative_to((media / 'artwork').resolve()) and image.is_file() and image.suffix.lower() in {'.png', '.jpg', '.jpeg', '.webp', '.gif'}:
                    artwork = quote(image.relative_to(media).as_posix(), safe='/')
            elif 'artwork' not in metadata:
                matches = covers.get(matching_stem(path.stem), [])
                exact = [image for image in matches if image.stem == path.stem]
                chosen = exact if len(exact) == 1 else matches
                if len(chosen) == 1:
                    artwork = quote(chosen[0].relative_to(media).as_posix(), safe='/')
            order = metadata.get('order', 0)
            if type(order) not in (int, float) or not (-1e9 < order < 1e9):
                order = 0
            relative = path.relative_to(media).as_posix()
            entries.append(dict(id=relative, section=section, src=quote(relative, safe='/'),
                                title=text('title', path.stem.replace('_', ' ').replace('-', ' ')),
                                artist=text('artist', read_artist(path) or 'Unknown artist'), album=text('album'),
                                description=text('description'), artwork=artwork, order=order))
    entries.sort(key=lambda entry: (0 if entry['section'] == 'music' else 1, entry['order'], entry['title'].casefold(), entry['id']))
    return {'version': 1, 'entries': entries}


if __name__ == '__main__':
    root = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1]
    (root / 'media' / 'library.json').write_text(json.dumps(generate(root), indent=2, ensure_ascii=False) + '\n')
