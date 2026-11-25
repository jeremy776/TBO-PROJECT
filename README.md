# Validasi PIN ATM - Finite State Machine (FSM)

Aplikasi simulasi validasi PIN ATM menggunakan model Deterministic Finite Automaton (DFA) untuk pembatasan akses percobaan PIN.

## Cara Menjalankan
Buka file `index.html` langsung di browser, atau jalankan melalui local server:
```bash
python -m http.server 8080
```
Lalu buka `http://localhost:8080` di browser.

## Struktur File
- `index.html`: Antarmuka mesin ATM, diagram state FSM, dan tabel transisi.
- `styles.css`: Styling light mode tanpa border dan tanpa shadow.
- `fsm.js`: Logika mesin DFA formal (Q, Sigma, delta, q0, F).
- `app.js`: Logika interaksi antarmuka, input keypad, dan visualisasi transisi.

## Spesifikasi Model DFA
- Q (7 State): q0 (IDLE), q1 (ATTEMPT_1), q2 (ATTEMPT_2), q3 (ATTEMPT_3), q4 (AUTHENTICATED), q5 (CARD_EJECTED), q6 (BLOCKED)
- Sigma (6 Input): insert_card, pin_valid, pin_wrong, pin_invalid_fmt, cancel, take_card
- q0 (State Awal): q0
- F (State Akhir): q4, q5
- State Pemblokiran: q6 (BLOCKED). Jika PIN salah 3 kali berturut-turut (q1 -> q2 -> q3 -> q6), seluruh input tetap berada di q6 sampai di-reset oleh bank.
