(function () {
  "use strict";
  if (window.__molanoVoiceAssistantLoaded) return;
  window.__molanoVoiceAssistantLoaded = true;
  const PRODUCT = document.body.dataset.molanoProduct || document.title || "ZakiTech";
  const API = "https://molanoai.zakpollyqueens.workers.dev/api/support-chat";
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const history = [];
  let busy = false, recognition = null, confirmRecognition = null, pending = "", waitingForSpokenConfirm = false;
  const style = document.createElement("style");
  style.textContent = `
  #molanoVoiceRoot{position:fixed;right:18px;bottom:18px;z-index:99999;font:14px/1.45 system-ui,-apple-system,sans-serif;color:#eef8ff}
  #molanoVoiceToggle{width:58px;height:58px;border-radius:50%;border:1px solid #83efff;background:linear-gradient(145deg,#a5f6ff,#37bfe7 55%,#587fff);color:#061629;font-size:25px;font-weight:900;box-shadow:0 8px 32px #20c9e955;cursor:pointer}
  #molanoVoicePanel{display:none;position:absolute;right:0;bottom:70px;width:min(370px,calc(100vw - 28px));max-height:min(72dvh,600px);background:#091a2b;border:1px solid #2a5876;border-radius:20px;box-shadow:0 22px 70px #0009;overflow:hidden}
  #molanoVoicePanel.open{display:flex;flex-direction:column}
  .mv-head{display:flex;align-items:center;gap:10px;padding:14px;background:linear-gradient(120deg,#102e4a,#122343);border-bottom:1px solid #ffffff16}
  .mv-logo{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:linear-gradient(145deg,#a5f6ff,#37bfe7 55%,#587fff);color:#061629;font-weight:950}
  .mv-head strong{display:block;font-size:14px}.mv-head small{color:#a7c2d8;font-size:11px}
  .mv-close{margin-left:auto;background:transparent;border:0;color:#d8f5ff;font-size:22px;cursor:pointer}
  .mv-messages{padding:13px;overflow:auto;min-height:120px;max-height:34dvh;display:flex;flex-direction:column;gap:9px}
  .mv-msg{padding:10px 12px;border-radius:13px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}
  .mv-msg.bot{align-self:flex-start;background:#132b42;border:1px solid #ffffff12;max-width:94%}
  .mv-msg.user{align-self:flex-end;background:#24577a;max-width:94%}
  .mv-status{padding:0 13px 8px;color:#9cb8cf;font-size:11px;min-height:18px}
  .mv-controls{display:flex;gap:7px;padding:11px;border-top:1px solid #ffffff15;background:#071525}
  .mv-controls textarea{min-width:0;flex:1;resize:none;height:43px;max-height:90px;background:#10243a;border:1px solid #34516b;border-radius:12px;padding:10px;color:#eef8ff;font:inherit;font-size:13px}
  .mv-controls button{border:1px solid #345b78;border-radius:12px;background:#12304a;color:#dffaff;min-width:42px;padding:0 10px;cursor:pointer}
  .mv-controls .mv-send{background:linear-gradient(145deg,#a5f6ff,#5d9aff);color:#071629;font-weight:900}
  .mv-controls button:disabled{opacity:.5}
  .mv-note{padding:0 13px 12px;color:#8fa9bf;font-size:10px;background:#071525}
  @media(max-width:480px){#molanoVoiceRoot{right:12px;bottom:12px}#molanoVoiceToggle{width:54px;height:54px}.mv-messages{max-height:31dvh}}
  `;
  document.head.appendChild(style);
  const root = document.createElement("div");
  root.id = "molanoVoiceRoot";
  root.innerHTML = '<section id="molanoVoicePanel" role="dialog" aria-label="Molano AI voice assistant"><header class="mv-head"><span class="mv-logo">M</span><div><strong>Molano AI</strong><small>Voice assistant · ' + escapeHtml(PRODUCT) + '</small></div><button class="mv-close" aria-label="Close assistant">×</button></header><div class="mv-messages" aria-live="polite"><div class="mv-msg bot">Hi! I’m Molano AI. I can talk you through ' + escapeHtml(PRODUCT) + '. Tell me what you need, and I’ll explain the next step before you confirm anything.</div></div><div class="mv-status" aria-live="polite">Ready when you are.</div><div class="mv-controls"><textarea aria-label="Message Molano AI" placeholder="Ask Molano…"></textarea><button class="mv-mic" aria-label="Speak to Molano">🎙</button><button class="mv-send" aria-label="Send message">➤</button></div><div class="mv-note">Advice and support only here. No account, sales, inventory, or settings changes are made by this widget.</div></section><button id="molanoVoiceToggle" aria-label="Open Molano AI assistant" title="Talk to Molano AI">M</button>';
  document.body.appendChild(root);
  const panel = root.querySelector("#molanoVoicePanel"), toggle = root.querySelector("#molanoVoiceToggle");
  const messagesEl = root.querySelector(".mv-messages"), statusEl = root.querySelector(".mv-status"), input = root.querySelector("textarea");
  const mic = root.querySelector(".mv-mic"), send = root.querySelector(".mv-send");
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function say(text){if(!("speechSynthesis" in window))return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=1;u.pitch=1;speechSynthesis.speak(u);}catch(_){}}
  function addMessage(text, who){const el=document.createElement("div");el.className="mv-msg "+who;el.textContent=text;messagesEl.appendChild(el);messagesEl.scrollTop=messagesEl.scrollHeight;}
  function setStatus(text){statusEl.textContent=text;}
  function open(){panel.classList.add("open");toggle.setAttribute("aria-expanded","true");input.focus({preventScroll:true});}
  function close(){panel.classList.remove("open");toggle.setAttribute("aria-expanded","false");}
  toggle.addEventListener("click",()=>panel.classList.contains("open")?close():open());
  root.querySelector(".mv-close").addEventListener("click",close);
  async function ask(text){
    if(busy||!text.trim())return;
    busy=true;send.disabled=true;setStatus("Molano is thinking…");history.push({role:"user",content:text.trim()});addMessage(text.trim(),"user");
    try{
      const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product:PRODUCT,messages:history.slice(-10)})});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Molano is temporarily unavailable.");
      const answer=String(data.response||data.reply||data.message||"I couldn't prepare a response. Please try again.");
      history.push({role:"assistant",content:answer});addMessage(answer,"bot");setStatus("Reply ready.");say(answer);
    }catch(e){const msg=e.message||"Connection failed.";addMessage(msg,"bot");setStatus("Could not connect.");say(msg);}
    finally{busy=false;send.disabled=false;}
  }
  function submitTyped(){const value=input.value.trim();if(!value)return;input.value="";ask(value);}
  send.addEventListener("click",submitTyped);
  input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submitTyped();}});
  function startConfirmation(){
    if(!Recognition){const yes=window.confirm('I heard: "'+pending+'". Send this request to Molano AI?');const cmd=pending;pending="";if(yes)ask(cmd);else setStatus("Request cancelled.");return;}
    confirmRecognition=new Recognition();confirmRecognition.lang="en-US";confirmRecognition.continuous=false;confirmRecognition.interimResults=false;
    confirmRecognition.onresult=e=>{
      const answer=e.results[0][0].transcript.toLowerCase().trim(),cmd=pending;pending="";
      if(/^(yes|yeah|yep|confirm|confirmed|proceed|go ahead|do it|correct|that's right|that is right)\b/.test(answer)){setStatus("Confirmed. Sending request…");ask(cmd);}
      else if(/^(no|nope|cancel|stop|don't|do not|not now)\b/.test(answer)){setStatus("Cancelled. Nothing was sent.");say("Okay, cancelled. Nothing was sent.");}
      else{setStatus("Please say yes to send or no to cancel.");say("Please say yes to send, or no to cancel.");}
    };
    confirmRecognition.onerror=()=>setStatus("I couldn't hear yes or no. Tap the microphone to try again.");
    try{confirmRecognition.start();setStatus("Listening for yes or no…");}catch(_){setStatus("Please confirm using the prompt on your screen.");}
  }
  mic.addEventListener("click",()=>{
    if(!Recognition){setStatus("Voice input isn't supported in this browser. Type your message instead.");return;}
    if(recognition){try{recognition.stop();}catch(_){}recognition=null;return;}
    recognition=new Recognition();recognition.lang="en-US";recognition.continuous=false;recognition.interimResults=false;
    mic.textContent="■";setStatus("Listening…");
    recognition.onresult=e=>{const transcript=e.results[0][0].transcript.trim();pending=transcript;addMessage("I heard: “"+transcript+"”\nI’ll send this request to Molano AI for advice. Should I proceed? Say yes or no.","bot");if("speechSynthesis" in window){waitingForSpokenConfirm=true;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance("I heard: "+transcript+". I will send this request to Molano AI for advice. Should I proceed? Please say yes or no.");u.lang="en-US";u.onend=()=>{waitingForSpokenConfirm=false;if(pending)startConfirmation();};u.onerror=()=>{waitingForSpokenConfirm=false;if(pending)startConfirmation();};speechSynthesis.speak(u);}else{startConfirmation();}};
    recognition.onend=()=>{mic.textContent="🎙";recognition=null;if(pending&&!waitingForSpokenConfirm)startConfirmation();else if(!busy&&!pending)setStatus("Ready when you are.");};
    recognition.onerror=()=>{mic.textContent="🎙";recognition=null;setStatus("Microphone unavailable. Check browser permission and try again.");};
    try{recognition.start();}catch(_){mic.textContent="🎙";recognition=null;setStatus("Couldn't start the microphone.");}
  });
  window.setTimeout(()=>{if(!sessionStorage.getItem("molanoVoiceWelcomed")){sessionStorage.setItem("molanoVoiceWelcomed","1");say("Hello, welcome. I’m Molano AI, your assistant for "+PRODUCT+". Open me any time and I’ll help you step by step.");}},1200);
  window.addEventListener("beforeunload",()=>{try{recognition&&recognition.stop();confirmRecognition&&confirmRecognition.stop();}catch(_){}});
})();