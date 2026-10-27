#!/usr/bin/env python3
"""Bulk edits of the static «ОфисСклад» copy in kanctovar/.

The pages are a static snapshot: header, menus and footer are repeated in every
HTML file, so site-wide changes are made here. Every step is idempotent — the
script can be run any number of times and gives the same result.

    python3 tools/build_site.py          # apply
    python3 tools/build_site.py --check  # report what would change, exit 1 if anything
"""
import glob
import html
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kanctovar')
BASE = '/test-zadanie/kanctovar/'
SITE = 'https://stereosam.github.io'
PHONE_TEXT = '+7 (000) 000-00-00'
PHONE_HREF = 'tel:+70000000000'
VIEWPORT = '<meta content="width=device-width, initial-scale=1" name="viewport"/>'
SKIP = {'bitrix/admin/index.html'}          # stand-alone stub of the CMS login, not a shop page

# Menu items: text -> page (relative to BASE). None removes the item: there is no such page.
MENU = {
    'ГЛАВНАЯ': '',
    'КАТАЛОГ': 'catalog/',
    'БРЕНДЫ': 'brands/',
    'НОВИНКИ': 'new/',
    'КОЛЛЕКЦИИ': None,
    'Коллекции': None,
    'Новости': None,
    'ПРАЗДНИКИ': 'catalog/igry_tvorchestvo_podarki/tovary_dlya_prazdnika/',
    'Праздники': 'catalog/igry_tvorchestvo_podarki/tovary_dlya_prazdnika/',
    'АКЦИИ': 'sale/',
    'КОНТАКТЫ': 'contacts/',
    'О КОМПАНИИ': 'about/',
    'ДОСТАВКА': 'delivery/',
    'Системы скидок': 'discounts/',
    'Условия работы': 'conditions/',
    'Оплата': 'payment/',
    'Прайс-лист': 'price/',
}
# The top line shows only its first six items (demo.css); «Новинки» takes the place of «Коллекции».
TOP_MENU_SWAP = ('КОЛЛЕКЦИИ', 'НОВИНКИ')


def read(path):
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, text, changed):
    if os.path.exists(path) and read(path) == text:
        return
    changed.append(os.path.relpath(path, ROOT))
    if not CHECK:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(text)


def page_url(rel):
    """kanctovar-relative file path -> its URL path under BASE."""
    if rel.endswith('index.html'):
        rel = rel[:-len('index.html')]
    return BASE + rel


# ---------- data ----------

def new_product_ids():
    """Products that carry the «Новинка» marker on the source site."""
    ids = set()
    marker = r'<div class="markerContainer">(.*?)</div>\s*</div>'
    for path in html_files():
        text = read(path)
        for m in re.finditer(r'data-product="(\d+)"[^>]*>\s*<div class="tabloid[^"]*">\s*'
                             r'<a class="removeFromWishlist" href="#"></a>\s*' + marker, text, re.S):
            if 'Новинка' in m.group(2):
                ids.add(m.group(1))
        own = re.search(r'data-page="product:(\d+)"', text)
        m = own and re.search(r'id="browse">\s*<div class="col">\s*' + marker, text, re.S)
        if m and 'Новинка' in m.group(1):
            ids.add(own.group(1))
    return ids


def build_data(changed):
    """products.json is the source; demo.js carries the same list inline (line 1)."""
    path = os.path.join(ROOT, 'products.json')
    products = json.loads(read(path))
    fresh = new_product_ids()
    for p in products:
        if p['id'] in fresh:
            p['new'] = True
        else:
            p.pop('new', None)
    data = json.dumps(products, ensure_ascii=False)
    write(path, data, changed)
    js_path = os.path.join(ROOT, 'demo.js')
    js = read(js_path)
    first, rest = js.split('\n', 1)
    assert first.startswith('window.DEMO_PRODUCTS='), 'demo.js must start with the product list'
    eol = '\r\n' if first.endswith('\r') else '\n'
    write(js_path, 'window.DEMO_PRODUCTS=' + data + ';' + eol + rest, changed)
    return {p['id']: p for p in products}


def card_properties(text):
    """«Характеристики» of a product page: name -> value (first occurrence)."""
    props = {}
    for k, v in re.findall(r'<div class="propertyName">(.*?)</div>\s*<div class="propertyValue">(.*?)</div>', text, re.S):
        k = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', k))).strip()
        v = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', v))).strip()
        props.setdefault(k, v)
    return props


