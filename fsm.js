/**
 * Formal Deterministic Finite Automaton (DFA) Engine
 * Topic: Perancangan Sistem Validasi PIN ATM Menggunakan FSM untuk Pencegahan Keamanan Akses
 *
 * 5-Tuple: M = (Q, Σ, δ, q0, F)
 * - Q  : { IDLE, ATTEMPT_1, ATTEMPT_2, ATTEMPT_3, AUTHENTICATED, CARD_EJECTED, BLOCKED }
 * - Σ  : { insert_card, pin_valid, pin_wrong, pin_invalid_fmt, cancel, take_card }
 * - δ  : Q × Σ -> Q (Total transition function defined in TRANSITION_TABLE)
 * - q0 : IDLE
 * - F  : { AUTHENTICATED, CARD_EJECTED } (Note: BLOCKED is a permanent trap/dead state)
 */

(function (global) {
  'use strict';

  const STATES = {
    IDLE: {
      id: 'IDLE',
      code: 'q0',
      label: 'IDLE',
      shortLabel: 'Siap',
      type: 'initial',
      severity: 'neutral',
      description: 'Mesin ATM siap menerima kartu nasabah.'
    },
    ATTEMPT_1: {
      id: 'ATTEMPT_1',
      code: 'q1',
      label: 'ATTEMPT_1',
      shortLabel: 'Coba 1/3',
      type: 'intermediate',
      severity: 'info',
      attemptsLeft: 3,
      description: 'Kartu terdeteksi. Menunggu input PIN (Percobaan ke-1 dari 3).'
    },
    ATTEMPT_2: {
      id: 'ATTEMPT_2',
      code: 'q2',
      label: 'ATTEMPT_2',
      shortLabel: 'Coba 2/3',
      type: 'intermediate',
      severity: 'warning',
      attemptsLeft: 2,
      description: 'PIN salah 1x. Kesempatan tersisa 2 kali.'
    },
    ATTEMPT_3: {
      id: 'ATTEMPT_3',
      code: 'q3',
      label: 'ATTEMPT_3',
      shortLabel: 'Coba 3/3',
      type: 'intermediate',
      severity: 'danger',
      attemptsLeft: 1,
      description: 'Peringatan: PIN salah 2x! Kesempatan terakhir sebelum pemblokiran.'
    },
    AUTHENTICATED: {
      id: 'AUTHENTICATED',
      code: 'q4',
      label: 'AUTHENTICATED',
      shortLabel: 'Akses Sah',
      type: 'accepting',
      severity: 'success',
      description: 'PIN valid. Akses keamanan diberikan ke menu transaksi ATM.'
    },
    CARD_EJECTED: {
      id: 'CARD_EJECTED',
      code: 'q5',
      label: 'CARD_EJECTED',
      shortLabel: 'Kartu Keluar',
      type: 'accepting',
      severity: 'info',
      description: 'Sesi diakhiri dengan aman. Silakan ambil kartu Anda.'
    },
    BLOCKED: {
      id: 'BLOCKED',
      code: 'q6',
      label: 'BLOCKED',
      shortLabel: 'Terblokir',
      type: 'trap',
      severity: 'blocked',
      attemptsLeft: 0,
      description: 'TRAP STATE: Salah PIN 3x berturut-turut. Kartu diblokir untuk mencegah brute-force.'
    }
  };

  const ALPHABET = [
    { symbol: 'insert_card', label: 'insert_card', desc: 'Kartu ATM dimasukkan ke slot' },
    { symbol: 'pin_valid', label: 'pin_valid', desc: 'PIN 6 digit sesuai dengan data terdaftar' },
    { symbol: 'pin_wrong', label: 'pin_wrong', desc: 'PIN 6 digit tidak cocok dengan data terdaftar' },
    { symbol: 'pin_invalid_fmt', label: 'pin_invalid_fmt', desc: 'Format input bukan 6 digit angka' },
    { symbol: 'cancel', label: 'cancel', desc: 'Tombol Cancel / Keluar Sesi ditekan' },
    { symbol: 'take_card', label: 'take_card', desc: 'Kartu diambil dari slot ATM' }
  ];

  /**
   * Total Transition Function δ : Q × Σ -> Q
   */
  const TRANSITION_TABLE = {
    IDLE: {
      insert_card: 'ATTEMPT_1',
      pin_valid: 'IDLE',
      pin_wrong: 'IDLE',
      pin_invalid_fmt: 'IDLE',
      cancel: 'IDLE',
      take_card: 'IDLE'
    },
    ATTEMPT_1: {
      insert_card: 'ATTEMPT_1',
      pin_valid: 'AUTHENTICATED',
      pin_wrong: 'ATTEMPT_2',
      pin_invalid_fmt: 'ATTEMPT_1',
      cancel: 'CARD_EJECTED',
      take_card: 'ATTEMPT_1'
    },
    ATTEMPT_2: {
      insert_card: 'ATTEMPT_2',
      pin_valid: 'AUTHENTICATED',
      pin_wrong: 'ATTEMPT_3',
      pin_invalid_fmt: 'ATTEMPT_2',
      cancel: 'CARD_EJECTED',
      take_card: 'ATTEMPT_2'
    },
    ATTEMPT_3: {
      insert_card: 'ATTEMPT_3',
      pin_valid: 'AUTHENTICATED',
      pin_wrong: 'BLOCKED',
      pin_invalid_fmt: 'ATTEMPT_3',
      cancel: 'CARD_EJECTED',
      take_card: 'ATTEMPT_3'
    },
    AUTHENTICATED: {
      insert_card: 'AUTHENTICATED',
      pin_valid: 'AUTHENTICATED',
      pin_wrong: 'AUTHENTICATED',
      pin_invalid_fmt: 'AUTHENTICATED',
      cancel: 'CARD_EJECTED',
      take_card: 'AUTHENTICATED'
    },
    CARD_EJECTED: {
      insert_card: 'CARD_EJECTED',
      pin_valid: 'CARD_EJECTED',
      pin_wrong: 'CARD_EJECTED',
      pin_invalid_fmt: 'CARD_EJECTED',
      cancel: 'CARD_EJECTED',
      take_card: 'IDLE'
    },
    BLOCKED: {
      insert_card: 'BLOCKED',
      pin_valid: 'BLOCKED',
      pin_wrong: 'BLOCKED',
      pin_invalid_fmt: 'BLOCKED',
      cancel: 'BLOCKED',
      take_card: 'BLOCKED'
    }
  };

  function resolveEdgeId(fromState, toState, inputSymbol) {
    if (fromState === 'BLOCKED' && toState === 'BLOCKED') {
      return 'edge-q6-self';
    }
    if (fromState === toState) {
      if (
        inputSymbol === 'pin_invalid_fmt' &&
        (fromState === 'ATTEMPT_1' || fromState === 'ATTEMPT_2' || fromState === 'ATTEMPT_3')
      ) {
        const code = STATES[fromState].code;
        return `edge-${code}-self`;
      }
      return null;
    }
    const fromCode = STATES[fromState].code;
    const toCode = STATES[toState].code;
    return `edge-${fromCode}-${toCode}`;
  }

  function buildTransitionNote(fromState, inputSymbol, toState) {
    if (fromState === 'BLOCKED') {
      return `Akses ditolak! Trap state q6 mengunci seluruh input (${inputSymbol}).`;
    }
    if (fromState === 'IDLE' && toState === 'ATTEMPT_1') {
      return 'Kartu diterima. Sistem masuk ke tahap validasi PIN (1/3).';
    }
    if (inputSymbol === 'pin_valid' && toState === 'AUTHENTICATED') {
      return 'PIN cocok! Otorisasi berhasil, akses menu transaksi dibuka.';
    }
    if (inputSymbol === 'pin_wrong' && toState === 'ATTEMPT_2') {
      return 'PIN salah (1/3). Counter keamanan naik, sisa 2 percobaan.';
    }
    if (inputSymbol === 'pin_wrong' && toState === 'ATTEMPT_3') {
      return 'PIN salah (2/3). Peringatan terakhir, sisa 1 percobaan.';
    }
    if (inputSymbol === 'pin_wrong' && toState === 'BLOCKED') {
      return 'BAHAYA: Salah PIN 3x berturut-turut! Masuk ke Trap State BLOCKED.';
    }
    if (inputSymbol === 'pin_invalid_fmt' && fromState === toState) {
      return 'Format PIN tidak valid (harus 6 digit angka). State tetap terjaga.';
    }
    if (inputSymbol === 'cancel' && toState === 'CARD_EJECTED') {
      return fromState === 'AUTHENTICATED'
        ? 'Nasabah mengakhiri sesi. Kartu dikeluarkan dengan aman.'
        : 'Validasi PIN dibatalkan. Kartu dikeluarkan dengan aman.';
    }
    if (inputSymbol === 'take_card' && toState === 'IDLE') {
      return 'Kartu diambil nasabah. Mesin kembali ke state awal IDLE (q0).';
    }
    if (fromState === toState) {
      return `Input '${inputSymbol}' diabaikan pada state ${STATES[fromState].code} (${fromState}).`;
    }
    return `Transisi dari ${fromState} ke ${toState} melalui '${inputSymbol}'.`;
  }

  class ATMStateMachine {
    constructor(correctPin = '123456') {
      this.correctPin = correctPin;
      this.currentState = 'IDLE';
      this.history = [];
      this.stepCounter = 0;
    }

    setCorrectPin(pin) {
      if (/^\d{6}$/.test(pin)) {
        this.correctPin = pin;
        return true;
      }
      return false;
    }

    getStateInfo(stateId = this.currentState) {
      return STATES[stateId];
    }

    /**
     * Evaluate raw PIN string into a formal alphabet symbol (Σ)
     * and execute the DFA transition.
     */
    submitPin(rawPin) {
      if (!/^\d{6}$/.test(rawPin)) {
        return this.step('pin_invalid_fmt', { rawLength: rawPin.length });
      }
      if (rawPin === this.correctPin) {
        return this.step('pin_valid');
      }
      return this.step('pin_wrong');
    }

    /**
     * Execute formal transition: δ(currentState, inputSymbol) -> nextState
     */
    step(inputSymbol, meta = {}) {
      const row = TRANSITION_TABLE[this.currentState];
      if (!row || !Object.prototype.hasOwnProperty.call(row, inputSymbol)) {
        throw new Error(`Simbol input tidak dikenal dalam alfabet Σ: ${inputSymbol}`);
      }

      const fromState = this.currentState;
      const toState = row[inputSymbol];
      const changed = fromState !== toState;
      const edgeId = resolveEdgeId(fromState, toState, inputSymbol);
      const note = buildTransitionNote(fromState, inputSymbol, toState);

      this.currentState = toState;
      this.stepCounter += 1;

      const record = {
        step: this.stepCounter,
        from: fromState,
        fromCode: STATES[fromState].code,
        input: inputSymbol,
        to: toState,
        toCode: STATES[toState].code,
        changed,
        edgeId,
        note,
        meta,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false })
      };

      this.history.unshift(record);
      return record;
    }

    /**
     * Out-of-band Bank/Admin recovery to unblock Trap State q6
     * and reset the simulation cleanly.
     */
    adminReset() {
      const fromState = this.currentState;
      this.currentState = 'IDLE';
      this.stepCounter += 1;
      const record = {
        step: this.stepCounter,
        from: fromState,
        fromCode: STATES[fromState].code,
        input: 'admin_reset',
        to: 'IDLE',
        toCode: 'q0',
        changed: fromState !== 'IDLE',
        edgeId: null,
        note: 'Reset Admin Bank: Mesin dipulihkan ke state awal q0 (IDLE).',
        meta: { outOfBand: true },
        timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false })
      };
      this.history.unshift(record);
      return record;
    }

    clearHistory() {
      this.history = [];
      this.stepCounter = 0;
    }
  }

  const exported = {
    STATES,
    ALPHABET,
    TRANSITION_TABLE,
    ATMStateMachine
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    global.ATMFSM = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
