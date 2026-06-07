const DB_KEY = "vocab_master_words_v3";
const SETTING_KEY = "vocab_master_settings_v3";
const AUTH_KEY = "vocab_master_auth_v3";
const SESSION_KEY = "vocab_master_session_v3";
const LOG_KEY = "vocab_master_logs_v3";
const SYNC_KEY = "vocab_master_sync_v6";

let words = [];
let filtered = [];
let idx = 0;
let quizWords = [];
let quizIdx = 0;
let quizScore = 0;
let autoNextTimer = null;
let autoReadBusy = false;
let cardSide = 'front';
let autoStudyOn = false;
let autoStudyTimer = null;

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function getAuth(){ try{return JSON.parse(localStorage.getItem(AUTH_KEY)||"{}")}catch(e){return{}} }
function setAuth(a){ localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function isSessionUnlocked(){ return sessionStorage.getItem(SESSION_KEY)==="1"; }
function showLock(){ document.getElementById("lockScreen").classList.remove("hidden"); document.getElementById("appShell").classList.add("hidden"); }
function showApp(){ document.getElementById("lockScreen").classList.add("hidden"); document.getElementById("appShell").classList.remove("hidden"); initApp(); }
function initAuth(){
  const auth=getAuth(), setupBox=document.getElementById("setupBox"), loginBox=document.getElementById("loginBox"), lockText=document.getElementById("lockText");
  if(!auth.passwordHash){ setupBox.classList.remove("hidden"); loginBox.classList.add("hidden"); lockText.textContent="Lần đầu sử dụng: hãy tạo mật khẩu riêng."; showLock(); return; }
  if(auth.lockEnabled === false || isSessionUnlocked()){ showApp(); return; }
  setupBox.classList.add("hidden"); loginBox.classList.remove("hidden"); lockText.textContent="Nhập mật khẩu để mở app."; showLock();
}
async function setupPassword(){
  const p1=document.getElementById("setupPass1").value, p2=document.getElementById("setupPass2").value;
  if(p1.length<4){ toast("Mật khẩu nên có ít nhất 4 ký tự"); return; }
  if(p1!==p2){ toast("Hai mật khẩu không giống nhau"); return; }
  const salt=crypto.getRandomValues(new Uint32Array(4)).join("-");
  const hash=await sha256(salt+"|"+p1);
  setAuth({salt,passwordHash:hash,lockEnabled:true,createdAt:new Date().toISOString()});
  sessionStorage.setItem(SESSION_KEY,"1"); toast("Đã tạo mật khẩu"); showApp();
}
async function unlockApp(){
  const pass=document.getElementById("loginPass").value, auth=getAuth();
  const hash=await sha256(auth.salt+"|"+pass);
  if(hash===auth.passwordHash){ sessionStorage.setItem(SESSION_KEY,"1"); document.getElementById("loginPass").value=""; showApp(); } else toast("Sai mật khẩu");
}
function lockApp(){ sessionStorage.removeItem(SESSION_KEY); initAuth(); }
async function changePassword(){
  const oldP=document.getElementById("oldPass").value, n1=document.getElementById("newPass1").value, n2=document.getElementById("newPass2").value, auth=getAuth();
  const oldHash=await sha256(auth.salt+"|"+oldP);
  if(oldHash!==auth.passwordHash){ toast("Mật khẩu hiện tại không đúng"); return; }
  if(n1.length<4){ toast("Mật khẩu mới nên có ít nhất 4 ký tự"); return; }
  if(n1!==n2){ toast("Hai mật khẩu mới không giống nhau"); return; }
  const salt=crypto.getRandomValues(new Uint32Array(4)).join("-"), hash=await sha256(salt+"|"+n1);
  setAuth({...auth,salt,passwordHash:hash,updatedAt:new Date().toISOString()});
  ["oldPass","newPass1","newPass2"].forEach(id=>document.getElementById(id).value="");
  toast("Đã đổi mật khẩu");
}
function toggleLockEnabled(){ const auth=getAuth(), enabled=document.getElementById("lockEnabled").checked; setAuth({...auth,lockEnabled:enabled}); toast(enabled?"Đã bật khóa app":"Đã tắt khóa app"); }

function loadWordsLocal(){
  try{ words = JSON.parse(localStorage.getItem(DB_KEY) || "[]"); }catch(e){ words=[]; }
  if(!words.length){
    try{
      const old = JSON.parse(localStorage.getItem("vocab_master_words_v2") || "[]");
      if(old.length){ words = old.map(normalizeWordObj); saveWords(); toast("Đã tự chuyển dữ liệu V2 sang V3"); }
    }catch(e){}
  }
}
function saveWords(){ localStorage.setItem(DB_KEY, JSON.stringify(words)); updateStats(); renderWordList(); refreshDecks(); renderStats(); }
function settings(){ try{return JSON.parse(localStorage.getItem(SETTING_KEY)||"{}")}catch(e){return{}} }
function saveSettings(s){ localStorage.setItem(SETTING_KEY, JSON.stringify(s)); }
function logs(){ try{return JSON.parse(localStorage.getItem(LOG_KEY)||"[]")}catch(e){return[]} }
function saveLogs(l){ localStorage.setItem(LOG_KEY, JSON.stringify(l.slice(-1000))); }
function addLog(type, wordId){ const l=logs(); l.push({type,wordId,date:new Date().toISOString()}); saveLogs(l); updateStats(); }

function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.style.display="block"; setTimeout(()=>t.style.display="none",2400); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function dueToday(w){ return !w.nextReview || w.nextReview.slice(0,10) <= todayStr(); }
function addDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString(); }

