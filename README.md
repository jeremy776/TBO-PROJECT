# Sistem Validasi PIN ATM Menggunakan Finite State Machine (FSM / DFA)

Aplikasi web interaktif untuk mensimulasikan **validasi PIN ATM berbasis Deterministic Finite Automaton (DFA)** guna mencegah serangan akses tidak sah (*brute-force*).

## Cara Menjalankan
Tidak perlu instalasi dependensi apa pun:
1. Buka file `index.html` langsung di browser (Chrome, Edge, Firefox), **atau**
2. Jalankan via local server:
   ```bash
   python -m http.server 8080
   ```
   lalu buka `http://localhost:8080`.

## Struktur Proyek
- `index.html` — Antarmuka Terminal ATM, Diagram SVG State FSM interaktif, dan panel inspeksi akademik.
- `styles.css` — Desain tema gelap (*OLED dark banking*) responsif dengan animasi transisi.
- `fsm.js` — Mesin DFA formal `(Q, Σ, δ, q₀, F)` yang terpisah dari UI (*pure logic*).
- `app.js` — Pengendali interaksi keypad/keyboard, animasi partikel pada SVG, tabel transisi live, dan runner skenario demo.

## Model Formal DFA `M = (Q, Σ, δ, q₀, F)`
- **Q (7 States):** `q₀ IDLE`, `q₁ ATTEMPT_1`, `q₂ ATTEMPT_2`, `q₃ ATTEMPT_3`, `q₄ AUTHENTICATED`, `q₅ CARD_EJECTED`, `q₆ BLOCKED`
- **Σ (6 Input):** `insert_card`, `pin_valid`, `pin_wrong`, `pin_invalid_fmt`, `cancel`, `take_card`
- **q₀ (Initial State):** `IDLE`
- **F (Accepting States):** `{AUTHENTICATED, CARD_EJECTED}`
- **Trap State (Keamanan):** `q₆ BLOCKED` — dicapai setelah 3x kesalahan PIN berturut-turut (`q₁ → q₂ → q₃ → q₆`). Semua input dari nasabah pada `q₆` tertahan di `q₆` hingga di-reset melalui aksi Admin Bank.