def build_index(changed, products):
    """search-index.json: everything the search needs about a product, taken from its own page."""
    items = []
    for p in sorted(products.values(), key=lambda p: int(p['id'])):
        text = read(os.path.join(ROOT, p['path'][len(BASE):]))
        props = card_properties(text)
        crumbs = re.findall(r'<span itemprop="title">([^<]*)</span>', text)
        code = props.get('Код', p['code'])
        items.append({
            'id': p['id'],
            'name': p['name'],
            'code': code,
            'codeNum': re.sub(r'^\d+-0*', '', code),             # 00-00179195 -> 179195
            'whCode': props.get('КодСклад', ''),
            'barcode': props.get('ШтрихКод', ''),
            'sku': props.get('Артикул', p.get('sku', '')),
            'brand': props.get('Производитель', ''),
            'section': p['section'],
            'sectionName': html.unescape(crumbs[-1]) if len(crumbs) > 2 else p['group'],
            'price': p['price'],
            'unit': p['unit'],
            'stock': p['stock'],
            'pop': p['pop'],
            'new': bool(p.get('new')),
            'url': p['path'],
            'image': p['image'],
        })
    write(os.path.join(ROOT, 'search-index.json'), json.dumps(items, ensure_ascii=False, indent=0) + '\n', changed)


# ---------- pages ----------

def html_files():
    for path in sorted(glob.glob(os.path.join(ROOT, '**', '*.html'), recursive=True)):
        if os.path.relpath(path, ROOT) not in SKIP:
            yield path


def make_new_page(changed, products):
    """/new/ — the list of «Новинка» products, built on the template of /sale/."""
    text = patch_page('new/index.html', read(os.path.join(ROOT, 'sale', 'index.html')), products)
    text = text.replace('<title>Акции — ОфисСклад</title>', '<title>Новинки — ОфисСклад</title>')
    text = text.replace('data-page="sale"', 'data-page="new"')
    text = text.replace('<h1>Акции</h1>', '<h1>Новинки</h1>')
    text = text.replace('<div id="demo-sale"></div>', '<div id="demo-new"></div>')
    assert 'id="demo-new"' in text and 'data-page="new"' in text, 'sale/index.html changed: update make_new_page'
    os.makedirs(os.path.join(ROOT, 'new'), exist_ok=True)
    write(os.path.join(ROOT, 'new', 'index.html'), text, changed)


def fix_menu(block, here, top=False):
    """Rewrites every <li><a>TEXT</a></li> of a menu: right target, «selected» only for the current page."""
    def item(m):
        attrs, label = m.group(1), m.group(2)
        key = label.strip()
        if top and key == TOP_MENU_SWAP[0]:
            key = label = TOP_MENU_SWAP[1]
        if key in MENU:
            target = MENU[key]
            if target is None:
                return ''
            href = BASE + target
        else:
            h = re.search(r'href="([^"]*)"', attrs)
            href = h.group(1) if h else None
            if href is None:                       # a «selected» item of the footer catalogue column
                return m.group(0)
        current = here == href or (href == BASE + 'catalog/' and here.startswith(href)) or \
            (href != BASE and href != BASE + 'catalog/' and here.startswith(href) and href.endswith('/'))
        cls = ' class="selected" aria-current="page"' if current else ''
        return '<li><a%s href="%s">%s</a></li>' % (cls, href, label)
    return re.sub(r'<li><a((?: [a-z-]+="[^"]*")*)>([^<]*)</a></li>(\r?\n)?',
                  lambda m: (lambda r: r + (m.group(3) or '') if r else '')(item(m)), block)


def fix_footer_catalog(block, here):
    """The catalogue column of the footer: one «selected» rule for all pages (exact page only)."""
    def item(m):
        attrs, label = m.group(1), m.group(2)
        h = re.search(r'href="([^"]*)"', attrs)
        href = h.group(1) if h else here                  # the source dropped href on the current section
        cls = ' class="selected" aria-current="page"' if href == here else ''
        return '<li><a%s href="%s">%s</a></li>' % (cls, href, label)
    return re.sub(r'<li><a((?: [a-z-]+="[^"]*")*)>([^<]*)</a></li>', item, block)


