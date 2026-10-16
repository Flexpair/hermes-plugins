import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('changed_plugins', Path(__file__).with_name('changed_plugins.py'))
assert spec is not None and spec.loader is not None
selector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(selector)


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.invalid')
        self.git('config', 'user.name', 'Test')
        for name, manifest in [('accent-picker', 'plugin.yaml'), ('flexpair-color-palette', 'plugin.yaml'), ('other', 'plugin.json')]:
            self.write(name + '/' + manifest)
            self.write(name + '/source.txt')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root).decode().strip()

    def write(self, path, text='test'):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def select(self, head, event='pull_request', base=None):
        base = base or self.base
        payload = {'pull_request': {'base': {'sha': base}, 'head': {'sha': head}}} if event == 'pull_request' else {'before': base, 'after': head}
        return selector.select_plugins(self.root, event, payload)

    def test_only_changed_plugin_for_pr_and_push(self):
        self.write('flexpair-color-palette/source.txt', 'modified')
        head = self.commit()
        for event in ('pull_request', 'push'):
            self.assertEqual(self.select(head, event), ['flexpair-color-palette'])

    def test_docs_and_workflow_changes_select_none(self):
        self.write('README.md')
        self.write('.github/workflows/tests.yml')
        self.assertEqual(self.select(self.commit()), [])

    def test_added_and_removed_plugins(self):
        self.write('new/plugin.yaml')
        self.git('rm', '-qr', 'other')
        self.assertEqual(self.select(self.commit()), ['new'])

    def test_rename_selects_both_existing_plugins(self):
        self.git('mv', 'accent-picker/source.txt', 'other/moved.txt')
        self.assertEqual(self.select(self.commit()), ['accent-picker', 'other'])

    def test_pr_ignores_unrelated_base_branch_changes(self):
        self.git('checkout', '-qb', 'feature')
        self.write('flexpair-color-palette/source.txt', 'feature')
        head = self.commit()
        self.git('checkout', '-qb', 'base-tip', self.base)
        self.write('other/source.txt', 'base change')
        base = self.commit()
        self.git('checkout', '-q', 'feature')
        self.assertEqual(self.select(head, base=base), ['flexpair-color-palette'])

    def test_full_runs_and_initial_push(self):
        expected = ['accent-picker', 'flexpair-color-palette', 'other']
        for event in ('schedule', 'workflow_dispatch'):
            self.assertEqual(selector.select_plugins(self.root, event, {}), expected)
        self.assertEqual(self.select(self.base, 'push', '0' * 40), expected)

    def test_invalid_revision_fails_closed(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.select('f' * 40)

    def test_unknown_event_fails_closed(self):
        with self.assertRaises(ValueError):
            selector.select_plugins(self.root, 'unknown', {})


if __name__ == '__main__':
    unittest.main()
