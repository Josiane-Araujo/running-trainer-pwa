// app.js - Running Trainer (corrigido e completo)
// Inclui: correção de lógica de repetição, iOS TTS unlock, barra de progresso,
// wake lock, áudio silencioso, GPS, beeps, notificações.
// Compatível com seu HTML (onclick="iniciarTreinoTempo()", etc).

/* =========================
   ESTADO / CONFIG
   ========================= */
let treinoAtivo = false;
let pausado = false;
let tipoTreino = ''; // 'tempo' ou 'distancia'

let config = {
  tempoCorrida1: 0, tempoCaminhada: 0, tempoCorrida2: 0, // segundos
  distCorrida1: 0, distCaminhada: 0, distCorrida2: 0,    // km
  repeticoes: 0
};

let repeticaoAtual = 0;
let repeticaoTotal = 0;
let fasesDaRepeticao = []; // [{ kind, target }]
let indiceFase = 0;

let tempoRestante = 0; // segundos
let faseDistanciaAcumulada = 0; // km

let intervaloTreino = null;
let watchId = null;
let ultimaLocalizacao = null;

/* AUDIO/VOICE/Wake */
let audioContext = null;
let audioSilenciosoSource = null;
let wakeLock = null;
let permissoesOk = false;

let vozesDisponiveis = [];
let vozSelecionada = null;
let preferenciaTipoVoz = 'auto';

/* iOS voice helpers */
let voices = [];
let voicesLoaded = false;

/* ======================
   UTILITÁRIOS
   ====================== */
function garantirAudioContext() {
  if (!audioContext) {
    try { audioContext = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { audioContext = null; console.warn('AudioContext não disponível', e); }
  }
}

function formatTempoSegundos(sec) {
  const m = Math.floor(sec/60), s = sec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* ======================
   VOZ / TTS (iOS safe)
   ====================== */
function desbloquearVozesIOS() {
  return new Promise(resolve => {
    if (typeof speechSynthesis === 'undefined') return resolve();
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.rate = 2.0;
      u.onend = () => setTimeout(resolve, 200);
      speechSynthesis.speak(u);
    } catch (e) { setTimeout(resolve, 200); }
  });
}

function carregarVozesIOS(force = false) {
  return new Promise(resolve => {
    let tentativa = 0;
    function tentar() {
      voices = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
      if (voices.length > 1 || tentativa > 12 || force) {
        voicesLoaded = true;
        resolve(voices);
        return;
      }
      tentativa++;
      setTimeout(tentar, 200);
    }
    tentar();
  });
}

function carregarVozes() {
  if (typeof speechSynthesis === 'undefined') return;
  vozesDisponiveis = speechSynthesis.getVoices() || [];
  const seletor = document.getElementById('seletorVoz') || document.getElementById('seletorVozMenu');
  if (seletor) preferenciaTipoVoz = seletor.value;
  vozSelecionada = null;

  if (preferenciaTipoVoz === 'feminina') {
    vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /maria|female|feminina|luciana/i.test(v.name));
  } else if (preferenciaTipoVoz === 'masculina') {
    vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /daniel|male|masculina/i.test(v.name));
  }
  if (!vozSelecionada) {
    vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /google/i.test(v.name))
      || vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt'))
      || vozesDisponiveis[0] || null;
  }
  console.log('Vozes:', vozesDisponiveis.length, 'Selecionada:', vozSelecionada ? vozSelecionada.name : 'nenhuma');
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = carregarVozes;
}