function displaySettings(){
  const s=settings();
  return {
    showHanzi: s.showHanzi !== false,
    showPinyin: s.showPinyin !== false,
    showVi: s.showVi !== false,
    showEn: s.showEn === true,
    autoRead: s.autoRead === true,
    autoShowAnswer: s.autoShowAnswer === true,
    readMode: s.readMode || "zh",
    readGap: Number(s.readGap || 900),
    autoNextDelay: Number(s.autoNextDelay || 0),
    studyReadMode: s.studyReadMode || "front_then_back"
  };
}
function applyDisplaySettings(){
  const s=displaySettings();
  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.checked=val; };
  set("showHanzi", s.showHanzi);
  set("showPinyin", s.showPinyin);
  set("showVi", s.showVi);
  set("showEn", s.showEn);
  set("autoRead", s.autoRead);
  set("autoShowAnswer", s.autoShowAnswer);
  const readMode=document.getElementById("readMode"); if(readMode) readMode.value=s.readMode;
  const readGap=document.getElementById("readGap"); if(readGap) readGap.value=s.readGap;
  const readGapValue=document.getElementById("readGapValue"); if(readGapValue) readGapValue.textContent=s.readGap+" ms";
  const autoNextDelay=document.getElementById("autoNextDelay"); if(autoNextDelay) autoNextDelay.value=String(s.autoNextDelay);
  const studyReadMode=document.getElementById("studyReadMode"); if(studyReadMode) studyReadMode.value=s.studyReadMode;
}
function saveDisplaySettings(){
  const s=settings();
  const get=(id)=>document.getElementById(id);
  if(get("showHanzi")) s.showHanzi=get("showHanzi").checked;
  if(get("showPinyin")) s.showPinyin=get("showPinyin").checked;
  if(get("showVi")) s.showVi=get("showVi").checked;
  if(get("showEn")) s.showEn=get("showEn").checked;
  if(get("autoRead")) s.autoRead=get("autoRead").checked;
  if(get("autoShowAnswer")) s.autoShowAnswer=get("autoShowAnswer").checked;
  if(get("readMode")) s.readMode=get("readMode").value;
  if(get("readGap")) s.readGap=Number(get("readGap").value);
  if(get("autoNextDelay")) s.autoNextDelay=Number(get("autoNextDelay").value);
  if(get("studyReadMode")) s.studyReadMode=get("studyReadMode").value;
  saveSettings(s);
}
function clearAutoNext(){
  if(autoNextTimer){ clearTimeout(autoNextTimer); autoNextTimer=null; }
}
function clearAutoStudyTimer(){
  if(autoStudyTimer){ clearTimeout(autoStudyTimer); autoStudyTimer=null; }
}
function scheduleAutoNext(){
  clearAutoNext();
  const s=displaySettings();
  if(s.autoNextDelay>0 && filtered.length){
    autoNextTimer=setTimeout(()=>nextCard(), s.autoNextDelay);
  }
}

function go(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  const tab=document.getElementById(`tab-${name}`); if(tab) tab.classList.add("active");
  if(name==="manage") renderWordList();
  if(name==="flash") { refreshDecks(); if(!filtered.length) loadFlash(); }
  if(name==="quiz") refreshDecks();
  if(name==="stats") renderStats();
  if(name==="settings") { const a=getAuth(); document.getElementById("lockEnabled").checked = a.lockEnabled !== false; }
  updateStats();
}
function quickDue(){ go("flash"); document.getElementById("statusFilter").value="due"; loadFlash(); }

function normalize(s){ return (s||"").toString().trim(); }
function normalizeWordObj(w){
  return {
    id: w.id || Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    hanzi: normalize(w.hanzi || w["Hán tự"] || w["Han tu"] || w["Chinese"] || w["中文"] || w["汉字"]),
    pinyin: normalize(w.pinyin || w["Pinyin"] || w["拼音"]),
    vi: normalize(w.vi || w.vietnamese || w["Tiếng Việt"] || w["Tieng Viet"] || w["Vietnamese"] || w["Viet"] || w["Nghĩa"]),
    en: normalize(w.en || w.english || w["English"] || w["EN"] || w["Tiếng Anh"]),
    deck: normalize(w.deck || w["Deck"] || w["Bộ"] || w["Bo"] || w["Bộ từ vựng"] || w["List"]) || "Default",
    status: w.status || "new",
    ease: Number(w.ease || 2.5),
    interval: Number(w.interval || 0),
    reviews: Number(w.reviews || 0),
    correct: Number(w.correct || 0),
    wrong: Number(w.wrong || 0),
    nextReview: w.nextReview || new Date().toISOString(),
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
function addWordObj(w){
  const item = normalizeWordObj(w);
  if(item.hanzi) words.push(item);
}
function addWord(){
  addWordObj({
    hanzi: document.getElementById("addHanzi").value,
    pinyin: document.getElementById("addPinyin").value,
    vi: document.getElementById("addVi").value,
    en: document.getElementById("addEn").value,
    deck: document.getElementById("addDeck").value
  });
  saveWords();
  ["addHanzi","addPinyin","addVi","addEn"].forEach(id=>document.getElementById(id).value="");
  toast("Đã thêm từ mới");
}

function updateStats(){
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.textContent=v;};
  set("statTotal", words.length);
  set("statDue", words.filter(dueToday).length);
  set("statKnown", words.filter(w=>w.status==="known").length);
  set("statUnknown", words.filter(w=>w.status==="unknown").length);
  const today=logs().filter(x=>x.date.slice(0,10)===todayStr()).length;
  const goal=50, pct=Math.min(100, Math.round(today/goal*100));
  const bar=document.getElementById("todayProgress"); if(bar) bar.style.width=pct+"%";
  const txt=document.getElementById("todayText"); if(txt) txt.textContent=`${today} lượt học hôm nay. Mục tiêu gợi ý: ${goal} lượt/ngày.`;
  renderDeckChips();
}
function renderDeckChips(){
  const box=document.getElementById("deckChips"); if(!box) return;
  const counts={}; words.forEach(w=>counts[w.deck]=(counts[w.deck]||0)+1);
  box.innerHTML=Object.entries(counts).sort().map(([d,c])=>`<span class="chip">${escapeHtml(d)} · ${c}</span>`).join("") || "<p>Chưa có bộ từ nào.</p>";
}
function refreshDecks(){
  const decks=[...new Set(words.map(w=>w.deck||"Default"))].sort();
  ["deckFilter","quizDeckFilter"].forEach(id=>{
    const sel=document.getElementById(id); if(!sel) return;
    const old=sel.value || "all";
    sel.innerHTML='<option value="all">Tất cả bộ từ</option>'+decks.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
    sel.value = decks.includes(old) ? old : "all";
  });
}

function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }
function loadFlash(){
  const deck=document.getElementById("deckFilter").value, status=document.getElementById("statusFilter").value;
  filtered=words.filter(w=>{
    const okDeck = deck==="all" || w.deck===deck;
    let okStatus = status==="all" || w.status===status;
    if(status==="due") okStatus = dueToday(w);
    return okDeck && okStatus;
  });
  filtered=shuffle(filtered); idx=0; renderCard(); toast(`Đã tải ${filtered.length} từ`);
}
function current(){ return filtered[idx]; }
function renderCard(){
  clearAutoNext();
  clearAutoStudyTimer();
  cardSide='front';
  const w=current();
  const s=displaySettings();
  document.getElementById("counter").textContent=filtered.length?`${idx+1}/${filtered.length}`:"0/0";
  document.getElementById("fcHanzi").textContent=w?w.hanzi:"Không có từ phù hợp";
  document.getElementById("fcPinyin").textContent=w?(w.pinyin||""):"";
  document.getElementById("fcVi").textContent=w?(w.vi||""):"";
  document.getElementById("fcEn").textContent=w?(w.en||""):"";
  document.getElementById("fcDeck").textContent=w?`Bộ: ${w.deck} | ${statusVi(w.status)} | Ôn: ${w.nextReview ? w.nextReview.slice(0,10) : "hôm nay"}`:"";

  document.getElementById("fcHanzi").classList.toggle("hidden", !s.showHanzi);
  document.getElementById("fcPinyin").classList.toggle("hidden", !s.showPinyin);
  document.getElementById("fcVi").classList.toggle("hidden", !s.showVi);
  document.getElementById("fcEn").classList.toggle("hidden", !s.showEn);

  if(!s.autoShowAnswer){
    document.getElementById("fcPinyin").classList.toggle("hidden", true);
    document.getElementById("fcVi").classList.toggle("hidden", true);
    document.getElementById("fcEn").classList.toggle("hidden", true);
  }else{
    cardSide='back';
  }

  if(w && s.autoRead && !autoStudyOn) autoReadCurrent();
  if(!autoStudyOn) scheduleAutoNext();
  if(autoStudyOn) scheduleAutoStudyStep();
}
function statusVi(s){ return s==="known"?"Đã thuộc":s==="unknown"?"Chưa thuộc":"Từ mới"; }
function showAnswer(){ 
  const s=displaySettings();
  if(s.showPinyin) document.getElementById("fcPinyin").classList.remove("hidden"); 
  if(s.showVi) document.getElementById("fcVi").classList.remove("hidden"); 
  if(s.showEn) document.getElementById("fcEn").classList.remove("hidden"); 
  cardSide='back';
}
function nextCard(){ if(!filtered.length)return; speechSynthesis.cancel(); autoReadBusy=false; clearAutoStudyTimer(); idx=(idx+1)%filtered.length; renderCard(); }
function prevCard(){ if(!filtered.length)return; speechSynthesis.cancel(); autoReadBusy=false; clearAutoStudyTimer(); idx=(idx-1+filtered.length)%filtered.length; renderCard(); }


