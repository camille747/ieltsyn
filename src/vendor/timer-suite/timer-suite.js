const template = document.createElement('template');
template.innerHTML = "<style>\n:host {\n      display: inline-block;\n      width: 276px;\n      height: 212px;\n      color: #fff;\n      font-family: -apple-system, BlinkMacSystemFont, \"SF Pro Display\", \"Segoe UI\", sans-serif;\n      font-synthesis: none;\n      contain: layout style;\n    }\n\n    .timer-suite,\n    .timer-suite * {\n      box-sizing: border-box;\n    }\n\n    .timer-suite :where(button) {\n      border: 0;\n      margin: 0;\n      padding: 0;\n      font: inherit;\n      color: inherit;\n      background: none;\n      cursor: pointer;\n      -webkit-tap-highlight-color: transparent;\n    }\n\n    .timer-suite button:focus-visible,\n    .timer-suite [role=\"listbox\"]:focus-visible {\n      outline: 2px solid rgba(255, 255, 255, .82);\n      outline-offset: 3px;\n    }\n\n    .timer-suite {\n      position: relative;\n      width: 276px;\n      height: 212px;\n      isolation: isolate;\n    }\n\n    .launcher {\n      position: absolute;\n      z-index: 3;\n      left: 59px;\n      width: 158px;\n      height: 54px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      gap: 9px;\n      border-radius: 27px;\n      color: #f7f7f5;\n      background: #292928;\n      font-size: 17px;\n      font-weight: 500;\n      letter-spacing: 0;\n      white-space: nowrap;\n      touch-action: manipulation;\n      box-shadow:\n        0 2px 3px rgba(0, 0, 0, .24),\n        0 11px 27px rgba(0, 0, 0, .14),\n        inset 0 1px 0 rgba(255, 255, 255, .055),\n        inset 0 0 0 1px rgba(255, 255, 255, .035);\n      transition:\n        top 320ms cubic-bezier(.2, .82, .2, 1),\n        opacity 180ms ease,\n        transform 320ms cubic-bezier(.2, .82, .2, 1);\n      will-change: opacity, transform;\n    }\n\n    .launcher-stopwatch {\n      top: 43px;\n    }\n\n    .launcher-countdown {\n      top: 115px;\n    }\n\n    .launcher-icon {\n      width: 20px;\n      height: 20px;\n      color: #a4a4a1;\n      stroke-width: 2;\n    }\n\n    @keyframes launcher-fade {\n      from { opacity: 1; transform: scale(1); }\n      to { opacity: 0; transform: scale(.94); }\n    }\n\n    @keyframes selected-launcher-out {\n      0% { opacity: 1; transform: scale(1); }\n      38%, 100% { opacity: 0; transform: scale(.96); }\n    }\n\n    @keyframes other-launcher-in {\n      from { opacity: 0; transform: scale(.94); }\n      to { opacity: 1; transform: scale(1); }\n    }\n\n    .timer-suite[data-phase=\"opening\"] .launcher {\n      animation: launcher-fade 260ms ease-out both;\n      pointer-events: none;\n    }\n\n    .timer-suite[data-phase=\"open\"] .launcher {\n      opacity: 0;\n      transform: scale(.94);\n      pointer-events: none;\n    }\n\n    .timer-suite[data-phase=\"opening\"][data-mode=\"stopwatch\"] .launcher-stopwatch,\n    .timer-suite[data-phase=\"opening\"][data-mode=\"countdown\"] .launcher-countdown {\n      z-index: 5;\n      animation: selected-launcher-out 420ms linear both;\n    }\n\n    .timer-suite[data-phase=\"closing\"] .launcher {\n      opacity: 1;\n      transform: scale(1);\n      animation: none;\n      pointer-events: none;\n    }\n\n    .timer-suite[data-phase=\"closing\"][data-mode=\"stopwatch\"] .launcher-countdown,\n    .timer-suite[data-phase=\"closing\"][data-mode=\"countdown\"] .launcher-stopwatch {\n      animation: other-launcher-in 500ms ease-out both;\n    }\n\n    .morph-shell {\n      --closed-y: -36px;\n      --closed-scale-x: .632;\n      --closed-scale-y: .255;\n      --open-radius: 36px;\n      position: absolute;\n      z-index: 4;\n      left: 13px;\n      top: 0;\n      width: 250px;\n      height: 212px;\n      border-radius: 36px;\n      overflow: hidden;\n      opacity: 0;\n      color: #f7f7f5;\n      background: #292928;\n      box-shadow:\n        0 3px 5px rgba(0, 0, 0, .25),\n        0 17px 34px rgba(0, 0, 0, .18),\n        inset 0 1px 0 rgba(255, 255, 255, .055),\n        inset 0 0 0 1px rgba(255, 255, 255, .035);\n      pointer-events: none;\n      transform: translate3d(0, var(--closed-y), 0) scale3d(var(--closed-scale-x), var(--closed-scale-y), 1);\n      transform-origin: 50% 50%;\n      transition:\n        left 480ms cubic-bezier(.2, .82, .2, 1),\n        top 480ms cubic-bezier(.2, .82, .2, 1),\n        width 480ms cubic-bezier(.2, .82, .2, 1),\n        height 480ms cubic-bezier(.2, .82, .2, 1),\n        border-radius 480ms cubic-bezier(.2, .82, .2, 1),\n        opacity 180ms ease,\n        box-shadow 480ms ease;\n      will-change: transform, opacity;\n    }\n\n    .timer-suite[data-mode=\"countdown\"] .morph-shell {\n      --closed-y: 36px;\n    }\n\n    @keyframes shell-open {\n      from {\n        opacity: 1;\n        transform: translate3d(0, var(--closed-y), 0) scale3d(var(--closed-scale-x), var(--closed-scale-y), 1);\n        border-radius: 50%;\n      }\n      to {\n        opacity: 1;\n        transform: translate3d(0, 0, 0) scale3d(1, 1, 1);\n        border-radius: var(--open-radius);\n      }\n    }\n\n    .timer-suite[data-phase=\"opening\"] .morph-shell {\n      animation: shell-open 420ms cubic-bezier(.16, 1, .3, 1) both;\n    }\n\n    .timer-suite:is([data-phase=\"closing\"], [data-phase=\"closed\"]) .morph-shell {\n      left: 59px;\n      top: 43px;\n      width: 158px;\n      height: 54px;\n      border-radius: 27px;\n      opacity: 1;\n      transform: none;\n      animation: none;\n      box-shadow:\n        0 2px 3px rgba(0, 0, 0, .24),\n        0 11px 27px rgba(0, 0, 0, .14),\n        inset 0 1px 0 rgba(255, 255, 255, .055),\n        inset 0 0 0 1px rgba(255, 255, 255, .035);\n    }\n\n    .timer-suite:is([data-phase=\"closing\"], [data-phase=\"closed\"])[data-mode=\"countdown\"] .morph-shell {\n      top: 115px;\n    }\n\n    .timer-suite[data-phase=\"closed\"] .morph-shell {\n      opacity: 0;\n      transition: none;\n    }\n\n    .timer-suite[data-phase=\"open\"] .morph-shell {\n      opacity: 1;\n      transform: translate3d(0, 0, 0) scale3d(1, 1, 1);\n      pointer-events: auto;\n    }\n\n    .timer-suite[data-phase=\"open\"][data-mode=\"countdown\"][data-countdown-state=\"running\"] .morph-shell {\n      --closed-scale-x: .572;\n      --closed-scale-y: .422;\n      --open-radius: 32px;\n      left: 0;\n      top: 42px;\n      width: 276px;\n      height: 128px;\n      border-radius: 32px;\n    }\n\n    .shell-idle-view {\n      position: absolute;\n      z-index: 6;\n      inset: 0;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      gap: 9px;\n      color: #f7f7f5;\n      font-size: 17px;\n      font-weight: 500;\n      white-space: nowrap;\n      opacity: 0;\n      visibility: hidden;\n      pointer-events: none;\n      transition: opacity 150ms ease, visibility 0s linear 150ms;\n    }\n\n    .shell-idle-view .launcher-icon {\n      flex: 0 0 auto;\n    }\n\n    .shell-idle-stopwatch,\n    .shell-idle-countdown {\n      display: none;\n    }\n\n    .timer-suite[data-mode=\"stopwatch\"] .shell-idle-stopwatch,\n    .timer-suite[data-mode=\"countdown\"] .shell-idle-countdown {\n      display: inline;\n    }\n\n    .timer-suite[data-phase=\"closing\"] .shell-idle-view {\n      opacity: 1;\n      visibility: visible;\n      transition: opacity 180ms ease 150ms, visibility 0s linear 0s;\n    }\n\n    .mode-view,\n    .subview {\n      position: absolute;\n      inset: 0;\n      opacity: 0;\n      visibility: hidden;\n      pointer-events: none;\n      transition: opacity 150ms ease, visibility 0s linear 150ms;\n    }\n\n    .timer-suite:is([data-phase=\"opening\"], [data-phase=\"open\"])[data-mode=\"stopwatch\"] .stopwatch-view,\n    .timer-suite:is([data-phase=\"opening\"], [data-phase=\"open\"])[data-mode=\"countdown\"] .countdown-view {\n      opacity: 1;\n      visibility: visible;\n      pointer-events: auto;\n      transition: opacity 180ms ease 150ms, visibility 0s linear 0s;\n    }\n\n    .timer-suite:is([data-phase=\"opening\"], [data-phase=\"open\"])[data-mode=\"countdown\"][data-countdown-state=\"picker\"] .countdown-picker,\n    .timer-suite:is([data-phase=\"opening\"], [data-phase=\"open\"])[data-mode=\"countdown\"][data-countdown-state=\"running\"] .countdown-running {\n      opacity: 1;\n      visibility: visible;\n      pointer-events: auto;\n      transition: none;\n    }\n\n    /* Stopwatch */\n    .stopwatch-time {\n      position: absolute;\n      top: 49px;\n      left: 50%;\n      width: 220px;\n      transform: translateX(-50%);\n      color: #f7f7f5;\n      text-align: center;\n      font-size: 32px;\n      font-weight: 680;\n      line-height: 1;\n      letter-spacing: 0;\n      font-variant-numeric: tabular-nums;\n      text-shadow: 0 1px 2px rgba(0, 0, 0, .34);\n    }\n\n    .stopwatch-controls {\n      position: absolute;\n      left: 50%;\n      bottom: 34px;\n      width: 220px;\n      height: 40px;\n      transform: translateX(-50%);\n    }\n\n    .stopwatch-control {\n      position: absolute;\n      top: 0;\n      height: 40px;\n      border-radius: 999px;\n      font-size: 16px;\n      font-weight: 560;\n      line-height: 1;\n      white-space: nowrap;\n      box-shadow:\n        inset 0 1px 0 rgba(255, 255, 255, .055),\n        inset 0 0 0 1px rgba(255, 255, 255, .035);\n      transition:\n        left 400ms cubic-bezier(.2, .82, .2, 1),\n        right 400ms cubic-bezier(.2, .82, .2, 1),\n        opacity 180ms ease,\n        transform 400ms cubic-bezier(.2, .82, .2, 1),\n        background-color 150ms ease;\n    }\n\n    .stopwatch-control:active {\n      transform: scale(.95);\n    }\n\n    .stopwatch-start {\n      left: 64px;\n      width: 92px;\n      z-index: 2;\n      color: #24f05a;\n      background: rgba(0, 127, 18, .22);\n    }\n\n    .stopwatch-pause,\n    .stopwatch-cancel {\n      width: 84px;\n      z-index: 1;\n      opacity: 0;\n      pointer-events: none;\n      background: #353534;\n      font-size: 14px;\n    }\n\n    .stopwatch-pause {\n      left: 68px;\n      color: #fe9119;\n      transform: scale(.76);\n    }\n\n    .stopwatch-cancel {\n      right: 68px;\n      color: #f4f4f2;\n      transform: scale(.76);\n    }\n\n    .timer-suite[data-stopwatch-state=\"active\"] .stopwatch-start {\n      opacity: 0;\n      transform: scale(.62);\n      pointer-events: none;\n    }\n\n    .timer-suite[data-stopwatch-state=\"active\"] .stopwatch-pause,\n    .timer-suite[data-stopwatch-state=\"active\"] .stopwatch-cancel {\n      opacity: 1;\n      transform: scale(1);\n      pointer-events: auto;\n    }\n\n    .timer-suite[data-stopwatch-state=\"active\"] .stopwatch-pause {\n      left: 18px;\n    }\n\n    .timer-suite[data-stopwatch-state=\"active\"] .stopwatch-cancel {\n      right: 18px;\n    }\n\n    /* Countdown picker */\n    .wheel-wrap {\n      position: absolute;\n      inset: 0;\n      overflow: hidden;\n    }\n\n    .wheel-wrap::before,\n    .wheel-wrap::after {\n      content: \"\";\n      position: absolute;\n      z-index: 3;\n      left: 0;\n      width: 108px;\n      height: 68px;\n      pointer-events: none;\n    }\n\n    .wheel-wrap::before {\n      top: 0;\n      background: linear-gradient(#292928 7%, rgba(41, 41, 40, .92) 43%, rgba(41, 41, 40, 0));\n    }\n\n    .wheel-wrap::after {\n      bottom: 0;\n      background: linear-gradient(rgba(41, 41, 40, 0), rgba(41, 41, 40, .92) 57%, #292928 93%);\n    }\n\n    .minute-wheel {\n      position: absolute;\n      inset: 0;\n      margin: 0;\n      padding: 87px 0;\n      overflow-y: auto;\n      overscroll-behavior: contain;\n      scrollbar-width: none;\n      scroll-snap-type: y mandatory;\n      touch-action: none;\n      cursor: grab;\n      user-select: none;\n      -webkit-user-select: none;\n    }\n\n    .minute-wheel::-webkit-scrollbar {\n      display: none;\n    }\n\n    .minute-wheel.is-dragging,\n    .minute-wheel.is-gliding,\n    .minute-wheel.is-positioning {\n      scroll-snap-type: none;\n    }\n\n    .minute-wheel.is-dragging {\n      cursor: grabbing;\n    }\n\n    .minute-option {\n      width: 108px;\n      height: 38px;\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      scroll-snap-align: center;\n      color: #6d6d6a;\n      font-size: 22px;\n      font-weight: 550;\n      line-height: 1;\n      text-shadow: 0 1px 3px rgba(0, 0, 0, .5);\n      opacity: .55;\n      transform: scale(.92);\n      transition: color 140ms ease, opacity 140ms ease, transform 140ms ease;\n      cursor: grab;\n    }\n\n    .minute-option.is-near {\n      color: #989894;\n      opacity: .78;\n      filter: blur(.25px);\n      transform: scale(.96);\n    }\n\n    .minute-option[aria-selected=\"true\"] {\n      color: #f7f7f5;\n      font-size: 31px;\n      font-weight: 680;\n      opacity: 1;\n      filter: none;\n      transform: scale(1);\n    }\n\n    .minute-label {\n      position: absolute;\n      z-index: 4;\n      top: 50%;\n      left: 82px;\n      transform: translateY(-50%);\n      color: #f7f7f5;\n      font-size: 22px;\n      font-weight: 610;\n      white-space: nowrap;\n      pointer-events: none;\n    }\n\n    .countdown-start {\n      position: absolute;\n      z-index: 5;\n      right: 15px;\n      bottom: 19px;\n      padding: 7px 13px 8px;\n      border-radius: 999px;\n      color: #24f05a;\n      background: rgba(0, 127, 18, .18);\n      font-size: 19px;\n      font-weight: 500;\n      line-height: 1;\n    }\n\n    /* Countdown running */\n    .countdown-running {\n      display: grid;\n      grid-template-columns: 80px 1fr 80px;\n      align-items: center;\n      padding: 0 18px;\n    }\n\n    .progress-ring {\n      position: absolute;\n      inset: 0;\n      width: 100%;\n      height: 100%;\n      pointer-events: none;\n    }\n\n    .progress-track,\n    .progress-value {\n      fill: none;\n      stroke-width: 5;\n      stroke-linecap: round;\n      stroke-linejoin: round;\n    }\n\n    .progress-track {\n      stroke: #885049;\n    }\n\n    .progress-value {\n      stroke: #e35d37;\n      stroke-dasharray: 100 100;\n      filter: drop-shadow(0 0 1.5px rgba(227, 93, 55, .38));\n    }\n\n    .countdown-action,\n    .countdown-time {\n      position: relative;\n      z-index: 2;\n    }\n\n    .countdown-action {\n      min-width: 58px;\n      min-height: 44px;\n      border-radius: 14px;\n      font-size: 14px;\n      font-weight: 520;\n    }\n\n    .countdown-action:active {\n      transform: scale(.94);\n    }\n\n    .countdown-pause {\n      justify-self: start;\n      color: #fe9119;\n    }\n\n    .countdown-cancel {\n      justify-self: end;\n      margin-right: 4px;\n      color: #f4f4f2;\n    }\n\n    .countdown-time {\n      justify-self: center;\n      min-width: 92px;\n      color: #f7f7f5;\n      text-align: center;\n      font-size: 31px;\n      font-weight: 690;\n      line-height: 1;\n      letter-spacing: 0;\n      font-variant-numeric: tabular-nums;\n      text-shadow: 0 1px 2px rgba(0, 0, 0, .32);\n    }\n\n    @media (prefers-reduced-motion: reduce) {\n      .launcher,\n      .morph-shell,\n      .shell-idle-view,\n      .mode-view,\n      .subview,\n      .stopwatch-control,\n      .minute-option,\n      .progress-value {\n        transition-duration: 1ms !important;\n        transition-delay: 0ms !important;\n        animation-duration: 1ms !important;\n      }\n    }\n</style>\n<main class=\"timer-suite\" data-phase=\"idle\" data-mode=\"\" data-stopwatch-state=\"ready\" data-countdown-state=\"picker\">\n    <button class=\"launcher launcher-stopwatch\" type=\"button\" aria-label=\"打开正计时\">\n      <svg class=\"launcher-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n        <path d=\"M10 2h4\"></path><path d=\"M12 14v-4\"></path><path d=\"m4 4 2 2\"></path><circle cx=\"12\" cy=\"14\" r=\"8\"></circle>\n      </svg>\n      <span>正计时</span>\n    </button>\n\n    <button class=\"launcher launcher-countdown\" type=\"button\" aria-label=\"打开倒计时\">\n      <svg class=\"launcher-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n        <path d=\"M10 2h4\"></path><path d=\"M12 14v-4\"></path><path d=\"m4 4 2 2\"></path><circle cx=\"12\" cy=\"14\" r=\"8\"></circle>\n      </svg>\n      <span>倒计时</span>\n    </button>\n\n    <section class=\"morph-shell\" aria-label=\"Timer controls\">\n      <div class=\"shell-idle-view\" aria-hidden=\"true\">\n        <svg class=\"launcher-icon\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">\n          <path d=\"M10 2h4\"></path><path d=\"M12 14v-4\"></path><path d=\"m4 4 2 2\"></path><circle cx=\"12\" cy=\"14\" r=\"8\"></circle>\n        </svg>\n        <span class=\"shell-idle-stopwatch\">正计时</span>\n        <span class=\"shell-idle-countdown\">倒计时</span>\n      </div>\n\n      <div class=\"mode-view stopwatch-view\">\n        <output class=\"stopwatch-time\" aria-live=\"off\">00:00:00</output>\n        <div class=\"stopwatch-controls\">\n          <button class=\"stopwatch-control stopwatch-start\" type=\"button\">Start</button>\n          <button class=\"stopwatch-control stopwatch-pause\" type=\"button\">Pause</button>\n          <button class=\"stopwatch-control stopwatch-cancel\" type=\"button\">Cancel</button>\n        </div>\n      </div>\n\n      <div class=\"mode-view countdown-view\">\n        <div class=\"subview countdown-picker\">\n          <div class=\"wheel-wrap\">\n            <div class=\"minute-wheel\" role=\"listbox\" tabindex=\"0\" aria-label=\"Minutes\"></div>\n          </div>\n          <span class=\"minute-label\">mins</span>\n          <button class=\"countdown-start\" type=\"button\">Start</button>\n        </div>\n\n        <div class=\"subview countdown-running\">\n          <svg class=\"progress-ring\" viewBox=\"0 0 276 128\" preserveAspectRatio=\"none\" aria-hidden=\"true\">\n            <path class=\"progress-track\" pathLength=\"100\" d=\"M138 5 H243 A28 28 0 0 1 271 33 V95 A28 28 0 0 1 243 123 H33 A28 28 0 0 1 5 95 V33 A28 28 0 0 1 33 5 H138\"></path>\n            <path class=\"progress-value\" pathLength=\"100\" d=\"M138 5 H243 A28 28 0 0 1 271 33 V95 A28 28 0 0 1 243 123 H33 A28 28 0 0 1 5 95 V33 A28 28 0 0 1 33 5 H138\"></path>\n          </svg>\n          <button class=\"countdown-action countdown-pause\" type=\"button\">Pause</button>\n          <output class=\"countdown-time\" aria-live=\"polite\">1:00</output>\n          <button class=\"countdown-action countdown-cancel\" type=\"button\">Cancel</button>\n        </div>\n      </div>\n    </section>\n  </main>";