def patch_page(rel, text, products):
    here = page_url(rel)

    # 0.5 zoom is allowed
    text = re.sub(r'<meta[^>]*name="viewport"[^>]*/?>', VIEWPORT, text)

    # 0.3 phone numbers are links
    text = text.replace('<span class="heading">%s</span>' % PHONE_TEXT,
                        '<a class="heading" href="%s">%s</a>' % (PHONE_HREF, PHONE_TEXT))
    text = text.replace('<div class="telephone">%s</div>' % PHONE_TEXT,
                        '<div class="telephone"><a href="%s">%s</a></div>' % (PHONE_HREF, PHONE_TEXT))

    # 0.4 menus: header line, «Наши предложения» block, footer columns
    text = re.sub(r'<ul id="subMenu">.*?</ul>', lambda m: fix_menu(m.group(0), here, top=True), text, flags=re.S)
    text = re.sub(r'<ul id="subLeftMenu">.*?</ul>', lambda m: fix_menu(m.group(0), here), text, flags=re.S)

    def footer_menus(m):
        cols = re.split(r'(<span class="heading">[^<]*</span>)', m.group(0))
        out, heading = [], ''
        for part in cols:
            if part.startswith('<span class="heading">'):
                heading = part
            elif heading:
                part = re.sub(r'<ul class="footerMenu">.*?</ul>',
                              lambda u: fix_footer_catalog(u.group(0), here) if 'Каталог' in heading
                              else fix_menu(u.group(0), here), part, flags=re.S)
            out.append(part)
        return ''.join(out)
    text = re.sub(r'<div id="leftFooter">.*?<div id="rightFooter">', footer_menus, text, flags=re.S)

    # 0.4 one footer: current year (demo.js keeps it current), feedback leads to contacts
    text = re.sub(r'Copyright (?:\d{4}|<span data-year="">\d{4}</span>) ©',
                  'Copyright <span data-year="">%d</span> ©' % date.today().year, text)
    text = text.replace('<a class="callback" href="%sabout/">' % BASE, '<a class="callback" href="%scontacts/">' % BASE)

    # Header «Вход» / «Регистрация» come back to this page (the snapshot points them at the notebooks section)
    back = BASE if here.startswith(BASE + 'auth/') else here
    text = re.sub(r'(<li class="top-auth-login"><a href="%sauth/\?)backurl=[^"]*"' % BASE,
                  r'\1backurl=%s"' % back, text)
    text = re.sub(r'(<li class="top-auth-register"><a href="%sauth/\?register=yes&amp;)backurl=[^"]*"' % BASE,
                  r'\1backurl=%s"' % back, text)

    # Links to the domain root left in schema.org microdata of product pages
    text = re.sub(r'href="/catalog/', 'href="%scatalog/' % BASE, text)
    own = re.search(r'data-page="product:(\d+)"', text)
    if own and own.group(1) in products:
        text = re.sub(r'<link href="/upload/[^"]*" itemprop="image"/>',
                      '<link href="%s" itemprop="image"/>' % products[own.group(1)]['image'], text)

    # Scripts: settings before demo.js, the search modules after it (they use what demo.js exposes)
    scripts = ''.join('<script defer="True" src="%s%s"></script>' % (BASE, name)
                      for name in ('js/config.js', 'demo.js', 'js/search.js', 'js/search-ui.js'))
    text = re.sub(r'(?:<script defer="True" src="%s[^"]*"></script>)+' % re.escape(BASE), scripts, text)
    # The search index and the abbreviation list are JSON files of this site, read with fetch()
    text = text.replace("connect-src 'none'", "connect-src 'self'")
    return text


def fix_sitemap(changed):
    """Sitemaps list only pages that exist; /new/ is added. A sitemap left empty is dropped from the index."""
    def exists(m):
        rel = m.group(1).replace(SITE + BASE, '')
        target = os.path.join(ROOT, rel)
        ok = os.path.isfile(target) or os.path.isfile(os.path.join(target, 'index.html'))
        return m.group(0) if ok else ''

    empty = []
    for path in sorted(glob.glob(os.path.join(ROOT, 'sitemap-*.xml'))):
        text = re.sub(r'<url><loc>([^<]*)</loc>.*?</url>(?:\r?\n)?', exists, read(path))
        if os.path.basename(path) == 'sitemap-files.xml' and SITE + BASE + 'new/' not in text:
            stamp = re.search(r'<lastmod>([^<]*)</lastmod>', text).group(1)
            eol = '\r\n' if '\r\n' in text else '\n'
            text = text.replace('</urlset>', '<url><loc>%snew/</loc><lastmod>%s</lastmod></url>%s</urlset>'
                                % (SITE + BASE, stamp, eol))
        if '<url>' in text:
            write(path, text, changed)
        else:
            empty.append(os.path.basename(path))
            changed.append(os.path.relpath(path, ROOT) + ' (removed: no existing pages)')
            if not CHECK:
                os.remove(path)
    index = os.path.join(ROOT, 'sitemap.xml')
    text = read(index)
    for name in empty:
        text = re.sub(r'<sitemap><loc>%s</loc>.*?</sitemap>(?:\r?\n)?' % re.escape(SITE + BASE + name), '', text)
    write(index, text, changed)


def main():
    changed = []
    products = build_data(changed)
    build_index(changed, products)
    make_new_page(changed, products)
    for path in html_files():
        rel = os.path.relpath(path, ROOT)
        text = read(path)
        write(path, patch_page(rel, text, products), changed)
    fix_sitemap(changed)
    verb = 'would change' if CHECK else 'changed'
    print('%s %d file(s)' % (verb, len(changed)))
    for rel in changed[:20]:
        print('  ' + rel)
    if len(changed) > 20:
        print('  …')
    return 1 if CHECK and changed else 0


CHECK = '--check' in sys.argv
if __name__ == '__main__':
    sys.exit(main())