/* falarTexto - central */
function falarTexto(texto, opcoes = {}) {
  if (typeof speechSynthesis === 'undefined') {
    console.warn('speechSynthesis não disponível');
    if (opcoes.onEnd) setTimeout(opcoes.onEnd, 300);
    return;
  }

  try { speechSynthesis.cancel(); } catch (e){}

  if (vozesDisponiveis.length === 0) {
    vozesDisponiveis = speechSynthesis.getVoices() || [];
    carregarVozes();
  } else if (!vozSelecionada) {
    carregarVozes();
  }

  setTimeout(() => {
    try {
      const u = new SpeechSynthesisUtterance(texto);
      if (vozSelecionada) u.voice = vozSelecionada;
      u.lang = 'pt-BR';
      u.volume = opcoes.volume !== undefined ? opcoes.volume : 1.0;
      u.rate = opcoes.rate !== undefined ? opcoes.rate : 0.95;
      u.pitch = opcoes.pitch !== undefined ? opcoes.pitch : 1.0;
      u.onend = () => { if (opcoes.onEnd) opcoes.onEnd(); };
      u.onerror = (e) => { console.error('TTS error', e); if (opcoes.onEnd) opcoes.onEnd(); };
      speechSynthesis.speak(u);
    } catch (err) {
      console.error('Erro ao falar', err);
      if (opcoes.onEnd) setTimeout(opcoes.onEnd, 300);
    }
  }, 120);
}

function testarVozManual() {
  garantirAudioContext();
  if (vozesDisponiveis.length === 0) vozesDisponiveis = speechSynthesis.getVoices() || [];
  if (!vozSelecionada && vozesDisponiveis.length>0) carregarVozes();
  vibrar(150);
  falarTexto('Três', { onEnd: ()=> { falarTexto('Dois', { onEnd: ()=> { falarTexto('Um', { onEnd: ()=> { falarTexto('Iniciando teste de voz'); } }); } }); });
}

function testarVozSelecionada() {
  garantirAudioContext();
  const sd = document.getElementById('seletorVoz');
  const sm = document.getElementById('seletorVozMenu');
  if (sd) preferenciaTipoVoz = sd.value;
  else if (sm) preferenciaTipoVoz = sm.value;
  vozSelecionada = null;
  carregarVozes();
  vibrar(120);
  falarTexto('Teste de voz selecionada. Está funcionando?', { rate: 1.0 });
}

/* ======================
   SONS / VIBRAÇÃO
   ====================== */
function tocarBeep(freq = 800, dur = 0.25) {
  garantirAudioContext();
  if (!audioContext) return;
  try {
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.connect(g); g.connect(audioContext.destination);
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.3, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + dur);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + dur);
  } catch(e) { console.warn('beep failed', e); }
}
function tocarTroca(){ tocarBeep(600,0.14); setTimeout(()=>tocarBeep(900,0.16),160); }
function tocarFinal(){ tocarBeep(523,0.14); setTimeout(()=>tocarBeep(659,0.14),200); setTimeout(()=>tocarBeep(784,0.2),420); }
function vibrar(ms=200){ if ('vibrate' in navigator) navigator.vibrate(ms); }

/* ======================
   WakeLock / audio silencioso
   ====================== */
async function solicitarWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    document.addEventListener('visibilitychange', async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e){}
      }
    });
  } catch(e) { console.warn('WakeLock erro', e); }
}
function liberarWakeLock(){ if (wakeLock){ try{ wakeLock.release().then(()=>wakeLock=null);}catch(e){wakeLock=null;} } }
function iniciarAudioSilencioso(){
  try { garantirAudioContext(); audioSilenciosoSource = audioContext.createOscillator(); const g = audioContext.createGain(); audioSilenciosoSource.connect(g); g.connect(audioContext.destination); g.gain.value = 0.0005; audioSilenciosoSource.frequency.value = 20; audioSilenciosoSource.start(); } catch(e){ console.warn('audio silencioso falhou', e); }
}
function pararAudioSilencioso(){ if (audioSilenciosoSource){ try{ audioSilenciosoSource.stop(); }catch(e){} audioSilenciosoSource = null; } }

/* ======================
   Preferências de voz / selects
   ====================== */
