// app.js - Running Trainer (versão final com melhorias requisitadas)
// Autor: HTML + CSS + Javascript (assistente)
// Recursos implementados:
// - 3 fases por repetição: Corrida1 (obrigatória) → Caminhada (opcional) → Corrida2 (opcional)
// - Anúncio natural: "Iniciando primeira repetição" antes da Corrida1 (Opção A)
// - Barra de progresso única que reinicia por fase (tempo ou distância)
// - Teste de voz funcional nos dois lugares (menu e modal), carregamento robusto de vozes
// - Repetições até 99 (inputs com min/max ajustados)
// - Preservação de beeps, vibração, wake lock, audio silencioso, GPS, service worker

/* =========================
   Estado / Configuração
   ========================= */
let treinoAtivo = false;
let pausado = false;
let tipoTreino = ''; // 'tempo' | 'distancia'
let config = {
    tempoCorrida1: 0, // segundos
    tempoCaminhada: 0, // segundos
    tempoCorrida2: 0, // seconds
    distCorrida1: 0, // km
    distCaminhada: 0, // km
    distCorrida2: 0, // km
    repeticoes: 0
};

let repeticaoAtual = 0;
let repeticaoTotal = 0;
let fasesDaRepeticao = []; // [{kind:'corrida1'|'caminhada'|'corrida2', target: number}]
let indiceFase = 0;
let tempoRestante = 0; // segundos (modo tempo)
let faseDistanciaAcumulada = 0; // km (modo distancia)
let intervaloTreino = null;
let watchId = null;

// Audio & Voice
let audioContext = null;
let audioSilenciosoSource = null;
let wakeLock = null;
let permissoesOk = false;

let vozesDisponiveis = [];
let vozSelecionada = null;
let preferenciaTipoVoz = 'auto'; // auto | feminina | masculina

/* =========================
   UTILITÁRIOS
   ========================= */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function pad2(n) { return String(n).padStart(2, '0'); }
