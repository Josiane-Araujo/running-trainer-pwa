// app.js - Running Trainer (atualizado)
// Estado do Aplicativo
let treinoAtivo = false;
let pausado = false;
let tipoTreino = ''; // 'tempo' | 'distancia'
let fase = null; // objeto { kind: 'corrida1'|'caminhada'|'corrida2', target: number (s ou km) }
let intervaloTreino = null;
let watchId = null;

// Configurações do treino (novas chaves para 1º e 2º corrida)
let config = {
    // tempo (em segundos)
    tempoCorrida1: 0,
    tempoCaminhada: 0,
    tempoCorrida2: 0,
    // distância (em km)
    distCorrida1: 0,
    distCaminhada: 0,
    distCorrida2: 0,
    // repeticoes
    repeticoes: 0
};

// Estado dinâmico de repetição/fase
let repeticaoAtual = 0;
let repeticaoTotal = 0;
let fasesDaRepeticao = []; // array de fases para a repetição atual
let indiceFase = 0;
let tempoRestante = 0; // em segundos - usado no modo tempo
let faseDistanciaAcumulada = 0; // em km - usado no modo distancia

// GPS
let ultimaLocalizacao = null;

// Audio Context para sons
let audioContext = null;
let permissoesOk = false;

// Wake Lock para manter tela ligada
let wakeLock = null;

// Audio silencioso para manter app ativo em background
let audioSilenciosoSource = null;

// Voz Sintetizada
let vozSelecionada = null;
let vozesDisponiveis = [];
let preferenciaTipoVoz = 'auto'; // 'auto', 'feminina', 'masculina'

// ========================================
// UTILITÁRIOS DE UI
// ========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(screenId);
    if (el) el.classList.add('active');
}

function formatTempoSegundos(segundos) {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function ordinal(num) {
    // Retorna "1ª", "2ª", "3ª", "4ª" - simplificação (feminino "repetição")
    return `${num}ª`;
}

// ========================================
// VOZ & SONS (mantive as funções originais, organizadas)
// ========================================

function carregarVozes() {
    vozesDisponiveis = speechSynthesis.getVoices();
    if (vozesDisponiveis.length === 0) return; // será chamado novamente via onvoiceschanged

    // obter preferência atual do select (se existir)
    const seletor = document.getElementById('seletorVoz') || document.getElementById('seletorVozMenu');
    if (seletor) preferenciaTipoVoz = seletor.value;

    vozSelecionada = null;

    if (preferenciaTipoVoz === 'feminina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('maria'))
            || vozesDisponiveis.find(v => v.lang === 'pt-BR' && /female|feminina|luciana|brasil/i.test(v.name));
    } else if (preferenciaTipoVoz === 'masculina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('daniel'))
            || vozesDisponiveis.find(v => v.lang === 'pt-BR' && /male|masculina/i.test(v.name));
    }

    if (!vozSelecionada) {
        vozSelecionada = vozesDisponiveis.find(v => v.lang === 'pt-BR' && v.name.toLowerCase().includes('google'))
            || vozesDisponiveis.find(v => v.lang === 'pt-BR')
            || vozesDisponiveis[0];
    }

    console.log('Voz selecionada:', vozSelecionada ? vozSelecionada.name : 'nenhuma');
}

if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = carregarVozes;
    carregarVozes();
}

function falarTexto(texto, opcoes = {}) {
    if (typeof speechSynthesis === 'undefined') {
        console.error('speechSynthesis não disponível');
        return;
    }

    speechSynthesis.cancel();

    if (vozesDisponiveis.length === 0) {
        vozesDisponiveis = speechSynthesis.getVoices();
        carregarVozes();
    }
    if (!vozSelecionada && vozesDisponiveis.length > 0) carregarVozes();

    setTimeout(() => {
        const u = new SpeechSynthesisUtterance(texto);
        if (vozSelecionada) u.voice = vozSelecionada;
        u.lang = 'pt-BR';
        u.volume = opcoes.volume !== undefined ? opcoes.volume : 1.0;
        u.rate = opcoes.rate !== undefined ? opcoes.rate : 0.95;
        u.pitch = opcoes.pitch !== undefined ? opcoes.pitch : 1.0;
        u.onend = () => { if (opcoes.onEnd) opcoes.onEnd(); };
        u.onerror = (e) => console.error('Erro synth:', e);
        speechSynthesis.speak(u);
    }, 150);
}

