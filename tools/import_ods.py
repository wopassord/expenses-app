#!/usr/bin/env python3
"""Import the original expenses spreadsheet (.ods) into the Ledger data layout.

    python3 tools/import_ods.py Ejemplo.ods data/ --year 2026

Writes data/transactions/YYYY-MM.json (one file per month). Existing month
files are overwritten, so run it once, before entering data in the app.
No third-party dependencies: an .ods file is a zip with a content.xml inside.
"""
import argparse
import json
import re
import unicodedata
import uuid
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {
    'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
    'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
}
T = '{%s}' % NS['table']
O = '{%s}' % NS['office']


def key(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z]', '', s.lower())


CATEGORY = {
    'sorties': 'going_out', 'miscellanee': 'misc', 'cosmetique': 'personal_care',
    'loyer': 'rent', 'supermarche': 'groceries', 'vetements': 'clothing',
    'repastme': 'canteen', 'grignoter': 'snacks', 'demarches': 'admin',
    'sante': 'health', 'voyages': 'travel', 'abonnements': 'subscriptions',
}
SOURCE = {'epargne': 'savings', 'cc': 'parents_cc', 'salaire': 'salary'}
DELIVERY = re.compile(r'uber\s*eats|deliveroo|takeaway|just\s*eat|delivery', re.I)


def read_rows(path):
    root = ET.fromstring(zipfile.ZipFile(path).read('content.xml'))
    table = next(root.iter(T + 'table'))
    for row in table.iter(T + 'table-row'):
        cells = []
        for c in row:
            rep = min(int(c.get(T + 'number-columns-repeated', '1')), 20)
            text = ' '.join(''.join(p.itertext()) for p in c.findall('text:p', NS)).strip()
            cells += [(text, c.get(O + 'value'))] * rep
        yield cells


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('ods')
    ap.add_argument('out')
    ap.add_argument('--year', type=int, default=datetime.now().year)
    args = ap.parse_args()

    raw = []
    for cells in read_rows(args.ods):
        if len(cells) < 6 or key(cells[0][0]) not in ('sortie', 'entree'):
            continue
        (mov, _), (date, _), (src, _), (_, amount), (desc, _), (cat, _) = cells[:6]
        d, m = date.split('/')[:2]
        raw.append({
            'mov': key(mov), 'date': f'{args.year}-{int(m):02d}-{int(d):02d}',
            'source': key(src), 'amount': round(float(amount), 2), 'description': desc, 'category': key(cat),
        })

    # Category used by expenses with the same description (to file refunds correctly).
    expense_cat = {key(r['description']): CATEGORY.get(r['category']) for r in raw if r['mov'] == 'sortie'}

    base = datetime.now(timezone.utc)
    by_month = defaultdict(list)
    for i, r in enumerate(raw):
        tx = {'id': str(uuid.uuid4()), 'date': r['date'], 'amount': r['amount'], 'description': r['description']}
        if r['mov'] == 'sortie':
            category = CATEGORY.get(r['category'], 'misc')
            if category == 'snacks' and DELIVERY.search(r['description']):
                category = 'delivery'
            tx.update(type='expense', category=category, source=SOURCE.get(r['source'], 'salary'))
        elif 'salaire' in key(r['description']) or 'salary' in key(r['description']):
            tx.update(type='income', category='salary', source='salary')
        else:
            tx.update(type='refund', category=expense_cat.get(key(r['description'])) or 'misc',
                      source=SOURCE.get(r['source'], 'savings'))
        stamp = (base + timedelta(milliseconds=i)).isoformat().replace('+00:00', 'Z')
        tx.update(createdAt=stamp, updatedAt=stamp)
        by_month[r['date'][:7]].append(tx)

    out = Path(args.out) / 'transactions'
    out.mkdir(parents=True, exist_ok=True)
    for month, txs in sorted(by_month.items()):
        txs.sort(key=lambda t: (t['date'], t['createdAt']))
        (out / f'{month}.json').write_text(json.dumps({'version': 1, 'transactions': txs}, indent=2, ensure_ascii=False) + '\n')
        print(f'{month}: {len(txs)} transactions')


if __name__ == '__main__':
    main()
