/* Molan Business voice-guided onboarding.
 * Connects to the existing guided form and authenticated Supabase workflow.
 * Passwords are intentionally never requested, recorded, or spoken by this script.
 */
(() => {
  'use strict';
  if (window.__molanBusinessVoiceOnboarding) return;
  window.__molanBusinessVoiceOnboarding = true;
  const $ = id => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = false, muted = false, listening = false, recognition = null;
  let stage = '', lastStep = -1, promptTimer = null, pendingAutoListen = false;
  const say = (message, listenAfter = false) => {
    const answer = $('mwc-answer');
    if (answer) answer.textContent = message;
    const box = $('molano-welcome-concierge');
    if (box) box.dataset.state = 'speaking';
    pendingAutoListen = !!listenAfter;
    if (muted || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      if (box) box.dataset.state = 'idle';
      if (pendingAutoListen) { pendingAutoListen = false; setTimeout(listen, 350); }
      return;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(message);
      u.lang = navigator.language || 'en-US'; u.rate = .96; u.pitch = 1.03;
      u.onend = () => {
        if (box) box.dataset.state = 'idle';
        if (pendingAutoListen && active) { pendingAutoListen = false; setTimeout(listen, 250); }
      };
      u.onerror = () => {
        if (box) box.dataset.state = 'idle';
        if (pendingAutoListen && active) { pendingAutoListen = false; setTimeout(listen, 250); }
      };
      speechSynthesis.speak(u);
    } catch (_) {
      if (box) box.dataset.state = 'idle';
      if (pendingAutoListen && active) { pendingAutoListen = false; setTimeout(listen, 350); }
    }
  };
  const visible = id => { const el = $(id); return !!el && !el.classList.contains('hidden'); };
  const currentStep = () => {
    const el = document.querySelector('.guided-step-view.active[data-guided-step]');
    return visible('guided-onboarding-screen') && el ? Number(el.dataset.guidedStep) : -1;
  };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9@.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const setField = (id, value) => {
    const el = $(id); if (!el) return false;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  const click = id => { const el = $(id); if (el && !el.disabled) { el.click(); return true; } return false; };
  const welcomeStart = () => { if (visible('welcome-screen')) click('welcome-get-started'); };
  const askCurrentStep = (step, autoListen = true) => {
    if (!active) return;
    stage = 'step-' + step;
    const prompts = {
      0: 'Step one: what kind of business do you run? Say the business type, for example shop, school, restaurant, farm, salon, or SACCO savings group. I will try to select it in the form.',
      1: 'Who will manage this workspace? Please say your full name first.',
      2: 'What is the name of your business or organisation? Say the full name.',
      3: 'Now choose what you want to manage first. You can say inventory, sales, customers, expenses, reports, bookings, school classes, savings, loans, or another option shown on screen. Say continue when ready.',
      4: 'Would you like to add staff now? Say skip to do it later, or say add staff if you want to prepare an invitation.',
      5: 'Please review the details. Say I agree if you accept the terms and privacy policy. I will then ask you to confirm before creating the workspace.'
    };
    if (step === 1) {
      const name = $('guided-owner-name'), email = $('guided-owner-email');
      if (!visible('guided-account-fields') || !name || !email) {
        say('You are already signed in. I will use your current account as the workspace owner. Let us continue to the business details.', false);
        setTimeout(() => click('guided-next'), 700); return;
      }
      if (name.value.trim() && !email.value.trim()) { stage = 'email'; say('Now please say the email address for your account. You can say the word at and the word dot.'); return; }
      if (name.value.trim() && email.value.trim()) { stage = 'password'; say('Your name and email are entered. For your security, type your password and confirm it privately in the two password fields. Do not say your password aloud. When finished, tap Continue or tap Set up with Molano and say continue.'); return; }
    }
    if (step === 4 && !visible('guided-staff-list')) return;
    say(prompts[step] || 'Let us continue through your Molan Business setup.', autoListen);
  };
  function startButton() {
    if (!$('guided-onboarding-screen') || $('molan-voice-setup')) return;
    const btn = document.createElement('button');
    btn.id = 'molan-voice-setup'; btn.type = 'button';
    btn.textContent = '🎙 Set up with Molano AI';
    btn.setAttribute('aria-label', 'Start voice-guided business setup with Molano AI');
    btn.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:100001;border:1px solid #83efff;border-radius:999px;padding:13px 17px;background:linear-gradient(135deg,#a5f6ff,#438fe8);color:#061629;font:700 14px system-ui;box-shadow:0 8px 28px #20c9e955;cursor:pointer;max-width:calc(100vw - 32px)';
    btn.addEventListener('click', () => {
      if (listening) { try { recognition?.stop(); } catch (_) {} return; }
      if (!active) {
        active = true; stage = 'consent';
        say('Hello and welcome to Molan Business. I am Molano, your voice setup guide. Would you like to create an account and business workspace with me? Please say yes or no.', true);
        return;
      }
      if (stage === 'consent') { listen(); return; }
      if (!SR) { say('Voice input is not supported in this browser. You can still use the form, and I will read each step aloud. Please try Chrome on Android and allow microphone access for full voice setup.'); return; }
      if (currentStep() >= 0) {
        if (stage === 'password') { say('Please enter and confirm your password privately on screen. When finished, say continue.', true); return; }
        if (stage === 'confirm-create') { say('To confirm, say create my workspace. I will submit only after you explicitly confirm.', true); return; }
        if (stage === 'confirm-terms') { say('Please say I agree if you accept the terms and privacy policy, or say no to leave them unchecked.', true); return; }
        if (stage === 'email') { say('Please say the email address clearly. You can say at and dot.', true); return; }
        askCurrentStep(currentStep(), true); return;
      }
      stage = 'consent';
      say('Would you like me to help you create an account and business workspace? Say yes or no.', true);
    });
    document.body.appendChild(btn);
  }
  function normalizeEmail(value) {
    return String(value).toLowerCase().trim().replace(/\s+at\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s+underscore\s+/g, '_').replace(/\s+hyphen\s+/g, '-').replace(/[\s,;]+/g, '');
  }
  function selectBusinessType(spoken) {
    const select = $('guided-business-type');
    if (!select) return false;
    const n = norm(spoken).replace(/\b(i run|i own|my business is|a|an|the)\b/g, '').trim();
    const options = [...select.options].filter(o => o.value && o.textContent.trim());
    let found = options.find(o => norm(o.textContent) === n || norm(o.value) === n);
    if (!found) found = options.find(o => { const t = norm(o.textContent); return t.includes(n) || n.includes(t); });
    if (!found && $('guided-business-type-search')) {
      setField('guided-business-type-search', spoken);
      const afterSearch = [...select.options].filter(o => o.value);
      found = afterSearch.find(o => norm(o.textContent) === n) || afterSearch.find(o => norm(o.textContent).includes(n) || n.includes(norm(o.textContent)));
    }
    if (!found) return false;
    select.value = found.value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  function selectIndustryOptions(spoken) {
    const n = norm(spoken);
    const checkboxes = [...document.querySelectorAll('#guided-industry-fields input[type="checkbox"]')];
    if (!checkboxes.length) return false;
    let chosen = 0;
    if (/\b(none|skip|later|nothing|not now)\b/.test(n)) {
      checkboxes.forEach(c => { c.checked = false; c.dispatchEvent(new Event('change', {bubbles:true})); });
      return true;
    }
    checkboxes.forEach(c => {
      const label = norm(c.closest('label')?.innerText || c.value || c.name);
      const words = n.split(' ').filter(w => w.length > 2);
      if (words.some(w => label.includes(w)) || n.includes(label)) {
        c.checked = true; c.dispatchEvent(new Event('change', {bubbles:true})); chosen++;
      }
    });
    return chosen > 0;
  }
  function handleTranscript(raw) {
    const value = String(raw || '').trim(), n = norm(value);
    if (!value) { say('I did not catch that. Please try again.', true); return; }
    if (/^(no|no thanks|cancel|stop|not now)\b/.test(n) && (stage === 'consent' || stage === 'confirm-terms' || stage === 'confirm-create')) {
      active = false; stage = ''; pendingAutoListen = false;
      say('No problem. I have not submitted anything. You can return whenever you are ready.'); return;
    }
    if (stage === 'consent') {
      if (/\b(plan|price|pricing|silver|gold|premium|subscription)\b/.test(n)) { explainPlans(); setTimeout(() => say('Would you like me to help you create your account and business workspace? Please say yes or no.', true), 4500); return; }
      if (/\b(features|what can you do|what does|how does|help|inventory|sales|staff|reports|customers|finance|what is molan business)\b/.test(n)) { explainFeatures(value); setTimeout(() => say('Would you like me to help you create your account and business workspace? Please say yes or no.', true), 4500); return; }
      if (/^(yes|yeah|yep|okay|ok|start|proceed|sure|please)\b/.test(n) || /\b(yes|create an account|set up my business)\b/.test(n)) {
        welcomeStart();
        stage = 'step-0'; lastStep = currentStep();
        say('Great. I am opening the real setup form now. First, tell me what kind of business you run.', true);
      } else say('Please say yes to begin, or no to cancel.', true);
      return;
    }
    const step = currentStep();
    if (step < 0) {
      if (/\b(plan|price|pricing|silver|gold|premium|subscription)\b/.test(n)) { explainPlans(); return; }
      if (/\b(features|what can you do|what does|how does|help|inventory|sales|staff|reports|customers|finance)\b/.test(n)) { explainFeatures(value); return; }
      if (/\b(create|setup|set up|account|workspace|get started)\b/.test(n)) { active = true; stage = 'consent'; say('Would you like me to help you create your account and business workspace? Say yes or no.', true); return; }
      say('I can explain the workspace, staff permissions, business records, reports, and subscription plans, or guide you through account setup. What would you like to know?', true);
      return;
    }
    if (step === 0 || stage === 'step-0') {
      if (!selectBusinessType(value)) {
        const search = $('guided-business-type-search');
        if (search) { setField('guided-business-type-search', value); }
        say('I am searching the business-type list for that answer. Please wait a moment.', false);
        setTimeout(() => {
          if (selectBusinessType(value)) {
            const selected = $('guided-business-type')?.selectedOptions?.[0]?.textContent || value;
            say('I selected ' + selected + '. Please check it is correct. I will continue to the owner account step.', false);
            setTimeout(() => click('guided-next'), 750);
          } else {
            say('I could not match that phrase to a business type. Please say a shorter category such as school, shop, restaurant, farm, salon, or SACCO savings group, or choose it from the list on screen.', true);
          }
        }, 650);
        return;
      }
      const selected = $('guided-business-type')?.selectedOptions?.[0]?.textContent || value;
      say('I selected ' + selected + '. Please check it is correct. I will continue to the owner account step.', false);
      setTimeout(() => { click('guided-next'); }, 750);
      return;
    }
    if (step === 1) {
      const nameField = $('guided-owner-name'), emailField = $('guided-owner-email');
      if (stage === 'name' || (nameField && !nameField.value.trim())) {
        const name = value.replace(/^(my full name is|my name is|i am|i'm|call me)\s+/i, '').trim();
        if (name.length < 2) { say('Please say your full name again.', true); return; }
        setField('guided-owner-name', name);
        stage = 'email';
        say('Thank you, ' + name + '. What email address should we use? Say the word at and the word dot if needed.', true);
        return;
      }
      if (stage === 'email' || (emailField && !emailField.value.trim())) {
        const email = normalizeEmail(value.replace(/^(my email is|email is|use)\s+/i, ''));
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That email does not sound complete. Please say it again, using at and dot.', true); return; }
        setField('guided-owner-email', email);
        stage = 'password';
        say('I entered ' + email + '. For security, type your password and confirmation privately into the two fields. Never say your password aloud. When both fields are filled, say continue.', false);
        return;
      }
      if (stage === 'password' || /^(continue|next|done|finished|ready)$/.test(n)) {
        if (!nameField?.value.trim() || !emailField?.value.trim()) { askCurrentStep(1, true); return; }
        const pw = $('guided-owner-password'), confirm = $('guided-owner-confirm');
        if (pw && confirm && (!pw.value || !confirm.value)) { say('Please type and confirm your password on screen. I cannot hear or fill passwords. When you finish, say continue.', true); return; }
        stage = 'step-1'; click('guided-next'); return;
      }
      say('Please say your full name, or say continue after you have filled the password fields privately.', true);
      return;
    }
    if (step === 2) {
      const businessField = $('guided-business-name');
      if (!businessField?.value.trim() && !/^(continue|next|skip|later)$/.test(n)) {
        const businessName = value.replace(/^(my business is|business name is|we are called|it is called)\s+/i, '').trim();
        setField('guided-business-name', businessName);
        stage = 'business-details';
        say('I entered ' + businessName + '. You can type optional motto, website, phone, and address if you want. Say continue when ready.', true);
        return;
      }
      if (/^(continue|next|skip|later|done|ready)$/.test(n) || businessField?.value.trim()) {
        stage = 'step-2'; click('guided-next'); return;
      }
      say('What is your business or organisation called?', true); return;
    }
    if (step === 3) {
      if (/^(continue|next|done|ready)$/.test(n)) { stage = 'step-3'; click('guided-next'); return; }
      const ok = selectIndustryOptions(value);
      if (ok) say('I updated the matching setup choices. Please check the selections on screen. Say continue when you are ready.', true);
      else say('I could not match that to a visible option. Please choose using the checkboxes on screen, or say continue to skip these preferences.', true);
      return;
    }
    if (step === 4) {
      if (/\b(add staff|invite staff|add a staff|yes)\b/.test(n)) {
        say('Please enter each staff member’s name and email directly into the staff fields on screen. For security, review each role carefully. When finished, say continue. You can also say skip to do this later.', true);
        return;
      }
      if (/\b(skip|later|no|continue|next|done|ready)\b/.test(n)) { stage = 'step-4'; click('guided-skip-staff'); if (currentStep() === 4) click('guided-next'); return; }
      say('You can say skip to manage staff later, or enter staff details on screen and say continue.', true); return;
    }
    if (step === 5) {
      if (stage === 'confirm-create') {
        if (/\b(create my workspace|create workspace|create my business|confirm create|yes create|submit)\b/.test(n)) {
          stage = 'submitting';
          say('Thank you. I am submitting the setup now. I will tell you whether the account and workspace were actually created.');
          click('guided-finish'); return;
        }
        say('To submit, please say create my workspace. Otherwise say no to cancel.', true); return;
      }
      if (/\b(i agree|agree|accept the terms|accept|yes)\b/.test(n)) {
        const terms = $('guided-terms'); if (terms) { terms.checked = true; terms.dispatchEvent(new Event('change', {bubbles:true})); }
        stage = 'confirm-create';
        say('The terms checkbox is selected. Please review the details and terms. To create the account and workspace, say create my workspace. I will not submit until you confirm.', true);
      } else say('Please review the details. If you agree to the terms and privacy policy, say I agree. To leave setup, say no.', true);
      return;
    }
    if (/\b(plan|price|pricing|silver|gold|premium|subscription)\b/.test(n)) { explainPlans(); return; }
    if (/\b(features|what can you do|what does|how does|help|inventory|sales|staff|reports|customers|finance)\b/.test(n)) { explainFeatures(value); return; }
    askCurrentStep(step, true);
  }
  function listen() {
    if (!SR) { say('Voice recognition is not available in this browser. Please use Chrome on Android and allow microphone access, or complete the visible form manually.'); return; }
    if (recognition) { try { recognition.stop(); } catch (_) {} return; }
    try {
      recognition = new SR(); recognition.lang = navigator.language || 'en-US'; recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
      recognition.onstart = () => { listening = true; const b=$('molan-voice-setup'); if(b)b.textContent='🎙 Listening…'; const box=$('molano-welcome-concierge'); if(box)box.dataset.state='listening'; };
      recognition.onresult = e => handleTranscript(e.results?.[0]?.[0]?.transcript || '');
      recognition.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') say('Microphone access is blocked. Allow it in your browser or Android app settings. You can still type into the form.');
        else if (e.error !== 'aborted' && e.error !== 'no-speech') say('I could not hear that clearly. Tap Set up with Molano and try again, or type your answer.');
      };
      recognition.onend = () => { listening = false; recognition = null; const b=$('molan-voice-setup'); if(b)b.textContent='🎙 Set up with Molano AI'; const box=$('molano-welcome-concierge'); if(box&&box.dataset.state==='listening')box.dataset.state='idle'; };
      recognition.start();
    } catch (_) { recognition = null; say('I could not start the microphone. Please check its permission and try again.'); }
  }
  function explainPlans() {
    say('Molan Business offers Premium, Silver, and Gold subscription plans. Premium renews monthly, Silver every two months, and Gold every three months. Gold includes Molano AI Business access. The exact price, currency, availability, and payment status must be checked in the current plan or checkout screen before paying. Do not assume a payment is complete until the app confirms it.');
  }
  function explainFeatures(question = '') {
    const n = norm(question);
    if (/\b(staff|team|employee|permissions|roles)\b/.test(n)) {
      say('Staff Management lets an authorised workspace owner prepare staff invitations and assign appropriate roles. Give each person only the permissions needed for their work, and review invitations before sharing them.');
    } else if (/\b(inventory|stock|product|supplier)\b/.test(n)) {
      say('Inventory and product tools help you organise products, quantities, suppliers, and restocking where those tools are enabled for your workspace. Keep quantities current and review records before saving.');
    } else if (/\b(sales|order|customer|client)\b/.test(n)) {
      say('Sales, orders, and customer tools help keep customer details, sales activity, and orders organised so you can follow up and review activity in one workspace.');
    } else if (/\b(finance|expense|income|profit|money)\b/.test(n)) {
      say('Finance tools help organise income, expenses, and transaction records where enabled. Check amounts and dates carefully, and use reports as a guide rather than a substitute for reviewing your actual records.');
    } else if (/\b(report|analytics|task|deadline|announcement|update)\b/.test(n)) {
      say('Reports help you review available business activity; Tasks help track assignments and deadlines; Announcements help share updates with the team. What you can see depends on your workspace and role.');
    } else if (/\b(sacco|savings|loan|cooperative|member)\b/.test(n)) {
      say('For SACCOs and savings groups, the setup can prepare member, savings, loan, and approval preferences. Financial approvals must remain restricted to the authorised roles configured for your organisation.');
    } else if (/\b(school|education|class|student|teacher)\b/.test(n)) {
      say('For schools and education organisations, setup can include education levels, classes or streams, academic year, and fee-planning preferences. Staff should receive only the class and workspace access they need.');
    } else {
      say('Molan Business is a connected workspace for organising day-to-day business activity. Depending on your business type and permissions, it can include a dashboard, business profile, staff and roles, customers, products and inventory, sales and orders, finance, tasks, announcements, reports, and industry-specific setup such as school or SACCO workflows. I can guide you through the setup, explain a feature, or compare the subscription plans. Some features depend on your workspace, permissions, and active plan.');
    }
  }
  function install() {
    startButton();
    const btn = $('molan-voice-setup');
    const welcomeVisible = visible('welcome-screen');
    const setupVisible = visible('guided-onboarding-screen');
    if (btn) btn.style.display = (welcomeVisible || setupVisible) ? 'block' : 'none';
    const step = currentStep();
    if (setupVisible && step >= 0 && active && step !== lastStep) {
      lastStep = step; clearTimeout(promptTimer);
      promptTimer = setTimeout(() => {
        if (!active) return;
        if (step === 1 && stage === 'password') {
          say('Please type and confirm your password privately. When finished, tap Set up with Molano and say continue.');
        } else askCurrentStep(step, true);
      }, 450);
    } else if (!setupVisible) lastStep = -1;
    const answer = $('mwc-answer');
    const status = $('guided-status');
    if (status && !status.hidden && status.textContent.trim() && status.dataset.molanoSpoken !== status.textContent.trim()) {
      status.dataset.molanoSpoken = status.textContent.trim();
      if (/account request has been submitted|check .* for the verification email/i.test(status.textContent)) {
        stage = 'email-verification';
        say(status.textContent + ' After verifying your email, return here or sign in so I can guide you to finish the workspace setup.');
      } else if (/workspace created|business is ready|your business workspace is ready/i.test(status.textContent)) {
        stage = 'complete';
        say('Congratulations! Your workspace has been created. Let me show you around. Start with Overview for a summary, then use your business profile to keep organisation details current. Depending on your business type, explore customers, products and inventory, sales, finance, tasks, staff and roles, announcements, and reports. Assign staff permissions carefully. Premium renews monthly, Silver every two months, and Gold every three months with Molano AI Business access. Review the current plan screen for exact prices and payment availability.');
      }
    }
    const complete = $('guided-complete-modal');
    if (complete && !complete.classList.contains('hidden') && stage !== 'complete') {
      stage = 'complete';
      say('Congratulations, your workspace is ready. Use Continue in browser to open it, then I can guide you through the dashboard, business profile, staff, records, tasks, and reports. Review plan details in the app before making a payment.');
    }
  }
  const observer = new MutationObserver(install);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  window.addEventListener('beforeunload', () => { try { recognition?.stop(); } catch (_) {} });
  window.MolanBusinessVoiceOnboarding = {
    start: () => { active = true; stage = 'consent'; say('Welcome to Molan Business. Would you like me to help create your account and business workspace? Say yes or no.', true); },
    listen,
    mute: value => { muted = !!value; if (muted && 'speechSynthesis' in window) speechSynthesis.cancel(); else if (!muted) say('Voice guidance is on.'); },
    explainFeatures, explainPlans
  };
})();