function tocarBeep(f = 800, d = 0.25) {
    if (!audioContext) return;
    const osc = audioContext.createOscillator();
    const g = audioContext.createGain();
    osc.connect(g);
    g.connect(audioContext.destination);
    osc.frequency.value = f;
    osc.type = 'sine';
    g.gain.setValueAtTime(0.3, audioContext.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + d);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + d);
}

function tocarTroca() {
    if (!audioContext) return;
    tocarBeep(600, 0.18);
    setTimeout(() => tocarBeep(900, 0.2), 180);
}

function tocarFinal() {
    if (!audioContext) return;
    tocarBeep(523, 0.15);
    setTimeout(() => tocarBeep(659, 0.15), 200);
    setTimeout(() => tocarBeep(784, 0.22), 420);
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

// ========================================
// WAKE LOCK & AUDIO SILENCIOSO
// ========================================
async function solicitarWakeLock() {
    if (!('wakeLock' in navigator)) {
        console.log('Wake Lock não suportado');
        return;
    }
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                try { wakeLock = await navigator.wakeLock.request('screen'); } catch(e) { /* ignore */ }
            }
        });
    } catch(e) {
        console.log('Falha wakeLock', e);
    }
}
function liberarWakeLock() {
    if (wakeLock) {
        try { wakeLock.release().then(() => { wakeLock = null; }); } catch(e){ wakeLock = null; }
    }
}

function iniciarAudioSilencioso() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    try {
        audioSilenciosoSource = audioContext.createOscillator();
        const g = audioContext.createGain();
        audioSilenciosoSource.connect(g);
        g.connect(audioContext.destination);
        g.gain.value = 0.0005;
        audioSilenciosoSource.frequency.value = 20;
        audioSilenciosoSource.start();
    } catch(e) { console.log('erro iniciar audio silencioso', e); }
}
function pararAudioSilencioso() {
    if (audioSilenciosoSource) {
        try { audioSilenciosoSource.stop(); } catch(e) {}
        audioSilenciosoSource = null;
    }
}

// ========================================
// PREFERÊNCIA VOZ / INTERAÇÃO PARA iOS
// ========================================
function atualizarVoz() {
    const seletorMenu = document.getElementById('seletorVozMenu');
    const seletorModal = document.getElementById('seletorVoz');
    if (seletorMenu && seletorModal) {
        preferenciaTipoVoz = seletorMenu.value;
        seletorModal.value = preferenciaTipoVoz;
    } else if (seletorMenu) preferenciaTipoVoz = seletorMenu.value;
    else if (seletorModal) preferenciaTipoVoz = seletorModal.value;

    vozSelecionada = null;
    carregarVozes();
    try { localStorage.setItem('vozPreferida', preferenciaTipoVoz); } catch(e){}
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

function ativarVozComInteracao() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (vozesDisponiveis.length === 0) vozesDisponiveis = speechSynthesis.getVoices();
    try {
        const u = new SpeechSynthesisUtterance('.');
        u.volume = 0.01; u.rate = 2.0;
        u.onend = () => { setTimeout(() => falarTexto('Running Trainer configurado! Pronto para treinar!'), 400); };
        speechSynthesis.speak(u);
    } catch(e) { console.error(e); }
}

async function solicitarPermissaoNotificacoes() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') {
        const p = await Notification.requestPermission();
        return p === 'granted';
    }
    return Notification.permission === 'granted';
}

function requestPermissions() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

// ========================================
// INICIAR TREINO - coletas de inputs atualizadas
// ========================================
function iniciarTreinoTempo() {
    const t1 = parseFloat(document.getElementById('tempoCorrida1').value) || 0;
    const tc = parseFloat(document.getElementById('tempoCaminhada').value) || 0;
    const t2 = parseFloat(document.getElementById('tempoCorrida2').value) || 0;
    const reps = parseInt(document.getElementById('repeticoes').value) || 0;

    if (t1 <= 0 || reps <= 0) {
        alert('⚠️ Preencha o 1º tempo de corrida e o número de repetições!');
        return;
    }
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }

    tipoTreino = 'tempo';
    config.tempoCorrida1 = Math.round(t1 * 60);
    config.tempoCaminhada = Math.round(tc * 60);
    config.tempoCorrida2 = Math.round(t2 * 60);
    config.repeticoes = reps;

    showScreen('treinoScreen');
    iniciarContagemRegressiva();
}

function iniciarTreinoDistancia() {
    const d1 = parseFloat(document.getElementById('distCorrida1').value) || 0;
    const dc = parseFloat(document.getElementById('distCaminhada').value) || 0;
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
    config.distCaminhada = dc;
    config.distCorrida2 = d2;
    config.repeticoes = reps;

    showScreen('treinoScreen');
    iniciarContagemRegressiva();
}

