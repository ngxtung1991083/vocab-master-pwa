const DB_KEY = "vocab_master_words_v2";
const SETTING_KEY = "vocab_master_settings_v2";
const AUTH_KEY = "vocab_master_auth_v2";
const SESSION_KEY = "vocab_master_session_v2";

let words = [];
let filtered = [];
let idx = 0;
let quizWords = [];
let quizIdx = 0;
let quizScore = 0;

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function getAuth(){ try{return JSON.parse(localStorage.getItem(AUTH_KEY)||"{}")}catch(e){return{}} }
function setAuth(a){ localStorage.setItem(AUTH_KEY, JSON.stringify(a)); }
function isSessionUnlocked(){ return sessionStorage.getItem(SESSION_KEY)==="1"; }

function showLock(){
  document.getElementById("lockScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
}
function showApp(){
  document.getElementById("lockScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  initApp();
}
function initAuth(){
  const auth=getAuth();
  const setupBox=document.getElementById("setupBox");
  const loginBox=document.getElementById("loginBox");
  const lockText=document.getElementById("lockText");

  if(!auth.passwordHash){
    setupBox.classList.remove("hidden");
    loginBox.classList.add("hidden");
    lockText.textContent="Lần đầu sử dụng: hãy tạo mật khẩu riêng.";
    showLock();
    return;
  }

  if(auth.lockEnabled === false || isSessionUnlocked()){
    showApp();
    return;
  }

  setupBox.classList.add("hidden");
  loginBox.classList.remove("hidden");
  lockText.textContent="Nhập mật khẩu để mở app.";
  showLock();
}
async function setupPassword(){
  const p1=document.getElementById("setupPass1").value;
  const p2=document.getElementById("setupPass2").value;
  if(p1.length<4){ toast("Mật khẩu nên có ít nhất 4 ký tự"); return; }
  if(p1!==p2){ toast("Hai mật khẩu không giống nhau"); return; }
  const salt=crypto.getRandomValues(new Uint32Array(4)).join("-");
  const hash=await sha256(salt+"|"+p1);
  setAuth({salt, passwordHash:hash, lockEnabled:true, createdAt:new Date().toISOString()});
  sessionStorage.setItem(SESSION_KEY,"1");
  toast("Đã tạo mật khẩu");
  showApp();
}
async function unlockApp(){
  const pass=document.getElementById("loginPass").value;
  const auth=getAuth();
  const hash=await sha256(auth.salt+"|"+pass);
  if(hash===auth.passwordHash){
    sessionStorage.setItem(SESSION_KEY,"1");
    document.getElementById("loginPass").value="";
    showApp();
  }else{
    toast("Sai mật khẩu");
  }
}
function lockApp(){
  sessionStorage.removeItem(SESSION_KEY);
  initAuth();
}
async function changePassword(){
  const oldP=document.getElementById("oldPass").value;
  const n1=document.getElementById("newPass1").value;
  const n2=document.getElementById("newPass2").value;
  const auth=getAuth();
  const oldHash=await sha256(auth.salt+"|"+oldP);
  if(oldHash!==auth.passwordHash){ toast("Mật khẩu hiện tại không đúng"); return; }
  if(n1.length<4){ toast("Mật khẩu mới nên có ít nhất 4 ký tự"); return; }
  if(n1!==n2){ toast("Hai mật khẩu mới không giống nhau"); return; }
  const salt=crypto.getRandomValues(new Uint32Array(4)).join("-");
  const hash=await sha256(salt+"|"+n1);
  setAuth({...auth, salt, passwordHash:hash, updatedAt:new Date().toISOString()});
  document.getElementById("oldPass").value="";
  document.getElementById("newPass1").value="";
  document.getElementById("newPass2").value="";
  toast("Đã đổi mật khẩu");
}
function toggleLockEnabled(){
  const auth=getAuth();
  const enabled=document.getElementById("lockEnabled").checked;
  setAuth({...auth, lockEnabled:enabled});
  toast(enabled ? "Đã bật khóa app" : "Đã tắt khóa app");
}

function saveWords(){ localStorage.setItem(DB_KEY, JSON.stringify(words)); updateStats(); renderWordList(); refreshDecks(); }
function loadWordsLocal(){ try{ words = JSON.parse(localStorage.getItem(DB_KEY) || "[]"); }catch(e){ words=[]; } }
function settings(){ try{return JSON.parse(localStorage.getItem(SETTING_KEY)||"{}")}catch(e){return{}} }
function saveSettings(s){ localStorage.setItem(SETTING_KEY, JSON.stringify(s)); }

function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.style.display="block"; setTimeout(()=>t.style.display="none",2200); }

function go(name){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById(`screen-${name}`).classList.add("active");
  const tab=document.getElementById(`tab-${name}`); if(tab) tab.classList.add("active");
  if(name==="manage") renderWordList();
  if(name==="flash") { refreshDecks(); if(!filtered.length) loadFlash(); }
  if(name==="settings") {
    const a=getAuth();
    document.getElementById("lockEnabled").checked = a.lockEnabled !== false;
  }
  updateStats();
}

function normalize(s){ return (s||"").toString().trim(); }
function addWordObj(w){
  const item = {
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    hanzi: normalize(w.hanzi),
    pinyin: normalize(w.pinyin),
    vi: normalize(w.vi || w.vietnamese),
    en: normalize(w.en || w.english),
    deck: normalize(w.deck) || "Default",
    status: w.status || "new",
    createdAt: w.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
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
  const a=id=>document.getElementById(id);
  if(!a("statTotal")) return;
  a("statTotal").textContent=words.length;
  a("statKnown").textContent=words.filter(w=>w.status==="known").length;
  a("statUnknown").textContent=words.filter(w=>w.status==="unknown").length;
}

function refreshDecks(){
  const sel=document.getElementById("deckFilter");
  if(!sel) return;
  const old=sel.value || "all";
  const decks=[...new Set(words.map(w=>w.deck||"Default"))].sort();
  sel.innerHTML='<option value="all">Tất cả bộ từ</option>'+decks.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
  sel.value = decks.includes(old) ? old : "all";
}

function shuffle(arr){ return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]); }

