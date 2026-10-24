import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// Keep every declared feature page in sync with its profile-owned navigation and route map.

const catalogPath = path.join(root, 'business-profiles/extended-catalog.json');
const registryPath = path.join(root, 'business-profiles/registry.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
if (!Array.isArray(catalog.profiles) || catalog.profiles.length !== 1500) {
  throw new Error('Expected exactly 1,500 extended business profiles.');
}
const slugify = value => String(value || '').toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const css = `:root{font-family:Inter,system-ui,sans-serif;color:#10213e;background:#f4f8fc}*{box-sizing:border-box}body{margin:0}.shell{max-width:1100px;margin:auto;padding:18px}.hero,.notice{border:1px solid #dce5f1;border-radius:20px;background:#fff;padding:22px;box-shadow:0 12px 34px #122b4f0f}.back{color:#087fbd;text-decoration:none;font-weight:700}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:#087fbd}.row{display:flex;justify-content:space-between;align-items:center;gap:14px}.mark{display:grid;place-items:center;width:58px;height:58px;border-radius:17px;background:linear-gradient(145deg,#05c8e8,#10366b);color:#fff;font-size:1.7rem}.muted{color:#65758b;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px;margin-top:16px}.card{display:flex;align-items:center;gap:12px;text-align:left;padding:16px;border:1px solid #dce5f1;border-radius:15px;background:#fff;color:#10213e;cursor:pointer;min-width:0;font:inherit;text-decoration:none}.card:hover{border-color:#0796d2}.num{color:#0796d2;font-weight:800}.copy{flex:1;min-width:0}.copy strong,.copy small{display:block;overflow-wrap:anywhere}.copy small{color:#65758b;margin-top:5px}.notice{margin-top:16px;color:#53657d;line-height:1.6}footer{display:flex;justify-content:space-between;gap:10px;padding:20px 4px;color:#65758b;font-size:.85rem}@media(max-width:620px){.shell{padding:10px}.hero{padding:16px}footer{flex-direction:column}}`;
const js = `(()=>{'use strict';const slug=location.pathname.replace(/\\/$/,'').split('/').slice(-2,-1)[0],grid=document.getElementById('features'),status=document.getElementById('connection-status'),notice=document.getElementById('notice');let profile;const safe=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));const fs=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\s-]/g,'').trim().replace(/[\\s_]+/g,'-').replace(/-+/g,'-');async function init(){try{const r=await fetch('profile.json',{cache:'no-cache'});if(!r.ok)throw Error('Profile configuration unavailable');profile=await r.json();if(profile.slug!==slug)throw Error('Profile folder and configuration do not match');document.title=profile.name+' | Molan Business';document.getElementById('profile-name').textContent=profile.name;document.getElementById('profile-description').textContent=profile.description||'';document.getElementById('profile-icon').textContent=profile.icon||'◈';grid.innerHTML=(profile.features||[]).map((f,i)=>'<a class="card" href="pages/'+fs(f.title)+'/index.html"><span class="num">'+String(i+1).padStart(2,'0')+'</span><span class="copy"><strong>'+safe(f.title)+'</strong><small>Open '+safe(f.title.toLowerCase())+'</small></span><span>↗</span></a>').join('');status.textContent='Profile loaded · '+(profile.features||[]).length+' dedicated feature pages';notice.textContent='Each feature above opens a page inside this business profile.'}catch(e){status.textContent='Could not load profile';notice.textContent=e.message;notice.dataset.state='error'}}init()})();`;

function ensureProfileNavigation(file, profile, isFeaturePage = false) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const deviceAccessScript = '<script data-profile-device-access src="' + (isFeaturePage ? '../../../../shared/profile-device-access.js' : '../../shared/profile-device-access.js') + '?v=20261018-1"></script>';
  const accessNavItem = '<a href="#give-device-access" data-give-device-access><span>🔐</span><strong>Give Access to Mobile &amp; PC App</strong></a>';
  if (html.includes('data-profile-hamburger')) {
    // Always normalize the actual hamburger nav, even if a stale marker exists elsewhere.
    const menuNav = /(\<aside\b[^>]*\bdata-profile-menu\b[^>]*>[\s\S]*?\<nav\b[^>]*>)([\s\S]*?)(\<\/nav\s*>)/i;
    const match = html.match(menuNav);
    if (!match) throw new Error('Profile hamburger has no menu navigation: ' + file);
    // Keep Give Access after the final profile-specific feature in the hamburger.
    const navContents = match[2]
      .replace(/<a\b(?=[^>]*\bdata-give-device-access\b)[^>]*>[\s\S]*?<\/a\s*>/gi, '')
      .replace(/^\s*/, '') + accessNavItem;
    html = html.replace(menuNav, match[1] + navContents + match[3]);

    const relativePage = path.relative(root, file).split(path.sep).join('/');
    const runtimeSrc = path.posix.relative(path.posix.dirname(relativePage), 'shared/profile-device-access.js');
    const canonicalRuntimeTag = '<script data-profile-device-access src="' + runtimeSrc + '?v=20261018-1"></script>';
    const runtimePattern = /<script\b(?=[^>]*\bdata-profile-device-access\b)[^>]*>[\s\S]*?<\/script\s*>/gi;
    if (runtimePattern.test(html)) {
      runtimePattern.lastIndex = 0;
      let first = true;
      html = html.replace(runtimePattern, () => {
        if (!first) return '';
        first = false;
        return canonicalRuntimeTag;
      });
    } else {
      html = html.replace('</body>', canonicalRuntimeTag + '</body>');
    }
    fs.writeFileSync(file, html);
    return;
  }
  const featureLinks = (profile.features || []).map((f, i) => {
    const href = isFeaturePage ? '../' + slugify(f.title) + '/index.html' : 'pages/' + slugify(f.title) + '/index.html';
    return '<a href="' + href + '"><span>' + String(i + 1).padStart(2, '0') + '</span>' + esc(f.title) + '</a>';
  }).join('');
  const overviewHref = isFeaturePage ? '../../index.html' : 'index.html';
  const appHref = isFeaturePage ? '../../../../index.html' : '../../index.html';
  const nav = '<button class="profile-menu-toggle" type="button" data-profile-hamburger aria-label="Open ' + esc(profile.name) + ' navigation" aria-expanded="false">☰ <span>Menu</span></button>' +
    '<div class="profile-menu-backdrop" data-profile-menu-backdrop hidden></div>' +
    '<aside class="profile-menu" data-profile-menu hidden aria-label="' + esc(profile.name) + ' navigation">' +
    '<div class="profile-menu-head"><div><small>BUSINESS PROFILE</small><strong>' + esc(profile.name) + '</strong></div><button type="button" data-profile-menu-close aria-label="Close menu">×</button></div>' +
    '<nav><a href="' + overviewHref + '"><span>⌂</span> Overview</a>' + featureLinks + accessNavItem + '</nav>' +
    '<a class="profile-menu-app" href="' + appHref + '">← Molan Business app</a></aside>';
  const styles = '<style data-profile-nav-styles>.profile-menu-toggle{position:sticky;top:10px;z-index:20;display:flex;align-items:center;gap:9px;margin:0 0 14px auto;padding:11px 15px;border:1px solid #cbd8e8;border-radius:13px;background:#fff;color:#10213e;font:700 14px system-ui;box-shadow:0 8px 24px #10213e12;cursor:pointer}.profile-menu-backdrop{position:fixed;inset:0;z-index:40;background:#07152bcc}.profile-menu{position:fixed;inset:0 auto 0 0;z-index:41;width:min(360px,88vw);overflow:auto;padding:18px;background:#f7faff;color:#10213e;box-shadow:18px 0 48px #07152b35}.profile-menu[hidden],.profile-menu-backdrop[hidden]{display:none}.profile-menu-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 2px 18px;border-bottom:1px solid #dce5f1}.profile-menu-head small,.profile-menu-head strong{display:block}.profile-menu-head small{font-size:10px;letter-spacing:.14em;color:#0787bf;font-weight:800}.profile-menu-head strong{margin-top:5px;font-size:18px}.profile-menu-head button{border:0;border-radius:10px;background:#e6eef8;padding:7px 12px;font-size:24px;cursor:pointer}.profile-menu nav{display:grid;gap:7px;padding:16px 0}.profile-menu nav a,.profile-menu-app{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e0e8f2;border-radius:11px;background:#fff;color:#10213e;text-decoration:none;font-size:14px}.profile-menu nav a:hover,.profile-menu-app:hover{border-color:#0787bf}.profile-menu nav a span{min-width:24px;color:#0787bf;font-weight:800}.profile-menu-app{font-weight:750;margin-top:8px}@media(min-width:900px){.profile-menu-toggle{position:fixed;top:18px;right:20px}}</style>';
  const script = '<script data-profile-nav-script>(()=>{const t=document.querySelector("[data-profile-hamburger]"),m=document.querySelector("[data-profile-menu]"),b=document.querySelector("[data-profile-menu-backdrop]"),c=document.querySelector("[data-profile-menu-close]");if(!t||!m||!b)return;const open=()=>{m.hidden=false;b.hidden=false;t.setAttribute("aria-expanded","true");c?.focus()};const close=()=>{m.hidden=true;b.hidden=true;t.setAttribute("aria-expanded","false");t.focus()};t.addEventListener("click",open);c?.addEventListener("click",close);b.addEventListener("click",close);document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!m.hidden)close()});})();</script>';
  const mainTag = /<main\b[^>]*>/i;
  if (!mainTag.test(html)) return;
  html = html.replace('</head>', styles + '</head>');
  html = html.replace(mainTag, match => match + nav);
  html = html.replace('</body>', script + deviceAccessScript + '</body>');
  fs.writeFileSync(file, html);
}