function visibleTextsForRead(){
  const w=current(); if(!w) return [];
  const s=displaySettings();
  const seq=[];
  if(cardSide==="front"){
    if(s.showHanzi) seq.push([w.hanzi,"zh-CN"]);
  }else{
    if(s.showHanzi) seq.push([w.hanzi,"zh-CN"]);
    if(s.showVi) seq.push([w.vi,"vi-VN"]);
    if(s.showEn) seq.push([w.en,"en-US"]);
  }
  return seq.filter(x=>x[0]);
}
async function readVisible(){
  const s=displaySettings();
  speechSynthesis.cancel();
  for(const [text, lang] of visibleTextsForRead()){
    await speakText(text, lang, false);
    await sleep(s.readGap || 900);
  }
}
async function studyStep(){
  const w=current(); if(!w) return;
  clearAutoNext();
  clearAutoStudyTimer();
  const s=displaySettings();
  if(s.studyReadMode==="flip_only"){
    if(cardSide==="front") showAnswer();
    else nextCard();
    return;
  }
  if(s.studyReadMode==="read_visible"){
    await readVisible();
    return;
  }
  // front_then_back: first press reads front; second press flips to back and reads selected back languages; third press moves next.
  if(cardSide==="front"){
    await speakText(w.hanzi, "zh-CN", true);
    showAnswer();
    await sleep(s.readGap || 900);
    const seq=[];
    if(s.showVi) seq.push([w.vi,"vi-VN"]);
    if(s.showEn) seq.push([w.en,"en-US"]);
    if(!seq.length && s.showPinyin) seq.push([w.pinyin,"zh-CN"]);
    for(const [text, lang] of seq){
      await speakText(text, lang, false);
      await sleep(s.readGap || 900);
    }
  }else{
    nextCard();
  }
}
function updateAutoStudyButton(){
  const btn=document.getElementById("autoStudyBtn");
  if(!btn) return;
  btn.textContent = autoStudyOn ? "⏸ Tắt tự động" : "▶ Tự động";
  btn.classList.toggle("auto-on", autoStudyOn);
}
function toggleAutoStudy(){
  autoStudyOn = !autoStudyOn;
  updateAutoStudyButton();
  clearAutoNext();
  clearAutoStudyTimer();
  if(autoStudyOn){
    toast("Đã bật tự động học");
    scheduleAutoStudyStep(300);
  }else{
    toast("Đã tắt tự động học");
    speechSynthesis.cancel();
  }
}
function scheduleAutoStudyStep(ms){
  clearAutoStudyTimer();
  if(!autoStudyOn || !filtered.length) return;
  const s=displaySettings();
  const delay = ms || (cardSide==="front" ? 500 : (s.autoNextDelay || 4000));
  autoStudyTimer=setTimeout(async ()=>{
    await studyStep();
    if(autoStudyOn) scheduleAutoStudyStep(s.autoNextDelay || 4000);
  }, delay);
}

function gradeCurrent(grade){
  const w=current(); if(!w) return;
  const real=words.find(x=>x.id===w.id); if(!real) return;
  real.reviews=(real.reviews||0)+1;
  if(grade==="again"){
    real.status="unknown"; real.wrong=(real.wrong||0)+1; real.interval=0; real.ease=Math.max(1.3,(real.ease||2.5)-0.2); real.nextReview=addDays(0);
    addLog("again", real.id);
  }else if(grade==="hard"){
    real.status="unknown"; real.correct=(real.correct||0)+1; real.interval=Math.max(1, Math.round((real.interval||1)*1.2)); real.ease=Math.max(1.3,(real.ease||2.5)-0.05); real.nextReview=addDays(real.interval);
    addLog("hard", real.id);
  }else{
    real.status="known"; real.correct=(real.correct||0)+1;
    if(!real.interval) real.interval=1; else real.interval=Math.max(2, Math.round(real.interval*(real.ease||2.5)));
    real.ease=Math.min(3.2,(real.ease||2.5)+0.05); real.nextReview=addDays(real.interval);
    addLog("good", real.id);
  }
  real.updatedAt=new Date().toISOString();
  saveWords(); nextCard();
}

