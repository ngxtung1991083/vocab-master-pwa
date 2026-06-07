import os
import sqlite3
from functools import wraps
from datetime import datetime

import pandas as pd
from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

APP_USERNAME = "tung"
APP_PASSWORD = "123456"  # Doi mat khau o day
SECRET_KEY = "change-this-secret-key-vocab-app"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "vocab.db")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

app = Flask(__name__)
app.secret_key = SECRET_KEY
os.makedirs(UPLOAD_DIR, exist_ok=True)

PASSWORD_HASH = generate_password_hash(APP_PASSWORD)


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS vocab (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hanzi TEXT NOT NULL,
            pinyin TEXT,
            vietnamese TEXT,
            english TEXT,
            deck TEXT DEFAULT 'Default',
            status TEXT DEFAULT 'new',
            created_at TEXT,
            updated_at TEXT
        )
    """)
    conn.commit()
    conn.close()


def login_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return func(*args, **kwargs)
    return wrapper


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        if username == APP_USERNAME and check_password_hash(PASSWORD_HASH, password):
            session["logged_in"] = True
            session["username"] = username
            return redirect(url_for("index"))
        flash("Sai tài khoản hoặc mật khẩu.")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    conn = db()
    total = conn.execute("SELECT COUNT(*) FROM vocab").fetchone()[0]
    known = conn.execute("SELECT COUNT(*) FROM vocab WHERE status='known'").fetchone()[0]
    unknown = conn.execute("SELECT COUNT(*) FROM vocab WHERE status='unknown'").fetchone()[0]
    decks = conn.execute("SELECT deck, COUNT(*) c FROM vocab GROUP BY deck ORDER BY deck").fetchall()
    words = conn.execute("SELECT * FROM vocab ORDER BY id DESC LIMIT 100").fetchall()
    conn.close()
    return render_template("index.html", total=total, known=known, unknown=unknown, decks=decks, words=words)


@app.route("/flashcard")
@login_required
def flashcard():
    return render_template("flashcard.html")


@app.route("/api/words")
@login_required
def api_words():
    mode = request.args.get("mode", "all")
    deck = request.args.get("deck", "all")
    q = "SELECT * FROM vocab WHERE 1=1"
    params = []
    if mode == "known":
        q += " AND status='known'"
    elif mode == "unknown":
        q += " AND status='unknown'"
    elif mode == "new":
        q += " AND status='new'"
    if deck != "all":
        q += " AND deck=?"
        params.append(deck)
    q += " ORDER BY RANDOM()"
    conn = db()
    rows = [dict(r) for r in conn.execute(q, params).fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/decks")
@login_required
def api_decks():
    conn = db()
    rows = [r["deck"] for r in conn.execute("SELECT DISTINCT deck FROM vocab ORDER BY deck").fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/mark/<int:word_id>", methods=["POST"])
@login_required
def api_mark(word_id):
    status = request.json.get("status", "unknown")
    if status not in ["known", "unknown", "new"]:
        status = "unknown"
    conn = db()
    conn.execute("UPDATE vocab SET status=?, updated_at=? WHERE id=?", (status, datetime.now().isoformat(), word_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/add", methods=["POST"])
@login_required
def add_word():
    hanzi = request.form.get("hanzi", "").strip()
    pinyin = request.form.get("pinyin", "").strip()
    vietnamese = request.form.get("vietnamese", "").strip()
    english = request.form.get("english", "").strip()
    deck = request.form.get("deck", "Default").strip() or "Default"
    if hanzi:
        now = datetime.now().isoformat()
        conn = db()
        conn.execute(
            "INSERT INTO vocab(hanzi,pinyin,vietnamese,english,deck,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
            (hanzi, pinyin, vietnamese, english, deck, "new", now, now),
        )
        conn.commit()
        conn.close()
    return redirect(url_for("index"))


@app.route("/delete/<int:word_id>", methods=["POST"])
@login_required
def delete_word(word_id):
    conn = db()
    conn.execute("DELETE FROM vocab WHERE id=?", (word_id,))
    conn.commit()
    conn.close()
    return redirect(url_for("index"))


def pick_col(df, candidates):
    normalized = {str(c).strip().lower(): c for c in df.columns}
    for name in candidates:
        if name.lower() in normalized:
            return normalized[name.lower()]
    return None


@app.route("/import", methods=["POST"])
@login_required
def import_excel():
    file = request.files.get("file")
    deck_name = request.form.get("deck_name", "").strip() or "Imported"
    if not file or file.filename == "":
        flash("Bạn chưa chọn file Excel.")
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    path = os.path.join(UPLOAD_DIR, filename)
    file.save(path)

    try:
        df = pd.read_excel(path)
        hanzi_col = pick_col(df, ["Hán tự", "Han tu", "Hanzi", "Chinese", "中文", "汉字"])
        pinyin_col = pick_col(df, ["Pinyin", "拼音"])
        vi_col = pick_col(df, ["Tiếng Việt", "Tieng Viet", "Vietnamese", "Viet", "VI", "Nghĩa"])
        en_col = pick_col(df, ["English", "EN", "Tiếng Anh", "Tieng Anh"])

        if not hanzi_col:
            flash("Không tìm thấy cột Hán tự/Hanzi/Chinese trong file.")
            return redirect(url_for("index"))

        conn = db()
        now = datetime.now().isoformat()
        added = 0
        for _, row in df.iterrows():
            hanzi = str(row.get(hanzi_col, "")).strip()
            if not hanzi or hanzi.lower() == "nan":
                continue
            pinyin = "" if not pinyin_col else str(row.get(pinyin_col, "")).strip()
            vi = "" if not vi_col else str(row.get(vi_col, "")).strip()
            en = "" if not en_col else str(row.get(en_col, "")).strip()
            pinyin = "" if pinyin.lower() == "nan" else pinyin
            vi = "" if vi.lower() == "nan" else vi
            en = "" if en.lower() == "nan" else en
            conn.execute(
                "INSERT INTO vocab(hanzi,pinyin,vietnamese,english,deck,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
                (hanzi, pinyin, vi, en, deck_name, "new", now, now),
            )
            added += 1
        conn.commit()
        conn.close()
        flash(f"Đã import {added} từ vào bộ: {deck_name}")
    except Exception as e:
        flash(f"Lỗi import: {e}")

    return redirect(url_for("index"))


@app.route("/reset_status", methods=["POST"])
@login_required
def reset_status():
    conn = db()
    conn.execute("UPDATE vocab SET status='new', updated_at=?", (datetime.now().isoformat(),))
    conn.commit()
    conn.close()
    flash("Đã reset toàn bộ trạng thái về từ mới.")
    return redirect(url_for("index"))


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)