function atualizarVoz(){ const sm = document.getElementById('seletorVozMenu'); const sd = document.getElementById('seletorVoz'); if (sm && sd){ preferenciaTipoVoz = sm.value; sd.value = preferenciaTipoVoz; } else if (sm) preferenciaTipoVoz = sm.value; else if (sd) preferenciaTipoVoz = sd.value; vozSelecionada = null; carregarVozes(); try{ localStorage.setItem('vozPreferida', preferenciaTipoVoz);}catch(e){} }
function sincronizarSeletores(){ const sm = document.getElementById('seletorVozMenu'); const sd = document.getElementById('seletorVoz'); if (sm && sd && sm.value !== sd.value) sd.value = sm.value; }
function carregarPreferenciaVoz(){ try{ const v = localStorage.getItem('vozPreferida'); if (v){ preferenciaTipoVoz = v; const sm=document.getElementById('seletorVozMenu'); const sd=document.getElementById('seletorVoz'); if (sm) sm.value=v; if (sd) sd.value=v; } }catch(e){} }

/* ======================
   ORDINAIS EM EXTENSO (feminino)
   ====================== */
function numeroParaOrdinalExtenso(n){
  if (n <= 0) return `${n}ª`;
  const unidades = ['zero','primeira','segunda','terceira','quarta','quinta','sexta','sétima','oitava','nona'];
  const especiais = {10:'décima',11:'décima primeira',12:'décima segunda',13:'décima terceira',14:'décima quarta',15:'décima quinta',16:'décima sexta',17:'décima sétima',18:'décima oitava',19:'décima nona'};
  const dezenas = {2:'vigésima',3:'trigésima',4:'quadragésima',5:'quinquagésima',6:'sexagésima',7:'septuagésima',8:'octogésima',9:'nonagésima'};
  if (n <= 9) return unidades[n];
  if (n >= 10 && n <= 19) return especiais[n];
  const d = Math.floor(n/10), u = n%10;
  if (u === 0) return dezenas[d] || `${d}ª`;
  return `${dezenas[d]||d+'ª'} ${unidades[u]}`;
}

/* ======================
   Construir fases
   ====================== */
function construirFasesDaRepeticao(){
  const fases = [];
  if (tipoTreino === 'tempo'){
    if (config.tempoCorrida1 > 0) fases.push({ kind: 'corrida1', target: config.tempoCorrida1 });
    if (config.tempoCaminhada > 0) fases.push({ kind: 'caminhada', target: config.tempoCaminhada });
    if (config.tempoCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.tempoCorrida2 });
  } else {
    if (config.distCorrida1 > 0) fases.push({ kind: 'corrida1', target: config.distCorrida1 });
    if (config.distCaminhada > 0) fases.push({ kind: 'caminhada', target: config.distCaminhada });
    if (config.distCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.distCorrida2 });
  }
  return fases;
}

/* ======================
   Limpeza segura de intervalos/GPS
   ====================== */
function limparIntervalosEGPS(){
  if (intervaloTreino){ clearInterval(intervaloTreino); intervaloTreino = null; }
  if (watchId){ try{ navigator.geolocation.clearWatch(watchId); }catch(e){} watchId = null; }
}

/* ======================
   INICIAR TREINO - TEMPO
   ====================== */
function iniciarTreinoTempo(){
  const t1 = parseFloat(document.getElementById('tempoCorrida1').value) || 0;
  const tc = parseFloat(document.getElementById('tempoCaminhada').value) || 0;
  const t2 = parseFloat(document.getElementById('tempoCorrida2').value) || 0;
  const reps = parseInt(document.getElementById('repeticoes').value) || 0;

  if (t1 <= 0 || reps <= 0){ alert('⚠️ Preencha o 1º tempo de corrida e o número de repetições!'); return; }
  if (!permissoesOk){ document.getElementById('permissionModal').classList.add('active'); return; }

  tipoTreino = 'tempo';
  config.tempoCorrida1 = Math.round(t1*60);
  config.tempoCaminhada = Math.round(tc*60);
  config.tempoCorrida2 = Math.round(t2*60);
  config.repeticoes = Math.min(Math.max(reps,1),99);

  // preparar estado
  repeticaoAtual = 1;
  repeticaoTotal = config.repeticoes;
  fasesDaRepeticao = construirFasesDaRepeticao();
  indiceFase = 0;

  showScreen('treinoScreen');
  iniciarContagemRegressiva();
}