// ========================================
// CONTAGEM REGRESSIVA (3..2..1..VAI)
// ========================================
function iniciarContagemRegressiva() {
    let contador = 3;
    document.getElementById('faseAtual').textContent = contador;
    document.getElementById('infoValor').textContent = '';
    document.getElementById('repeticoesDisplay').textContent = '';

    tocarBeep(); vibrar(200); falarTexto('3');

    const intervalo = setInterval(() => {
        contador--;
        if (contador > 0) {
            document.getElementById('faseAtual').textContent = contador;
            tocarBeep(); vibrar(200); falarTexto(String(contador));
        } else if (contador === 0) {
            document.getElementById('faseAtual').textContent = 'VAI!';
            tocarBeep(1000, 0.45); vibrar(400);
            falarTexto('VAI!', { pitch: 1.2 });
        } else {
            clearInterval(intervalo);
            setTimeout(() => iniciarTreinoReal(), 900);
        }
    }, 1000);
}

// ========================================
// Montar fases da repetição dependendo da config
// ========================================
function construirFasesDaRepeticao() {
    const fases = [];
    // Corrida 1 - sempre presente
    if (tipoTreino === 'tempo') {
        fases.push({ kind: 'corrida1', target: config.tempoCorrida1 }); // segundos
        if (config.tempoCaminhada > 0) fases.push({ kind: 'caminhada', target: config.tempoCaminhada });
        if (config.tempoCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.tempoCorrida2 });
    } else {
        fases.push({ kind: 'corrida1', target: config.distCorrida1 }); // km
        if (config.distCaminhada > 0) fases.push({ kind: 'caminhada', target: config.distCaminhada });
        if (config.distCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.distCorrida2 });
    }
    return fases;
}

// ========================================
// INÍCIO DO TREINO REAL
// ========================================
function iniciarTreinoReal() {
    treinoAtivo = true;
    pausado = false;
    repeticaoAtual = 1;
    repeticaoTotal = config.repeticoes;
    fasesDaRepeticao = construirFasesDaRepeticao();
    indiceFase = 0;

    // Ativar WakeLock e áudio silencioso
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    solicitarWakeLock();
    if (!audioSilenciosoSource) iniciarAudioSilencioso();

    atualizarDisplay();

    // Anunciar repetição antes de começar (Opção A)
    anunciarRepeticaoEIniciarFase();
}

function anunciarRepeticaoEIniciarFase() {
    // Anuncia "1ª repetição" (ou 2ª, 3ª...) ANTES de falar "CORRIDA!" e iniciar
    const ord = ordinal(repeticaoAtual);
    falarTexto(`${ord} repetição`, { onEnd: () => {
        // Após anunciar repetição, anunciar fase inicial (CORRIDA!) e iniciar primeiro fase
        iniciarFaseAtual();
    }});
}

// função que começa a fase atual de fasesDaRepeticao[indiceFase]
function iniciarFaseAtual() {
    if (!treinoAtivo) return;

    if (indiceFase >= fasesDaRepeticao.length) {
        // acabou as fases desta repetição
        proximaRepeticao();
        return;
    }

    const f = fasesDaRepeticao[indiceFase];
    fase = f;
    faseDistanciaAcumulada = 0;

    // Atualizar label e iniciar lógica dependendo do tipo de treino
    if (tipoTreino === 'tempo') {
        tempoRestante = f.target;
        document.getElementById('infoLabel').textContent = 'Tempo Restante';
        document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);
        // anunciar fase (apenas uma vez)
        if (f.kind === 'corrida1' || f.kind === 'corrida2') {
            falarTexto('CORRIDA!');
        } else if (f.kind === 'caminhada') {
            falarTexto('CAMINHADA!');
        }
        // iniciar intervalo de 1s para decrementar
        clearInterval(intervaloTreino);
        intervaloTreino = setInterval(updateLoopTempo, 1000);
    } else {
        // Distância
        document.getElementById('infoLabel').textContent = 'Distância Percorrida';
        document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;
        // anunciar fase
        if (f.kind === 'corrida1' || f.kind === 'corrida2') falarTexto('CORRIDA!');
        else falarTexto('CAMINHADA!');
        // iniciar GPS se ainda não
        iniciarGPS();
        // iniciar intervalo para checar (1s)
        clearInterval(intervaloTreino);
        intervaloTreino = setInterval(updateLoopDistancia, 1000);
    }

    atualizarDisplay();
}

