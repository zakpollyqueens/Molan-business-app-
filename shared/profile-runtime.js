/* Shared profile loader/route bridge. Authentication remains owned by the main app. */
(() => {
 const root='business-profiles/'; let registryPromise;
 const safeSlug=v=>/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(v||''));
 async function registry(){if(!registryPromise)registryPromise=fetch(root+'registry.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Profile registry unavailable');return r.json()}).then(d=>{if(d?.schemaVersion!==1||!Array.isArray(d.profiles))throw Error('Invalid profile registry');return d}).catch(e=>{registryPromise=null;throw e});return registryPromise}
 async function getProfile(slug){if(!safeSlug(slug))throw Error('Invalid profile identifier');const d=await registry();const entry=d.profiles.find(p=>p.slug===slug&&p.enabled!==false);if(!entry)throw Error('Profile is not registered or enabled');const r=await fetch(root+slug+'/profile.json',{cache:'no-cache'});if(!r.ok)throw Error('Profile configuration unavailable');const p=await r.json();if(p.slug!==slug||!Array.isArray(p.features))throw Error('Profile configuration failed validation');return p}
 function navigate(page,options={}){if(typeof page!=='string'||!/^[a-z0-9-]+$/.test(page))return false;if(typeof window.MolanNavigate==='function'){window.MolanNavigate(page,options);return true}document.dispatchEvent(new CustomEvent('molan:navigate',{detail:{page,...options}}));return false}
 window.MolanProfileRuntime=Object.assign(window.MolanProfileRuntime||{},{registry,getProfile,navigate,safeSlug});
})();