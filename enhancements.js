/* Molan Business experience enhancements: profile-specific visual identity, live release checks, and data-led mini charts. */
(() => {
  'use strict';
  const FALLBACK_VERSION = '1.0.0';
  const RELEASE_API = 'https://api.github.com/repos/zakpollyqueens/Molan-business-app-/releases/latest';
  const RELEASE_PAGE = 'https://github.com/zakpollyqueens/Molan-business-app-/releases/latest';
  const DISMISSED_KEY = 'molan_update_dismissed_version';
  const $ = (selector, root=document) => root.querySelector(selector);
  let latestRelease = null;
  let lastPageText = '';

  const themes = [
    {key:'technology', words:['ict','technology','software','it services','cyber','computer','network','digital','web development','application development'], title:'Technology & digital systems'},
    {key:'education', words:['school','education','training','university','college','learning'], title:'Education & learning'},
    {key:'finance', words:['sacco','savings','finance','investment','microfinance','banking','accounting','insurance'], title:'Finance & financial services'},
    {key:'health', words:['clinic','health','medical','pharmacy','hospital','wellness'], title:'Healthcare'},
    {key:'agriculture', words:['farm','agriculture','livestock','poultry','crop','agribusiness'], title:'Agriculture & agribusiness'},
    {key:'hospitality', words:['hotel','restaurant','catering','tourism','hospitality','lodge'], title:'Hospitality & tourism'},
    {key:'retail', words:['retail','shop','wholesale','grocery','supermarket','boutique'], title:'Retail & commerce'},
    {key:'transport', words:['transport','logistics','delivery','taxi','fleet','travel'], title:'Transport & logistics'},
    {key:'construction', words:['construction','engineering','architecture','building','contractor'], title:'Construction & engineering'},
    {key:'property', words:['property','real estate','rent','estate agency','landlord'], title:'Property & real estate'},
    {key:'community', words:['ngo','nonprofit','community','church','charity','foundation'], title:'Community & impact'},
    {key:'default', words:[], title:'Business workspace'}
  ];

  function detectTheme(text) {
    const normalized = String(text || '').toLowerCase();
    for (const theme of themes) {
      if (theme.words.some(word => normalized.includes(word))) return theme;
    }
    return themes[themes.length - 1];
  }

  function applyProfileTheme() {
    const content = $('#page-content');
    if (!content) return;
    const title = $('#breadcrumb-page')?.textContent || '';
    const profileTitle = $('.profile-detail-hero h2', content)?.textContent || '';
    const categoryText = $('[data-profile-category]', content)?.textContent || '';
    const theme = detectTheme([title, profileTitle, categoryText, content.textContent.slice(0, 1800)].join(' '));
    document.body.dataset.profileTheme = theme.key;
    const hero = $('.profile-detail-hero', content);
    if (hero) {
      hero.dataset.profileTheme = theme.key;
      hero.setAttribute('aria-label', theme.title + ' business profile');
    }
  }

  function parseVersion(tag) {
    const parts = String(tag || '').replace(/^v/i, '').split(/[.+-]/).slice(0, 3).map(v => Number.parseInt(v, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  }

  function isNewer(remote, local) {
    const a = parseVersion(remote), b = parseVersion(local);
    for (let i = 0; i < 3; i++) {
      if (a[i] > b[i]) return true;
      if (a[i] < b[i]) return false;
    }
    return false;
  }

  function ensureUpdateButton() {
    let button = $('#molan-floating-update');
    if (button) return button;
    button = document.createElement('button');
    button.id = 'molan-floating-update';
    button.className = 'molan-floating-update';
    button.type = 'button';
    button.hidden = true;
    button.setAttribute('aria-live', 'polite');
    button.innerHTML = '<span class="molan-update-pulse" aria-hidden="true"></span><span class="molan-update-copy"><strong>Update available</strong><small>Get the latest Molan Business</small></span><span aria-hidden="true">↓</span>';
    document.body.appendChild(button);
    button.addEventListener('click', () => {
      if (!latestRelease) {
        window.open(RELEASE_PAGE, '_blank', 'noopener,noreferrer');
        return;
      }
      const assets = latestRelease.assets || [];
      const isAndroid = /Android/i.test(navigator.userAgent);
      const asset = assets.find(item => isAndroid ? /molan[-_ ]business.*\.apk$/i.test(item.name) : /molan[-_ ]business.*\.exe$/i.test(item.name));
      if (!asset) {
        window.open(latestRelease.html_url || RELEASE_PAGE, '_blank', 'noopener,noreferrer');
        button.querySelector('strong').textContent = 'Open release downloads';
        button.querySelector('small').textContent = 'Choose the installer for your device';
        return;
      }
      const link = document.createElement('a');
      link.href = asset.browser_download_url;
      link.download = asset.name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      try { localStorage.setItem(DISMISSED_KEY, latestRelease.tag_name); } catch (_) {}
      button.hidden = true;
    });
    return button;
  }

  async function checkForUpdates() {
    const button = ensureUpdateButton();
    try {
      const response = await fetch(RELEASE_API + '?_=' + Date.now(), {
        cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) throw new Error('Release check unavailable');
      const release = await response.json();
      let localVersion = FALLBACK_VERSION;
      try { const versionResponse = await fetch('version.json?_=' + Date.now(), { cache: 'no-store' }); if (versionResponse.ok) { const metadata = await versionResponse.json(); if (metadata.currentVersion) localVersion = metadata.currentVersion; } } catch (_) {}
      if (release.draft || release.prerelease || !release.tag_name || !isNewer(release.tag_name, localVersion)) {
        button.hidden = true;
        return;
      }
      let dismissed = '';
      try { dismissed = localStorage.getItem(DISMISSED_KEY) || ''; } catch (_) {}
      if (dismissed === release.tag_name) {
        button.hidden = true;
        return;
      }
      latestRelease = release;
      button.hidden = false;
      button.dataset.downloadStarted = 'false';
      button.querySelector('strong').textContent = 'Update available · ' + release.tag_name;
      button.querySelector('small').textContent = 'Download the latest version';
    } catch (_) {
      // Network/rate-limit errors must never interrupt core app usage.
      button.hidden = true;
    }
  }

  function addMiniChart() {
    const content = $('#page-content');
    if (!content || $('#molan-mini-analytics', content)) return;
    const title = ($('#breadcrumb-page')?.textContent || '').toLowerCase();
    if (!/(overview|reports|analytics|dashboard|finance|sales|inventory|sacco)/.test(title)) return;
    const cards = [...content.querySelectorAll('.stat-card, .metric-card, .kpi-card, .stat-item')].slice(0, 6);
    if (cards.length < 2) return;
    const values = cards.map((card, index) => {
      const text = card.innerText || '';
      const match = text.match(/(?:UGX\s*)?([\d,]+(?:\.\d+)?)/);
      if (!match) return null;
      return { label: text.split('\n').map(s => s.trim()).find(Boolean) || ('Metric ' + (index + 1)), value: Number(match[1].replace(/,/g, '')) };
    }).filter(item => item && Number.isFinite(item.value) && item.value >= 0);
    if (values.length < 2 || values.every(item => item.value === 0)) return;
    const max = Math.max(...values.map(item => item.value), 1);
    const width = 520, height = 180, left = 14, bottom = 142;
    const slot = (width - left * 2) / values.length;
    const bars = values.map((item, i) => {
      const barHeight = Math.max(3, (item.value / max) * 100);
      const x = left + i * slot + slot * 0.2;
      const y = bottom - barHeight;
      const label = item.label.replace(/[&<>"]/g, '').slice(0, 18);
      return '<g><rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (slot * .6).toFixed(1) + '" height="' + barHeight.toFixed(1) + '" rx="5" class="molan-chart-bar"><title>' + label + ': ' + item.value.toLocaleString() + '</title></rect><text x="' + (x + slot * .3).toFixed(1) + '" y="162" text-anchor="middle">' + label.slice(0, 10) + '</text></g>';
    }).join('');
    const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
    const circumference = 2 * Math.PI * 48;
    let pieOffset = 0;
    const pieSegments = values.map((item, index) => {
      const length = (item.value / total) * circumference;
      const segment = '<circle class="molan-pie-segment molan-pie-segment-' + (index % 6) + '" cx="60" cy="60" r="48" fill="none" stroke-width="18" stroke-dasharray="' + length.toFixed(2) + ' ' + (circumference - length).toFixed(2) + '" stroke-dashoffset="' + (-pieOffset).toFixed(2) + '"><title>' + item.label.replace(/[&<>"]/g, '').slice(0, 24) + ': ' + ((item.value / total) * 100).toFixed(1) + '%</title></circle>';
      pieOffset += length;
      return segment;
    }).join('');
    const section = document.createElement('section');
    section.id = 'molan-mini-analytics';
    section.className = 'panel molan-mini-analytics';
    section.innerHTML = '<div class="panel-head"><div><span class="section-kicker">QUICK ANALYTICS</span><h3>Workspace metrics at a glance</h3><p>Chart generated from the visible metrics already shown on this page.</p></div><span class="molan-chart-badge">Live page data</span></div><div class="molan-chart-wrap"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Bar chart of visible workspace metrics"><line x1="10" y1="' + bottom + '" x2="' + (width - 10) + '" y2="' + bottom + '" class="molan-chart-axis"/>' + bars + '</svg></div><div class="molan-pie-panel"><div class="molan-pie-chart"><svg viewBox="0 0 120 120" role="img" aria-label="Pie chart showing each visible metric as a share of their combined total"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--line,#e7edf4)" stroke-width="18"/>' + pieSegments + '</svg></div><div class="molan-pie-legend">' + values.map((item,index)=>'<div><span class="molan-pie-dot molan-pie-segment-' + (index % 6) + '"></span><span>' + item.label.replace(/[&<>"]/g, '').slice(0,22) + '</span><strong>' + ((item.value / total) * 100).toFixed(1) + '%</strong></div>').join('') + '</div></div><div class="molan-metric-table-wrap"><table class="molan-metric-table"><thead><tr><th>Metric</th><th class="number">Value</th></tr></thead><tbody>' + values.map(item => '<tr><td>' + item.label.replace(/[&<>"]/g, '') + '</td><td class="number">' + item.value.toLocaleString() + '</td></tr>').join('') + '</tbody></table></div>';
    content.appendChild(section);
  }

  function addStatusPieChart() {
    const content = $('#page-content');
    if (!content || $('#molan-status-pie', content)) return;
    const page = ($('#breadcrumb-page')?.textContent || '').toLowerCase();
    if (!/(reports|analytics|inventory|sales|finance|sacco|overview)/.test(page)) return;
    const counts = new Map();
    content.querySelectorAll('.badge').forEach(badge => {
      const label = (badge.textContent || '').trim();
      if (!label || label.length > 32) return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    if (counts.size < 2) return;
    const sorted = [...counts.entries()].sort((a,b) => b[1]-a[1]);
    const chosen = sorted.slice(0, 5);
    if (sorted.length > 5) chosen.push(['Other', sorted.slice(5).reduce((sum,item) => sum + item[1], 0)]);
    const total = chosen.reduce((sum,item) => sum + item[1], 0);
    if (total < 2) return;
    const colors = ['#2878e5','#18a77b','#f3a54a','#9b7de3','#20b7c9','#8b9aad'];
    let cursor = 0;
    const slices = chosen.map((item,index) => {
      const start = cursor;
      cursor += item[1] / total * 100;
      return colors[index % colors.length] + ' ' + start.toFixed(2) + '% ' + cursor.toFixed(2) + '%';
    });
    const section = document.createElement('section');
    section.id = 'molan-status-pie';
    section.className = 'panel molan-status-pie';
    section.innerHTML = '<div class="panel-head"><div><span class="section-kicker">STATUS MIX</span><h3>Visible record distribution</h3><p>Summarized from the status badges currently displayed on this page.</p></div></div><div class="molan-pie-layout"><div class="molan-pie" role="img" aria-label="Pie chart of visible record statuses" style="background:conic-gradient(' + slices.join(',') + ')"><span>' + total + '<small>records</small></span></div><ul class="molan-pie-legend">' + chosen.map((item,index) => '<li><span class="molan-pie-dot" style="background:' + colors[index % colors.length] + '"></span><span>' + item[0].replace(/[&<>"]/g,'') + '</span><strong>' + item[1] + '</strong></li>').join('') + '</ul></div>';
    content.appendChild(section);
  }

  function refreshEnhancements() {
    const content = $('#page-content');
    if (!content) return;
    const snapshot = ($('#breadcrumb-page')?.textContent || '') + '|' + (content.innerText || '').slice(0, 900);
    if (snapshot === lastPageText) return;
    lastPageText = snapshot;
    applyProfileTheme();
    addMiniChart();
    addStatusPieChart();
  }

  function start() {
    ensureUpdateButton();
    refreshEnhancements();
    checkForUpdates();
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(refreshEnhancements);
    });
    const content = $('#page-content');
    if (content) observer.observe(content, { childList: true, subtree: true, characterData: true });
    const breadcrumb = $('#breadcrumb-page');
    if (breadcrumb) new MutationObserver(refreshEnhancements).observe(breadcrumb, { childList: true, subtree: true, characterData: true });
    window.setInterval(checkForUpdates, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
