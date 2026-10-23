/* Molan Business voice-guided onboarding bridge.
 * Uses the existing guided onboarding form and Supabase flow; never handles passwords by voice.
 */
(() => {
  'use strict';
  if (window.__molanBusinessVoiceOnboarding) return;
  window.__molanBusinessVoiceOnboarding = true;
  const $ = (id) => document.getElementById(id);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let active = false, muted = false, listening = false, stage = '', recognition = null, lastStep = -1, promptTimer = null;
  const say = (message) => {
    if (muted || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(message); u.lang = navigator.language || 'en-US'; u.rate = .96; speechSynthesis.speak(u); } catch (_) {}
  };
  const visible = (id) => { const el = $(id); return !!el && !el.classList.contains('hidden'); };
  const startButton = () => {
    if (!$('guided-onboarding-screen') || $('molan-voice-setup')) return;
    const btn = document.createElement('button');
    btn.id = 'molan-voice-setup'; btn.type = 'button';
    btn.textContent = '🎙 Set up with Molano AI';
    btn.setAttribute('aria-label', 'Start voice-guided business setup with Molano AI');
    btn.style.cssText = 'position:fixed;right:16px;bottom:18px;z-index:100001;border:1px solid #83efff;border-radius:999px;padding:13px 17px;background:linear-gradient(135deg,#a5f6ff,#438fe8);color:#061629;font:700 14px system-ui;box-shadow:0 8px 28px #20c9e955;cursor:pointer';
    btn.addEventListener('click', () => {
      active = true; muted = false;
      if (listening) { try { recognition?.stop(); } catch (_) {} return; }
      if (stage === 'consent') { listen(); return; }
      stage = 'consent';
      const prompt = 'Hello and welcome to Molan Business. I am Molano AI. I can guide you through creating your account and business workspace. I will ask for your name and email, and you will enter your password privately on screen. Tap this microphone button again or tap Talk to Molano, then say yes to begin.';
      const answer = $('mwc-answer'); if (answer) answer.textContent = prompt;
      say(prompt);
    });
    document.body.appendChild(btn);
  };
  function askFor(stageName, prompt) {
    stage = stageName;
    say(prompt);
    const answer = $('mwc-answer');
    if (answer) answer.textContent = prompt;
  }
  function fillAndAdvance(id, value, nextPrompt, nextStage) {
    const field = $(id);
    if (!field) { say('I could not find that field on this screen. Please enter it manually.'); return; }
    field.value = value;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    field.dispatchEvent(new Event('change', {bubbles:true}));
    say('I heard ' + value + '. Please check that it is correct.');
    if (nextPrompt) setTimeout(() => askFor(nextStage, nextPrompt), 900);
  }
  function handleTranscript(raw) {
    const value = String(raw || '').trim(), normalized = value.toLowerCase();
    if (!value) { say('I did not catch that. Please try again.'); return; }
    if (!active) {
      if (/create (an )?account|business profile|help me (start|setup)|get started/.test(normalized)) {
        active = true;
        const start = $('welcome-get-started');
        if (start) start.click();
        say('I can help you get started. First choose your business type. I will then help you with your name and email.'); 
      }
      return;
    }
    if (/^(no|cancel|stop|not now)\b/.test(normalized)) { active = false; stage = ''; say('No problem. Your setup has not been submitted. You can resume whenever you are ready.'); return; }
    if (stage === 'consent') {
      if (/^(yes|yeah|yep|okay|ok|start|proceed|sure)\b/.test(normalized)) {
        const go = $('welcome-get-started');
        if (go && visible('welcome-screen')) go.click();
        stage = 'business-type';
        say('Great. Choose the business type that best matches your work. Then continue to the owner account step. I will ask for your name and email. For your security, type your password into the password fields yourself.');
      } else say('Please say yes to begin, or no to cancel.');
      return;
    }
    if (stage === 'name') {
      fillAndAdvance('guided-owner-name', value, 'What email address should we use for your account? Please say it clearly.', 'email');
      stage = 'email'; return;
    }
    if (stage === 'email') {
      const email = value.replace(/\s+at\s+/ig,'@').replace(/\s+dot\s+/ig,'.').replace(/[\s,;]+/g,'').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('That email did not sound complete. Please say it again, using the word at for the at sign and dot for the dot.'); return; }
      fillAndAdvance('guided-owner-email', email, 'Your email is ' + email + '. Please enter and confirm your password on screen. I will never ask you to speak your password. When you are ready, continue to your business details.', 'password');
      stage = 'password'; return;
    }
    if (stage === 'business-name') {
      fillAndAdvance('guided-business-name', value, 'Your business name has been entered. Review it, then continue with the remaining setup fields.', 'business-details');
      stage = 'business-details'; return;
    }
    if (/^(yes|yeah|yep|okay|ok|start|proceed|sure)\b/.test(normalized) && !stage) {
      stage = 'business-type';
      say('First, choose your business type from the list on the screen. Then tap Continue. When the owner account step appears, say “my name is” followed by your name.');
      return;
    }
    if (/my name is|i am |i'm |call me /.test(normalized)) {
      const name = value.replace(/^(my name is|i am|i'm|call me)\s*/i,'').trim();
      if (name && visible('guided-onboarding-screen')) { stage = 'name'; fillAndAdvance('guided-owner-name', name, 'What email address should we use for your account?', 'email'); stage = 'email'; return; }
    }
    if (/email|password|account/.test(normalized)) {
      if (visible('guided-onboarding-screen')) {
        const nameField = $('guided-owner-name');
        const emailField = $('guided-owner-email');
        if (nameField && !nameField.value.trim()) { askFor('name','What is your full name?'); return; }
        if (emailField && !emailField.value.trim()) { askFor('email','What email address should we use? Please say it clearly.'); return; }
        say('Your account details are on screen. Enter your password privately, accept the terms when ready, and continue. I will guide you through business details next.');
      }
    }
  }
  function listen() {
    if (!SR) { say('Voice input is not supported in this browser. You can still use the setup form and hear my guidance.'); return; }
    if (recognition) { try { recognition.stop(); } catch (_) {} return; }
    try {
      recognition = new SR(); recognition.lang = navigator.language || 'en-US'; recognition.continuous = false; recognition.interimResults = false;
      recognition.onstart = () => { listening = true; const b=$('molan-voice-setup'); if(b)b.textContent='🎙 Listening…'; };
      recognition.onresult = e => handleTranscript(e.results[0][0].transcript);
      recognition.onerror = e => say(e.error === 'not-allowed' ? 'Please allow microphone access to use voice setup. You can also type into the form.' : 'I could not hear that clearly. Please try again.');
      recognition.onend = () => { listening = false; recognition = null; const b=$('molan-voice-setup'); if(b)b.textContent='🎙 Set up with Molano AI'; };
      recognition.start();
    } catch (_) { recognition = null; say('I could not start the microphone. Please check its permission and try again.'); }
  }
  function install() {
    startButton();
    const btn = $('molan-voice-setup');
    const welcomeVisible = visible('welcome-screen');
    const setupVisible = visible('guided-onboarding-screen');
    if (btn) btn.style.display = (welcomeVisible || setupVisible) ? 'block' : 'none';
    if (btn && !btn.dataset.micBound) {
      btn.dataset.micBound = '1';
      btn.addEventListener('dblclick', () => { muted = !muted; if (muted && 'speechSynthesis' in window) speechSynthesis.cancel(); else say('Voice guidance is on.'); });
    }
    const stepEl = document.querySelector('.guided-step-view.active[data-guided-step]');
    if (setupVisible && stepEl) {
      const step = Number(stepEl.dataset.guidedStep);
      if (step !== lastStep) {
        lastStep = step;
        clearTimeout(promptTimer);
        if (active) promptTimer = setTimeout(() => {
          if (step === 0) { stage = 'business-type'; say('Step one: choose the business type that best describes your organization, then tap Continue.'); }
          if (step === 1) {
            const name = $('guided-owner-name'), email = $('guided-owner-email');
            if (name && !name.value.trim()) askFor('name', 'Now let us create your owner account. What is your full name?');
            else if (email && !email.value.trim()) askFor('email', 'What email address should we use? Please say it clearly.');
            else { stage = 'password'; say('Your name and email are on screen. Enter and confirm your password privately, then tap Continue.'); }
          }
          if (step === 2) {
            const businessName = $('guided-business-name');
            if (businessName && !businessName.value.trim()) askFor('business-name', 'What is your business or organization called?');
            else { stage = 'business-details'; say('Review the business name and add any optional details you wish, then continue.'); }
          }
          if (step === 3) { stage = 'industry'; say('Now review the business plan and industry-specific setup options on screen. Choose what fits, then continue.'); }
          if (step === 4) { stage = 'staff'; say('This step helps you configure your team. Add staff if you are ready, or continue to review.'); }
          if (step === 5) { stage = 'review'; say('You are at the final review. Check your details carefully, then choose Create my business. If email confirmation is required, confirm your email and return here to finish.'); }
        }, 350);
      }
    } else if (!setupVisible) { lastStep = -1; }
    const talk = $('mwc-talk');
    if (talk && !talk.dataset.voiceOnboardingBound) {
      talk.dataset.voiceOnboardingBound = '1';
      talk.addEventListener('click', () => {
        if (!active) { active = true; stage = 'consent'; say('Welcome to Molan Business. I can help you create your account and business profile. Would you like to begin?'); }
        else if (stage === 'consent') listen();
        else listen();
      });
    }
  }
  const observer = new MutationObserver(install);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true}); else install();
  observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('beforeunload', () => { try { recognition?.stop(); } catch (_) {} });
  window.MolanBusinessVoiceOnboarding = {
    start: () => { active = true; stage = 'consent'; say('Welcome to Molan Business. Would you like me to help create your account and business profile?'); },
    listen,
    mute: (value) => { muted = !!value; if (muted && 'speechSynthesis' in window) speechSynthesis.cancel(); else if (!muted) say('Voice guidance is on.'); }
  };
})();