function loadFlash(){
  const deck=document.getElementById("deckFilter").value;
  const status=document.getElementById("statusFilter").value;
  filtered=words.filter(w=>{
    const okDeck = deck==="all" || w.deck===deck;
    const okStatus = status==="all" || w.status===status;
    return okDeck && okStatus;
  });
  filtered=shuffle(filtered);
  idx=0;
  renderCard();
  toast(`Đã tải ${filtered.length} từ`);
}

function current(){ return filtered[idx]; }

function renderCard(){
  const w=current();
  document.getElementById("counter").textContent=filtered.length?`${idx+1}/${filtered.length}`:"0/0";
  document.getElementById("fcHanzi").textContent=w?w.hanzi:"Không có từ phù hợp";
  document.getElementById("fcPinyin").textContent=w?(w.pinyin||""):"";
  document.getElementById("fcMeaning").textContent=w?`${w.vi||""}${w.en?" / "+w.en:""}`:"";
  document.getElementById("fcDeck").textContent=w?`Bộ: ${w.deck} | Trạng thái: ${statusVi(w.status)}`:"";
  document.getElementById("fcPinyin").classList.add("hidden");
  document.getElementById("fcMeaning").classList.add("hidden");
}

function statusVi(s){ return s==="known"?"Đã thuộc":s==="unknown"?"Chưa thuộc":"Từ mới"; }
function showAnswer(){ document.getElementById("fcPinyin").classList.remove("hidden"); document.getElementById("fcMeaning").classList.remove("hidden"); }
function nextCard(){ if(!filtered.length)return; idx=(idx+1)%filtered.length; renderCard(); }
function prevCard(){ if(!filtered.length)return; idx=(idx-1+filtered.length)%filtered.length; renderCard(); }

function markCurrent(status){
  const w=current(); if(!w) return;
  const real=words.find(x=>x.id===w.id);
  if(real){ real.status=status; real.updatedAt=new Date().toISOString(); }
  w.status=status;
  saveWords();
  nextCard();
}

