(function () {
  'use strict';

  const { STATES, ALPHABET, TRANSITION_TABLE, ATMStateMachine } = window.ATMFSM;

  const fsm = new ATMStateMachine('123456');

  // UI state
  let pinBuffer = '';
  let showPin = false;
  let screenFeedback = null; // { type: 'error' | 'warn' | 'info', text: string }
  let activeMenuMessage = '';
  let lastRecord = null;
  let scenarioTimerIds = [];
  let runningScenarioKey = null;
  let activeAnimationFrame = null;

  // DOM References
  const elAtmBadge = document.getElementById('atm-state-badge');
  const elSlotLed = document.getElementById('slot-led');
  const elSlotStatus = document.getElementById('slot-status-text');
  const elSlotHint = document.getElementById('slot-hint-text');
  const btnCardAction = document.getElementById('btn-card-action');
  const btnCardLabel = document.getElementById('btn-card-label');

  const elScreen = document.getElementById('atm-screen');
  const elScreenCodePill = document.getElementById('screen-code-pill');
  const elScreenBody = document.getElementById('screen-body');
  const elAttemptText = document.getElementById('attempt-counter-text');
  const elBars = [
    document.getElementById('bar-1'),
    document.getElementById('bar-2'),
    document.getElementById('bar-3')
  ];

  const elTargetPinInput = document.getElementById('input-target-pin');
  const btnSavePin = document.getElementById('btn-save-pin');
  const btnAdminReset = document.getElementById('btn-admin-reset');

  const btnCancel = document.getElementById('key-cancel');
  const btnClear = document.getElementById('key-clear');
  const btnEnter = document.getElementById('key-enter');
  const btnInvalidTest = document.getElementById('key-invalid-test');
  const btnTogglePin = document.getElementById('key-toggle-pin');
  const numButtons = Array.from(document.querySelectorAll('.key-btn[data-key]'));

  const elBanner = document.getElementById('transition-banner');
  const elTableBody = document.getElementById('transition-table-body');
  const elLogsList = document.getElementById('logs-list');
  const elLogCountBadge = document.getElementById('log-count-badge');
  const btnCopyLogs = document.getElementById('btn-copy-logs');
  const btnClearLogs = document.getElementById('btn-clear-logs');

  const pulseLayer = document.getElementById('fsm-pulse-layer');
  const pulseDot = document.getElementById('fsm-pulse-dot');
  const pulseHalo = document.getElementById('fsm-pulse-halo');
  const scenarioButtons = Array.from(document.querySelectorAll('[data-scenario]'));
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  const tabPanels = Array.from(document.querySelectorAll('.tab-content'));

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function getWrongPinExample(variant = 0) {
    const candidates = ['000000', '111111', '999999', '654321'];
    const filtered = candidates.filter((p) => p !== fsm.correctPin);
    return filtered[variant % filtered.length] || '999999';
  }

  function stopScenario() {
    scenarioTimerIds.forEach((id) => clearTimeout(id));
    scenarioTimerIds = [];
    runningScenarioKey = null;
    scenarioButtons.forEach((btn) => btn.classList.remove('is-running'));
  }

  function handleTransition(record) {
    lastRecord = record;
    renderAll();
    animateTransition(record);
  }

  function executeStep(inputSymbol, meta = {}) {
    const record = fsm.step(inputSymbol, meta);

    if (record.to === 'AUTHENTICATED') {
      pinBuffer = '';
      screenFeedback = null;
      activeMenuMessage = 'Silakan pilih layanan perbankan Anda.';
    } else if (record.to === 'IDLE') {
      pinBuffer = '';
      screenFeedback = null;
      activeMenuMessage = '';
    } else if (record.to === 'CARD_EJECTED') {
      pinBuffer = '';
      screenFeedback = null;
    } else if (record.to === 'BLOCKED') {
      pinBuffer = '';
      screenFeedback = {
        type: 'error',
        text: 'Kartu ditahan dan diblokir.'
      };
    } else if (record.input === 'pin_wrong') {
      pinBuffer = '';
      const left = STATES[record.to].attemptsLeft;
      screenFeedback = {
        type: 'warn',
        text: `PIN salah. Sisa ${left} percobaan.`
      };
    } else if (record.input === 'pin_invalid_fmt') {
      screenFeedback = {
        type: 'error',
        text: 'PIN harus 6 digit angka.'
      };
    }

    handleTransition(record);
    return record;
  }

  function submitCurrentPin() {
    const state = fsm.currentState;

    if (state === 'IDLE' || state === 'CARD_EJECTED') {
      screenFeedback = {
        type: 'warn',
        text: state === 'IDLE' ? 'Masukkan kartu terlebih dahulu.' : 'Ambil kartu dari slot.'
      };
      renderAtmScreen();
      return;
    }

    if (state === 'AUTHENTICATED') {
      return;
    }

    if (state === 'BLOCKED') {
      pinBuffer = '';
      screenFeedback = {
        type: 'error',
        text: 'Kartu diblokir. Input tidak diproses.'
      };
      const record = fsm.submitPin(fsm.correctPin);
      handleTransition(record);
      return;
    }

    const record = fsm.submitPin(pinBuffer);
    if (record.input === 'pin_valid') {
      pinBuffer = '';
      screenFeedback = null;
      activeMenuMessage = 'Autentikasi berhasil. Saldo aktif: Rp 12.500.000';
    } else if (record.input === 'pin_wrong') {
      pinBuffer = '';
      if (record.to === 'BLOCKED') {
        screenFeedback = {
          type: 'error',
          text: 'Salah PIN 3x berturut-turut! Masuk Trap State q₆.'
        };
      } else {
        const left = STATES[record.to].attemptsLeft;
        screenFeedback = {
          type: 'warn',
          text: `PIN salah! Kesempatan tersisa: ${left}.`
        };
      }
    } else if (record.input === 'pin_invalid_fmt') {
      screenFeedback = {
        type: 'error',
        text: 'Format tidak valid! Masukkan tepat 6 digit angka.'
      };
    }

    handleTransition(record);
  }

  // Rendering Functions
  function renderAll() {
    renderCardSlot();
    renderAtmScreen();
    renderSvgStates();
    renderTransitionBanner();
    renderTransitionTable();
    renderLogs();
  }

  function renderCardSlot() {
    const state = fsm.currentState;
    const info = STATES[state];

    elAtmBadge.textContent = `${info.code}: ${info.label}`;
    elAtmBadge.className = `state-chip chip-${info.severity}`;

    elSlotLed.className = 'led';
    btnCardAction.className = 'btn btn-card';

    if (state === 'IDLE') {
      elSlotLed.classList.add('led-idle');
      elSlotStatus.textContent = 'Slot Kosong';
      elSlotHint.textContent = 'Masukkan kartu untuk mulai';
      btnCardLabel.textContent = 'Masukkan Kartu';
      btnCardAction.classList.add('btn-primary');
    } else if (state === 'CARD_EJECTED') {
      elSlotLed.classList.add('led-ejected');
      elSlotStatus.textContent = 'Kartu Keluar';
      elSlotHint.textContent = 'Ambil kartu dari slot';
      btnCardLabel.textContent = 'Ambil Kartu';
      btnCardAction.classList.add('btn-primary');
    } else if (state === 'BLOCKED') {
      elSlotLed.classList.add('led-blocked');
      elSlotStatus.textContent = 'Kartu Diblokir';
      elSlotHint.textContent = 'Kartu diblokir. Gunakan Reset Bank untuk mengulang';
      btnCardLabel.textContent = 'Uji Input Blokir';
    } else {
      elSlotLed.classList.add('led-active');
      elSlotStatus.textContent = 'Kartu Terpasang';
      elSlotHint.textContent = state === 'AUTHENTICATED' ? 'Sesi aktif' : 'Menunggu input PIN';
      btnCardLabel.textContent = 'Batalkan & Keluar';
    }
  }

  function renderAtmScreen() {
    const state = fsm.currentState;
    const info = STATES[state];

    elScreen.className = `atm-screen screen-${info.severity}`;
    elScreenCodePill.textContent = `STATE: ${info.code} (${info.label})`;

    let html = '';

    if (state === 'IDLE') {
      html = `
        <h3 class="screen-title">Selamat Datang</h3>
        <p class="screen-desc">Silakan masukkan kartu ATM untuk memulai.</p>
        ${screenFeedback ? `<div class="screen-feedback feedback-warn">${escapeHtml(screenFeedback.text)}</div>` : ''}
      `;
    } else if (state === 'ATTEMPT_1' || state === 'ATTEMPT_2' || state === 'ATTEMPT_3') {
      const slots = Array.from({ length: 6 }, (_, i) => {
        const ch = pinBuffer[i];
        const filled = ch !== undefined;
        const display = filled ? (showPin ? ch : '*') : '';
        return `<div class="pin-slot ${filled ? 'is-filled' : ''}">${display}</div>`;
      }).join('');

      const attemptNum = state === 'ATTEMPT_1' ? 1 : state === 'ATTEMPT_2' ? 2 : 3;
      html = `
        <h3 class="screen-title">Masukkan 6 Digit PIN</h3>
        <p class="screen-desc">Percobaan ${attemptNum} dari 3. Tekan <strong>ENTER</strong> untuk verifikasi.</p>
        <div class="pin-slots" aria-label="Digit PIN">${slots}</div>
        ${screenFeedback ? `<div class="screen-feedback feedback-${screenFeedback.type === 'error' ? 'error' : 'warn'}">${escapeHtml(screenFeedback.text)}</div>` : ''}
      `;
    } else if (state === 'AUTHENTICATED') {
      html = `
        <h3 class="screen-title" style="color:#059669;">PIN Benar</h3>
        <div class="auth-balance-box">${escapeHtml(activeMenuMessage || 'PIN terverifikasi.')}</div>
        <div class="auth-menu-grid">
          <button type="button" class="auth-action-btn" data-atm-menu="balance">Cek Saldo</button>
          <button type="button" class="auth-action-btn" data-atm-menu="withdraw">Tarik Tunai</button>
          <button type="button" class="auth-action-btn" data-atm-menu="transfer">Informasi</button>
          <button type="button" class="auth-action-btn" data-atm-menu="logout">Keluar</button>
        </div>
      `;
    } else if (state === 'CARD_EJECTED') {
      html = `
        <h3 class="screen-title" style="color:#0284c7;">Kartu Keluar</h3>
        <p class="screen-desc">Kartu telah dikeluarkan. Silakan ambil kartu Anda.</p>
      `;
    } else if (state === 'BLOCKED') {
      html = `
        <h3 class="screen-title" style="color:#dc2626;">KARTU DIBLOKIR</h3>
        <p class="screen-desc">PIN salah 3 kali berturut-turut. Kartu ditahan oleh sistem.</p>
        <div class="screen-feedback feedback-error">${escapeHtml(screenFeedback ? screenFeedback.text : 'Gunakan Reset Bank untuk mengulang simulasi.')}</div>
      `;
    }

    elScreenBody.innerHTML = html;

    // Bind dummy menu buttons if present
    elScreenBody.querySelectorAll('[data-atm-menu]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-atm-menu');
        if (action === 'balance') {
          activeMenuMessage = 'Saldo Rekening: Rp 12.500.000';
          renderAtmScreen();
        } else if (action === 'withdraw') {
          activeMenuMessage = 'Simulasi tarik tunai Rp 500.000 berhasil.';
          renderAtmScreen();
        } else if (action === 'transfer') {
          activeMenuMessage = 'Sesi terautentikasi di Accepting State q₄.';
          renderAtmScreen();
        } else if (action === 'logout') {
          stopScenario();
          executeStep('cancel');
        }
      });
    });

    // Security Attempt Meter
    elBars.forEach((bar) => {
      bar.className = 'meter-bar';
    });

    if (state === 'IDLE' || state === 'CARD_EJECTED') {
      elAttemptText.textContent = 'Siap (3/3 Kesempatan)';
      elBars.forEach((b) => b.classList.add('bar-ok'));
    } else if (state === 'ATTEMPT_1') {
      elAttemptText.textContent = '3 percobaan tersisa';
      elBars.forEach((b) => b.classList.add('bar-ok'));
    } else if (state === 'ATTEMPT_2') {
      elAttemptText.textContent = '2 percobaan tersisa';
      elBars[0].classList.add('bar-warn');
      elBars[1].classList.add('bar-warn');
    } else if (state === 'ATTEMPT_3') {
      elAttemptText.textContent = '1 percobaan tersisa';
      elBars[0].classList.add('bar-danger');
    } else if (state === 'AUTHENTICATED') {
      elAttemptText.textContent = 'Akses diterima';
      elBars.forEach((b) => b.classList.add('bar-ok'));
    } else if (state === 'BLOCKED') {
      elAttemptText.textContent = '0/3 Terblokir (q6)';
      elBars.forEach((b) => b.classList.add('bar-blocked'));
    }
  }

  function renderSvgStates() {
    document.querySelectorAll('.fsm-node').forEach((node) => {
      const nodeState = node.getAttribute('data-state');
      node.classList.toggle('is-active', nodeState === fsm.currentState);
    });
  }

  function renderTransitionBanner() {
    elBanner.className = 'transition-banner';
    if (!lastRecord) {
      elBanner.innerHTML = `
        <span class="mono banner-formula">δ(q0, start) = q0</span>
        <span class="banner-note">Mesin siap. Masukkan kartu atau pilih skenario.</span>
      `;
      return;
    }

    if (lastRecord.to === 'BLOCKED') {
      elBanner.classList.add('banner-danger');
    } else if (lastRecord.to === 'AUTHENTICATED') {
      elBanner.classList.add('banner-success');
    }

    elBanner.innerHTML = `
      <span class="mono banner-formula">δ(${escapeHtml(lastRecord.fromCode)}, ${escapeHtml(lastRecord.input)}) = ${escapeHtml(lastRecord.toCode)}</span>
      <span class="banner-note">${escapeHtml(lastRecord.note)}</span>
    `;
  }

  function renderTransitionTable() {
    const stateKeys = Object.keys(STATES);
    const inputKeys = ALPHABET.map((a) => a.symbol);

    const rowsHtml = stateKeys
      .map((stateKey) => {
        const info = STATES[stateKey];
        const isCurrentRow = fsm.currentState === stateKey;

        const cellsHtml = inputKeys
          .map((sym) => {
            const targetKey = TRANSITION_TABLE[stateKey][sym];
            const targetCode = STATES[targetKey].code;
            const isLastCell =
              lastRecord &&
              lastRecord.from === stateKey &&
              lastRecord.input === sym;

            let cellClass = 'mono';
            if (targetKey === 'BLOCKED') cellClass += ' cell-trap';
            if (targetKey === 'AUTHENTICATED') cellClass += ' cell-accept';
            if (isLastCell) cellClass += ' is-last-cell';

            let shortTag = targetCode;
            if (targetKey === 'AUTHENTICATED') shortTag = `${targetCode} (Sah)`;
            else if (targetKey === 'CARD_EJECTED') shortTag = `${targetCode} (Out)`;
            else if (targetKey === 'BLOCKED') shortTag = `${targetCode} (Blok)`;

            return `<td class="${cellClass}" title="${stateKey} + ${sym} -> ${targetKey}">${shortTag}</td>`;
          })
          .join('');

        return `
          <tr class="${isCurrentRow ? 'is-current-row' : ''}">
            <td>${info.code}: ${info.label}</td>
            ${cellsHtml}
          </tr>
        `;
      })
      .join('');

    elTableBody.innerHTML = rowsHtml;
  }

  function renderLogs() {
    elLogCountBadge.textContent = String(fsm.history.length);

    if (fsm.history.length === 0) {
      elLogsList.innerHTML = `<div class="empty-logs">Belum ada transisi.</div>`;
      return;
    }

    elLogsList.innerHTML = fsm.history
      .map((item) => {
        let severityClass = '';
        if (item.to === 'BLOCKED') severityClass = 'log-danger';
        else if (item.to === 'AUTHENTICATED') severityClass = 'log-success';
        else if (item.input === 'pin_wrong' || item.input === 'pin_invalid_fmt') severityClass = 'log-warn';

        return `
          <div class="log-item ${severityClass}">
            <span class="log-step">#${String(item.step).padStart(2, '0')}</span>
            <div>
              <div class="log-formula">δ(${escapeHtml(item.fromCode)}, ${escapeHtml(item.input)}) -> ${escapeHtml(item.toCode)}</div>
              <div class="log-note">${escapeHtml(item.note)}</div>
            </div>
            <span class="log-time">${escapeHtml(item.timestamp)}</span>
          </div>
        `;
      })
      .join('');
  }

  function clearEdgeHighlights() {
    document.querySelectorAll('.fsm-edge').forEach((edge) => {
      edge.classList.remove('is-active-edge', 'is-active-edge-danger', 'is-active-edge-success');
    });
    document.querySelectorAll('.edge-label-group').forEach((grp) => {
      grp.classList.remove('is-active-label');
    });
  }

  function animateTransition(record) {
    if (activeAnimationFrame) {
      cancelAnimationFrame(activeAnimationFrame);
      activeAnimationFrame = null;
    }

    clearEdgeHighlights();
    pulseLayer.classList.add('hidden');

    if (!record || !record.edgeId) return;
    const edgeEl = document.getElementById(record.edgeId);
    if (!edgeEl) return;

    const labelGroup = document.querySelector(`.edge-label-group[data-edge="${record.edgeId}"]`);
    let activeClass = 'is-active-edge';
    let dotColor = '#0284c7';
    let haloColor = 'rgba(2, 132, 199, 0.2)';

    if (record.to === 'BLOCKED') {
      activeClass = 'is-active-edge-danger';
      dotColor = '#dc2626';
      haloColor = 'rgba(220, 38, 38, 0.2)';
    } else if (record.to === 'AUTHENTICATED') {
      activeClass = 'is-active-edge-success';
      dotColor = '#059669';
      haloColor = 'rgba(5, 150, 105, 0.2)';
    }

    edgeEl.classList.add(activeClass);
    if (labelGroup) {
      labelGroup.classList.add('is-active-label');
    }

    if (prefersReducedMotion.matches || typeof edgeEl.getTotalLength !== 'function') {
      return;
    }

    const totalLen = edgeEl.getTotalLength();
    if (!totalLen) return;

    pulseDot.setAttribute('fill', dotColor);
    pulseHalo.setAttribute('fill', haloColor);
    pulseLayer.classList.remove('hidden');

    const duration = 420;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // easeInOutCubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const pt = edgeEl.getPointAtLength(eased * totalLen);
      pulseDot.setAttribute('cx', pt.x.toFixed(1));
      pulseDot.setAttribute('cy', pt.y.toFixed(1));
      pulseHalo.setAttribute('cx', pt.x.toFixed(1));
      pulseHalo.setAttribute('cy', pt.y.toFixed(1));

      if (t < 1) {
        activeAnimationFrame = requestAnimationFrame(tick);
      } else {
        pulseLayer.classList.add('hidden');
        activeAnimationFrame = null;
      }
    }

    activeAnimationFrame = requestAnimationFrame(tick);
  }

  // Scenarios
  function runScenario(key) {
    stopScenario();

    // Reset clean for clear demonstration
    fsm.currentState = 'IDLE';
    fsm.clearHistory();
    pinBuffer = '';
    screenFeedback = null;
    lastRecord = null;
    clearEdgeHighlights();
    renderAll();

    const wrongA = getWrongPinExample(0);
    const wrongB = getWrongPinExample(1);
    const wrongC = getWrongPinExample(2);

    const stepsMap = {
      success: [
        { delay: 250, fn: () => executeStep('insert_card') },
        { delay: 1100, fn: () => { pinBuffer = fsm.correctPin; renderAtmScreen(); } },
        { delay: 1650, fn: () => submitCurrentPin() }
      ],
      retry_success: [
        { delay: 250, fn: () => executeStep('insert_card') },
        { delay: 1050, fn: () => { pinBuffer = wrongA; renderAtmScreen(); } },
        { delay: 1550, fn: () => submitCurrentPin() },
        { delay: 2450, fn: () => { pinBuffer = wrongB; renderAtmScreen(); } },
        { delay: 2950, fn: () => submitCurrentPin() },
        { delay: 3850, fn: () => { pinBuffer = fsm.correctPin; renderAtmScreen(); } },
        { delay: 4400, fn: () => submitCurrentPin() }
      ],
      bruteforce: [
        { delay: 250, fn: () => executeStep('insert_card') },
        { delay: 1000, fn: () => { pinBuffer = wrongA; renderAtmScreen(); } },
        { delay: 1500, fn: () => submitCurrentPin() },
        { delay: 2350, fn: () => { pinBuffer = wrongB; renderAtmScreen(); } },
        { delay: 2850, fn: () => submitCurrentPin() },
        { delay: 3700, fn: () => { pinBuffer = wrongC; renderAtmScreen(); } },
        { delay: 4250, fn: () => submitCurrentPin() },
        { delay: 5300, fn: () => submitCurrentPin() } // proves trap state q6 rejects valid/further attempt
      ],
      cancel_flow: [
        { delay: 250, fn: () => executeStep('insert_card') },
        { delay: 1050, fn: () => { pinBuffer = wrongA; renderAtmScreen(); } },
        { delay: 1550, fn: () => submitCurrentPin() },
        { delay: 2500, fn: () => executeStep('cancel') },
        { delay: 3450, fn: () => executeStep('take_card') }
      ]
    };

    const actions = stepsMap[key];
    if (!actions) return;

    runningScenarioKey = key;
    const activeBtn = document.querySelector(`[data-scenario="${key}"]`);
    if (activeBtn) activeBtn.classList.add('is-running');

    actions.forEach((stepObj, idx) => {
      const timerId = setTimeout(() => {
        stepObj.fn();
        if (idx === actions.length - 1) {
          runningScenarioKey = null;
          if (activeBtn) activeBtn.classList.remove('is-running');
        }
      }, stepObj.delay);
      scenarioTimerIds.push(timerId);
    });
  }

  // Event Listeners
  btnCardAction.addEventListener('click', () => {
    stopScenario();
    const state = fsm.currentState;
    if (state === 'IDLE') {
      executeStep('insert_card');
    } else if (state === 'CARD_EJECTED') {
      executeStep('take_card');
    } else if (state === 'BLOCKED') {
      executeStep('insert_card');
    } else {
      executeStep('cancel');
    }
  });

  numButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      stopScenario();
      const digit = btn.getAttribute('data-key');
      if (fsm.currentState === 'BLOCKED') {
        screenFeedback = {
          type: 'error',
          text: 'Trap State q₆ aktif. Input numerik diabaikan.'
        };
        renderAtmScreen();
        return;
      }
      if (
        fsm.currentState === 'ATTEMPT_1' ||
        fsm.currentState === 'ATTEMPT_2' ||
        fsm.currentState === 'ATTEMPT_3'
      ) {
        if (pinBuffer.length < 6) {
          pinBuffer += digit;
          screenFeedback = null;
          renderAtmScreen();
        }
      } else {
        screenFeedback = {
          type: 'warn',
          text: fsm.currentState === 'IDLE' ? 'Masukkan kartu terlebih dahulu.' : 'Keypad tidak menerima input PIN pada state ini.'
        };
        renderAtmScreen();
      }
    });
  });

  btnClear.addEventListener('click', () => {
    stopScenario();
    if (pinBuffer.length > 0) {
      pinBuffer = '';
      screenFeedback = null;
      renderAtmScreen();
    }
  });

  btnCancel.addEventListener('click', () => {
    stopScenario();
    executeStep('cancel');
  });

  btnEnter.addEventListener('click', () => {
    stopScenario();
    submitCurrentPin();
  });

  btnInvalidTest.addEventListener('click', () => {
    stopScenario();
    executeStep('pin_invalid_fmt', { trigger: 'manual_format_test' });
  });

  btnTogglePin.addEventListener('click', () => {
    showPin = !showPin;
    renderAtmScreen();
  });

  btnSavePin.addEventListener('click', () => {
    const val = elTargetPinInput.value.trim();
    if (fsm.setCorrectPin(val)) {
      screenFeedback = {
        type: 'info',
        text: `PIN demo diperbarui menjadi ${val}.`
      };
      elTargetPinInput.style.backgroundColor = '#d1fae5';
      setTimeout(() => {
        elTargetPinInput.style.backgroundColor = '';
      }, 900);
      renderAtmScreen();
    } else {
      elTargetPinInput.style.backgroundColor = '#fee2e2';
      alert('PIN demo harus tepat 6 digit angka (contoh: 123456).');
    }
  });

  btnAdminReset.addEventListener('click', () => {
    stopScenario();
    pinBuffer = '';
    screenFeedback = null;
    activeMenuMessage = '';
    clearEdgeHighlights();
    const record = fsm.adminReset();
    handleTransition(record);
  });

  scenarioButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-scenario');
      runScenario(key);
    });
  });

  // Inspector Tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', String(active));
      });
      tabPanels.forEach((panel) => {
        const active = panel.id === targetId;
        panel.classList.toggle('is-active', active);
        panel.hidden = !active;
      });
    });
  });

  btnCopyLogs.addEventListener('click', async () => {
    if (fsm.history.length === 0) return;
    const text = fsm.history
      .slice()
      .reverse()
      .map((item) => `[#${item.step}] (${item.timestamp}) δ(${item.fromCode} ${item.from}, ${item.input}) -> ${item.toCode} ${item.to} | ${item.note}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      const oldText = btnCopyLogs.textContent;
      btnCopyLogs.textContent = 'Tersalin!';
      setTimeout(() => {
        btnCopyLogs.textContent = oldText;
      }, 1200);
    } catch {
      alert(text);
    }
  });

  btnClearLogs.addEventListener('click', () => {
    fsm.clearHistory();
    lastRecord = null;
    clearEdgeHighlights();
    renderAll();
  });

  // Physical Keyboard Support
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === elTargetPinInput) {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnSavePin.click();
      }
      return;
    }

    if (/^\d$/.test(e.key)) {
      stopScenario();
      if (
        fsm.currentState === 'ATTEMPT_1' ||
        fsm.currentState === 'ATTEMPT_2' ||
        fsm.currentState === 'ATTEMPT_3'
      ) {
        if (pinBuffer.length < 6) {
          pinBuffer += e.key;
          screenFeedback = null;
          renderAtmScreen();
        }
      }
    } else if (e.key === 'Backspace') {
      if (pinBuffer.length > 0) {
        e.preventDefault();
        stopScenario();
        pinBuffer = pinBuffer.slice(0, -1);
        renderAtmScreen();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      stopScenario();
      submitCurrentPin();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      stopScenario();
      executeStep('cancel');
    }
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initial Render
  renderAll();
})();