function speakText(text, lang, cancel=true){
  return new Promise(resolve=>{
    if(!text){ resolve(); return; }
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang || "zh-CN";
    const rate=parseFloat(document.getElementById("rateInput")?.value || settings().rate || "0.85");
    u.rate=rate;
    u.onend=()=>resolve();
    u.onerror=()=>resolve();
    if(cancel) speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function speakCurrent(lang){ 
  const w=current(); if(!w) return; 
  let text=w.hanzi;
  if(lang==="vi-VN") text=w.vi;
  if(lang==="en-US") text=w.en;
  speakText(text, lang, true); 
}
async function autoReadCurrent(){
  if(autoReadBusy) return;
  const w=current(); if(!w) return;
  autoReadBusy=true;
  const s=displaySettings();
  const gap=s.readGap || 900;
  speechSynthesis.cancel();
  const seq=[];
  if(s.readMode==="zh") seq.push([w.hanzi,"zh-CN"]);
  if(s.readMode==="vi") seq.push([w.vi,"vi-VN"]);
  if(s.readMode==="en") seq.push([w.en,"en-US"]);
  if(s.readMode==="zh_vi") seq.push([w.hanzi,"zh-CN"],[w.vi,"vi-VN"]);
  if(s.readMode==="zh_en") seq.push([w.hanzi,"zh-CN"],[w.en,"en-US"]);
  if(s.readMode==="all") seq.push([w.hanzi,"zh-CN"],[w.vi,"vi-VN"],[w.en,"en-US"]);
  for(const [text, lang] of seq){
    await speakText(text, lang, false);
    await sleep(gap);
  }
  autoReadBusy=false;
}
function testVoice(){ 
  const lang=document.getElementById("testVoiceLang")?.value || "zh-CN";
  const text = lang==="vi-VN" ? "Xin chào, đây là giọng tiếng Việt." : lang==="en-US" ? "Hello, this is the English voice." : "生产进度怎么样？";
  speakText(text, lang, true); 
}

function startQuiz(){
  const deck=document.getElementById("quizDeckFilter").value;
  quizWords=shuffle(words.filter(w=>deck==="all" || w.deck===deck));
  quizIdx=0; quizScore=0; renderQuiz();
}
function renderQuiz(){
  const w=quizWords[quizIdx];
  document.getElementById("quizCounter").textContent=quizWords.length?`${quizIdx+1}/${quizWords.length}`:"0/0";
  document.getElementById("quizQuestion").textContent=w?(w.vi||w.en||w.pinyin||w.hanzi):"Chưa có từ";
  document.getElementById("quizAnswer").value=""; document.getElementById("quizResult").textContent="";
}
function checkQuiz(){
  const w=quizWords[quizIdx]; if(!w) return;
  const ans=normalize(document.getElementById("quizAnswer").value).toLowerCase();
  const ok = ans && (ans===normalize(w.hanzi).toLowerCase() || ans===normalize(w.pinyin).toLowerCase());
  const real=words.find(x=>x.id===w.id);
  if(ok){ quizScore++; document.getElementById("quizResult").textContent=`Đúng ✅\n${w.hanzi} | ${w.pinyin}`; if(real) { filtered=[real]; idx=0; gradeCurrent("good"); } }
  else{ document.getElementById("quizResult").textContent=`Sai ❌\nĐáp án: ${w.hanzi} | ${w.pinyin}`; if(real) { filtered=[real]; idx=0; gradeCurrent("again"); } }
  setTimeout(()=>{ quizIdx++; if(quizIdx>=quizWords.length){ document.getElementById("quizQuestion").textContent=`Hoàn thành: ${quizScore}/${quizWords.length}`; document.getElementById("quizCounter").textContent="Xong"; document.getElementById("quizResult").textContent=""; } else renderQuiz(); }, 1200);
}

function pick(obj, names){ for(const n of names){ if(obj[n]!==undefined && obj[n]!==null) return obj[n]; } return ""; }
function rowsToWords(rows, defaultDeck){
  return rows.map(r => normalizeWordObj({
    hanzi: pick(r, ["Hán tự","Han tu","Hanzi","Chinese","中文","汉字","hanzi"]),
    pinyin: pick(r, ["Pinyin","拼音","pinyin"]),
    vi: pick(r, ["Tiếng Việt","Tieng Viet","Vietnamese","Viet","VI","Nghĩa","vi","vietnamese"]),
    en: pick(r, ["English","EN","Tiếng Anh","Tieng Anh","en","english"]),
    deck: pick(r, ["Deck","Bộ","Bo","Bộ từ vựng","Bo tu vung","List","deck"]) || defaultDeck
  })).filter(w=>w.hanzi);
}
async function importFile(){
  const file=document.getElementById("importFile").files[0];
  const defaultDeck=normalize(document.getElementById("importDefaultDeck").value)||"Imported";
  if(!file){ toast("Chưa chọn file"); return; }
  const name=file.name.toLowerCase();
  try{
    let imported=[];
    if(name.endsWith(".json")){
      const text=await file.text();
      const data=JSON.parse(text);
      if(!Array.isArray(data)) throw new Error("JSON phải là mảng");
      imported=data.map(normalizeWordObj).filter(w=>w.hanzi);
    }else if(name.endsWith(".csv")){
      const text=await file.text();
      const rows=parseCSV(text);
      imported=rowsToWords(rows, defaultDeck);
    }else if(name.endsWith(".xlsx") || name.endsWith(".xls")){
      if(window.__loadSheetJS) await window.__loadSheetJS();
      if(!window.XLSX || !window.XLSX.read || String(window.XLSX.read).includes("Thiếu thư viện")){
        throw new Error("Thiếu thư viện đọc Excel. Cách nhanh nhất: lưu Excel thành CSV rồi import, hoặc upload file xlsx.full.min.js chuẩn của SheetJS.");
      }
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf, {type:"array"});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sheet, {defval:""});
      imported=rowsToWords(rows, defaultDeck);
    }else{
      toast("Chỉ hỗ trợ .xlsx, .csv, .json"); return;
    }
    imported.forEach(w=>words.push(w));
    saveWords(); toast(`Đã import ${imported.length} từ`);
  }catch(e){ toast("Lỗi import: "+e.message); }
}
function parseCSV(text){
  const lines=text.replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if(!lines.length) return [];
  const parseLine=line=>{
    const out=[]; let cur="", q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i], n=line[i+1];
      if(c=='"' && q && n=='"'){ cur+='"'; i++; }
      else if(c=='"'){ q=!q; }
      else if(c=="," && !q){ out.push(cur); cur=""; }
      else cur+=c;
    }
    out.push(cur); return out.map(x=>x.trim());
  };
  const headers=parseLine(lines[0]);
  return lines.slice(1).map(l=>{ const vals=parseLine(l), obj={}; headers.forEach((h,i)=>obj[h]=vals[i]||""); return obj; });
}
function exportBackup(){
  const data=JSON.stringify({version:3, exportedAt:new Date().toISOString(), words},null,2);
  const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="vocab_master_v3_backup_"+new Date().toISOString().slice(0,10)+".json";
  a.click(); URL.revokeObjectURL(a.href);
}
function resetAllStatus(){
  if(!confirm("Reset toàn bộ trạng thái về Từ mới?")) return;
  words.forEach(w=>{w.status="new"; w.interval=0; w.reviews=0; w.correct=0; w.wrong=0; w.nextReview=new Date().toISOString(); w.updatedAt=new Date().toISOString();});
  saveWords(); toast("Đã reset trạng thái");
}
function deleteAllWords(){ if(!confirm("Xóa toàn bộ từ? Hãy export backup trước nếu cần.")) return; words=[]; saveWords(); loadFlash(); toast("Đã xóa toàn bộ từ"); }
function deleteWord(id){ if(!confirm("Xóa từ này?")) return; words=words.filter(w=>w.id!==id); saveWords(); }
function renderWordList(){
  const box=document.getElementById("wordList"); if(!box) return;
  const q=normalize(document.getElementById("searchBox")?.value).toLowerCase();
  const list=words.slice().reverse().filter(w=>!q || [w.hanzi,w.pinyin,w.vi,w.en,w.deck].join(" ").toLowerCase().includes(q)).slice(0,120);
  box.innerHTML=list.map(w=>`
    <div class="word-item">
      <div class="word-main">
        <b>${escapeHtml(w.hanzi)}</b>
        <div>${escapeHtml(w.pinyin||"")} | ${escapeHtml(w.vi||"")} | ${escapeHtml(w.deck||"Default")} | ${statusVi(w.status)} | ôn ${w.nextReview ? w.nextReview.slice(0,10) : "hôm nay"}</div>
      </div>
      <button class="danger" onclick="deleteWord('${w.id}')">Xóa</button>
    </div>
  `).join("") || "<p>Chưa có từ nào.</p>";
}
function renderStats(){
  const detail=document.getElementById("statsDetail"); if(!detail) return;
  const total=words.length, due=words.filter(dueToday).length, newc=words.filter(w=>w.status==="new").length, known=words.filter(w=>w.status==="known").length, unknown=words.filter(w=>w.status==="unknown").length;
  const today=logs().filter(x=>x.date.slice(0,10)===todayStr()).length;
  detail.innerHTML = [
    ["Tổng từ", total],["Cần ôn hôm nay", due],["Từ mới", newc],["Đã thuộc", known],["Chưa thuộc", unknown],["Lượt học hôm nay", today]
  ].map(([k,v])=>`<div class="detail-row"><span>${k}</span><b>${v}</b></div>`).join("");
  const decks={}; words.forEach(w=>{ if(!decks[w.deck]) decks[w.deck]={total:0,known:0,unknown:0,due:0}; decks[w.deck].total++; if(w.status==="known") decks[w.deck].known++; if(w.status==="unknown") decks[w.deck].unknown++; if(dueToday(w)) decks[w.deck].due++; });
  const ds=document.getElementById("deckStats");
  ds.innerHTML=Object.entries(decks).sort().map(([d,s])=>`<div class="detail-row"><span>${escapeHtml(d)}<br><small>${s.known} đã thuộc · ${s.unknown} chưa thuộc · ${s.due} cần ôn</small></span><b>${s.total}</b></div>`).join("") || "<p>Chưa có dữ liệu.</p>";
}
function escapeHtml(s){ return (s||"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }


function syncSettings(){
  try{return JSON.parse(localStorage.getItem(SYNC_KEY)||"{}")}catch(e){return{}}
}
function saveSyncSettings(){
  const s={
    owner: normalize(document.getElementById("syncOwner").value),
    repo: normalize(document.getElementById("syncRepo").value),
    branch: normalize(document.getElementById("syncBranch").value) || "main",
    path: normalize(document.getElementById("syncPath").value) || "data/vocab_sync.json",
    token: document.getElementById("syncToken").value || syncSettings().token || ""
  };
  if(!s.owner || !s.repo || !s.token){ toast("Cần nhập username, repo và token"); return; }
  localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  setSyncStatus("Đã lưu cấu hình đồng bộ trên thiết bị này.");
}
function loadSyncSettingsToForm(){
  const s=syncSettings();
  const set=(id,v)=>{const el=document.getElementById(id); if(el) el.value=v||"";};
  set("syncOwner",s.owner);
  set("syncRepo",s.repo);
  set("syncBranch",s.branch||"main");
  set("syncPath",s.path||"data/vocab_sync.json");
  set("syncToken",s.token);
}
function clearSyncToken(){
  const s=syncSettings();
  delete s.token;
  localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  const el=document.getElementById("syncToken"); if(el) el.value="";
  setSyncStatus("Đã xóa token trên thiết bị này.");
}
function setSyncStatus(msg){
  const el=document.getElementById("syncStatus");
  if(el) el.textContent=msg;
  toast(msg);
}
function requireSyncSettings(){
  let s=syncSettings();
  const owner=document.getElementById("syncOwner")?.value;
  if(owner){
    s={
      owner: normalize(document.getElementById("syncOwner").value),
      repo: normalize(document.getElementById("syncRepo").value),
      branch: normalize(document.getElementById("syncBranch").value) || "main",
      path: normalize(document.getElementById("syncPath").value) || "data/vocab_sync.json",
      token: document.getElementById("syncToken").value || s.token || ""
    };
  }
  if(!s.owner || !s.repo || !s.token) throw new Error("Thiếu cấu hình GitHub. Hãy nhập username, repo và token.");
  if(!s.branch) s.branch="main";
  if(!s.path) s.path="data/vocab_sync.json";
  localStorage.setItem(SYNC_KEY, JSON.stringify(s));
  return s;
}
function b64EncodeUnicode(str){
  return btoa(unescape(encodeURIComponent(str)));
}
function b64DecodeUnicode(str){
  return decodeURIComponent(escape(atob(str.replace(/\n/g,""))));
}
async function githubGetFile(s){
  const url=`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${s.path}?ref=${encodeURIComponent(s.branch)}`;
  const res=await fetch(url,{headers:{
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+s.token,
    "X-GitHub-Api-Version":"2022-11-28"
  }});
  if(res.status===404) return null;
  if(!res.ok) throw new Error("GitHub GET lỗi: "+res.status+" "+await res.text());
  return await res.json();
}
async function githubPutFile(s, contentText, sha){
  const url=`https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${s.path}`;
  const body={
    message:"Update vocab sync "+new Date().toISOString(),
    content:b64EncodeUnicode(contentText),
    branch:s.branch
  };
  if(sha) body.sha=sha;
  const res=await fetch(url,{method:"PUT",headers:{
    "Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+s.token,
    "X-GitHub-Api-Version":"2022-11-28",
    "Content-Type":"application/json"
  },body:JSON.stringify(body)});
  if(!res.ok) throw new Error("GitHub PUT lỗi: "+res.status+" "+await res.text());
  return await res.json();
}
function syncPayload(){
  return {
    app:"Vocab Master",
    version:6,
    exportedAt:new Date().toISOString(),
    words,
    logs:logs()
  };
}
async function pushToGitHub(){
  try{
    const s=requireSyncSettings();
    setSyncStatus("Đang đẩy dữ liệu lên GitHub...");
    const old=await githubGetFile(s);
    const payload=JSON.stringify(syncPayload(),null,2);
    await githubPutFile(s,payload,old?.sha);
    setSyncStatus("Đã đẩy dữ liệu lên GitHub thành công.");
  }catch(e){ setSyncStatus("Lỗi đẩy GitHub: "+e.message); }
}
async function pullFromGitHub(){
  try{
    const s=requireSyncSettings();
    if(!confirm("Tải dữ liệu từ GitHub sẽ thay thế dữ liệu hiện tại trên thiết bị này. Bạn nên Export Backup trước. Tiếp tục?")) return;
    setSyncStatus("Đang tải dữ liệu từ GitHub...");
    const file=await githubGetFile(s);
    if(!file) throw new Error("Chưa có file đồng bộ trên GitHub. Hãy Đẩy lên GitHub từ thiết bị có dữ liệu trước.");
    const data=JSON.parse(b64DecodeUnicode(file.content));
    const newWords=Array.isArray(data) ? data : (data.words||[]);
    words=newWords.map(normalizeWordObj).filter(w=>w.hanzi);
    saveWords();
    if(data.logs) saveLogs(data.logs);
    setSyncStatus(`Đã tải ${words.length} từ từ GitHub.`);
  }catch(e){ setSyncStatus("Lỗi tải GitHub: "+e.message); }
}
async function mergeFromGitHub(){
  try{
    const s=requireSyncSettings();
    setSyncStatus("Đang gộp dữ liệu từ GitHub...");
    const file=await githubGetFile(s);
    if(!file) throw new Error("Chưa có file đồng bộ trên GitHub.");
    const data=JSON.parse(b64DecodeUnicode(file.content));
    const remote=(Array.isArray(data) ? data : (data.words||[])).map(normalizeWordObj).filter(w=>w.hanzi);
    const map=new Map();
    words.forEach(w=>map.set((w.hanzi+"|"+w.pinyin+"|"+w.deck).toLowerCase(), w));
    let added=0, updated=0;
    remote.forEach(r=>{
      const key=(r.hanzi+"|"+r.pinyin+"|"+r.deck).toLowerCase();
      if(!map.has(key)){ words.push(r); added++; }
      else{
        const local=map.get(key);
        if((r.updatedAt||"") > (local.updatedAt||"")){
          Object.assign(local,r); updated++;
        }
      }
    });
    saveWords();
    setSyncStatus(`Đã gộp dữ liệu: thêm ${added}, cập nhật ${updated}.`);
  }catch(e){ setSyncStatus("Lỗi gộp GitHub: "+e.message); }
}

function initApp(){
  loadWordsLocal();
  const s=settings(); if(s.rate){ document.getElementById("rateInput").value=s.rate; document.getElementById("rateValue").textContent=s.rate; }
  applyDisplaySettings();
  const a=getAuth(); if(document.getElementById("lockEnabled")) document.getElementById("lockEnabled").checked = a.lockEnabled !== false;
  updateStats(); refreshDecks(); renderWordList(); renderStats(); loadSyncSettingsToForm();
}

document.getElementById("rateInput")?.addEventListener("input", e=>{ document.getElementById("rateValue").textContent=e.target.value; const s=settings(); s.rate=e.target.value; saveSettings(s); });
window.addEventListener("online",()=>document.getElementById("offlineStatus").textContent="Đang online. App vẫn có thể dùng offline sau khi cài.");
window.addEventListener("offline",()=>document.getElementById("offlineStatus").textContent="Đang offline. Bạn vẫn có thể học nếu app đã được lưu cache.");
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").then(()=>console.log("SW registered")).catch(console.error); }
document.addEventListener("keydown",(e)=>{
  if(document.getElementById("appShell").classList.contains("hidden")) { if(e.key==="Enter" && !document.getElementById("loginBox").classList.contains("hidden")) unlockApp(); return; }
  if(e.key===" "){ e.preventDefault(); showAnswer(); }
  if(e.key==="ArrowRight") nextCard();
  if(e.key==="ArrowLeft") prevCard();
  if(e.key==="1") gradeCurrent("again");
  if(e.key==="2") gradeCurrent("hard");
  if(e.key==="3") gradeCurrent("good");
  if(e.key==="Enter" && document.activeElement.id==="quizAnswer") checkQuiz();
  if(e.key.toLowerCase()==="h") studyStep();
  if(e.key.toLowerCase()==="a") toggleAutoStudy();
});
document.getElementById("offlineStatus") && (document.getElementById("offlineStatus").textContent = navigator.onLine ? "Đang online. App sẽ tự lưu để dùng offline." : "Đang offline.");
initAuth();


/* ===== V7 STUDY FLOW OVERRIDES ===== */
let v7StudyStepState = 0; // 0 front, 1 back, 2 next
let v7AutoRunning = false;
let v7AutoTimer = null;

function v7Settings(){
  const s=settings();
  return {
    frontShowHanzi: s.frontShowHanzi !== false,
    frontShowPinyin: s.frontShowPinyin === true,
    frontShowVi: s.frontShowVi === true,
    frontShowEn: s.frontShowEn === true,
    backShowHanzi: s.backShowHanzi !== false,
    backShowPinyin: s.backShowPinyin !== false,
    backShowVi: s.backShowVi !== false,
    backShowEn: s.backShowEn === true,
    frontReadMode: s.frontReadMode || "zh",
    backReadMode: s.backReadMode || "vi",
    autoRead: s.autoRead === true,
    autoShowBack: s.autoShowBack === true,
    readGap: Number(s.readGap || 900),
    autoNextDelay: Number(s.autoNextDelay || 3000)
  };
}

function applyDisplaySettings(){
  const s=v7Settings();
  const setCheck=(id,val)=>{ const el=document.getElementById(id); if(el) el.checked=val; };
  const setVal=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=String(val); };

  setCheck("frontShowHanzi",s.frontShowHanzi);
  setCheck("frontShowPinyin",s.frontShowPinyin);
  setCheck("frontShowVi",s.frontShowVi);
  setCheck("frontShowEn",s.frontShowEn);
  setCheck("backShowHanzi",s.backShowHanzi);
  setCheck("backShowPinyin",s.backShowPinyin);
  setCheck("backShowVi",s.backShowVi);
  setCheck("backShowEn",s.backShowEn);
  setCheck("autoRead",s.autoRead);
  setCheck("autoShowBack",s.autoShowBack);
  setVal("frontReadMode",s.frontReadMode);
  setVal("backReadMode",s.backReadMode);
  setVal("readGap",s.readGap);
  setVal("autoNextDelay",s.autoNextDelay);
  const rg=document.getElementById("readGapValue"); if(rg) rg.textContent=s.readGap+" ms";
}

function saveDisplaySettings(){
  const old=settings();
  const get=(id)=>document.getElementById(id);
  const readCheck=(id, fallback)=>get(id)?get(id).checked:fallback;
  const readVal=(id, fallback)=>get(id)?get(id).value:fallback;

  old.frontShowHanzi=readCheck("frontShowHanzi",true);
  old.frontShowPinyin=readCheck("frontShowPinyin",false);
  old.frontShowVi=readCheck("frontShowVi",false);
  old.frontShowEn=readCheck("frontShowEn",false);
  old.backShowHanzi=readCheck("backShowHanzi",true);
  old.backShowPinyin=readCheck("backShowPinyin",true);
  old.backShowVi=readCheck("backShowVi",true);
  old.backShowEn=readCheck("backShowEn",false);
  old.frontReadMode=readVal("frontReadMode","zh");
  old.backReadMode=readVal("backReadMode","vi");
  old.autoRead=readCheck("autoRead",false);
  old.autoShowBack=readCheck("autoShowBack",false);
  old.readGap=Number(readVal("readGap",900));
  old.autoNextDelay=Number(readVal("autoNextDelay",3000));
  saveSettings(old);
}

function modeToSeq(mode, w){
  if(!w || mode==="none") return [];
  const pinyinText = w.pinyin ? w.pinyin : w.hanzi;
  const map = {
    zh: [[w.hanzi,"zh-CN"]],
    pinyin: [[pinyinText,"zh-CN"]],
    vi: [[w.vi,"vi-VN"]],
    en: [[w.en,"en-US"]],
    zh_vi: [[w.hanzi,"zh-CN"],[w.vi,"vi-VN"]],
    zh_en: [[w.hanzi,"zh-CN"],[w.en,"en-US"]],
    all: [[w.hanzi,"zh-CN"],[w.vi,"vi-VN"],[w.en,"en-US"]]
  };
  return (map[mode] || []).filter(x=>x[0]);
}

async function readSeq(seq){
  const s=v7Settings();
  speechSynthesis.cancel();
  for(const [text, lang] of seq){
    await speakText(text, lang, false);
    await sleep(s.readGap || 900);
  }
}

function setCardVisibility(side){
  const s=v7Settings();
  const front = side === "front";
  const vh = front ? s.frontShowHanzi : s.backShowHanzi;
  const vp = front ? s.frontShowPinyin : s.backShowPinyin;
  const vv = front ? s.frontShowVi : s.backShowVi;
  const ve = front ? s.frontShowEn : s.backShowEn;

  const h=document.getElementById("fcHanzi");
  const p=document.getElementById("fcPinyin");
  const vi=document.getElementById("fcVi");
  const en=document.getElementById("fcEn");
  if(h) h.classList.toggle("hidden", !vh);
  if(p) p.classList.toggle("hidden", !vp);
  if(vi) vi.classList.toggle("hidden", !vv);
  if(en) en.classList.toggle("hidden", !ve);
  cardSide=side;
}

function renderCard(){
  clearAutoNext();
  clearAutoStudyTimer();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  const w=current();
  const s=v7Settings();
  v7StudyStepState = s.autoShowBack ? 1 : 0;
  cardSide = s.autoShowBack ? "back" : "front";

  document.getElementById("counter").textContent=filtered.length?`${idx+1}/${filtered.length}`:"0/0";
  document.getElementById("fcHanzi").textContent=w?w.hanzi:"Không có từ phù hợp";
  document.getElementById("fcPinyin").textContent=w?(w.pinyin||""):"";
  document.getElementById("fcVi").textContent=w?(w.vi||""):"";
  document.getElementById("fcEn").textContent=w?(w.en||""):"";
  document.getElementById("fcDeck").textContent=w?`Bộ: ${w.deck} | ${statusVi(w.status)} | Ôn: ${w.nextReview ? w.nextReview.slice(0,10) : "hôm nay"}`:"";
  setCardVisibility(cardSide);

  if(w && s.autoRead && !v7AutoRunning){
    const mode = cardSide === "front" ? s.frontReadMode : s.backReadMode;
    readSeq(modeToSeq(mode,w));
  }
  updateAutoStudyButton();
}

function showAnswer(){
  setCardVisibility("back");
  v7StudyStepState = 2;
}

async function studyStep(){
  const w=current(); 
  if(!w) return;
  const s=v7Settings();

  if(v7StudyStepState === 0){
    setCardVisibility("front");
    await readSeq(modeToSeq(s.frontReadMode,w));
    v7StudyStepState = 1;
    return;
  }

  if(v7StudyStepState === 1){
    setCardVisibility("back");
    await readSeq(modeToSeq(s.backReadMode,w));
    v7StudyStepState = 2;
    return;
  }

  nextCard();
  v7StudyStepState = 0;
}

function nextCard(){
  if(!filtered.length)return;
  speechSynthesis.cancel(); autoReadBusy=false; clearAutoStudyTimer();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  idx=(idx+1)%filtered.length;
  renderCard();
}

function prevCard(){
  if(!filtered.length)return;
  speechSynthesis.cancel(); autoReadBusy=false; clearAutoStudyTimer();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  idx=(idx-1+filtered.length)%filtered.length;
  renderCard();
}

function updateAutoStudyButton(){
  const btn=document.getElementById("autoStudyBtn");
  if(!btn) return;
  btn.textContent = v7AutoRunning ? "⏸ Tắt tự động" : "▶ Tự động";
  btn.classList.toggle("auto-on", v7AutoRunning);
}

function toggleAutoStudy(){
  v7AutoRunning = !v7AutoRunning;
  updateAutoStudyButton();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  speechSynthesis.cancel();

  if(v7AutoRunning){
    toast("Đã bật tự động học");
    runAutoStudyLoop();
  }else{
    toast("Đã tắt tự động học");
  }
}

async function runAutoStudyLoop(){
  if(!v7AutoRunning || !filtered.length) return;
  const s=v7Settings();
  await studyStep();
  if(!v7AutoRunning) return;
  v7AutoTimer=setTimeout(runAutoStudyLoop, s.autoNextDelay || 3000);
}

function speakCurrent(lang){ 
  const w=current(); if(!w) return; 
  let text=w.hanzi;
  if(lang==="vi-VN") text=w.vi;
  if(lang==="en-US") text=w.en;
  speakText(text, lang, true); 
}

/* ===== V8 VOICE & CONTROL FIX OVERRIDES ===== */
let v8SpeechToken = 0;
let v8Audio = null;

function markSettingsDirty(){
  ["frontReadMode","backReadMode","readGap","autoNextDelay","voiceEngine","aiTtsUrl"].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el.dataset.v8Bound){
      el.dataset.v8Bound="1";
      el.addEventListener("change",()=>el.classList.add("changed"));
      el.addEventListener("input",()=>el.classList.add("changed"));
    }
  });
}
function confirmDisplaySettings(part){
  saveDisplaySettings();
  applyDisplaySettings();
  renderCard();
  document.querySelectorAll(".changed").forEach(x=>x.classList.remove("changed"));
  toast(part==="front" ? "Đã cập nhật mặt trước" : part==="back" ? "Đã cập nhật mặt sau" : "Đã cập nhật cài đặt học");
}