function ensureProfileFeatureLaunch(file, profile, feature) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  const route = feature.route || 'business-tools';
  const launchButton = '<button class="card" type="button" data-profile-feature-launch data-profile="' + esc(profile.slug) + '" data-profile-name="' + esc(profile.name) + '" data-feature-title="' + esc(feature.title) + '" data-feature-route="' + esc(route) + '">Open in Molan Business →</button>';
  if (html.includes('data-profile-feature-launch')) {
    const updated = html.replace(/<button class="card" type="button" data-profile-feature-launch[^>]*>.*?<\/button>/, launchButton);
    if (updated !== html) fs.writeFileSync(file, updated);
    return;
  }
  const block = '<section class="notice profile-feature-launch"><strong>' + esc(feature.title) + '</strong><p>Open this feature in the authenticated Molan Business workspace. Records remain scoped to the matching business profile.</p>' + launchButton + '<p data-profile-feature-status role="status">No data has been changed.</p></section>' +
    '<script data-profile-feature-launch-script>(()=>{const b=document.querySelector("[data-profile-feature-launch]"),s=document.querySelector("[data-profile-feature-status]");if(!b)return;b.addEventListener("click",()=>{const req={profile:b.dataset.profile,profileName:b.dataset.profileName,feature:{title:b.dataset.featureTitle,route:b.dataset.featureRoute},createdAt:Date.now()};if(typeof window.MolanProfileRuntime?.openFeature==="function"){try{const result=window.MolanProfileRuntime.openFeature(req);result?.catch?.(e=>{if(s)s.textContent=e.message||"Could not open feature"});return}catch(e){if(s)s.textContent=e.message||"Could not open feature";return}}try{localStorage.setItem("molan_business_pending_profile_feature_v1",JSON.stringify(req));location.href="../../../../index.html"}catch(e){if(s)s.textContent="Open the signed-in Molan Business app and select this profile feature from its hamburger menu."}})})();</script>';
  html = html.replace('</body>', block + '</body>');
  fs.writeFileSync(file, html);
}

