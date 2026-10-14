import { eventSource, event_types, getContext } from '../../../../script.js';

const EXT = 'solo_system_floating_ui';
const DEFAULT_DATA = {
  level: 'N/A', exp: 'N/A', job: 'N/A', title: 'N/A', hp: 'N/A/N/A', mp: 'N/A/N/A', sp: 'N/A/N/A',
  str: 'N/A', agi: 'N/A', vit: 'N/A', int: 'N/A', per: 'N/A', cha: 'N/A',
  equipment: {}, skills: { passive: [], active: [], ultimate: [] }, inventory: [], quests: []
};
let currentData = structuredClone(DEFAULT_DATA);
let root;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function normalizeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return structuredClone(DEFAULT_DATA);
  return { ...structuredClone(DEFAULT_DATA), ...data,
    equipment: data.equipment || {},
    skills: { passive: [], active: [], ultimate: [], ...(data.skills || {}) },
    inventory: Array.isArray(data.inventory) ? data.inventory : [],
    quests: Array.isArray(data.quests) ? data.quests : []
  };
}
function findDataInText(text) {
  if (!text) return null;
  const patterns = [/<system_data>\s*([\s\S]*?)\s*<\/system_data>/i, /```(?:json|system_data)\s*([\s\S]*?)```/i];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) { try { return JSON.parse(match[1]); } catch {} }
  }
  // Also accept a complete JSON object with recognizable system keys.
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { const obj = JSON.parse(text.slice(start, end + 1)); if (['level','hp','skills','equipment','inventory','quests'].some(k => k in obj)) return obj; } catch {}
  }
  return null;
}
function getChatText(message) {
  if (typeof message === 'string') return message;
  if (!message) return '';
  return message.mes || message.message || message.text || '';
}
function latestChatData() {
  try {
    const { chat } = getContext();
    for (let i = (chat?.length || 0) - 1; i >= 0; i--) {
      const found = findDataInText(getChatText(chat[i]));
      if (found) return found;
    }
  } catch (e) { console.debug(`[${EXT}] Could not inspect chat`, e); }
  return null;
}
function itemButton(item, type = '') {
  const name = typeof item === 'string' ? item : (item.name || item.type || 'Unnamed');
  const meta = typeof item === 'object' ? [item.type, item.level ? `LV.${item.level}` : '', item.exp ? `EXP: ${item.exp}` : '', item.amount != null ? `AMOUNT: ${item.amount}` : ''].filter(Boolean).join(' · ') : type;
  const details = typeof item === 'string' ? '' : [item.stat ? `STATUS BONUS: ${item.stat}` : '', item.desc || '', item.timer ? `TIME LEFT: ${item.timer}` : '', item.goals?.length ? 'GOALS:\n' + item.goals.map(g => `${g.done ? '[✓]' : '[ ]'} ${g.name}: ${g.progress ?? ''}`).join('\n') : '', item.reward ? `REWARD: ${item.reward}` : '', item.warning || '', item.msg || ''].filter(Boolean).join('\n\n');
  return `<button class="ssui-item" data-name="${escapeHtml(name)}" data-meta="${escapeHtml(meta)}" data-desc="${escapeHtml(details)}">${escapeHtml(name)}</button>`;
}
function listSection(title, items, empty = 'NONE') {
  const contents = Array.isArray(items) && items.length ? items.map(i => itemButton(i)).join('') : `<div class="ssui-empty">${empty}</div>`;
  return `<section class="ssui-section"><h3>${escapeHtml(title)}</h3><div class="ssui-list">${contents}</div></section>`;
}
function render() {
  if (!root) return;
  const d = currentData;
  root.querySelector('[data-view="stats"]').innerHTML = `
    <section class="ssui-section"><h3>CHARACTER</h3>${[['LEVEL',d.level],['EXP',d.exp],['JOB',d.job],['TITLE',d.title]].map(([k,v])=>`<div class="ssui-stat"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join('')}</section>
    <section class="ssui-section"><h3>RESOURCES</h3>${[['HP',d.hp],['MP',d.mp],['SP',d.sp]].map(([k,v])=>`<div class="ssui-stat"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join('')}</section>
    <section class="ssui-section"><h3>ATTRIBUTES</h3>${[['STR',d.str],['AGI',d.agi],['VIT',d.vit],['INT',d.int],['PER',d.per],['CHA',d.cha]].map(([k,v])=>`<div class="ssui-stat"><span>${k}</span><b>${escapeHtml(v)}</b></div>`).join('')}</section>`;
  const slots = [['head','HEAD'],['chest','CHEST'],['gloves','GLOVES'],['pants','PANTS'],['shoes','SHOES'],['weapon','WEAPON']];
  root.querySelector('[data-view="equip"]').innerHTML = slots.map(([key,label]) => { let val=d.equipment?.[key]; const arr=Array.isArray(val)?val:(val?[val]:[]); return listSection(label,arr.filter(x=>x && x.name && !['None','N/A'].includes(x.name))); }).join('');
  root.querySelector('[data-view="skills"]').innerHTML = listSection('PASSIVE SKILLS',d.skills?.passive)+listSection('ACTIVE SKILLS',d.skills?.active)+listSection('ULTIMATE SKILLS',d.skills?.ultimate);
  root.querySelector('[data-view="items"]').innerHTML = listSection('INVENTORY',d.inventory,'EMPTY');
  root.querySelector('[data-view="quests"]').innerHTML = listSection('QUEST LIST',d.quests,'NO QUESTS');
}
function setData(data) { currentData = normalizeData(data); render(); }
function openDetails(button) {
  root.querySelector('.ssui-detail-title').textContent = button.dataset.name || 'DETAIL';
  root.querySelector('.ssui-detail-meta').textContent = button.dataset.meta || '';
  root.querySelector('.ssui-detail-desc').textContent = button.dataset.desc || 'No additional details.';
  root.querySelector('.ssui-detail').hidden = false;
}
function createUI() {
  if (document.getElementById('ssui-root')) return;
  root = document.createElement('div'); root.id = 'ssui-root';
  root.innerHTML = `
    <button class="ssui-launcher" title="Open Solo System" aria-label="Open Solo System">SYSTEM</button>
    <div class="ssui-window" hidden role="dialog" aria-label="Solo System interface">
      <header class="ssui-header"><span class="ssui-brand">▣ SYSTEM INTERFACE</span><div class="ssui-head-actions"><button class="ssui-refresh" title="Read latest chat data">↻</button><button class="ssui-close" title="Close">×</button></div></header>
      <nav class="ssui-tabs">${[['stats','STATS'],['equip','EQUIP'],['skills','SKILL'],['items','ITEM'],['quests','QUEST']].map(([id,label],i)=>`<button data-tab="${id}" class="${i===0?'active':''}">${label}</button>`).join('')}</nav>
      <div class="ssui-main">${['stats','equip','skills','items','quests'].map((id,i)=>`<div class="ssui-view" data-view="${id}" ${i?'hidden':''}></div>`).join('')}</div>
      <div class="ssui-detail" hidden><div class="ssui-detail-head"><b class="ssui-detail-title"></b><button class="ssui-detail-close">[X]</button></div><div class="ssui-detail-meta"></div><pre class="ssui-detail-desc"></pre></div>
      <footer class="ssui-footer"><span>SOLO SYSTEM</span><span class="ssui-status">AWAITING DATA</span></footer>
    </div>`;
  document.body.appendChild(root);
  const win = root.querySelector('.ssui-window');
  root.querySelector('.ssui-launcher').addEventListener('click', () => { win.hidden = !win.hidden; if (!win.hidden) { const found=latestChatData(); if(found) setData(found); } });
  root.querySelector('.ssui-close').addEventListener('click', () => win.hidden = true);
  root.querySelector('.ssui-refresh').addEventListener('click', () => { const found=latestChatData(); if(found) { setData(found); root.querySelector('.ssui-status').textContent='DATA SYNCED'; } else root.querySelector('.ssui-status').textContent='NO SYSTEM JSON FOUND'; });
  root.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    root.querySelectorAll('.ssui-view').forEach(v=>v.hidden=v.dataset.view!==btn.dataset.tab);
  }));
  root.querySelector('.ssui-detail-close').addEventListener('click', () => root.querySelector('.ssui-detail').hidden = true);
  root.addEventListener('click', e => { const btn=e.target.closest('.ssui-item'); if(btn) openDetails(btn); });
  // Drag the floating window by its header; keep it within the viewport.
  const header=root.querySelector('.ssui-header'); let drag=null;
  header.addEventListener('pointerdown', e => { if(e.target.closest('button')) return; const r=win.getBoundingClientRect(); drag={x:e.clientX-r.left,y:e.clientY-r.top}; header.setPointerCapture(e.pointerId); });
  header.addEventListener('pointermove', e => { if(!drag) return; win.style.left=`${Math.max(0,Math.min(innerWidth-win.offsetWidth,e.clientX-drag.x))}px`; win.style.top=`${Math.max(0,Math.min(innerHeight-50,e.clientY-drag.y))}px`; win.style.right='auto'; });
  header.addEventListener('pointerup',()=>drag=null); header.addEventListener('pointercancel',()=>drag=null);
  render();
}
function syncFromChat() {
  const found=latestChatData();
  if(found) { setData(found); if(root) root.querySelector('.ssui-status').textContent='DATA SYNCED'; }
}
function init() {
  createUI();
  try {
    if (eventSource && event_types) {
      for (const name of ['MESSAGE_RECEIVED','MESSAGE_UPDATED','CHAT_CHANGED','MESSAGE_SWIPED']) {
        const event=event_types[name]; if(event) eventSource.on(event, syncFromChat);
      }
    }
  } catch(e) { console.debug(`[${EXT}] Event hooks unavailable`,e); }
  syncFromChat();
  console.log(`[${EXT}] Floating system UI loaded`);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