/* ======================
   INICIAR TREINO - DISTÂNCIA
   ====================== */
function iniciarTreinoDistancia(){
  const d1 = parseFloat(document.getElementById('distCorrida1').value) || 0;
  const dc = parseFloat(document.getElementById('distCaminhada').value) || 0;
  const d2 = parseFloat(document.getElementById('distCorrida2').value) || 0;
  const reps = parseInt(document.getElementById('repeticoesDist').value) || 0;

  if (d1 <= 0 || reps <= 0){ alert('⚠️ Preencha a 1ª distância de corrida e o número de repetições!'); return; }
  if (!permissoesOk){ document.getElementById('permissionModal').classList.add('active'); return; }

  tipoTreino = 'distancia';
  config.distCorrida1 = d1;
  config.distCaminhada = dc;
  config.distCorrida2 = d2;
  config.repeticoes = Math.min(Math.max(reps,1),99);

  repeticaoAtual = 1;
  repeticaoTotal = config.repeticoes;
  fasesDaRepeticao = construirFasesDaRepeticao();
  indiceFase = 0;

  showScreen('treinoScreen');
  iniciarContagemRegressiva();
}

/* ======================
   CONTAGEM REGRESSIVA
   ====================== */
function iniciarContagemRegressiva(){
  let contador = 3;
  document.getElementById('faseAtual').textContent = contador;
  document.getElementById('infoValor').textContent = '';
  document.getElementById('repeticoesDisplay').textContent = '';

  garantirAudioContext();
  tocarBeep(); vibrar(180);
  falarTexto('Três');

  const iv = setInterval(() => {
    contador--;
    if (contador > 0){
      document.getElementById('faseAtual').textContent = contador;
      tocarBeep(); vibrar(150);
      falarTexto(String(contador));
    } else if (contador === 0){
      document.getElementById('faseAtual').textContent = 'VAI!';
      tocarBeep(1000,0.45); vibrar(400);
      falarTexto('VAI!', { pitch: 1.12 });
    } else {
      clearInterval(iv);
      setTimeout(() => iniciarTreinoReal(), 700);
    }
  },1000);
}

/* ======================
   INICIAR TREINO REAL (após contagem)
   ====================== */
function iniciarTreinoReal(){
  treinoAtivo = true;
  pausado = false;

  // NÃO reconstruir fases aqui — já foram construídas ao iniciar o treino
  // só garantir display e recursos
  document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
  garantirAudioContext();
  solicitarWakeLock();
  if (!audioSilenciosoSource) iniciarAudioSilencioso();
  atualizarDisplay();

  // anunciar repetição
  const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
  // Garantir que NÃO existam timers pendentes antes de anunciar
  limparIntervalosEGPS();
  falarTexto(textoRep, { onEnd: () => {
    // segurança extra: limpar novamente
    limparIntervalosEGPS();
    setTimeout(() => iniciarFaseAtual(), 300);
  }});
}

/* ======================
   INICIAR FASE ATUAL
   ====================== */
