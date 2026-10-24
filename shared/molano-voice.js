(function () {
  "use strict";
  if (window.__molanoVoiceAssistantLoaded) return;
  window.__molanoVoiceAssistantLoaded = true;
  const PRODUCT = document.body.dataset.molanoProduct || document.title || "ZakiTech";
  const API = "https://molanoai.zakpollyqueens.workers.dev/api/support-chat";
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const history = [];
  let welcomed = false;
  let busy = false, recognition = null, confirmRecognition = null, pending = "", waitingForSpokenConfirm = false;
  const style = document.createElement("style");
  style.textContent = `
  #molanoVoiceRoot{position:fixed;left:16px;right:auto;bottom:18px;z-index:99999;font:14px/1.45 system-ui,-apple-system,sans-serif;color:#eef8ff}
  #molanoVoiceToggle{width:58px;height:58px;border-radius:50%;border:1px solid #83efff;background:radial-gradient(circle at 30% 20%,#ffffff,#9bf7ff 20%,#38bfe8 52%,#3654b8);color:#061629;display:grid;place-items:center;box-shadow:0 8px 32px #20c9e955;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}#molanoVoiceToggle:hover{transform:translateY(-2px);box-shadow:0 12px 36px #20c9e977}#molanoVoiceToggle svg{width:30px;height:30px;display:block}
  #molanoVoicePanel{display:none!important;visibility:hidden!important;pointer-events:none!important}
  #molanoVoicePanel.open{display:none!important}
  #molanoVoiceToggle.voice-listening{animation:molanoPulse 1.1s ease-in-out infinite;box-shadow:0 0 0 8px #38bfe833,0 8px 32px #20c9e977}
  #molanoVoiceToggle.voice-speaking{box-shadow:0 0 0 5px #a5f6ff33,0 8px 32px #20c9e977}
  @keyframes molanoPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
  .mv-head{display:flex;align-items:center;gap:10px;padding:14px;background:linear-gradient(120deg,#102e4a,#122343);border-bottom:1px solid #ffffff16}
  .mv-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:linear-gradient(145deg,#a5f6ff,#37bfe7 55%,#587fff);color:#061629;font-weight:950}
  .mv-head strong{display:block;font-size:14px}.mv-head small{color:#a7c2d8;font-size:11px}
  .mv-close{margin-left:auto;background:transparent;border:0;color:#d8f5ff;font-size:22px;cursor:pointer}
  .mv-messages{padding:13px;overflow:auto;min-height:120px;max-height:34dvh;display:flex;flex-direction:column;gap:9px}
  .mv-msg{padding:10px 12px;border-radius:13px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}
  .mv-msg.bot{align-self:flex-start;background:#132b42;border:1px solid #ffffff12;max-width:94%}
  .mv-msg.user{align-self:flex-end;background:#24577a;max-width:94%}
  .mv-status{padding:0 13px 8px;color:#9cb8cf;font-size:11px;min-height:18px}
  .mv-trial{display:none;margin:0 12px 10px;padding:12px;border:1px solid #2e6683;border-radius:14px;background:linear-gradient(120deg,#102b43,#172746);color:#eafaff}.mv-trial strong{display:block;font-size:12px}.mv-trial-count{font-size:23px;font-weight:900;letter-spacing:.02em;color:#9bf2ff;margin:4px 0}.mv-trial small{display:block;color:#b4cadd;font-size:11px}
  .mv-controls{display:flex;gap:7px;padding:11px;border-top:1px solid #ffffff15;background:#071525}
  .mv-controls textarea{min-width:0;flex:1;resize:none;height:43px;max-height:90px;background:#10243a;border:1px solid #34516b;border-radius:12px;padding:10px;color:#eef8ff;font:inherit;font-size:13px}
  .mv-controls button{border:1px solid #345b78;border-radius:12px;background:#12304a;color:#dffaff;min-width:42px;padding:0 10px;cursor:pointer}
  .mv-controls .mv-send{background:linear-gradient(145deg,#a5f6ff,#5d9aff);color:#071629;font-weight:900}
  .mv-controls button:disabled{opacity:.5}.mv-controls .mv-replay{min-width:40px;padding:0 8px;background:#163c55}
  .mv-note{padding:0 13px 12px;color:#8fa9bf;font-size:10px;background:#071525}
  @media(max-width:480px){#molanoVoiceRoot{left:12px;right:auto;bottom:calc(84px + env(safe-area-inset-bottom))}#molanoVoiceToggle{width:52px;height:52px}.mv-messages{max-height:31dvh}#molanoVoicePanel{width:min(370px,calc(100vw - 24px))}}
  `;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.id = "molanoVoiceRoot";
  root.innerHTML = '<section id="molanoVoicePanel" role="dialog" aria-label="Molano AI voice assistant"><header class="mv-head"><span class="mv-logo" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M16 2.5 19.1 12.9 29.5 16 19.1 19.1 16 29.5 12.9 19.1 2.5 16 12.9 12.9 16 2.5Z" fill="#062039"/><circle cx="16" cy="16" r="3" fill="#a5f6ff"/><path d="M24.5 3.5v5M22 6h5M6 23v4M4 25h4" stroke="#062039" stroke-width="1.8" stroke-linecap="round"/></svg></span><div><strong>Molano AI</strong><small>Voice assistant · ' + escapeHtml(PRODUCT) + '</small></div><button class="mv-close" aria-label="Close assistant">×</button></header><div class="mv-messages" aria-live="polite"><div class="mv-msg bot">Hi! I’m Molano AI. I can talk you through ' + escapeHtml(PRODUCT) + '. Tell me what you need, and I’ll explain the next step before you confirm anything.</div></div><div class="mv-status" aria-live="polite">Ready when you are.</div><section class="mv-trial" aria-live="polite"><strong>Free grace-period countdown</strong><div class="mv-trial-count">Checking account…</div><small>One month from account creation. Upgrade using the existing checkout.</small></section><div class="mv-controls"><textarea aria-label="Message Molano AI" placeholder="Ask Molano…"></textarea><button class="mv-mic" aria-label="Speak to Molano">🎙</button><button class="mv-replay" aria-label="Replay last spoken reply" title="Replay last spoken reply">🔊</button><button class="mv-send" aria-label="Send message">➤</button></div><div class="mv-note">Advice and support only here. No account, sales, inventory, or settings changes are made by this widget.</div></section><button id="molanoVoiceToggle" aria-label="Open Molano AI assistant" title="Talk to Molano AI"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 2.5 19.1 12.9 29.5 16 19.1 19.1 16 29.5 12.9 19.1 2.5 16 12.9 12.9 16 2.5Z" fill="#062039"/><circle cx="16" cy="16" r="3" fill="#a5f6ff"/><path d="M24.5 3.5v5M22 6h5M6 23v4M4 25h4" stroke="#062039" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
  document.body.appendChild(root);
  const panel = root.querySelector("#molanoVoicePanel"), toggle = root.querySelector("#molanoVoiceToggle");
  const messagesEl = root.querySelector(".mv-messages"), statusEl = root.querySelector(".mv-status"), input = root.querySelector("textarea");
  const mic = root.querySelector(".mv-mic"), send = root.querySelector(".mv-send"), replay = root.querySelector(".mv-replay");
  const trialCard=root.querySelector(".mv-trial"),trialCount=root.querySelector(".mv-trial-count");let accountCreatedAt=window.__molanAccountCreatedAt||null;
  function updateTrialCountdown(){if(!accountCreatedAt||!trialCard||!trialCount)return;const start=new Date(accountCreatedAt).getTime();if(!Number.isFinite(start)||start<=0)return;const deadline=start+30*24*60*60*1000;const remaining=Math.max(0,deadline-Date.now());const days=Math.floor(remaining/86400000),hours=Math.floor((remaining%86400000)/3600000),minutes=Math.floor((remaining%3600000)/60000);trialCard.style.display="block";trialCount.textContent=remaining>0?days+" days : "+hours+" hours : "+minutes+" minutes": "Grace period ended";const note=trialCard.querySelector("small");if(note)note.textContent=remaining>0?(Math.ceil(remaining/86400000)<=15?"Final 15-day countdown: review Premium, Silver or Gold in checkout.":"Your one-month grace period is running. We’ll remind you to review plans from day 15."):"Please review Premium, Silver or Gold in the existing subscription checkout."; }
  window.addEventListener("molan-account-context",e=>{accountCreatedAt=e.detail?.createdAt||null;updateTrialCountdown();});updateTrialCountdown();setInterval(updateTrialCountdown,60000);
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  let lastSpokenText="";
  function say(text){
    lastSpokenText=String(text||"").trim();
    if(!lastSpokenText)return;
    if(!("speechSynthesis" in window)||typeof SpeechSynthesisUtterance==="undefined"){
      setStatus("Spoken replies aren't supported here. Try Chrome and check Android text-to-speech settings.");
      return;
    }
    try{
      window.speechSynthesis.cancel();
      const chunks=lastSpokenText.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[lastSpokenText];
      let index=0;
      const speakNext=()=>{
        if(index>=chunks.length)return;
        const part=chunks[index++].trim();
        if(!part){speakNext();return;}
        const utterance=new SpeechSynthesisUtterance(part);
        utterance.lang="en-US";utterance.rate=0.96;utterance.pitch=1;
        utterance.onerror=()=>{if(index<chunks.length)speakNext();else setStatus("Reply is visible. If you hear no sound, raise media volume and check Android text-to-speech settings.");};
        utterance.onend=()=>{if(index<chunks.length)speakNext();};
        window.speechSynthesis.speak(utterance);
      };
      if(window.speechSynthesis.paused)window.speechSynthesis.resume();
      speakNext();
    }catch(_){setStatus("Reply is visible, but speech could not start. Check Android text-to-speech settings.");}
  }
  function addMessage(text, who){const el=document.createElement("div");el.className="mv-msg "+who;el.textContent=text;messagesEl.appendChild(el);messagesEl.scrollTop=messagesEl.scrollHeight;}
  function setStatus(text){statusEl.textContent=text;}
  function open(){panel.classList.remove("open");}
  function close(){panel.classList.remove("open");}
  let voiceActivated=false;
  toggle.setAttribute("aria-expanded","false");
  toggle.setAttribute("aria-label","Start Molano AI voice assistant");
  toggle.addEventListener("click",()=>{
    if(!voiceActivated){
      voiceActivated=true;welcomed=true;
      const greeting="Hello, welcome! I’m Molano AI, your voice assistant for Molan Business. I can guide you through setting up your business profile, understanding your workspace, and using the app. Tap me again and tell me what you would like help with.";
      toggle.classList.remove("voice-listening");toggle.classList.add("voice-speaking");
      say(greeting);
      const checkSpeech=()=>{if(!window.speechSynthesis?.speaking)toggle.classList.remove("voice-speaking");};
      setTimeout(checkSpeech,1200);
      return;
    }
    startListening();
  });
  root.querySelector(".mv-close").addEventListener("click",close);
  function isPlanQuestion(text){return /\b(upgrade|subscription|subscriptions|pricing|plans?|premium|silver|gold|checkout|grace period|countdown|trial|days left)\b/i.test(text);}
  function localPlanExplanation(){
    const market = document.querySelector('#subscription-country')?.value || document.querySelector('#learn-country')?.value || '';
    const cards = Array.from(document.querySelectorAll('[data-subscription-plan]'));
    const cardText = code => {
      const card = cards.find(el => (el.getAttribute('data-subscription-plan') || '').toLowerCase() === code);
      return card ? card.innerText.replace(/\s+/g,' ').trim() : '';
    };
    const premium = cardText('premium'), silver = cardText('silver'), gold = cardText('gold');
    const marketName = market ? ({UG:'Uganda',KE:'Kenya',TZ:'Tanzania',RW:'Rwanda',BI:'Burundi',SS:'South Sudan',OTHER_AFRICA:'other African markets',EUROPE:'Europe',ASIA:'Asia',AMERICA:'America',USD:'USD market',OTHER:'your market'}[market] || market) : 'your market';
    let details = '';
    if (premium || silver || gold) {
      details = [premium,silver,gold].filter(Boolean).join(' ');
    } else {
      details = 'Premium lasts one month, Silver lasts two months, and Gold lasts three months. The checkout page shows the current price for your market.';
    }
    return 'Of course! Molan Business has three upgrade options. Premium is the one-month plan. Silver covers two months. Gold covers three months and is the plan associated with Molano AI Access Pro, which requires an active, payment-verified Gold subscription. ' + details + ' Prices and checkout availability can depend on ' + marketName + '. Your one-month grace period begins when your account is created. From day 15, I can remind you to review these plans; you can choose Premium, Silver, or Gold in the existing subscription checkout. I will not make a payment or change your subscription for you.';
  }
  async function ask(text){
    if(busy||!text.trim())return;
    busy=true;send.disabled=true;setStatus("Preparing plan information…");history.push({role:"user",content:text.trim()});addMessage(text.trim(),"user");
    if(isPlanQuestion(text)){
      const answer=localPlanExplanation();
      history.push({role:"assistant",content:answer});addMessage(answer,"bot");setStatus("Plan explanation ready.");say(answer);busy=false;send.disabled=false;return;
    }
    setStatus("Molano is thinking…");
    try{
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
      let res,data;try{res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({product:PRODUCT,messages:history.slice(-10)}),signal:controller.signal});data=await res.json().catch(()=>({}));}finally{clearTimeout(timeout)}
      if(!res.ok)throw new Error(data.error||"Molano is temporarily unavailable.");
      const answer=String(data.response||data.reply||data.message||"I couldn't prepare a response. Please try again.");
      history.push({role:"assistant",content:answer});addMessage(answer,"bot");setStatus("Reply ready.");say(answer);
    }catch(e){const msg=e.name==="AbortError"?"Molano is taking too long to respond. Please check your connection and try again.":(e.message||"Connection failed. Please check your connection and try again.");addMessage(msg,"bot");setStatus("Reply failed — tap Send to retry.");say(msg);}
    finally{busy=false;send.disabled=false;}
  }
  function submitTyped(){const value=input.value.trim();if(!value)return;input.value="";ask(value);}
  send.addEventListener("click",submitTyped);
  replay.addEventListener("click",()=>{if(lastSpokenText)say(lastSpokenText);else{const latest=messagesEl.querySelector(".mv-msg.bot:last-of-type");if(latest)say(latest.textContent);else say("Hello, welcome! I’m Molano AI. Tell me what you need help with.");}});
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitTyped();}});
  function startConfirmation(){
    if(!Recognition){say("I can’t verify your confirmation because voice input is unavailable in this browser. Please open Molan Business in Chrome and allow microphone access.");return;}
    confirmRecognition=new Recognition();confirmRecognition.lang="en-US";confirmRecognition.continuous=false;confirmRecognition.interimResults=false;
    confirmRecognition.onresult=e=>{
      const answer=e.results[0][0].transcript.toLowerCase().trim(),cmd=pending;pending="";
      if(/^(yes|yeah|yep|confirm|confirmed|proceed|go ahead|do it|correct|that's right|that is right)\b/.test(answer)){setStatus("Confirmed. Sending request…");ask(cmd);}
      else if(/^(no|nope|cancel|stop|don't|do not|not now)\b/.test(answer)){setStatus("Cancelled. Nothing was sent.");say("Okay, cancelled. Nothing was sent.");}
      else{pending=cmd;say("Please say yes to continue, or no to cancel.");setTimeout(startConfirmation,900);}
    };
    confirmRecognition.onerror=()=>{setStatus("I couldn't hear your confirmation. Tap the Molano button to try again.");};
    confirmRecognition.onend=()=>{confirmRecognition=null;};
    try{confirmRecognition.start();setStatus("Listening for confirmation…");toggle.classList.add("voice-listening");}catch(_){say("I couldn’t start the microphone. Please check microphone permission in your browser.");}
  }
  function startListening(){
    if(busy){say("I’m still preparing your answer. Please wait a moment, then tap me again.");return;}
    if(!Recognition){say("Voice input isn’t supported in this browser. Please open Molan Business in Chrome and allow microphone access.");return;}
    try{window.speechSynthesis?.cancel();}catch(_){}
    toggle.classList.remove("voice-speaking");
    if(recognition){try{recognition.stop();}catch(_){}recognition=null;toggle.classList.remove("voice-listening");return;}
    recognition=new Recognition();recognition.lang="en-US";recognition.continuous=false;recognition.interimResults=false;
    toggle.classList.add("voice-listening");toggle.setAttribute("aria-label","Listening to Molano AI. Tap to stop listening");
    setStatus("Listening…");
    recognition.onresult=e=>{
      const transcript=String(e.results?.[0]?.[0]?.transcript||"").trim();
      if(!transcript){say("Sorry, I didn’t catch that. Tap me again and speak a little louder.");return;}
      pending=transcript;
      if(/\b(create|set up|open|register|delete|remove|send|publish|buy|pay|change|update|invite|approve|submit|cancel|sign out|log out)\b/i.test(transcript)){
        say("I heard: "+transcript+". I’ll explain the next step before anything is changed. Say yes if you want me to continue, or no to cancel.");
        waitingForSpokenConfirm=true;
        const begin=()=>{waitingForSpokenConfirm=false;if(pending)startConfirmation();};
        const waitSpeech=()=>{if(!window.speechSynthesis?.speaking)begin();else setTimeout(waitSpeech,250);};
        setTimeout(waitSpeech,400);
      }else{
        const question=pending;pending="";ask(question);
      }
    };
    recognition.onend=()=>{recognition=null;toggle.classList.remove("voice-listening");toggle.setAttribute("aria-label",voiceActivated?"Tap to speak to Molano AI":"Start Molano AI voice assistant");if(!busy&&!pending)setStatus("Ready for your next voice command.");};
    recognition.onerror=e=>{
      recognition=null;toggle.classList.remove("voice-listening");toggle.setAttribute("aria-label","Tap to speak to Molano AI");
      if(e.error==="not-allowed"||e.error==="service-not-allowed")say("Microphone access is blocked. Please allow microphone access for this site in Chrome settings, then tap me again.");
      else if(e.error!=="aborted")say("I couldn’t hear you clearly. Please tap me again and try once more.");
    };
    try{recognition.start();}catch(_){recognition=null;toggle.classList.remove("voice-listening");say("I couldn’t start the microphone. Please check microphone permission and try again.");}
  }
  mic.addEventListener("click",startListening);
  function syncAssistantPosition(){const mainLauncher=document.getElementById("molano-voice-launcher");const visible=mainLauncher&&getComputedStyle(mainLauncher).display!=="none";root.style.display=visible?"none":"";}
  syncAssistantPosition();new MutationObserver(syncAssistantPosition).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["style","class"]});
  window.addEventListener("beforeunload",()=>{try{recognition&&recognition.stop();confirmRecognition&&confirmRecognition.stop();}catch(_){}});
})();