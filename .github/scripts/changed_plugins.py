"""Select current plugin directories affected by a PR or push."""
import argparse
import json
from pathlib import Path
import subprocess


def select_plugins(root, event_name, event):
    plugins = sorted(
        path.name for path in root.iterdir()
        if path.is_dir() and any((path / name).is_file() for name in ('plugin.yaml', 'plugin.json'))
    )
    if event_name in ('schedule', 'workflow_dispatch'):
        return plugins
    if event_name == 'pull_request':
        pr = event['pull_request']
        revision = pr['base']['sha'] + '...' + pr['head']['sha']
    elif event_name == 'push':
        before = event['before']
        if before == '0' * 40:
            return plugins
        revision = before + '..' + event['after']
    else:
        raise ValueError('Unsupported event: ' + event_name)
    # Disable rename detection so moves select both the old and new plugin.
    result = subprocess.run(
        ['git', 'diff', '--name-only', '--no-renames', '-z', revision, '--'],
        cwd=root, check=True, stdout=subprocess.PIPE,
    )
    changed = {path.split(b'/', 1)[0].decode('utf-8') for path in result.stdout.split(b'\0') if path}
    return [plugin for plugin in plugins if plugin in changed]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--event-name', required=True)
    parser.add_argument('--event-path', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    plugins = select_plugins(Path.cwd(), args.event_name, json.loads(args.event_path.read_text()))
    with args.output.open('a') as output:
        output.write('plugins=' + json.dumps(plugins) + '\n')
        output.write('has_plugins=' + str(bool(plugins)).lower() + '\n')
        output.write('flexpair_changed=' + str('flexpair-color-palette' in plugins).lower() + '\n')
    print('Selected plugins:', json.dumps(plugins))


if __name__ == '__main__':
    main()