function v7Settings(){
  const s=settings();
  return {
    frontShowHanzi: s.frontShowHanzi !== false,
    frontShowPinyin: s.frontShowPinyin === true,
    frontShowVi: s.frontShowVi === true,
    frontShowEn: s.frontShowEn === true,
    backShowHanzi: s.backShowHanzi !== false,
    backShowPinyin: s.backShowPinyin !== false,
    backShowVi: s.backShowVi !== false,
    backShowEn: s.backShowEn === true,
    frontReadMode: s.frontReadMode || "zh",
    backReadMode: s.backReadMode || "vi",
    autoRead: s.autoRead === true,
    autoShowBack: s.autoShowBack === true,
    readGap: Number(s.readGap ?? 0),
    autoNextDelay: Number(s.autoNextDelay || 3000),
    voiceEngine: s.voiceEngine || "browser",
    aiTtsUrl: s.aiTtsUrl || ""
  };
}

function applyDisplaySettings(){
  const s=v7Settings();
  const setCheck=(id,val)=>{ const el=document.getElementById(id); if(el) el.checked=val; };
  const setVal=(id,val)=>{ const el=document.getElementById(id); if(el) el.value=String(val); };

  setCheck("frontShowHanzi",s.frontShowHanzi);
  setCheck("frontShowPinyin",s.frontShowPinyin);
  setCheck("frontShowVi",s.frontShowVi);
  setCheck("frontShowEn",s.frontShowEn);
  setCheck("backShowHanzi",s.backShowHanzi);
  setCheck("backShowPinyin",s.backShowPinyin);
  setCheck("backShowVi",s.backShowVi);
  setCheck("backShowEn",s.backShowEn);
  setCheck("autoRead",s.autoRead);
  setCheck("autoShowBack",s.autoShowBack);
  setVal("frontReadMode",s.frontReadMode);
  setVal("backReadMode",s.backReadMode);
  setVal("readGap",s.readGap);
  setVal("autoNextDelay",s.autoNextDelay);
  setVal("voiceEngine",s.voiceEngine);
  setVal("aiTtsUrl",s.aiTtsUrl);
  const rg=document.getElementById("readGapValue"); if(rg) rg.textContent=s.readGap+" ms";
  markSettingsDirty();
}