function updateLoopTempo() {
    if (pausado) return;
    if (!fase) return;

    tempoRestante = Math.max(0, tempoRestante - 1);
    document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

    if (tempoRestante <= 0) {
        // Fim da fase atual
        tocarTroca(); vibrar(300);
        // se houver fala de troca (CAMINHADA/CORRIDA) será feita ao iniciarFaseAtual
        indiceFase++;
        // iniciar próxima fase após pequeno delay para beep
        setTimeout(() => iniciarFaseAtual(), 450);
    }
}

function updateLoopDistancia() {
    if (pausado) return;
    if (!fase) return;

    document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;

    const alvo = fase.target; // em km
    if (faseDistanciaAcumulada >= alvo) {
        tocarTroca(); vibrar(300);
        indiceFase++;
        setTimeout(() => iniciarFaseAtual(), 450);
    }
}

// ========================================
// PROXIMA REPETIÇÃO / FINALIZAÇÃO
// ========================================
function proximaRepeticao() {
    if (repeticaoAtual < repeticaoTotal) {
        repeticaoAtual++;
        indiceFase = 0;
        fasesDaRepeticao = construirFasesDaRepeticao();
        // anunciar repetição (Opção A) e iniciar fase 0
        falarTexto(`${ordinal(repeticaoAtual)} repetição`, { onEnd: () => {
            // beep e iniciar
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
    setTimeout(() => {
        falarTexto('PARABÉNS! TREINO CONCLUÍDO!', { pitch: 1.2, rate: 0.9 });
    }, 1500);
    enviarNotificacao('🎉 Parabéns!', 'Você concluiu o treino com sucesso!');
    setTimeout(() => showScreen('menuScreen'), 6000);
}

// ========================================
// GPS (DISTÂNCIA) - acumulador por fase
// ========================================
function iniciarGPS() {
    if (!navigator.geolocation) {
        alert('⚠️ GPS não disponível');
        return;
    }
    if (watchId) return; // já ativo
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
        faseDistanciaAcumulada += d;
    }
    ultimaLocalizacao = { lat, lon };
    // atualizar display (já é feito no loop)
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

// ========================================
// CONTROLES (PAUSAR, FINALIZAR, LIMPAR)
// ========================================
function pausarTreino() {
    pausado = !pausado;
    const btn = document.getElementById('btnPausar');
    if (pausado) {
        btn.textContent = 'RETOMAR';
        document.getElementById('faseAtual').textContent = 'PAUSADO';
        // pause speechSynth? não necessário
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
    fase = null;
    repeticaoAtual = 0;
    repeticaoTotal = 0;
    fasesDaRepeticao = [];
    indiceFase = 0;
    tempoRestante = 0;
    faseDistanciaAcumulada = 0;

    if (intervaloTreino) { clearInterval(intervaloTreino); intervaloTreino = null; }
    if (watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    ultimaLocalizacao = null;

    liberarWakeLock();
    pararAudioSilencioso();
    // limpar UI
    document.getElementById('repeticoesDisplay').textContent = '0 / 0';
    document.getElementById('infoValor').textContent = '';
    document.getElementById('infoLabel').textContent = '';
    document.getElementById('faseAtual').textContent = 'Preparar';
    document.getElementById('infoExtra').textContent = '';
}

// Atualiza indicadores visuais
function atualizarDisplay() {
    document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
    const faseTxt = (!fase) ? 'Preparar' : (fase.kind === 'caminhada' ? 'Caminhada' : (fase.kind === 'corrida1' ? 'Corrida' : 'Corrida 2'));
    document.getElementById('faseAtual').textContent = faseTxt;
    const indicador = document.getElementById('indicadorFase');
    if (fase && fase.kind === 'caminhada') indicador.classList.add('caminhada');
    else if (indicador) indicador.classList.remove('caminhada');
}

// ========================================
// SERVICE WORKER
// ========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('✓ Service Worker registrado'))
            .catch(err => console.log('✗ Erro ao registrar SW:', err));
    });
}

// ========================================
// INICIALIZAÇÃO
// ========================================
window.addEventListener('load', () => {
    console.log('🏃 Running Trainer PWA - versão atualizada iniciada');

    carregarPreferenciaVoz();
    carregarVozes();
    setTimeout(carregarVozes, 1000);

    // criar AudioContext antecipadamente (necessário em alguns dispositivos)
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Prevenir zoom (tocar só se precisar)
    document.addEventListener('gesturestart', e => e.preventDefault());

    // Mostrar modal de permissões após 1s
    setTimeout(() => {
        if (!permissoesOk) {
            document.getElementById('permissionModal').classList.add('active');
        }
    }, 1000);
});