function formatTempoSegundos(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${pad2(m)}:${pad2(s)}`;
}

/* =========================
   Conversor de número para ordinal em extenso (feminino)
   Ex.: 1 -> "primeira", 2 -> "segunda", 11 -> "décima primeira"
   ========================= */
function numeroParaOrdinalExtenso(n) {
    // suporta 1..99
    if (n <= 0) return `${n}ª`;
    const unidades = ['zero','primeira','segunda','terceira','quarta','quinta','sexta','sétima','oitava','nona'];
    const especiais = {
        10: 'décima',
        11: 'décima primeira',
        12: 'décima segunda',
        13: 'décima terceira',
        14: 'décima quarta',
        15: 'décima quinta',
        16: 'décima sexta',
        17: 'décima sétima',
        18: 'décima oitava',
        19: 'décima nona'
    };
    const dezenas = {
        2: 'vigésima', // 20 -> vigésima
        3: 'trigésima',
        4: 'quadragésima',
        5: 'quinquagésima',
        6: 'sexagésima',
        7: 'septuagésima',
        8: 'octogésima',
        9: 'nonagésima'
    };
    if (n <= 9) return unidades[n];
    if (n >= 10 && n <= 19) return especiais[n];
    const d = Math.floor(n / 10);
    const u = n % 10;
    // 20,30,40...
    if (u === 0) {
        if (d === 2) return 'vigésima';
        return dezenas[d] || `${d}ª`;
    }
    // ex.: 21 -> vigésima primeira
    const dezExt = (d === 2) ? 'vigésima' : (dezenas[d] || `${d}ª`);
    const uniExt = unidades[u];
    return `${dezExt} ${uniExt}`;
}

/* =========================
   VOZ / SONS
   ========================= */
function garantirAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function carregarVozes() {
    vozesDisponiveis = speechSynthesis.getVoices();
    if (!vozesDisponiveis || vozesDisponiveis.length === 0) return;

    // Preferência do select
    const seletor = document.getElementById('seletorVoz') || document.getElementById('seletorVozMenu');
    if (seletor) preferenciaTipoVoz = seletor.value;

    vozSelecionada = null;

    if (preferenciaTipoVoz === 'feminina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang.startsWith('pt') && /maria|brasil|female|feminina|luciana/i.test(v.name));
    } else if (preferenciaTipoVoz === 'masculina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang.startsWith('pt') && /daniel|male|masculina/i.test(v.name));
    }

    if (!vozSelecionada) {
        vozSelecionada = vozesDisponiveis.find(v => v.lang.startsWith('pt') && /google/i.test(v.name))
            || vozesDisponiveis.find(v => v.lang.startsWith('pt'))
            || vozesDisponiveis[0];
    }

    console.log('Voz selecionada:', vozSelecionada ? vozSelecionada.name : 'nenhuma');
}
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = carregarVozes;
    setTimeout(carregarVozes, 500);
}

function falarTexto(texto, opcoes = {}) {
    if (typeof speechSynthesis === 'undefined') {
        console.warn('speechSynthesis não disponível');
        return;
    }

    // Não cancelar completamente se houver fala que queremos manter -- apenas garantir que fala atual não atrapalhe.
    try { speechSynthesis.cancel(); } catch (e) {}

    if (vozesDisponiveis.length === 0) vozesDisponiveis = speechSynthesis.getVoices();
    if (!vozSelecionada && vozesDisponiveis.length > 0) carregarVozes();

    setTimeout(() => {
        try {
            const u = new SpeechSynthesisUtterance(texto);
            if (vozSelecionada) u.voice = vozSelecionada;
            u.lang = 'pt-BR';
            u.volume = opcoes.volume !== undefined ? opcoes.volume : 1.0;
            u.rate = opcoes.rate !== undefined ? opcoes.rate : 0.95;
            u.pitch = opcoes.pitch !== undefined ? opcoes.pitch : 1.0;
            u.onend = () => { if (opcoes.onEnd) opcoes.onEnd(); };
            u.onerror = (err) => console.error('Erro TTS:', err);
            speechSynthesis.speak(u);
        } catch (err) {
            console.error('Erro ao criar utterance:', err);
        }
    }, 120);
}

function tocarBeep(freq = 800, dur = 0.25) {
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
    } catch (e) { console.error('Beep error', e); }
}

function tocarTroca() {
    if (!audioContext) return;
    tocarBeep(600, 0.16);
    setTimeout(() => tocarBeep(900, 0.18), 160);
}

function tocarFinal() {
    if (!audioContext) return;
    tocarBeep(523, 0.14);
    setTimeout(() => tocarBeep(659, 0.14), 200);
    setTimeout(() => tocarBeep(784, 0.2), 420);
}

function vibrar(ms = 200) {
    if ('vibrate' in navigator) navigator.vibrate(ms);
}

function enviarNotificacao(titulo, mensagem) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(titulo, { body: mensagem, icon: 'icon-192.png', tag: 'running-trainer' });
    }
}

/* =========================
   Wake Lock / audio silencioso
   ========================= */
async function solicitarWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) {}
            }
        });
    } catch (e) {
        console.log('WakeLock não disponível', e);
    }
}
function liberarWakeLock() {
    if (wakeLock) {
        try { wakeLock.release().then(() => wakeLock = null); } catch(e) { wakeLock = null; }
    }
}

function iniciarAudioSilencioso() {
    try {
        garantirAudioContext();
        audioSilenciosoSource = audioContext.createOscillator();
        const g = audioContext.createGain();
        audioSilenciosoSource.connect(g); g.connect(audioContext.destination);
        g.gain.value = 0.0005;
        audioSilenciosoSource.frequency.value = 20;
        audioSilenciosoSource.start();
    } catch (e) { console.warn('audio silencioso falhou', e); }
}
function pararAudioSilencioso() {
    if (audioSilenciosoSource) {
        try { audioSilenciosoSource.stop(); } catch(e) {}
        audioSilenciosoSource = null;
    }
}

/* =========================
   Preferências de voz / botões de teste
   ========================= */
function atualizarVoz() {
    const sm = document.getElementById('seletorVozMenu');
    const sd = document.getElementById('seletorVoz');
    if (sm && sd) {
        preferenciaTipoVoz = sm.value;
        sd.value = preferenciaTipoVoz;
    } else if (sm) preferenciaTipoVoz = sm.value;
    else if (sd) preferenciaTipoVoz = sd.value;

    vozSelecionada = null;
    carregarVozes();
    try { localStorage.setItem('vozPreferida', preferenciaTipoVoz); } catch(e){}
}

function sincronizarSeletores() {
    const sm = document.getElementById('seletorVozMenu');
    const sd = document.getElementById('seletorVoz');
    if (sm && sd && sm.value !== sd.value) sd.value = sm.value;
}

function carregarPreferenciaVoz() {
    try {
        const v = localStorage.getItem('vozPreferida');
        if (v) {
            preferenciaTipoVoz = v;
            const sm = document.getElementById('seletorVozMenu');
            const sd = document.getElementById('seletorVoz');
            if (sm) sm.value = v;
            if (sd) sd.value = v;
        }
    } catch(e){}
}

// Testar voz do menu (teste genérico)
function testarVozManual() {
    garantirAudioContext();
    // Garantir vozes carregadas
    if (vozesDisponiveis.length === 0) vozesDisponiveis = speechSynthesis.getVoices();
    if (!vozSelecionada && vozesDisponiveis.length > 0) carregarVozes();

    vibrar(150);
    // Sequência curta para demonstrar fala
    falarTexto('Três', { onEnd: () => {
        falarTexto('Dois', { onEnd: () => {
            falarTexto('Um', { onEnd: () => {
                falarTexto('Iniciando teste de voz', { pitch: 1.05 });
            }});
        }});
    }});
}

// Testar voz selecionada no modal
function testarVozSelecionada() {
    garantirAudioContext();
    // Recarregar vozes/vozSelecionada baseando-se no select atual
    const sd = document.getElementById('seletorVoz');
    const sm = document.getElementById('seletorVozMenu');
    if (sd) preferenciaTipoVoz = sd.value;
    else if (sm) preferenciaTipoVoz = sm.value;
    vozSelecionada = null;
    carregarVozes();

    vibrar(120);
    // Mensagem mais curta para teste
    falarTexto('Teste de voz selecionada. Está funcionando?', { onEnd: () => {
        // nada
    }});
}

/* =========================
   Permissões / inicialização
   ========================= */
async function solicitarPermissaoNotificacoes() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') {
        const p = await Notification.requestPermission();
        return p === 'granted';
    }
    return Notification.permission === 'granted';
}

function ativarVozComInteracao() {
    garantirAudioContext();
    try {
        const u = new SpeechSynthesisUtterance('.');
        u.volume = 0.01; u.rate = 2.0;
        u.onend = () => { setTimeout(() => falarTexto('Running Trainer configurado! Pronto para treinar!'), 300); };
        speechSynthesis.speak(u);
    } catch (e) { console.warn('ativarVozComInteracao falhou', e); }
}

function requestPermissions() {
    garantirAudioContext();
    carregarVozes();
    ativarVozComInteracao();
    solicitarPermissaoNotificacoes();
    solicitarWakeLock();
    iniciarAudioSilencioso();
    permissoesOk = true;
    const modal = document.getElementById('permissionModal');
    if (modal) modal.classList.remove('active');
    if ('vibrate' in navigator) navigator.vibrate(200);
}

/* =========================
   Construção das fases (por repetição)
   ========================= */
function construirFasesDaRepeticao() {
    const fases = [];
    if (tipoTreino === 'tempo') {
        // somente incluir fases com target > 0 (corrida1 é obrigatória)
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

/* =========================
   Iniciar treino (tempo / distância)
   ========================= */
function iniciarTreinoTempo() {
    const t1min = parseFloat(document.getElementById('tempoCorrida1').value) || 0;
    const tCmin = parseFloat(document.getElementById('tempoCaminhada').value) || 0;
    const t2min = parseFloat(document.getElementById('tempoCorrida2').value) || 0;
    const reps = parseInt(document.getElementById('repeticoes').value) || 0;

    if (t1min <= 0 || reps <= 0) {
        alert('⚠️ Preencha o 1º tempo de corrida e o número de repetições!');
        return;
    }
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }

    tipoTreino = 'tempo';
    config.tempoCorrida1 = Math.round(t1min * 60);
    config.tempoCaminhada = Math.round(tCmin * 60);
    config.tempoCorrida2 = Math.round(t2min * 60);
    config.repeticoes = Math.min(Math.max(reps, 1), 99);

    iniciarContagemRegressiva();
    showScreen('treinoScreen');
}

function iniciarTreinoDistancia() {
    const d1 = parseFloat(document.getElementById('distCorrida1').value) || 0;
    const dC = parseFloat(document.getElementById('distCaminhada').value) || 0;
    const d2 = parseFloat(document.getElementById('distCorrida2').value) || 0;
    const reps = parseInt(document.getElementById('repeticoesDist').value) || 0;

    if (d1 <= 0 || reps <= 0) {
        alert('⚠️ Preencha a 1ª distância de corrida e o número de repetições!');
        return;
    }
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }

    tipoTreino = 'distancia';
    config.distCorrida1 = d1;
    config.distCaminhada = dC;
    config.distCorrida2 = d2;
    config.repeticoes = Math.min(Math.max(reps, 1), 99);

    iniciarContagemRegressiva();
    showScreen('treinoScreen');
}

/* =========================
   Contagem regressiva (3..2..1..VAI)
   ========================= */
function iniciarContagemRegressiva() {
    let c = 3;
    document.getElementById('faseAtual').textContent = c;
    document.getElementById('infoValor').textContent = '';
    document.getElementById('repeticoesDisplay').textContent = '';

    garantirAudioContext();
    tocarBeep(); vibrar(200); falarTexto('Três');

    const iv = setInterval(() => {
        c--;
        if (c > 0) {
            document.getElementById('faseAtual').textContent = c;
            tocarBeep(); vibrar(170);
            falarTexto(String(c));
        } else if (c === 0) {
            document.getElementById('faseAtual').textContent = 'VAI!';
            tocarBeep(1000, 0.45); vibrar(400);
            falarTexto('VAI!', { pitch: 1.15 });
        } else {
            clearInterval(iv);
            setTimeout(() => iniciarTreinoReal(), 700);
        }
    }, 1000);
}

/* =========================
   Início do treino real / fluxo das fases
   ========================= */
function iniciarTreinoReal() {
    treinoAtivo = true;
    pausado = false;
    repeticaoAtual = 1;
    repeticaoTotal = config.repeticoes;
    fasesDaRepeticao = construirFasesDaRepeticao();
    indiceFase = 0;

    garantirAudioContext();
    solicitarWakeLock();
    if (!audioSilenciosoSource) iniciarAudioSilencioso();

    atualizarDisplay();

    // Anunciar repetição em voz natural antes de iniciar Corrida1 (Opção A)
    const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
    falarTexto(textoRep, { onEnd: () => {
        // logo após anunciar repetição, iniciar a primeira fase
        iniciarFaseAtual();
    }});

    // Atualizar UI repeticoes
    document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
}

/* Inicia a fase atual (fasesDaRepeticao[indiceFase]) */
function iniciarFaseAtual() {
    if (!treinoAtivo) return;

    if (indiceFase >= fasesDaRepeticao.length) {
        // acabou fases -> próxima repetição
        proximaRepeticao();
        return;
    }

    const f = fasesDaRepeticao[indiceFase];
    faseDistanciaAcumulada = 0;

    if (tipoTreino === 'tempo') {
        tempoRestante = f.target;
        document.getElementById('infoLabel').textContent = 'Tempo Restante';
        document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

        // anunciar fase (CORRIDA/CAMINHADA)
        if (f.kind === 'corrida1' || f.kind === 'corrida2') falarTexto('Corrida!');
        else falarTexto('Caminhada!');

        // atualizar barra e iniciar loop de tempo
        atualizarBarraProgresso(0, f.target, f.kind);
        clearInterval(intervaloTreino);
        intervaloTreino = setInterval(loopTempo, 1000);
    } else {
        // distância
        document.getElementById('infoLabel').textContent = 'Distância Percorrida';
        faseDistanciaAcumulada = 0;
        document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;
        if (f.kind === 'corrida1' || f.kind === 'corrida2') falarTexto('Corrida!');
        else falarTexto('Caminhada!');
        // iniciar GPS
        iniciarGPS();
        atualizarBarraProgresso(0, f.target, f.kind);
        clearInterval(intervaloTreino);
        intervaloTreino = setInterval(loopDistancia, 1000);
    }

    atualizarDisplay();
}

/* =========================
   Loops de atualização por modo
   ========================= */
function loopTempo() {
    if (pausado) return;
    if (!treinoAtivo) return;
    if (!fasesDaRepeticao[indiceFase]) return;

    tempoRestante = Math.max(0, tempoRestante - 1);
    document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

    const alvo = fasesDaRepeticao[indiceFase].target;
    const decorrido = alvo - tempoRestante;
    const pct = alvo > 0 ? Math.min(100, Math.round((decorrido / alvo) * 100)) : 100;
    atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);

    if (tempoRestante <= 0) {
        // final da fase
        tocarTroca(); vibrar(260);
        indiceFase++;
        setTimeout(() => iniciarFaseAtual(), 420);
    }
}

function loopDistancia() {
    if (pausado) return;
    if (!treinoAtivo) return;
    if (!fasesDaRepeticao[indiceFase]) return;

    // infoValor já atualizado na callback do GPS
    const alvo = fasesDaRepeticao[indiceFase].target; // em km
    const atual = faseDistanciaAcumulada;
    const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 100;
    atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);

    document.getElementById('infoValor').textContent = `${atual.toFixed(2)} km`;
    if (atual >= alvo) {
        tocarTroca(); vibrar(260);
        indiceFase++;
        setTimeout(() => iniciarFaseAtual(), 420);
    }
}

/* =========================
   Próxima repetição / finalizar
   ========================= */
function proximaRepeticao() {
    if (repeticaoAtual < repeticaoTotal) {
        repeticaoAtual++;
        indiceFase = 0;
        fasesDaRepeticao = construirFasesDaRepeticao();
        document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;

        const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
        falarTexto(textoRep, { onEnd: () => {
            tocarTroca();
            setTimeout(() => iniciarFaseAtual(), 300);
        }});
        atualizarDisplay();
    } else {
        finalizarComSucesso();
    }
}

function finalizarComSucesso() {
    limparTreino();
    document.getElementById('faseAtual').textContent = 'Parabéns!\nMeta concluída!';
    document.getElementById('infoValor').textContent = '🎉';
    setTimeout(() => { tocarFinal(); vibrar(400); }, 0);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 500);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 1000);
    setTimeout(() => falarTexto('Parabéns! Treino concluído!'), 1400);
    enviarNotificacao('🎉 Parabéns!', 'Você concluiu o treino com sucesso!');
    setTimeout(() => showScreen('menuScreen'), 4500);
}

/* =========================
   GPS (distância)
   ========================= */
let ultimaLocalizacao = null;
function iniciarGPS() {
    if (!navigator.geolocation) {
        alert('⚠️ GPS não disponível neste dispositivo');
        return;
    }
    if (watchId) return; // já rodando
    ultimaLocalizacao = null;
    watchId = navigator.geolocation.watchPosition(atualizarLocalizacao, erroGPS, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
    });
}

function atualizarLocalizacao(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    if (ultimaLocalizacao) {
        const d = calcularDistancia(ultimaLocalizacao.lat, ultimaLocalizacao.lon, lat, lon); // km
        // filtrar saltos absurdos (p.ex. >0.5km em 1s)
        if (d >= 0 && d < 1) {
            faseDistanciaAcumulada += d;
        }
    }
    ultimaLocalizacao = { lat, lon };

    // atualizar display imediatamente em distance mode
    if (tipoTreino === 'distancia') {
        document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function erroGPS(error) {
    console.error('Erro GPS:', error);
    document.getElementById('infoExtra').textContent = '⚠️ Erro ao acessar GPS';
}

/* =========================
   Barra de progresso (única por fase)
   ========================= */
function atualizarBarraProgresso(pct, alvo, kind) {
    const barra = document.getElementById('barraProgresso');
    const esquerda = document.getElementById('progressoTextoLeft');
    const direita = document.getElementById('progressoTextoRight');

    if (!barra) return;
    barra.style.width = `${pct}%`;

    // Atualizar cor conforme fase
    const indicador = document.getElementById('indicadorFase');
    if (kind === 'caminhada') indicador.classList.add('caminhada');
    else indicador.classList.remove('caminhada');

    esquerda.textContent = `${pct}%`;
    if (tipoTreino === 'tempo') {
        // ex.: 00:30 / 02:00 -> mostrar tempo decorrido/total
        const alvoText = alvo ? formatTempoSegundos(alvo) : '--:--';
        direita.textContent = alvoText;
    } else {
        // distância
        direita.textContent = alvo ? `${alvo.toFixed(2)} km` : '— km';
    }
}

/* =========================
   Controles: pausar / finalizar / limpar
   ========================= */
function pausarTreino() {
    pausado = !pausado;
    const btn = document.getElementById('btnPausar');
    if (pausado) {
        btn.textContent = 'RETOMAR';
        document.getElementById('faseAtual').textContent = 'PAUSADO';
    } else {
        btn.textContent = 'PAUSAR';
        atualizarDisplay();
    }
}

function finalizarTreino() {
    if (confirm('Deseja realmente finalizar o treino?')) {
        limparTreino();
        showScreen('menuScreen');
    }
}

function limparTreino() {
    treinoAtivo = false;
    pausado = false;
    tipoTreino = '';
    config = {
        tempoCorrida1: 0, tempoCaminhada: 0, tempoCorrida2: 0,
        distCorrida1: 0, distCaminhada: 0, distCorrida2: 0,
        repeticoes: 0
    };
    repeticaoAtual = 0; repeticaoTotal = 0;
    fasesDaRepeticao = []; indiceFase = 0;
    tempoRestante = 0; faseDistanciaAcumulada = 0;

    if (intervaloTreino) { clearInterval(intervaloTreino); intervaloTreino = null; }
    if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    ultimaLocalizacao = null;

    liberarWakeLock();
    pararAudioSilencioso();

    document.getElementById('repeticoesDisplay').textContent = '0 / 0';
    document.getElementById('infoValor').textContent = '';
    document.getElementById('infoLabel').textContent = '';
    document.getElementById('faseAtual').textContent = 'Preparar';
    atualizarBarraProgresso(0, 0, null);
    document.getElementById('infoExtra').textContent = '';
}

/* =========================
   Atualizar indicadores visuais
   ========================= */
function atualizarDisplay() {
    document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
    const faseTxt = (!fasesDaRepeticao.length || !fasesDaRepeticao[indiceFase]) ? 'Preparar' :
        (fasesDaRepeticao[indiceFase].kind === 'caminhada' ? 'Caminhada' :
            (fasesDaRepeticao[indiceFase].kind === 'corrida1' ? 'Corrida' : 'Corrida 2'));
    document.getElementById('faseAtual').textContent = faseTxt;
}

/* =========================
   Service Worker
   ========================= */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('✓ Service Worker registrado'))
            .catch(err => console.log('✗ Erro ao registrar SW:', err));
    });
}

/* =========================
   Inicialização da página
   ========================= */
window.addEventListener('load', () => {
    console.log('Running Trainer iniciado (versão final).');
    carregarPreferenciaVoz();
    carregarVozes();
    setTimeout(carregarVozes, 800);

    // Criar audioContext preventivamente (ajuda em alguns celulares)
    garantirAudioContext();

    // Mostrar modal de permissões (se ainda não ativado) após 1s
    setTimeout(() => {
        if (!permissoesOk) {
            const modal = document.getElementById('permissionModal');
            if (modal) modal.classList.add('active');
        }
    }, 1000);

    // Prevenir zoom pinch no mobile
    document.addEventListener('gesturestart', e => e.preventDefault());
});