function initialiseTimerSuite(root) {
      const suite = root.querySelector('.timer-suite');
      const stopwatchLauncher = suite.querySelector('.launcher-stopwatch');
      const countdownLauncher = suite.querySelector('.launcher-countdown');
      const stopwatchTime = suite.querySelector('.stopwatch-time');
      const stopwatchStart = suite.querySelector('.stopwatch-start');
      const stopwatchPause = suite.querySelector('.stopwatch-pause');
      const stopwatchCancel = suite.querySelector('.stopwatch-cancel');
      const wheel = suite.querySelector('.minute-wheel');
      const countdownStart = suite.querySelector('.countdown-start');
      const countdownPause = suite.querySelector('.countdown-pause');
      const countdownCancel = suite.querySelector('.countdown-cancel');
      const countdownTime = suite.querySelector('.countdown-time');
      const progressValue = suite.querySelector('.progress-value');

      let phaseTimers = [];
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Stopwatch state
      let stopwatchElapsed = 0;
      let stopwatchStartedAt = 0;
      let stopwatchRunning = false;
      let stopwatchFrame = 0;

      // Countdown state
      const optionHeight = 38;
      const maxMinutes = 180;
      const loopCopies = 3;
      const middleCopy = Math.floor(loopCopies / 2);
      let selectedMinutes = 1;
      let activeIndex = middleCopy * maxMinutes;
      let styledIndices = [];
      let countdownDuration = 60_000;
      let countdownRemaining = countdownDuration;
      let countdownDeadline = 0;
      let countdownPaused = false;
      let countdownFrame = 0;
      let scrollFrame = 0;
      let inertiaFrame = 0;
      let pickerPositionTimer = 0;
      let dragPointerId = null;
      let dragLastY = 0;
      let dragLastTime = 0;
      let dragVelocity = 0;
      let dragDistance = 0;
      let suppressOptionClick = false;

      const clearPhaseTimers = () => {
        phaseTimers.forEach((timer) => window.clearTimeout(timer));
        phaseTimers = [];
      };

      const schedulePhase = (phase, delay) => {
        phaseTimers.push(window.setTimeout(() => {
          suite.dataset.phase = phase;
        }, delay));
      };

      const formatStopwatch = (milliseconds) => {
        const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
      };

      const drawStopwatch = (now = performance.now()) => {
        const elapsed = stopwatchRunning ? stopwatchElapsed + now - stopwatchStartedAt : stopwatchElapsed;
        const value = formatStopwatch(elapsed);
        stopwatchTime.value = value;
        stopwatchTime.textContent = value;
      };

      const tickStopwatch = (now) => {
        if (!stopwatchRunning) return;
        drawStopwatch(now);
        stopwatchFrame = requestAnimationFrame(tickStopwatch);
      };

      const resetStopwatch = () => {
        cancelAnimationFrame(stopwatchFrame);
        stopwatchRunning = false;
        stopwatchElapsed = 0;
        stopwatchStartedAt = 0;
        stopwatchPause.textContent = 'Pause';
        suite.dataset.stopwatchState = 'ready';
        drawStopwatch();
      };

      const startStopwatch = () => {
        stopwatchRunning = true;
        stopwatchElapsed = 0;
        stopwatchStartedAt = performance.now();
        stopwatchPause.textContent = 'Pause';
        suite.dataset.stopwatchState = 'active';
        drawStopwatch(stopwatchStartedAt);
        cancelAnimationFrame(stopwatchFrame);
        stopwatchFrame = requestAnimationFrame(tickStopwatch);
      };

      const toggleStopwatch = () => {
        if (stopwatchRunning) {
          stopwatchElapsed += performance.now() - stopwatchStartedAt;
          stopwatchRunning = false;
          cancelAnimationFrame(stopwatchFrame);
          stopwatchPause.textContent = 'Resume';
          drawStopwatch();
          return;
        }
        stopwatchRunning = true;
        stopwatchStartedAt = performance.now();
        stopwatchPause.textContent = 'Pause';
        stopwatchFrame = requestAnimationFrame(tickStopwatch);
      };

      const renderOptions = () => {
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < maxMinutes * loopCopies; index += 1) {
          const minute = (index % maxMinutes) + 1;
          const option = document.createElement('div');
          option.className = 'minute-option';
          option.dataset.value = String(minute);
          option.id = `suite-minute-${index}`;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          option.textContent = String(minute);
          option.addEventListener('click', (event) => {
            if (suppressOptionClick) {
              event.preventDefault();
              return;
            }
            selectIndex(index, true);
          });
          fragment.append(option);
        }
        wheel.append(fragment);
      };

      const updateOptionStyles = () => {
        styledIndices.forEach((index) => {
          const option = wheel.children[index];
          if (!option) return;
          option.setAttribute('aria-selected', 'false');
          option.classList.remove('is-near');
        });
        const current = wheel.children[activeIndex];
        const previous = wheel.children[activeIndex - 1];
        const next = wheel.children[activeIndex + 1];
        if (current) current.setAttribute('aria-selected', 'true');
        if (previous) previous.classList.add('is-near');
        if (next) next.classList.add('is-near');
        styledIndices = [activeIndex - 1, activeIndex, activeIndex + 1];
        wheel.setAttribute('aria-activedescendant', `suite-minute-${activeIndex}`);
      };

      const selectIndex = (index, smooth = false) => {
        activeIndex = Math.max(0, Math.min(maxMinutes * loopCopies - 1, index));
        selectedMinutes = (activeIndex % maxMinutes) + 1;
        updateOptionStyles();
        wheel.scrollTo({ top: activeIndex * optionHeight, behavior: smooth ? 'smooth' : 'auto' });
      };

      const selectMinute = (minute, smooth = false) => {
        const normalized = ((Math.round(minute) - 1) % maxMinutes + maxMinutes) % maxMinutes + 1;
        const offset = normalized - 1;
        const nearestCopy = Math.round((activeIndex - offset) / maxMinutes);
        const targetIndex = nearestCopy >= 0 && nearestCopy < loopCopies
          ? nearestCopy * maxMinutes + offset
          : middleCopy * maxMinutes + offset;
        selectIndex(targetIndex, smooth);
      };

      const stopInertia = () => {
        cancelAnimationFrame(inertiaFrame);
        inertiaFrame = 0;
        wheel.classList.remove('is-gliding');
      };

      const settleWheel = () => selectIndex(Math.round(wheel.scrollTop / optionHeight), true);

      const startInertia = () => {
        if (Math.abs(dragVelocity) < .025) {
          settleWheel();
          return;
        }
        wheel.classList.add('is-gliding');
        let previousTime = performance.now();
        const glide = (now) => {
          const elapsed = Math.min(32, Math.max(1, now - previousTime));
          previousTime = now;
          wheel.scrollTop += dragVelocity * elapsed;
          dragVelocity *= Math.pow(.92, elapsed / 16.67);
          if (Math.abs(dragVelocity) < .025) {
            wheel.classList.remove('is-gliding');
            settleWheel();
            return;
          }
          inertiaFrame = requestAnimationFrame(glide);
        };
        inertiaFrame = requestAnimationFrame(glide);
      };

      const formatCountdown = (milliseconds) => {
        const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
        return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
      };

      const drawCountdown = () => {
        const value = formatCountdown(countdownRemaining);
        countdownTime.value = value;
        countdownTime.textContent = value;
        const progress = Math.max(0, Math.min(100, countdownRemaining / countdownDuration * 100));
        progressValue.style.strokeDasharray = `${progress} 100`;
      };

      const tickCountdown = (now) => {
        if (countdownPaused || suite.dataset.countdownState !== 'running') return;
        countdownRemaining = Math.max(0, countdownDeadline - now);
        drawCountdown();
        if (countdownRemaining <= 0) {
          suite.dispatchEvent(new CustomEvent('timer-countdown-complete', {
            bubbles: true,
            composed: true,
          }));
          window.setTimeout(returnToIdle, 700);
          return;
        }
        countdownFrame = requestAnimationFrame(tickCountdown);
      };

      const resetCountdown = () => {
        cancelAnimationFrame(countdownFrame);
        window.clearTimeout(pickerPositionTimer);
        stopInertia();
        countdownPaused = false;
        countdownPause.textContent = 'Pause';
        countdownDuration = selectedMinutes * 60_000;
        countdownRemaining = countdownDuration;
        suite.dataset.countdownState = 'picker';
        drawCountdown();
      };

      const positionPickerAtOne = () => {
        window.clearTimeout(pickerPositionTimer);
        stopInertia();
        wheel.classList.add('is-positioning');
        activeIndex = middleCopy * maxMinutes;
        selectedMinutes = 1;
        updateOptionStyles();
        wheel.scrollTo({ top: activeIndex * optionHeight, behavior: 'auto' });
        wheel.classList.remove('is-positioning');
      };

      const startCountdown = () => {
        window.clearTimeout(pickerPositionTimer);
        wheel.classList.remove('is-positioning');
        stopInertia();
        countdownDuration = selectedMinutes * 60_000;
        countdownRemaining = countdownDuration;
        countdownDeadline = performance.now() + countdownDuration;
        countdownPaused = false;
        countdownPause.textContent = 'Pause';
        suite.dataset.countdownState = 'running';
        drawCountdown();
        cancelAnimationFrame(countdownFrame);
        countdownFrame = requestAnimationFrame(tickCountdown);
      };

      const toggleCountdown = () => {
        countdownPaused = !countdownPaused;
        countdownPause.textContent = countdownPaused ? 'Resume' : 'Pause';
        if (!countdownPaused) {
          countdownDeadline = performance.now() + countdownRemaining;
          countdownFrame = requestAnimationFrame(tickCountdown);
        }
      };

      const openMode = (mode) => {
        if (suite.dataset.phase !== 'idle') return;
        clearPhaseTimers();
        if (mode === 'countdown') {
          // Each new countdown starts from the requested 1-minute default.
          selectedMinutes = 1;
          countdownDuration = 60_000;
          countdownRemaining = countdownDuration;
          positionPickerAtOne();
        }
        suite.dataset.mode = mode;
        if (reduceMotion) {
          suite.dataset.phase = 'open';
          return;
        }
        suite.dataset.phase = 'opening';
        schedulePhase('open', 420);
      };

      const returnToIdle = () => {
        if (suite.dataset.phase !== 'open') return;
        clearPhaseTimers();
        cancelAnimationFrame(stopwatchFrame);
        cancelAnimationFrame(countdownFrame);
        stopwatchRunning = false;
        countdownPaused = false;
        stopInertia();
        if (reduceMotion) {
          resetStopwatch();
          resetCountdown();
          positionPickerAtOne();
          suite.dataset.phase = 'idle';
          suite.dataset.mode = '';
          return;
        }
        suite.dataset.phase = 'closing';
        phaseTimers.push(window.setTimeout(() => {
          resetStopwatch();
          resetCountdown();
          positionPickerAtOne();
          suite.dataset.phase = 'closed';
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              suite.dataset.phase = 'idle';
              suite.dataset.mode = '';
            });
          });
        }, 500));
      };

      stopwatchLauncher.addEventListener('pointerdown', (event) => {
        if (event.button === 0) openMode('stopwatch');
      });
      countdownLauncher.addEventListener('pointerdown', (event) => {
        if (event.button === 0) openMode('countdown');
      });
      stopwatchLauncher.addEventListener('click', () => openMode('stopwatch'));
      countdownLauncher.addEventListener('click', () => openMode('countdown'));
      stopwatchStart.addEventListener('click', startStopwatch);
      stopwatchPause.addEventListener('click', toggleStopwatch);
      stopwatchCancel.addEventListener('click', returnToIdle);
      countdownStart.addEventListener('click', startCountdown);
      countdownPause.addEventListener('click', toggleCountdown);
      countdownCancel.addEventListener('click', returnToIdle);

      wheel.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        window.clearTimeout(pickerPositionTimer);
        wheel.classList.remove('is-positioning');
        stopInertia();
        dragPointerId = event.pointerId;
        dragLastY = event.clientY;
        dragLastTime = event.timeStamp;
        dragVelocity = 0;
        dragDistance = 0;
        suppressOptionClick = false;
        wheel.classList.add('is-dragging');
        wheel.setPointerCapture(event.pointerId);
        event.preventDefault();
      });

      wheel.addEventListener('pointermove', (event) => {
        if (event.pointerId !== dragPointerId) return;
        const elapsed = Math.max(1, event.timeStamp - dragLastTime);
        const delta = event.clientY - dragLastY;
        dragDistance += Math.abs(delta);
        wheel.scrollTop -= delta;
        dragVelocity = dragVelocity * .68 + (-delta / elapsed) * .32;
        dragLastY = event.clientY;
        dragLastTime = event.timeStamp;
        if (dragDistance > 4) suppressOptionClick = true;
        event.preventDefault();
      });

      const finishDrag = (event, withInertia) => {
        if (event.pointerId !== dragPointerId) return;
        if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
        dragPointerId = null;
        wheel.classList.remove('is-dragging');
        if (withInertia) startInertia();
        else settleWheel();
      };

      wheel.addEventListener('pointerup', (event) => finishDrag(event, true));
      wheel.addEventListener('pointercancel', (event) => finishDrag(event, false));
      wheel.addEventListener('wheel', () => {
        window.clearTimeout(pickerPositionTimer);
        wheel.classList.remove('is-positioning');
      }, { passive: true });

      wheel.addEventListener('scroll', () => {
        cancelAnimationFrame(scrollFrame);
        scrollFrame = requestAnimationFrame(() => {
          const index = Math.max(0, Math.min(maxMinutes * loopCopies - 1, Math.round(wheel.scrollTop / optionHeight)));
          if (index !== activeIndex) {
            activeIndex = index;
            selectedMinutes = activeIndex % maxMinutes + 1;
            updateOptionStyles();
          }
          if (activeIndex < maxMinutes || activeIndex >= maxMinutes * (loopCopies - 1)) {
            activeIndex = middleCopy * maxMinutes + activeIndex % maxMinutes;
            selectedMinutes = activeIndex % maxMinutes + 1;
            updateOptionStyles();
            wheel.scrollTo({ top: activeIndex * optionHeight, behavior: 'auto' });
          }
        });
      }, { passive: true });

      wheel.addEventListener('keydown', (event) => {
        window.clearTimeout(pickerPositionTimer);
        wheel.classList.remove('is-positioning');
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          selectMinute(selectedMinutes + (event.key === 'ArrowUp' ? -1 : 1), true);
        }
        if (event.key === 'Enter') startCountdown();
      });

      root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && suite.dataset.phase === 'open') returnToIdle();
      });

      renderOptions();
      updateOptionStyles();
      wheel.scrollTo({ top: activeIndex * optionHeight, behavior: 'auto' });
      drawStopwatch();
      drawCountdown();
    }

class TimerSuiteElement extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: 'open' });
    root.append(template.content.cloneNode(true));
    const learningStyle = document.createElement('style');
    learningStyle.textContent = `
      .launcher,.timer-suite:is([data-phase="closing"],[data-phase="closed"]) .morph-shell {
        border:2px solid var(--line,#d5d7dc);border-radius:12px;
        background:var(--white,#fff);color:var(--ink,#4b4b4b);box-shadow:none;
      }
      .launcher { font-family:var(--sans, sans-serif);font-weight:700; }
      .launcher-icon { color:currentColor; }
      .launcher:hover { border-color:var(--action,#0000ee);color:var(--action,#0000ee); }
      .timer-suite button:focus-visible,.timer-suite [role="listbox"]:focus-visible { outline:2px solid var(--focus,#000); }
      .morph-shell { box-shadow:none; }
    `;
    root.append(learningStyle);
    initialiseTimerSuite(root);
  }
}

if (!customElements.get('timer-suite')) {
  customElements.define('timer-suite', TimerSuiteElement);
}
