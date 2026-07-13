(() => {
  "use strict";

  const STORAGE_KEY = "fitplan31_progress_v1";

  /* ---------- State ---------- */
  let progress = loadProgress();
  let currentDay = null;
  const timers = {}; // exerciseKey -> {remaining, total, running, intervalId}

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (e) { /* storage unavailable, ignore */ }
  }
  function dayState(dayNum) {
    if (!progress[dayNum]) progress[dayNum] = { checks: {}, doneOverride: null };
    return progress[dayNum];
  }

  function totalUnits(day) {
    const rounds = day.rounds || 1;
    return day.exercises.length * rounds;
  }
  function checkedUnits(day) {
    const st = dayState(day.day);
    const rounds = day.rounds || 1;
    let n = 0;
    for (let r = 0; r < rounds; r++) {
      for (let e = 0; e < day.exercises.length; e++) {
        if (st.checks[`${r}-${e}`]) n++;
      }
    }
    return n;
  }
  function isDayDone(day) {
    const st = dayState(day.day);
    if (st.doneOverride !== null) return st.doneOverride;
    const tot = totalUnits(day);
    return tot > 0 && checkedUnits(day) === tot;
  }

  function buildDaySteps(day) {
    const rounds = day.rounds || 1;
    const steps = [];
    for (let r = 0; r < rounds; r++) {
      day.exercises.forEach((ex, e) => {
        steps.push({ type: "exercise", roundIdx: r, exIdx: e, ex, checkKey: `${r}-${e}` });
        const restSeconds = ex.restAfter || (e < day.exercises.length - 1 ? day.restBetweenExercises : null);
        if (restSeconds) {
          const nextName = e < day.exercises.length - 1 ? day.exercises[e + 1].name : null;
          steps.push({
            type: "rest", roundIdx: r, seconds: restSeconds,
            label: nextName ? `antes de ${nextName}` : null,
            restKey: `r${r}-e${e}`,
          });
        }
      });
      if (rounds > 1 && r < rounds - 1 && day.restBetweenRounds) {
        steps.push({
          type: "rest", roundIdx: r, seconds: day.restBetweenRounds,
          label: `antes de la ronda ${r + 2}`, restKey: `round${r}`, isRoundRest: true,
        });
      }
    }
    return steps;
  }

  /* ---------- Elements ---------- */
  const calendarView = document.getElementById("calendarView");
  const dayView = document.getElementById("dayView");
  const dayContent = document.getElementById("dayContent");
  const weeksContainer = document.getElementById("weeksContainer");
  const backBtn = document.getElementById("backBtn");
  const overallFill = document.getElementById("overallFill");
  const overallLabel = document.getElementById("overallLabel");
  const streakCount = document.getElementById("streakCount");
  const resetBtn = document.getElementById("resetBtn");

  backBtn.addEventListener("click", () => showCalendar());
  resetBtn.addEventListener("click", () => {
    if (confirm("¿Reiniciar todo tu progreso? Esta acción no se puede deshacer.")) {
      progress = {};
      resetAllTimers();
      saveProgress();
      renderCalendar();
      if (currentDay) renderDay(currentDay);
    }
  });

  /* ---------- Calendar rendering ---------- */
  function renderCalendar() {
    weeksContainer.innerHTML = "";
    const weeks = {};
    WORKOUTS.forEach(d => {
      (weeks[d.week] = weeks[d.week] || []).push(d);
    });

    Object.keys(weeks).sort((a, b) => a - b).forEach(weekNum => {
      const block = document.createElement("div");
      block.className = "week-block";
      const label = weekNum <= 4 ? `Semana ${weekNum}` : "Final";
      block.innerHTML = `
        <div class="week-block__head">
          <span class="week-block__title">${label}</span>
          <div class="week-block__rule"></div>
        </div>
        <div class="day-grid"></div>
      `;
      const grid = block.querySelector(".day-grid");
      weeks[weekNum].forEach(day => grid.appendChild(dayCard(day)));
      weeksContainer.appendChild(block);
    });

    updateOverallProgress();
  }

  function dayCard(day) {
    const meta = TYPE_META[day.type];
    const done = isDayDone(day);
    const pct = totalUnits(day) ? Math.round((checkedUnits(day) / totalUnits(day)) * 100) : (done ? 100 : 0);
    const btn = document.createElement("button");
    btn.className = "day-card" + (done ? " is-done" : "");
    btn.style.setProperty("--type-color", meta.color);
    btn.innerHTML = `
      <div class="day-card__top">
        <span class="day-card__num">${day.day}</span>
        <span class="day-card__ring" style="background:conic-gradient(${meta.color} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)">${done ? '<span class="day-card__ring-check">✓</span>' : ""}</span>
      </div>
      <div>
        <div class="day-card__type">${meta.label}</div>
        <div class="day-card__title">${day.title}</div>
      </div>
    `;
    btn.addEventListener("click", () => showDay(day.day));
    return btn;
  }

  function updateOverallProgress() {
    const doneCount = WORKOUTS.filter(isDayDone).length;
    overallFill.style.width = `${(doneCount / WORKOUTS.length) * 100}%`;
    overallLabel.textContent = `${doneCount} / ${WORKOUTS.length} días completados`;
    streakCount.textContent = doneCount;
  }

  /* ---------- Day view ---------- */
  function showCalendar() {
    dayView.hidden = true;
    calendarView.hidden = false;
    currentDay = null;
    renderCalendar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDay(dayNum) {
    currentDay = dayNum;
    calendarView.hidden = true;
    dayView.hidden = false;
    renderDay(dayNum);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showDayInPlace(dayNum) {
    currentDay = dayNum;
    renderDay(dayNum);
  }

  function renderDay(dayNum) {
    clearDayDisplays(dayNum);
    const day = WORKOUTS.find(d => d.day === dayNum);
    const meta = TYPE_META[day.type];
    const rounds = day.rounds || 1;
    const st = dayState(day.day);
    const done = isDayDone(day);

    dayContent.innerHTML = "";
    dayContent.style.setProperty("--type-color", meta.color);

    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `
      <span class="day-head__num">${String(day.day).padStart(2, "0")}</span>
      <div class="day-head__meta">
        <span class="day-head__badge" style="--type-color:${meta.color}">${meta.label}</span>
        <h2 class="day-head__title">${day.title}</h2>
        <span class="day-head__format">${day.format}</span>
      </div>
    `;
    dayContent.appendChild(head);

    if (day.tip) {
      const tip = document.createElement("div");
      tip.className = "day-tip";
      tip.textContent = "💡 " + day.tip;
      dayContent.appendChild(tip);
    }

    if (day.type !== "descanso") {
      const warmup = document.createElement("details");
      warmup.className = "warmup";
      warmup.innerHTML = `
        <summary>${WARMUP.title}</summary>
        <ul>${WARMUP.items.map(i => `<li>${i}</li>`).join("")}</ul>
      `;
      dayContent.appendChild(warmup);
    }

    const startBtn = document.createElement("button");
    startBtn.className = "start-workout-btn";
    startBtn.innerHTML = `<span>▶</span> Iniciar entrenamiento`;
    startBtn.addEventListener("click", () => startTraining(dayNum));
    dayContent.appendChild(startBtn);

    if (rounds > 1) {
      const track = document.createElement("div");
      track.className = "rounds-track";
      const roundsDoneList = [];
      for (let r = 0; r < rounds; r++) {
        const roundChecked = day.exercises.every((_, e) => st.checks[`${r}-${e}`]);
        roundsDoneList.push(roundChecked);
      }
      track.innerHTML = `<span class="rounds-track__label">Rondas</span>` +
        Array.from({ length: rounds }, (_, r) => {
          const cls = roundsDoneList[r] ? "is-complete" : "";
          return `<span class="round-pill ${cls}">Ronda ${r + 1}</span>`;
        }).join("");
      dayContent.appendChild(track);
    }

    const list = document.createElement("div");
    list.className = "exercise-list";

    let lastRound = -1;
    buildDaySteps(day).forEach(step => {
      if (rounds > 1 && step.type === "exercise" && step.exIdx === 0 && step.roundIdx !== lastRound) {
        lastRound = step.roundIdx;
        const rlabel = document.createElement("div");
        rlabel.className = "rounds-track__label";
        rlabel.style.marginTop = step.roundIdx > 0 ? "6px" : "0";
        rlabel.textContent = `Ronda ${step.roundIdx + 1}`;
        list.appendChild(rlabel);
      }
      if (step.type === "exercise") {
        list.appendChild(exerciseRow(day, step.ex, step.roundIdx, step.exIdx, st));
      } else {
        list.appendChild(restRow(dayNum, step.restKey, step.seconds, `Descanso · ${step.label}`, step.isRoundRest));
      }
    });
    dayContent.appendChild(list);

    const completeBox = document.createElement("button");
    completeBox.className = "complete-box" + (done ? " is-done" : "");
    completeBox.innerHTML = `
      <span class="complete-box__check">✓</span>
      <span>
        <div class="complete-box__label">${done ? "¡Día completado!" : "Marcar día como completado"}</div>
        <div class="complete-box__sub">${done ? "Buen trabajo. Puedes desmarcarlo si te equivocaste." : "Se marca solo al completar todo, o puedes marcarlo tú manualmente."}</div>
      </span>
    `;
    completeBox.addEventListener("click", () => {
      st.doneOverride = isDayDone(day) ? false : true;
      saveProgress();
      renderDay(dayNum);
    });
    dayContent.appendChild(completeBox);

    const nav = document.createElement("div");
    nav.className = "day-nav";
    const prev = document.createElement("button");
    prev.className = "day-nav__btn";
    prev.textContent = "← Día anterior";
    prev.disabled = dayNum <= 1;
    prev.addEventListener("click", () => showDayInPlace(dayNum - 1));
    const next = document.createElement("button");
    next.className = "day-nav__btn";
    next.textContent = "Día siguiente →";
    next.disabled = dayNum >= WORKOUTS.length;
    next.addEventListener("click", () => showDayInPlace(dayNum + 1));
    nav.appendChild(prev);
    nav.appendChild(next);
    dayContent.appendChild(nav);
  }

  function exerciseRow(day, ex, roundIdx, exIdx, st) {
    const key = `${roundIdx}-${exIdx}`;
    const checked = !!st.checks[key];
    const row = document.createElement("div");
    row.className = "exercise" + (checked ? " is-checked" : "");

    const main = document.createElement("div");
    main.className = "exercise__row";

    const checkBtn = document.createElement("button");
    checkBtn.className = "exercise__check";
    checkBtn.setAttribute("aria-label", "Marcar ejercicio hecho");
    checkBtn.textContent = checked ? "✓" : "";
    checkBtn.addEventListener("click", () => {
      st.checks[key] = !st.checks[key];
      st.doneOverride = null; // let completion follow the checklist again
      saveProgress();
      renderDay(currentDay);
    });
    main.appendChild(checkBtn);

    const body = document.createElement("div");
    body.className = "exercise__body";
    let amountText = "";
    if (ex.reps) amountText = `${ex.reps} reps`;
    else if (ex.seconds) amountText = formatDuration(ex.seconds) + (ex.repeatLabel ? ` ${ex.repeatLabel}` : "");
    else amountText = "";
    body.innerHTML = `
      <div class="exercise__name">${ex.name}</div>
      ${amountText ? `<div class="exercise__amount">${amountText}</div>` : ""}
      ${ex.scale ? `<div class="exercise__scale">${ex.scale}</div>` : ""}
    `;
    main.appendChild(body);

    let tKey = null;
    if (ex.seconds) {
      tKey = `${day.day}-${key}`;
      main.appendChild(timerWidget(day.day, key, ex.seconds, ex.name));
    }
    row.appendChild(main);
    if (tKey) row.appendChild(timerBar(tKey));

    return row;
  }

  function restRow(dayNum, keySuffix, seconds, label, isRoundRest) {
    const row = document.createElement("div");
    row.className = "exercise exercise--rest" + (isRoundRest ? " exercise--round-rest" : "");

    const main = document.createElement("div");
    main.className = "exercise__row";

    const icon = document.createElement("div");
    icon.className = "exercise__rest-icon";
    icon.textContent = "💤";
    main.appendChild(icon);

    const body = document.createElement("div");
    body.className = "exercise__body";
    body.innerHTML = `
      <div class="exercise__name">Descanso</div>
      <div class="exercise__amount">${formatDuration(seconds)}</div>
    `;
    main.appendChild(body);

    const tKey = `${dayNum}-rest-${keySuffix}`;
    main.appendChild(timerWidget(dayNum, `rest-${keySuffix}`, seconds, label));
    row.appendChild(main);
    row.appendChild(timerBar(tKey));
    return row;
  }

  /* ---------- Workout mode (full screen) ---------- */
  let workoutState = null; // { day, steps, index }
  let workoutActiveTKey = null;

  const workoutOverlay = document.getElementById("workoutOverlay");
  const workoutBody = document.getElementById("workoutBody");
  const workoutProgressFill = document.getElementById("workoutProgressFill");
  const workoutProgressLabel = document.getElementById("workoutProgressLabel");
  const workoutExitBtn = document.getElementById("workoutExitBtn");
  workoutOverlay.hidden = true;
  workoutOverlay.style.display = "none";

  workoutExitBtn.addEventListener("click", () => exitWorkout());

  function startTraining(dayNum) {
    const day = WORKOUTS.find(d => d.day === dayNum);
    const steps = buildDaySteps(day);
    if (!steps.length) return;
    workoutState = { day, steps, index: 0 };
    workoutOverlay.hidden = false;
    workoutOverlay.style.display = "flex";
    document.body.classList.add("workout-active");
    renderWorkoutStep();
  }

  function exitWorkout() {
    if (workoutActiveTKey) pauseTimer(workoutActiveTKey);
    workoutActiveTKey = null;
    const day = workoutState ? workoutState.day : null;
    workoutState = null;
    workoutOverlay.hidden = true;
    workoutOverlay.style.display = "none";
    document.body.classList.remove("workout-active");
    if (day) renderDay(day.day);
  }

  function renderWorkoutStep() {
    if (!workoutState) return;
    const { day, steps, index } = workoutState;
    if (index >= steps.length) { renderWorkoutComplete(); return; }
    const step = steps[index];

    workoutProgressFill.style.width = `${(index / steps.length) * 100}%`;
    workoutProgressLabel.textContent = `Paso ${index + 1} / ${steps.length}`;
    workoutBody.innerHTML = "";
    workoutActiveTKey = null;

    const wrap = document.createElement("div");
    wrap.className = "workout-step" + (step.type === "rest" ? " workout-step--rest" : "");

    if (step.type === "exercise") {
      const meta = TYPE_META[day.type];
      wrap.style.setProperty("--type-color", meta.color);
      const roundsLabel = (day.rounds || 1) > 1
        ? `<div class="workout-step__round">Ronda ${step.roundIdx + 1} de ${day.rounds}</div>` : "";
      wrap.innerHTML = `
        ${roundsLabel}
        <div class="workout-step__badge">${meta.label}</div>
        <h2 class="workout-step__name">${step.ex.name}</h2>
        ${step.ex.scale ? `<div class="workout-step__scale">${step.ex.scale}</div>` : ""}
      `;
      if (step.ex.seconds) {
        const tKey = `${day.day}-${step.checkKey}`;
        ensureTimer(tKey, step.ex.seconds, step.ex.name);
        workoutActiveTKey = tKey;
        wrap.appendChild(bigTimerDisplay(tKey));
        wrap.appendChild(workoutSkipBtn("Saltar ▶"));
        startTimer(tKey);
      } else {
        const amount = document.createElement("div");
        amount.className = "workout-step__amount";
        amount.textContent = step.ex.reps ? `${step.ex.reps} reps` : "";
        wrap.appendChild(amount);
        const nextBtn = document.createElement("button");
        nextBtn.className = "workout-step__next-btn";
        nextBtn.textContent = "✓ Hecho, siguiente";
        nextBtn.addEventListener("click", () => {
          const st = dayState(day.day);
          st.checks[step.checkKey] = true;
          st.doneOverride = null;
          saveProgress();
          advanceWorkout();
        });
        wrap.appendChild(nextBtn);
      }
    } else {
      const nextStep = steps[index + 1];
      const nextPreview = nextStep && nextStep.type === "exercise"
        ? `<div class="workout-step__next-preview">Después: ${nextStep.ex.name}</div>` : "";
      wrap.innerHTML = `
        <div class="workout-step__badge workout-step__badge--rest">Descanso</div>
        <h2 class="workout-step__name">💤 Descanso</h2>
        ${nextPreview}
      `;
      const tKey = `${day.day}-rest-${step.restKey}`;
      ensureTimer(tKey, step.seconds, step.label ? `Descanso · ${step.label}` : "Descanso");
      workoutActiveTKey = tKey;
      wrap.appendChild(bigTimerDisplay(tKey));
      wrap.appendChild(workoutSkipBtn("Saltar descanso ▶"));
      startTimer(tKey);
    }

    workoutBody.appendChild(wrap);

    if (index > 0) {
      const back = document.createElement("button");
      back.className = "workout-step__back";
      back.textContent = "‹ Anterior";
      back.addEventListener("click", () => {
        if (workoutActiveTKey) pauseTimer(workoutActiveTKey);
        workoutState.index -= 1;
        renderWorkoutStep();
      });
      workoutBody.appendChild(back);
    }
  }

  function workoutSkipBtn(text) {
    const btn = document.createElement("button");
    btn.className = "workout-step__skip";
    btn.textContent = text;
    btn.addEventListener("click", () => advanceWorkout());
    return btn;
  }

  function bigTimerDisplay(tKey) {
    const t = timers[tKey];
    const wrap = document.createElement("div");
    wrap.className = "workout-timer" + (t.running ? " is-running" : "");
    const display = document.createElement("div");
    display.className = "workout-timer__display";
    display.textContent = formatClock(Math.max(t.remaining, 0));
    const bar = document.createElement("div");
    bar.className = "workout-timer__bar";
    const fill = document.createElement("div");
    fill.className = "workout-timer__bar-fill";
    bar.appendChild(fill);
    wrap.appendChild(display);
    wrap.appendChild(bar);

    registerDisplay(tKey, (tt) => {
      display.textContent = formatClock(Math.max(tt.remaining, 0));
      const pct = tt.total ? ((tt.total - tt.remaining) / tt.total) * 100 : 0;
      fill.style.width = Math.min(100, Math.max(0, pct)) + "%";
      wrap.classList.toggle("is-running", tt.running);
    });
    return wrap;
  }

  function advanceWorkout() {
    if (!workoutState) return;
    if (workoutActiveTKey) pauseTimer(workoutActiveTKey);
    workoutState.index += 1;
    renderWorkoutStep();
  }

  function renderWorkoutComplete() {
    const { day, steps } = workoutState;
    const st = dayState(day.day);
    st.doneOverride = true;
    saveProgress();
    workoutBody.innerHTML = `
      <div class="workout-step workout-step--done">
        <div class="workout-step__badge">¡Completado!</div>
        <h2 class="workout-step__name">Día ${day.day} hecho 💪</h2>
        <p class="workout-step__scale">Buen trabajo. Cierra para volver al calendario.</p>
        <button class="workout-step__next-btn" id="workoutFinishBtn">Volver al día</button>
      </div>
    `;
    workoutProgressFill.style.width = "100%";
    workoutProgressLabel.textContent = `${steps.length} / ${steps.length}`;
    document.getElementById("workoutFinishBtn").addEventListener("click", () => exitWorkout());
  }

  /* ---------- Timers ---------- */
  const timerDisplays = {}; // tKey -> Set(updateFn)
  let floatingTimerKey = null;

  const floatingEl = document.getElementById("floatingTimer");
  const floatingName = document.getElementById("floatingName");
  const floatingDisplay = document.getElementById("floatingDisplay");
  const floatingPlayPause = document.getElementById("floatingPlayPause");
  const floatingResetBtn = document.getElementById("floatingReset");
  const floatingCloseBtn = document.getElementById("floatingClose");
  floatingEl.hidden = true;
  floatingEl.style.display = "none";

  function formatDuration(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    if (m > 0) return `${m}:${String(s).padStart(2, "0")} min`;
    return `${s} s`;
  }
  function formatClock(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(1, "0")}:${String(s).padStart(2, "0")}`;
  }

  function ensureTimer(tKey, seconds, label) {
    if (!timers[tKey]) timers[tKey] = { remaining: seconds, total: seconds, running: false, intervalId: null, label };
    timers[tKey].label = label;
    return timers[tKey];
  }

  function registerDisplay(tKey, fn) {
    if (!timerDisplays[tKey]) timerDisplays[tKey] = new Set();
    timerDisplays[tKey].add(fn);
  }

  function clearDayDisplays(dayNum) {
    Object.keys(timerDisplays).forEach(k => {
      if (k.startsWith(`${dayNum}-`)) delete timerDisplays[k];
    });
  }

  function refreshDisplays(tKey) {
    const t = timers[tKey];
    if (!t) return;
    (timerDisplays[tKey] || []).forEach(fn => fn(t));
    if (floatingTimerKey === tKey) updateFloatingUI();
  }

  function startTimer(tKey) {
    const t = timers[tKey];
    if (!t || t.running) return;
    if (t.remaining <= 0) t.remaining = t.total;
    t.running = true;
    t.intervalId = setInterval(() => tick(tKey), 1000);
    refreshDisplays(tKey);
  }
  function pauseTimer(tKey) {
    const t = timers[tKey];
    if (!t) return;
    if (t.intervalId) clearInterval(t.intervalId);
    t.intervalId = null;
    t.running = false;
    refreshDisplays(tKey);
  }
  function resetTimer(tKey) {
    const t = timers[tKey];
    if (!t) return;
    pauseTimer(tKey);
    t.remaining = t.total;
    refreshDisplays(tKey);
  }
  function tick(tKey) {
    const t = timers[tKey];
    if (!t) return;
    t.remaining -= 1;
    if (t.remaining <= 0) {
      t.remaining = 0;
      pauseTimer(tKey);
      beep();
      if (workoutState && workoutActiveTKey === tKey) {
        setTimeout(() => {
          if (workoutState && workoutActiveTKey === tKey) advanceWorkout();
        }, 700);
      }
    }
    refreshDisplays(tKey);
  }
  function stopAllTimers() {
    Object.keys(timers).forEach(pauseTimer);
    hideFloating();
  }
  function resetAllTimers() {
    Object.keys(timers).forEach(k => delete timers[k]);
    hideFloating();
  }

  function showFloating(tKey) {
    floatingTimerKey = tKey;
    floatingEl.hidden = false;
    floatingEl.style.display = "flex";
    document.body.classList.add("has-floating-timer");
    updateFloatingUI();
  }
  function hideFloating() {
    floatingTimerKey = null;
    floatingEl.hidden = true;
    floatingEl.style.display = "none";
    document.body.classList.remove("has-floating-timer");
  }
  function updateFloatingUI() {
    const t = timers[floatingTimerKey];
    if (!t) { hideFloating(); return; }
    floatingName.textContent = t.label || "Temporizador";
    floatingDisplay.textContent = formatClock(Math.max(t.remaining, 0));
    floatingEl.classList.toggle("is-running", t.running);
    floatingPlayPause.textContent = t.running ? "⏸" : "▶";
  }

  floatingPlayPause.addEventListener("click", () => {
    if (!floatingTimerKey) return;
    const t = timers[floatingTimerKey];
    if (t.running) pauseTimer(floatingTimerKey); else startTimer(floatingTimerKey);
  });
  floatingResetBtn.addEventListener("click", () => {
    if (floatingTimerKey) resetTimer(floatingTimerKey);
  });
  floatingCloseBtn.addEventListener("click", () => hideFloating());

  function timerBar(tKey) {
    const t = timers[tKey];
    const wrap = document.createElement("div");
    wrap.className = "exercise__bar-wrap";
    const bar = document.createElement("div");
    bar.className = "exercise__bar";
    const fill = document.createElement("div");
    fill.className = "exercise__bar-fill";
    bar.appendChild(fill);
    const label = document.createElement("div");
    label.className = "exercise__bar-label";
    wrap.appendChild(bar);
    wrap.appendChild(label);

    const update = (tt) => {
      const elapsed = Math.max(0, tt.total - tt.remaining);
      const pct = tt.total ? Math.min(100, (elapsed / tt.total) * 100) : 0;
      fill.style.width = pct + "%";
      label.textContent = `${formatClock(elapsed)} transcurrido · ${formatClock(Math.max(tt.remaining, 0))} restante`;
    };
    update(t);
    registerDisplay(tKey, update);
    return wrap;
  }

  function timerWidget(dayNum, key, seconds, label) {
    const tKey = `${dayNum}-${key}`;
    const t = ensureTimer(tKey, seconds, label);

    const wrap = document.createElement("div");
    wrap.className = "timer" + (t.running ? " is-running" : "");

    const display = document.createElement("span");
    display.className = "timer__display";
    display.textContent = formatClock(t.remaining);

    const playBtn = document.createElement("button");
    playBtn.className = "timer__btn";
    playBtn.setAttribute("aria-label", "Iniciar o pausar temporizador");
    playBtn.textContent = t.running ? "⏸" : "▶";

    const resetBtnEl = document.createElement("button");
    resetBtnEl.className = "timer__btn";
    resetBtnEl.setAttribute("aria-label", "Reiniciar temporizador");
    resetBtnEl.textContent = "↺";

    registerDisplay(tKey, (tt) => {
      display.textContent = formatClock(Math.max(tt.remaining, 0));
      wrap.classList.toggle("is-running", tt.running);
      playBtn.textContent = tt.running ? "⏸" : "▶";
    });

    playBtn.addEventListener("click", () => {
      if (t.running) {
        pauseTimer(tKey);
      } else {
        startTimer(tKey);
        showFloating(tKey);
      }
    });
    resetBtnEl.addEventListener("click", () => resetTimer(tKey));

    wrap.appendChild(display);
    wrap.appendChild(playBtn);
    wrap.appendChild(resetBtnEl);
    return wrap;
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) { /* audio unavailable, ignore */ }
  }

  /* ---------- Init ---------- */
  renderCalendar();
})();
