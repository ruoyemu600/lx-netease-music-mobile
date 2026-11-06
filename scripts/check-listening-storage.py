"""Run production SQL strings in SQLite, not an Android instrumentation test."""
from pathlib import Path
import re, sqlite3, tempfile

root = Path(__file__).resolve().parent.parent
source = (root / 'android/listening-stats/ListeningStatsStore.java').read_text()
commands = re.findall(r'db\.execSQL\("([^"]+)"', source)
queries = re.findall(r'db\.rawQuery\("([^"]+)"', source)
create = [sql for sql in commands if sql.startswith('CREATE ')]
meta = next(sql for sql in commands if sql.startswith('INSERT OR IGNORE INTO meta'))
insert = next(sql for sql in commands if sql.startswith('INSERT OR IGNORE INTO tracks'))
update = next(sql for sql in commands if sql.startswith('UPDATE tracks'))
summary = next(sql for sql in queries if 'SUM(listenedMs)' in sql)
page = next(sql for sql in queries if 'ORDER BY listenedMs' in sql)
started = next(sql for sql in queries if 'FROM meta' in sql)

with tempfile.TemporaryDirectory(prefix='listening-sql-test-') as folder:
    file = Path(folder) / 'stats.db'
    db = sqlite3.connect(file)
    for sql in create:
        db.execute(sql)
    db.execute(meta, (1000,))
    db.commit()
    assert db.execute(summary).fetchone() == (0, 0)
    assert db.execute(started).fetchone() == (1000,)

    def accrue(key, milliseconds, last, name='Song'):
        db.execute(insert, (key, key, 'wy', name, 'Singer', None))
        db.execute(update, (key, 'wy', name, 'Singer', None, milliseconds, last, key))

    with db:
        accrue('a', 1001, 2000)
        accrue('a', 2002, 3000)
        accrue('b', 3003, 3000)
    assert db.execute(summary).fetchone() == (6006, 2)
    rows = db.execute(page, ('1', '0')).fetchall()
    assert rows[0][0] == 'a' and rows[0][6] == 3003
    assert db.execute(page, ('1', '1')).fetchone()[0] == 'b'
    assert not db.execute(page, ('1', '999')).fetchall()
    print('PASS production schema, millisecond increments, sum/count and stable pagination')

    try:
        with db:
            accrue('a', 500, 5000)
            db.execute('INSERT INTO tracks(key) VALUES(NULL)')
    except sqlite3.IntegrityError:
        pass
    assert db.execute(summary).fetchone() == (6006, 2)
    with db:
        accrue('a', 500, 2500, 'Updated title')
    assert db.execute(summary).fetchone() == (6506, 2)
    record = db.execute('SELECT name,lastPlayedAt FROM tracks WHERE key=?', ('a',)).fetchone()
    assert record == ('Updated title', 3000)
    db.execute(meta, (9999,))
    db.commit()
    assert db.execute(started).fetchone() == (1000,)
    db.close()
    db = sqlite3.connect(file)
    assert db.execute(summary).fetchone() == (6506, 2)
    assert db.execute(started).fetchone() == (1000,)
    db.close()
    print('PASS failed transaction rollback, retry once, metadata update and reopen persistence')