function iniciarFaseAtual(){
  console.log('iniciarFaseAtual -> rep', repeticaoAtual, 'faseIndex', indiceFase, 'totalFases', fasesDaRepeticao.length);

  if (!treinoAtivo) treinoAtivo = true;

  // reconstruir caso array vazio por algum motivo
  if (!fasesDaRepeticao || fasesDaRepeticao.length === 0){
    fasesDaRepeticao = construirFasesDaRepeticao();
  }

  // SE ACABARAM AS FASES -> PRÓXIMA REPETIÇÃO OU FINALIZA
  if (indiceFase >= fasesDaRepeticao.length){
    console.log('fim das fases da repetição', repeticaoAtual);
    // limpa intervalos antes de trocar repetição
    limparIntervalosEGPS();

    if (repeticaoAtual < repeticaoTotal){
      repeticaoAtual++;
      indiceFase = 0;
      // reconstruir fases para nova repetição (mantém consistência)
      fasesDaRepeticao = construirFasesDaRepeticao();
      document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;

      const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
      // Garantir que NÃO existam timers enquanto TTS fala
      limparIntervalosEGPS();
      falarTexto(textoRep, { onEnd: () => {
        limparIntervalosEGPS();
        setTimeout(() => iniciarFaseAtual(), 300);
      }});
      return;
    } else {
      finalizarComSucesso();
      return;
    }
  }

  // Iniciar fase corrente
  const f = fasesDaRepeticao[indiceFase];
  faseDistanciaAcumulada = 0;

  if (!f){
    console.error('fase indefinida para indice', indiceFase, fasesDaRepeticao);
    indiceFase++;
    setTimeout(()=> iniciarFaseAtual(),200);
    return;
  }

  console.log('Iniciando fase', f.kind, 'target', f.target, 'tipoTreino', tipoTreino);

  // limpeza segura do intervalo anterior
  limparIntervalosEGPS();

  if (tipoTreino === 'tempo'){
    tempoRestante = f.target;
    document.getElementById('infoLabel').textContent = 'Tempo Restante';
    document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

    if (f.kind === 'caminhada') falarTexto('Caminhada!');
    else falarTexto('Corrida!');

    atualizarBarraProgresso(0, f.target, f.kind);

    intervaloTreino = setInterval(loopTempo, 1000);
    console.log('loop tempo iniciado');
  } else {
    // distância
    document.getElementById('infoLabel').textContent = 'Distância Percorrida';
    faseDistanciaAcumulada = 0;
    document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;

    if (f.kind === 'caminhada') falarTexto('Caminhada!');
    else falarTexto('Corrida!');

    atualizarBarraProgresso(0, f.target, f.kind);
    iniciarGPS();
    intervaloTreino = setInterval(loopDistancia, 1000);
    console.log('loop distancia iniciado');
  }

  atualizarDisplay();
}

/* ======================
   LOOP tempo
   ====================== */
function loopTempo(){
  if (pausado) return;
  if (!treinoAtivo) return;
  if (!fasesDaRepeticao[indiceFase]) return;

  tempoRestante = Math.max(0, tempoRestante-1);
  document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

  const alvo = fasesDaRepeticao[indiceFase].target;
  const decorrido = alvo - tempoRestante;
  const pct = alvo > 0 ? Math.min(100, Math.round((decorrido / alvo) * 100)) : 100;
  atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);

  if (tempoRestante <= 0){
    tocarTroca(); vibrar(260);
    // encerrar loop atual e avançar fase
    limparIntervalosEGPS();
    indiceFase++;
    setTimeout(()=> iniciarFaseAtual(), 420);
  }
}

/* ======================
   LOOP distancia
   ====================== */
function loopDistancia(){
  if (pausado) return;
  if (!treinoAtivo) return;
  if (!fasesDaRepeticao[indiceFase]) return;

  const alvo = fasesDaRepeticao[indiceFase].target; // km
  const atual = faseDistanciaAcumulada;
  const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 100;
  atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);
  document.getElementById('infoValor').textContent = `${atual.toFixed(2)} km`;

  if (atual >= alvo){
    tocarTroca(); vibrar(260);
    limparIntervalosEGPS();
    indiceFase++;
    setTimeout(()=> iniciarFaseAtual(), 420);
  }
}

/* ======================
   Finalizar com sucesso
   ====================== */