function saveDisplaySettings(){
  const old=settings();
  const get=(id)=>document.getElementById(id);
  const readCheck=(id, fallback)=>get(id)?get(id).checked:fallback;
  const readVal=(id, fallback)=>get(id)?get(id).value:fallback;

  old.frontShowHanzi=readCheck("frontShowHanzi",true);
  old.frontShowPinyin=readCheck("frontShowPinyin",false);
  old.frontShowVi=readCheck("frontShowVi",false);
  old.frontShowEn=readCheck("frontShowEn",false);
  old.backShowHanzi=readCheck("backShowHanzi",true);
  old.backShowPinyin=readCheck("backShowPinyin",true);
  old.backShowVi=readCheck("backShowVi",true);
  old.backShowEn=readCheck("backShowEn",false);
  old.frontReadMode=readVal("frontReadMode","zh");
  old.backReadMode=readVal("backReadMode","vi");
  old.autoRead=readCheck("autoRead",false);
  old.autoShowBack=readCheck("autoShowBack",false);
  old.readGap=Number(readVal("readGap",0));
  old.autoNextDelay=Number(readVal("autoNextDelay",3000));
  old.voiceEngine=readVal("voiceEngine","browser");
  old.aiTtsUrl=readVal("aiTtsUrl","");
  saveSettings(old);
}

