#!/usr/bin/env python3
"""Link check of the static copy in kanctovar/: every page, every href/src, the sitemaps.

Fails (exit 1) on
  * a link to the domain root (a path outside /test-zadanie/kanctovar/),
  * a link to a file or page that does not exist.

    python3 tools/check_links.py
"""
import glob
import html
import os
import re
import sys
from urllib.parse import unquote, urljoin, urlparse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kanctovar')
BASE = '/test-zadanie/kanctovar/'
SITE = 'https://stereosam.github.io'


def target_exists(path):
    rel = unquote(path[len(BASE):])
    full = os.path.join(ROOT, rel)
    return os.path.isfile(full) or os.path.isfile(os.path.join(full, 'index.html'))


def page_url(rel):
    return BASE + (rel[:-len('index.html')] if rel.endswith('index.html') else rel)


def main():
    problems, checked = [], 0
    for path in sorted(glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True)):
        rel = os.path.relpath(path, ROOT)
        with open(path, encoding='utf-8') as f:
            text = f.read()
        here = SITE + page_url(rel)
        for m in re.finditer(r'\b(?:href|src)="([^"]*)"', text):
            raw = html.unescape(m.group(1)).strip()
            if not raw or raw.startswith(('#', 'tel:', 'mailto:', 'javascript:', 'data:')):
                continue
            url = urlparse(urljoin(here, raw))
            if url.netloc and url.netloc != urlparse(SITE).netloc:
                continue                                    # external site
            checked += 1
            if not url.path.startswith(BASE):
                problems.append('%s: link to the domain root: %s' % (rel, raw))
            elif not target_exists(url.path):
                problems.append('%s: broken link: %s' % (rel, raw))
    for path in sorted(glob.glob(os.path.join(ROOT, 'sitemap*.xml'))):
        with open(path, encoding='utf-8') as f:
            for loc in re.findall(r'<loc>([^<]*)</loc>', f.read()):
                url = urlparse(html.unescape(loc))
                checked += 1
                if url.path.endswith('.xml') and os.path.isfile(os.path.join(ROOT, os.path.basename(url.path))):
                    continue
                if not url.path.startswith(BASE) or not target_exists(url.path):
                    problems.append('%s: missing page: %s' % (os.path.basename(path), loc))
    for p in problems[:50]:
        print(p)
    if len(problems) > 50:
        print('… and %d more' % (len(problems) - 50))
    print('checked %d links, %d problem(s)' % (checked, len(problems)))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