function finalizarComSucesso(){
  limparTreino();
  document.getElementById('faseAtual').textContent = 'Parabéns!\nMeta concluída!';
  document.getElementById('infoValor').textContent = '🎉';
  setTimeout(()=> { tocarFinal(); vibrar(400); }, 0);
  setTimeout(()=> { tocarFinal(); vibrar(400); }, 500);
  setTimeout(()=> { tocarFinal(); vibrar(400); }, 1000);
  setTimeout(()=> falarTexto('Parabéns! Treino concluído!'), 1400);
  enviarNotificacao('🎉 Parabéns!', 'Você concluiu o treino com sucesso!');
  setTimeout(()=> showScreen('menuScreen'), 4500);
}

/* ======================
   GPS (distância)
   ====================== */
function iniciarGPS(){
  if (!navigator.geolocation) { alert('⚠️ GPS não disponível neste dispositivo'); return; }
  if (watchId) return;
  ultimaLocalizacao = null;
  faseDistanciaAcumulada = 0;
  const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
  watchId = navigator.geolocation.watchPosition(atualizarLocalizacao, erroGPS, options);
}

function atualizarLocalizacao(position){
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  if (ultimaLocalizacao){
    const d = calcularDistancia(ultimaLocalizacao.lat, ultimaLocalizacao.lon, lat, lon); // km
    if (d >= 0 && d < 1) faseDistanciaAcumulada += d;
  }
  ultimaLocalizacao = { lat, lon };
  if (tipoTreino === 'distancia') document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;
}