function speakText(text, lang){
  if(!text) return;
  const u=new SpeechSynthesisUtterance(text);
  u.lang=lang || "zh-CN";
  const rate=parseFloat(document.getElementById("rateInput")?.value || settings().rate || "0.85");
  u.rate=rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
function speakCurrent(lang){ const w=current(); if(w) speakText(lang==="vi-VN" ? w.vi : w.hanzi, lang); }
function testVoice(){ speakText("生产进度怎么样？", "zh-CN"); }

function startQuiz(){
  quizWords=shuffle(words.slice());
  quizIdx=0; quizScore=0;
  renderQuiz();
}
function renderQuiz(){
  const w=quizWords[quizIdx];
  document.getElementById("quizCounter").textContent=quizWords.length?`${quizIdx+1}/${quizWords.length}`:"0/0";
  document.getElementById("quizQuestion").textContent=w?(w.vi||w.en||w.pinyin||w.hanzi):"Chưa có từ";
  document.getElementById("quizAnswer").value="";
  document.getElementById("quizResult").textContent="";
}
function checkQuiz(){
  const w=quizWords[quizIdx]; if(!w) return;
  const ans=normalize(document.getElementById("quizAnswer").value).toLowerCase();
  const ok = ans && (ans===normalize(w.hanzi).toLowerCase() || ans===normalize(w.pinyin).toLowerCase());
  if(ok){ quizScore++; document.getElementById("quizResult").textContent=`Đúng ✅\n${w.hanzi} | ${w.pinyin}`; }
  else{ document.getElementById("quizResult").textContent=`Sai ❌\nĐáp án: ${w.hanzi} | ${w.pinyin}`; }
  setTimeout(()=>{ quizIdx++; if(quizIdx>=quizWords.length){ document.getElementById("quizQuestion").textContent=`Hoàn thành: ${quizScore}/${quizWords.length}`; document.getElementById("quizCounter").textContent="Xong"; document.getElementById("quizResult").textContent=""; } else renderQuiz(); }, 1200);
}

function importJson(){
  const file=document.getElementById("importFile").files[0];
  if(!file){ toast("Chưa chọn file"); return; }
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error("File phải là mảng JSON");
      let count=0;
      data.forEach(w=>{ const before=words.length; addWordObj(w); if(words.length>before) count++; });
      saveWords();
      toast(`Đã import ${count} từ`);
    }catch(e){ toast("Lỗi import JSON: "+e.message); }
  };
  reader.readAsText(file);
}

function exportBackup(){
  const data=JSON.stringify(words,null,2);
  const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="vocab_master_backup_"+new Date().toISOString().slice(0,10)+".json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function resetAllStatus(){
  if(!confirm("Reset toàn bộ trạng thái về Từ mới?")) return;
  words.forEach(w=>{w.status="new"; w.updatedAt=new Date().toISOString();});
  saveWords(); toast("Đã reset trạng thái");
}
function deleteAllWords(){
  if(!confirm("Xóa toàn bộ từ? Hãy export backup trước nếu cần.")) return;
  words=[]; saveWords(); loadFlash(); toast("Đã xóa toàn bộ từ");
}
function deleteWord(id){
  if(!confirm("Xóa từ này?")) return;
  words=words.filter(w=>w.id!==id);
  saveWords();
}
function renderWordList(){
  const box=document.getElementById("wordList"); if(!box) return;
  const latest=words.slice().reverse().slice(0,80);
  box.innerHTML=latest.map(w=>`
    <div class="word-item">
      <div class="word-main">
        <b>${escapeHtml(w.hanzi)}</b>
        <div>${escapeHtml(w.pinyin||"")} | ${escapeHtml(w.vi||"")} | ${escapeHtml(w.deck||"Default")} | ${statusVi(w.status)}</div>
      </div>
      <button class="danger" onclick="deleteWord('${w.id}')">Xóa</button>
    </div>
  `).join("") || "<p>Chưa có từ nào.</p>";
}
function escapeHtml(s){ return (s||"").toString().replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }

function initApp(){
  loadWordsLocal();
  const s=settings(); 
  if(s.rate){ 
    document.getElementById("rateInput").value=s.rate; 
    document.getElementById("rateValue").textContent=s.rate; 
  }
  const a=getAuth();
  if(document.getElementById("lockEnabled")) document.getElementById("lockEnabled").checked = a.lockEnabled !== false;
  updateStats();
  refreshDecks();
  renderWordList();
}

document.getElementById("rateInput")?.addEventListener("input", e=>{
  document.getElementById("rateValue").textContent=e.target.value;
  const s=settings(); s.rate=e.target.value; saveSettings(s);
});

window.addEventListener("online",()=>document.getElementById("offlineStatus").textContent="Đang online. App vẫn có thể dùng offline sau khi cài.");
window.addEventListener("offline",()=>document.getElementById("offlineStatus").textContent="Đang offline. Bạn vẫn có thể học nếu app đã được lưu cache.");

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(()=>console.log("SW registered")).catch(console.error);
}

document.addEventListener("keydown",(e)=>{
  if(document.getElementById("appShell").classList.contains("hidden")) {
    if(e.key==="Enter" && !document.getElementById("loginBox").classList.contains("hidden")) unlockApp();
    return;
  }
  if(e.key===" "){ e.preventDefault(); showAnswer(); }
  if(e.key==="ArrowRight") nextCard();
  if(e.key==="ArrowLeft") prevCard();
  if(e.key==="1") markCurrent("unknown");
  if(e.key==="2") markCurrent("known");
  if(e.key==="Enter" && document.activeElement.id==="quizAnswer") checkQuiz();
});

document.getElementById("offlineStatus") && (document.getElementById("offlineStatus").textContent = navigator.onLine ? "Đang online. App sẽ tự lưu để dùng offline." : "Đang offline.");
initAuth();