function stopAllSpeech(){
  v8SpeechToken++;
  try{ speechSynthesis.cancel(); }catch(e){}
  if(v8Audio){
    try{ v8Audio.pause(); v8Audio.src=""; }catch(e){}
    v8Audio=null;
  }
}

async function speakText(text, lang, cancel=true){
  const token = cancel ? (++v8SpeechToken) : v8SpeechToken;
  if(cancel) stopAllSpeech();
  if(!text) return;

  const s=v7Settings();

  // AI Voice Server mode: server should return audio/mpeg or audio/wav.
  if(s.voiceEngine==="ai_server" && s.aiTtsUrl){
    try{
      const url=s.aiTtsUrl;
      const res=await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text, lang})
      });
      if(!res.ok) throw new Error("AI TTS server lỗi "+res.status);
      const blob=await res.blob();
      if(token !== v8SpeechToken) return;
      const audioUrl=URL.createObjectURL(blob);
      v8Audio=new Audio(audioUrl);
      await new Promise(resolve=>{
        v8Audio.onended=()=>{URL.revokeObjectURL(audioUrl); resolve();};
        v8Audio.onerror=()=>{URL.revokeObjectURL(audioUrl); resolve();};
        v8Audio.play().catch(()=>resolve());
      });
      return;
    }catch(e){
      console.warn(e);
      // fallback to browser voice
    }
  }

  return new Promise(resolve=>{
    if(token !== v8SpeechToken){ resolve(); return; }
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang || "zh-CN";
    const rate=parseFloat(document.getElementById("rateInput")?.value || settings().rate || "0.85");
    u.rate=rate;
    u.onend=()=>resolve();
    u.onerror=()=>resolve();
    speechSynthesis.speak(u);
  });
}