function calcularDistancia(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI/180;
  const dLon = (lon2 - lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function erroGPS(e){ console.error('Erro GPS', e); const ie = document.getElementById('infoExtra'); if (ie) ie.textContent = '⚠️ Erro ao acessar GPS'; }

/* ======================
   Barra de progresso
   ====================== */
function atualizarBarraProgresso(pct, alvo, kind){
  const barra = document.getElementById('barraProgresso');
  const left = document.getElementById('progressoTextoLeft');
  const right = document.getElementById('progressoTextoRight');
  const indicador = document.getElementById('indicadorFase');
  if (!barra) return;
  barra.style.width = `${pct}%`;
  if (kind === 'caminhada') indicador.classList.add('caminhada'); else indicador.classList.remove('caminhada');
  left.textContent = `${pct}%`;
  if (tipoTreino === 'tempo') right.textContent = alvo ? formatTempoSegundos(alvo) : '--:--';
  else right.textContent = alvo ? `${alvo.toFixed(2)} km` : '— km';
}

/* ======================
   CONTROLES: pausar / finalizar / limpar
   ====================== */
function pausarTreino(){
  pausado = !pausado;
  const btn = document.getElementById('btnPausar');
  if (pausado){ btn.textContent = 'RETOMAR'; document.getElementById('faseAtual').textContent = 'PAUSADO'; }
  else { btn.textContent = 'PAUSAR'; atualizarDisplay(); }
}

function finalizarTreino(){
  if (confirm('Deseja realmente finalizar o treino?')){ limparTreino(); showScreen('menuScreen'); }
}

function limparTreino(){
  treinoAtivo = false; pausado = false; tipoTreino = '';
  config = { tempoCorrida1:0, tempoCaminhada:0, tempoCorrida2:0, distCorrida1:0, distCaminhada:0, distCorrida2:0, repeticoes:0 };
  repeticaoAtual = 0; repeticaoTotal = 0; fasesDaRepeticao = []; indiceFase = 0;
  tempoRestante = 0; faseDistanciaAcumulada = 0;
  limparIntervalosEGPS();
  liberarWakeLock(); pararAudioSilencioso();
  const repDisp = document.getElementById('repeticoesDisplay'); if (repDisp) repDisp.textContent = '0 / 0';
  const iv = document.getElementById('infoValor'); if (iv) iv.textContent = '';
  const lbl = document.getElementById('infoLabel'); if (lbl) lbl.textContent = '';
  const faseAt = document.getElementById('faseAtual'); if (faseAt) faseAt.textContent = 'Preparar';
  atualizarBarraProgresso(0,0,null);
  const ie = document.getElementById('infoExtra'); if (ie) ie.textContent = '';
}

/* ======================
   UI updates
   ====================== */
function atualizarDisplay(){
  const repDisp = document.getElementById('repeticoesDisplay'); if (repDisp) repDisp.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
  const faseTxt = (!fasesDaRepeticao.length || !fasesDaRepeticao[indiceFase]) ? 'Preparar' : (fasesDaRepeticao[indiceFase].kind === 'caminhada' ? 'Caminhada' : (fasesDaRepeticao[indiceFase].kind === 'corrida1' ? 'Corrida' : 'Corrida 2'));
  const faseAt = document.getElementById('faseAtual'); if (faseAt) faseAt.textContent = faseTxt;
}

/* ======================
   Notificações
   ====================== */
async function solicitarPermissaoNotificacoes(){
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'default'){ const p = await Notification.requestPermission(); return p === 'granted'; }
  return Notification.permission === 'granted';
}
function enviarNotificacao(titulo, mensagem){
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') new Notification(titulo, { body: mensagem, icon: 'icon-192.png', tag: 'running-trainer' });
}

/* ======================
   INICIALIZAÇÃO
   ====================== */
window.addEventListener('load', async () => {
  console.log('Running Trainer carregado (corrigido).');
  carregarPreferenciaVoz();
  garantirAudioContext();
  if (typeof speechSynthesis !== 'undefined'){
    try { await desbloquearVozesIOS(); await carregarVozesIOS(true); vozesDisponiveis = speechSynthesis.getVoices() || []; carregarVozes(); } catch(e){ console.warn('voices init falhou', e); }
  }
  setTimeout(carregarVozes, 800);
  garantirAudioContext();
  setTimeout(()=> { if (!permissoesOk) { const modal = document.getElementById('permissionModal'); if (modal) modal.classList.add('active'); } }, 900);
  if ('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(()=>console.log('SW registrado')).catch(e=>console.warn('SW erro',e)); }
  document.addEventListener('gesturestart', e => e.preventDefault());
});

/* ======================
   Expor funções globais
   ====================== */
window.atualizarVoz = atualizarVoz;
window.sincronizarSeletores = sincronizarSeletores;
window.testarVozManual = testarVozManual;
window.testarVozSelecionada = testarVozSelecionada;
window.requestPermissions = () => {
  garantirAudioContext(); carregarVozes(); ativarVozComInteracao(); solicitarPermissaoNotificacoes(); solicitarWakeLock(); iniciarAudioSilencioso(); permissoesOk = true; const modal = document.getElementById('permissionModal'); if (modal) modal.classList.remove('active'); if ('vibrate' in navigator) navigator.vibrate(200);
};
window.iniciarTreinoTempo = iniciarTreinoTempo;
window.iniciarTreinoDistancia = iniciarTreinoDistancia;
window.pausarTreino = pausarTreino;
window.finalizarTreino = finalizarTreino;

/* Função para ativar voz via interação (iOS) */
function ativarVozComInteracao(){
  garantirAudioContext();
  try {
    const u = new SpeechSynthesisUtterance('.');
    u.volume = 0.01; u.rate = 2.0;
    u.onend = () => { setTimeout(()=> falarTexto('Running Trainer configurado! Pronto para treinar!'), 300); };
    speechSynthesis.speak(u);
  } catch(e) { console.warn('ativarVozComInteracao falhou', e); }
}

/* carregarVozes fallback / retry */
function carregarVozesComRetry(){
  return new Promise(resolve => {
    let tent = 0;
    function tentar(){
      vozesDisponiveis = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
      if (vozesDisponiveis.length > 1 || tent >= 10) { carregarVozes(); resolve(vozesDisponiveis); return; }
      tent++; setTimeout(tentar, 200);
    }
    tentar();
  });
}

// garantir inicializarVozesIOS definido (usado no load)
async function inicializarVozesIOS(){ try{ await desbloquearVozesIOS(); await carregarVozesComRetry(); vozesDisponiveis = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : []; carregarVozes(); } catch(e){ console.warn('inicializarVozesIOS fallback', e); } }