let createdFolders = 0, createdPages = 0;
for (const [i, p] of catalog.profiles.entries()) {
  const dir = path.join(root, 'business-profiles', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const profile = { schemaVersion: 1, index: 51 + i, slug: p.slug, name: p.name, plural: p.plural || p.name,
    description: p.description || '', icon: p.icon || '◈', group: p.group || 'Other business services',
    extended: true, features: p.features || [], settingsRoute: p.settingsRoute || 'industry-settings',
    overviewRoute: p.overviewRoute || 'industry-profile' };
  if (!fs.existsSync(path.join(dir, 'profile.json'))) fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile, null, 2) + '\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(p.description)}"><title>${esc(p.name)} | Molan Business</title><link rel="stylesheet" href="profile.css"></head><body data-profile="${esc(p.slug)}"><main class="shell"><header class="hero"><a class="back" href="../../index.html">← Molan Business</a><p class="eyebrow">DEDICATED BUSINESS PROFILE · ${51+i} / ${50+catalog.profiles.length}</p><div class="row"><div><h1 id="profile-name">${esc(p.name)}</h1><p class="muted" id="profile-description">${esc(p.description)}</p></div><span class="mark" id="profile-icon">${esc(p.icon || '◈')}</span></div><p class="muted" id="connection-status">Loading profile configuration…</p></header><h2>Business features</h2><p class="muted">Choose a tool below. Each feature has its own page within this business profile.</p><div class="grid" id="features">${(p.features||[]).map((f,j)=>`<a class="card" href="pages/${slugify(f.title)}/index.html"><span class="num">${String(j+1).padStart(2,'0')}</span><span class="copy"><strong>${esc(f.title)}</strong><small>Open ${esc(f.title.toLowerCase())}</small></span><span>↗</span></a>`).join('')}</div><section class="notice" id="notice" role="status">Profile tools are ready.</section><footer><span>Molan Business · ${esc(p.name)}</span><span>Profile module: ${esc(p.slug)}</span></footer></main><script src="profile.js" defer></script></body></html>`;
  if (!fs.existsSync(path.join(dir, 'index.html'))) fs.writeFileSync(path.join(dir, 'index.html'), html);
  if (!fs.existsSync(path.join(dir, 'profile.js'))) fs.writeFileSync(path.join(dir, 'profile.js'), js);
  if (!fs.existsSync(path.join(dir, 'profile.css'))) fs.writeFileSync(path.join(dir, 'profile.css'), css);
  for (const [j, f] of (p.features || []).entries()) {
    const featureSlug = slugify(f.title);
    const pageDir = path.join(dir, 'pages', featureSlug);
    fs.mkdirSync(pageDir, { recursive: true });
    const pageHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(f.title)} · ${esc(p.name)}</title><link rel="stylesheet" href="../../profile.css"></head><body><main class="shell"><header class="hero"><a class="back" href="../../index.html">← Back to ${esc(p.name)}</a><p class="eyebrow">${esc(p.group || 'BUSINESS PROFILE')}</p><h1>${esc(f.title)}</h1><p class="muted">${esc(p.description)}</p></header><section class="notice"><strong>${esc(f.title)}</strong><p>This is the dedicated ${esc(f.title.toLowerCase())} page for <strong>${esc(p.name)}</strong>.</p><p>Use this area for ${esc(f.title.toLowerCase())} records and review the permissions of your active workspace before entering business data.</p><p>Workspace route: <code>${esc(f.route || 'business-tools')}</code></p></section><p><a class="card" href="../../../../index.html">Open Molan Business workspace ↗</a></p><footer><span>${esc(p.name)}</span><span>Feature ${j+1} / ${(p.features||[]).length}</span></footer></main></body></html>`;
    if (!fs.existsSync(path.join(pageDir, 'index.html'))) {
      fs.writeFileSync(path.join(pageDir, 'index.html'), pageHtml);
      createdPages++;
    }
    ensureProfileFeatureLaunch(path.join(pageDir, 'index.html'), profile, f);
  }
  ensureProfileNavigation(path.join(dir, 'index.html'), p, false);
  for (const f of (p.features || [])) ensureProfileNavigation(path.join(dir, 'pages', slugify(f.title), 'index.html'), p, true);
  createdFolders++;
}
// Add the same profile-scoped hamburger to the original 50 profile folders too.

const extended = new Set(catalog.profiles.map(p => p.slug));
const primaryProfileNavSync = `<script data-primary-profile-nav-sync>(()=>{const slugify=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\s-]/g,'').trim().replace(/[\\s_]+/g,'-').replace(/-+/g,'-');const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));fetch('profile.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Profile config unavailable');return r.json()}).then(p=>{const nav=document.querySelector('[data-profile-menu] nav');if(!nav||!Array.isArray(p.features))return;nav.replaceChildren();const home=document.createElement('a');home.href='index.html';home.innerHTML='<span>⌂</span> Overview';nav.append(home);p.features.forEach((f,i)=>{const a=document.createElement('a');a.href='pages/'+slugify(f.title)+'/index.html';a.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span>'+esc(f.title);nav.append(a)});const access=document.createElement('a');access.href='#give-device-access';access.dataset.giveDeviceAccess='';access.innerHTML='<span>🔐</span><strong>Give Access to Mobile &amp; PC App</strong>';nav.append(access)}).catch(e=>console.warn('[Molan Business] Profile navigation sync failed:',e.message));})();</script>
<script data-primary-profile-feature-fallback>(()=>{const slugify=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g,'').trim().replace(/[\s_]+/g,'-').replace(/-+/g,'-');document.addEventListener('click',e=>{const b=e.target.closest('#features button.feature');if(!b||typeof window.MolanProfileRuntime?.openFeature==='function')return;const title=b.querySelector('strong')?.textContent;if(!title)return;e.preventDefault();e.stopImmediatePropagation();location.href='pages/'+slugify(title)+'/index.html'},true)})();</script>`;
const primaryFeatureNavSync = `<script data-primary-feature-nav-sync>(()=>{const slugify=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9\\s-]/g,'').trim().replace(/[\\s_]+/g,'-').replace(/-+/g,'-');const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));fetch('../../profile.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Profile config unavailable');return r.json()}).then(p=>{const nav=document.querySelector('[data-profile-menu] nav');if(!nav||!Array.isArray(p.features))return;nav.replaceChildren();const home=document.createElement('a');home.href='../../index.html';home.innerHTML='<span>⌂</span> Overview';nav.append(home);p.features.forEach((f,i)=>{const a=document.createElement('a');a.href='../'+slugify(f.title)+'/index.html';a.innerHTML='<span>'+String(i+1).padStart(2,'0')+'</span>'+esc(f.title);nav.append(a)})}).catch(e=>console.warn('[Molan Business] Feature navigation sync failed:',e.message));})();</script>`;
let primaryFeaturePages=0, primaryProfilesUpdated=0;
for (const entry of registry.profiles) {
  if (extended.has(entry.slug)) continue;
  const configPath = path.join(root, entry.config || `business-profiles/${entry.slug}/profile.json`);
  const indexPath = path.join(root, entry.page || `business-profiles/${entry.slug}/index.html`);
  if (!fs.existsSync(configPath) || !fs.existsSync(indexPath)) continue;
  let profile;
  try { profile = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { continue; }
  if (!profile.slug || !Array.isArray(profile.features)) continue;
  const profileDir = path.dirname(configPath);
  for (const [i, feature] of profile.features.entries()) {
    if (!feature?.title) continue;
    const featureSlug = slugify(feature.title);
    const pageDir = path.join(profileDir, 'pages', featureSlug);
    const pagePath = path.join(pageDir, 'index.html');
    fs.mkdirSync(pageDir, { recursive: true });
    if (!fs.existsSync(pagePath)) {
    const route = feature.route || 'business-tools';
    const pageHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(profile.description)}"><title>${esc(feature.title)} · ${esc(profile.name)}</title><style>:root{font-family:Inter,system-ui,sans-serif;color:#10213e;background:#f4f8fc}*{box-sizing:border-box}body{margin:0}.shell{max-width:1000px;margin:auto;padding:clamp(12px,3vw,28px)}.hero,.panel{border:1px solid #dce5f1;border-radius:20px;background:#fff;padding:22px;box-shadow:0 12px 34px #122b4f0f}.back{color:#087fbd;text-decoration:none;font-weight:800}.eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.12em;color:#087fbd;margin-top:22px}h1{font-size:clamp(26px,5vw,40px);margin:8px 0}.muted{color:#65758b;line-height:1.6}.panel{margin-top:16px}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}button,.button{border:1px solid #cbd8e8;border-radius:12px;padding:12px 15px;background:#0a8ac5;color:white;font:700 14px system-ui;text-decoration:none;cursor:pointer}.secondary{background:white;color:#10213e}footer{padding:20px 4px;color:#65758b;font-size:.85rem}</style></head><body data-profile="${esc(profile.slug)}" data-profile-name="${esc(profile.name)}"><main class="shell"><header class="hero"><a class="back" href="../../index.html">← Back to ${esc(profile.name)}</a><p class="eyebrow">${esc(profile.group || 'BUSINESS PROFILE')} · FEATURE ${i+1} / ${profile.features.length}</p><h1>${esc(feature.title)}</h1><p class="muted">${esc(profile.description || 'Dedicated business profile feature.')}</p></header><section class="panel"><h2>${esc(feature.title)}</h2><p class="muted">This page belongs exclusively to the <strong>${esc(profile.name)}</strong> profile. Live records are opened through the authenticated Molan Business workspace and remain scoped to that workspace.</p><p class="muted">Feature destination: <code>${esc(route)}</code></p><div class="actions"><button id="open-feature" data-feature-title="${esc(feature.title)}" data-feature-route="${esc(route)}">Open in Molan Business →</button><a class="button secondary" href="../../index.html">Return to profile overview</a></div><p id="feature-status" class="muted" role="status">No data has been changed.</p></section><footer>Molan Business · ${esc(profile.name)} · ${esc(profile.slug)}</footer></main><script>(()=>{const b=document.getElementById('open-feature'),s=document.getElementById('feature-status');b.addEventListener('click',()=>{const req={profile:document.body.dataset.profile,profileName:document.body.dataset.profileName,feature:{title:b.dataset.featureTitle,route:b.dataset.featureRoute},createdAt:Date.now()};if(typeof window.MolanProfileRuntime?.openFeature==='function'){try{const r=window.MolanProfileRuntime.openFeature(req);r?.catch?.(e=>s.textContent=e.message||'Could not open feature');return}catch(e){s.textContent=e.message||'Could not open feature';return}}try{localStorage.setItem('molan_business_pending_profile_feature_v1',JSON.stringify(req));location.href='../../../../index.html'}catch(e){s.textContent='Open the signed-in Molan Business app and select this profile feature from its hamburger menu.'}})})();</script></body></html>`;
    fs.writeFileSync(pagePath, pageHtml);
    primaryFeaturePages++;
    }
    ensureProfileFeatureLaunch(pagePath, profile, feature);
    let featureHtml = fs.readFileSync(pagePath, 'utf8');
    if (!featureHtml.includes('data-primary-feature-nav-sync')) {
      featureHtml = featureHtml.replace('</body>', primaryFeatureNavSync + '<script data-profile-device-access src="../../../../shared/profile-device-access.js"></script></body>');
      fs.writeFileSync(pagePath, featureHtml);
    }
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('data-primary-profile-nav-sync')) {
    html = html.replace('</body>', primaryProfileNavSync + '<script data-profile-device-access src="../../shared/profile-device-access.js"></script></body>');
    fs.writeFileSync(indexPath, html);
    primaryProfilesUpdated++;
  }
}


for (const entry of registry.profiles) {
  if (extended.has(entry.slug)) continue;
  const configPath = path.join(root, entry.config || `business-profiles/${entry.slug}/profile.json`);
  const indexPath = path.join(root, entry.page || `business-profiles/${entry.slug}/index.html`);
  if (!fs.existsSync(configPath) || !fs.existsSync(indexPath)) continue;
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    ensureProfileNavigation(indexPath, config, false);
    for (const feature of (config.features || [])) {
      const featurePath = path.join(root, 'business-profiles', entry.slug, 'pages', slugify(feature.title), 'index.html');
      if (fs.existsSync(featurePath)) ensureProfileNavigation(featurePath, config, true);
    }
  } catch (error) {
    console.warn('Skipping optional navigation injection for existing profile', entry.slug, error.message);
  }
}
for (const p of registry.profiles) {
  if (extended.has(p.slug)) {
    p.config = `business-profiles/${p.slug}/profile.json`;
    p.page = `business-profiles/${p.slug}/index.html`;
    p.featureMap = `business-profiles/${p.slug}/profile.json#features`;
  }
}
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Generated ${createdFolders} dedicated profile folders and ${createdPages} feature pages.`);