async function readSeq(seq){
  stopAllSpeech();
  const localToken=v8SpeechToken;
  const s=v7Settings();
  for(const [text, lang] of seq){
    if(localToken !== v8SpeechToken) return;
    await speakText(text, lang, false);
    if((s.readGap || 0)>0) await sleep(s.readGap);
  }
}

function nextCard(){
  if(!filtered.length)return;
  stopAllSpeech(); autoReadBusy=false; clearAutoStudyTimer();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  idx=(idx+1)%filtered.length;
  renderCard();
}

function prevCard(){
  if(!filtered.length)return;
  stopAllSpeech(); autoReadBusy=false; clearAutoStudyTimer();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  idx=(idx-1+filtered.length)%filtered.length;
  renderCard();
}

function speakCurrent(lang){ 
  const w=current(); if(!w) return; 
  let text=w.hanzi;
  if(lang==="vi-VN") text=w.vi;
  if(lang==="en-US") text=w.en;
  speakText(text, lang, true); 
}

async function studyStep(){
  const w=current(); 
  if(!w) return;
  const s=v7Settings();

  if(v7StudyStepState === 0){
    setCardVisibility("front");
    await readSeq(modeToSeq(s.frontReadMode,w));
    v7StudyStepState = 1;
    return;
  }

  if(v7StudyStepState === 1){
    setCardVisibility("back");
    await readSeq(modeToSeq(s.backReadMode,w));
    v7StudyStepState = 2;
    return;
  }

  nextCard();
  v7StudyStepState = 0;
}

function toggleAutoStudy(){
  v7AutoRunning = !v7AutoRunning;
  updateAutoStudyButton();
  if(v7AutoTimer){ clearTimeout(v7AutoTimer); v7AutoTimer=null; }
  stopAllSpeech();

  if(v7AutoRunning){
    toast("Đã bật tự động học");
    runAutoStudyLoop();
  }else{
    toast("Đã tắt tự động học");
  }
}

async function runAutoStudyLoop(){
  if(!v7AutoRunning || !filtered.length) return;
  const s=v7Settings();
  await studyStep();
  if(!v7AutoRunning) return;
  v7AutoTimer=setTimeout(runAutoStudyLoop, s.autoNextDelay || 3000);
}

function testVoice(){ 
  const lang=document.getElementById("testVoiceLang")?.value || "zh-CN";
  const text = lang==="vi-VN" ? "Xin chào, đây là giọng tiếng Việt." : lang==="en-US" ? "Hello, this is the English voice." : "生产进度怎么样？";
  speakText(text, lang, true); 
}


initAuth();
