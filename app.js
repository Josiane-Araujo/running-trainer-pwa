// app.js - Running Trainer com Treinos Fixos, Zonas de FC e Melhorias
// Versão Profissional com Wake Lock, Background Sync e Análises

/* =========================
   ESTADO / CONFIG
   ========================= */
let treinoAtivo = false;
let pausado = false;
let tipoTreino = ''; // 'tempo', 'distancia' ou 'fixo'
let config = {
    tempoCorrida1: 0, tempoCaminhada: 0, tempoCorrida2: 0,
    distCorrida1: 0, distCaminhada: 0, distCorrida2: 0,
    repeticoes: 0
};

// Perfil do usuário
let perfil = {
    nome: 'Atleta',
    idade: 30,
    altura: 1.75,
    nivel: 'Iniciante' // Iniciante, Intermediário, Avançado
};

let repeticaoAtual = 0;
let repeticaoTotal = 0;
let fasesDaRepeticao = [];
let indiceFase = 0;

let tempoRestante = 0;
let faseDistanciaAcumulada = 0;
let intervaloTreino = null;
let watchId = null;
let ultimaLocalizacao = null;

// Treino fixo selecionado
let treinoFixoAtual = null;

/* =========================
   AUDIO / VOZ / SONS
   ========================= */
let audioContext = null;
let audioSilenciosoSource = null;
let wakeLock = null;
let permissoesOk = false;

let vozesDisponiveis = [];
let vozSelecionada = null;
let preferenciaTipoVoz = 'auto';

/* =========================
   iOS voices helper
   ========================= */
let voices = [];
let voicesLoaded = false;

function carregarVozesComRetry() {
    return new Promise(resolve => {
        let tent = 0;
        function tentar() {
            vozesDisponiveis = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
            if (vozesDisponiveis.length > 1 || tent >= 10) {
                carregarVozes();
                resolve(vozesDisponiveis);
                return;
            }
            tent++;
            setTimeout(tentar, 200);
        }
        tentar();
    });
}

function carregarVozesIOS(force = false) {
    return new Promise(resolve => {
        let tentativa = 0;
        function tentarCarregar() {
            voices = (typeof speechSynthesis !== 'undefined') ? speechSynthesis.getVoices() : [];
            if (voices.length > 1 || tentativa > 12 || force) {
                voicesLoaded = true;
                resolve(voices);
                return;
            }
            tentativa++;
            setTimeout(tentarCarregar, 200);
        }
        tentarCarregar();
    });
}

function desbloquearVozesIOS() {
    return new Promise(resolve => {
        if (typeof speechSynthesis === 'undefined') { setTimeout(resolve, 100); return; }
        try {
            const u = new SpeechSynthesisUtterance(' ');
            u.volume = 0;
            u.rate = 2.0;
            u.onend = () => setTimeout(resolve, 180);
            speechSynthesis.speak(u);
        } catch (e) {
            setTimeout(resolve, 200);
        }
    });
}

async function inicializarVozesIOS() {
    if (typeof speechSynthesis === 'undefined') return;
    try {
        await desbloquearVozesIOS();
        await carregarVozesComRetry();
        vozesDisponiveis = speechSynthesis.getVoices() || [];
        carregarVozes();
    } catch (e) {
        console.warn('inicializarVozesIOS fallback', e);
    }
}

function carregarVozes() {
    if (typeof speechSynthesis === 'undefined') return;
    vozesDisponiveis = speechSynthesis.getVoices() || [];

    const seletor = document.getElementById('seletorVoz') || document.getElementById('seletorVozMenu');
    if (seletor) preferenciaTipoVoz = seletor.value;

    vozSelecionada = null;

    if (preferenciaTipoVoz === 'feminina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /maria|female|feminina|luciana|brasil/i.test(v.name));
    } else if (preferenciaTipoVoz === 'masculina') {
        vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /daniel|male|masculina/i.test(v.name));
    }

    if (!vozSelecionada) {
        vozSelecionada = vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt') && /google/i.test(v.name))
            || vozesDisponiveis.find(v => v.lang && v.lang.startsWith('pt'))
            || vozesDisponiveis[0] || null;
    }

    console.log('Vozes carregadas:', vozesDisponiveis.length, 'Voz selecionada:', vozSelecionada ? vozSelecionada.name : 'nenhuma');
}

if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => {
        carregarVozes();
    };
}

function garantirAudioContext() {
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('AudioContext não disponível:', e);
            audioContext = null;
        }
    }
}

/* FUNÇÕES DE FALA */
function falarTexto(texto, opcoes = {}) {
    if (typeof speechSynthesis === 'undefined') {
        console.warn('speechSynthesis não disponível');
        return;
    }

    try { speechSynthesis.cancel(); } catch (e) {}

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
            u.onerror = (err) => console.error('Erro TTS:', err);
            speechSynthesis.speak(u);
        } catch (err) {
            console.error('Erro ao falar:', err);
        }
    }, 120);
}

function falarComBeep(texto, beepFreq = 1000) {
    tocarBeep(beepFreq, 0.25);
    setTimeout(() => falarTexto(texto), 360);
}

function testarVozManual() {
    garantirAudioContext();
    if (vozesDisponiveis.length === 0) vozesDisponiveis = speechSynthesis.getVoices() || [];
    if (!vozSelecionada && vozesDisponiveis.length > 0) carregarVozes();

    vibrar(150);
    falarTexto('Três', { onEnd: () => {
        falarTexto('Dois', { onEnd: () => {
            falarTexto('Um', { onEnd: () => {
                falarTexto('Iniciando teste de voz', { pitch: 1.05 });
            }});
        }});
    }});
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

/* SONS (beeps) e vibração */
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
    } catch (e) { console.warn('Erro tocarBeep', e); }
}

function tocarTroca() {
    if (!audioContext) return;
    tocarBeep(600, 0.14);
    setTimeout(() => tocarBeep(900, 0.16), 160);
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
        console.log('WakeLock não disponível:', e);
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
   Preferência voz + sincronizar selects
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
    try { localStorage.setItem('vozPreferida', preferenciaTipoVoz); } catch(e) {}
}

function carregarPreferenciaVoz() {
    try {
        const pref = localStorage.getItem('vozPreferida');
        if (pref) preferenciaTipoVoz = pref;
    } catch(e) {}
}

function sincronizarSeletores() {
    const sm = document.getElementById('seletorVozMenu');
    const sd = document.getElementById('seletorVoz');
    if (sm && sd) {
        sm.value = sd.value;
        sd.value = sm.value;
    }
}

/* =========================
   PERFIL DO USUÁRIO
   ========================= */
function carregarPerfil() {
    try {
        const saved = localStorage.getItem('perfilUsuario');
        if (saved) {
            perfil = JSON.parse(saved);
        }
    } catch(e) {
        console.warn('Erro ao carregar perfil:', e);
    }
}

function salvarPerfil() {
    try {
        localStorage.setItem('perfilUsuario', JSON.stringify(perfil));
    } catch(e) {
        console.warn('Erro ao salvar perfil:', e);
    }
}

function atualizarPerfil(nome, idade, altura, nivel) {
    perfil = { nome, idade: parseInt(idade), altura: parseFloat(altura), nivel };
    salvarPerfil();
    console.log('Perfil atualizado:', perfil);
}

/* =========================
   TREINOS FIXOS - Seleção e Inicialização
   ========================= */
function iniciarTreinoFixo(treinoId, semana, dia) {
    if (!TREINOS_FIXOS[treinoId]) {
        alert('Treino não encontrado');
        return;
    }

    const config = converterTreinoFixo(treinoId, semana, dia);
    if (!config) {
        alert('Semana ou dia não disponível');
        return;
    }

    tipoTreino = 'fixo';
    treinoFixoAtual = config;
    repeticaoTotal = config.repeticoes;
    repeticaoAtual = 1;
    indiceFase = 0;
    fasesDaRepeticao = construirFasesDaTreinoFixo(config.blocos);

    console.log('Treino fixo iniciado:', config.nome);
    console.log('Fases:', fasesDaRepeticao);

    mostrarTreinoFixo(config);
}

function construirFasesDaTreinoFixo(blocos) {
    const fases = [];
    blocos.forEach(bloco => {
        let kind = 'caminhada';
        if (bloco.tipo === 'corrida') {
            // Se for a segunda corrida do bloco (como na semana 5A), usamos corrida2
            kind = (bloco.repeticao === 2 && blocos.length > 2) ? 'corrida2' : 'corrida1';
        }
        
        fases.push({
            kind: kind,
            target: bloco.tempo,
            zona: bloco.zona,
            tipo: bloco.tipo,
            repeticao: bloco.repeticao
        });
    });
    return fases;
}

function mostrarTreinoFixo(config) {
    showScreen('treinoScreen');
    const faseAt = document.getElementById('faseAtual');
    if (faseAt) faseAt.textContent = config.nome;
    
    const repDisplay = document.getElementById('repeticoesDisplay');
    if (repDisplay) repDisplay.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;

    treinoAtivo = true;
    pausado = false;
    permissoesOk = true;

    solicitarWakeLock();
    iniciarAudioSilencioso();
    
    setTimeout(() => iniciarFaseAtual(), 500);
}

/* =========================
   TREINOS PERSONALIZADOS (Tempo/Distância)
   ========================= */
function iniciarTreinoTempo() {
    const tempoCorrida1 = parseInt(document.getElementById('tempoCorrida1').value) || 0;
    const tempoCaminhada = parseInt(document.getElementById('tempoCaminhada').value) || 0;
    const tempoCorrida2 = parseInt(document.getElementById('tempoCorrida2').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoes').value) || 0;

    if (tempoCorrida1 <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha os campos obrigatórios (tempo de corrida e repetições)');
        return;
    }

    tipoTreino = 'tempo';
    config = {
        tempoCorrida1: tempoCorrida1 * 60,
        tempoCaminhada: tempoCaminhada * 60,
        tempoCorrida2: tempoCorrida2 * 60,
        repeticoes
    };

    repeticaoTotal = repeticoes;
    repeticaoAtual = 1;
    indiceFase = 0;
    fasesDaRepeticao = construirFasesDaRepeticao();

    console.log('Treino por tempo iniciado:', config);

    showScreen('treinoScreen');
    treinoAtivo = true;
    pausado = false;
    permissoesOk = true;

    solicitarWakeLock();
    iniciarAudioSilencioso();

    const repDisplay = document.getElementById('repeticoesDisplay');
    if (repDisplay) repDisplay.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;

    setTimeout(() => iniciarFaseAtual(), 500);
}

function iniciarTreinoDistancia() {
    const distCorrida1 = parseFloat(document.getElementById('distCorrida1').value) || 0;
    const distCaminhada = parseFloat(document.getElementById('distCaminhada').value) || 0;
    const distCorrida2 = parseFloat(document.getElementById('distCorrida2').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoesDist').value) || 0;

    if (distCorrida1 <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha os campos obrigatórios (distância de corrida e repetições)');
        return;
    }

    tipoTreino = 'distancia';
    config = {
        distCorrida1,
        distCaminhada,
        distCorrida2,
        repeticoes
    };

    repeticaoTotal = repeticoes;
    repeticaoAtual = 1;
    indiceFase = 0;
    fasesDaRepeticao = construirFasesDaRepeticao();

    console.log('Treino por distância iniciado:', config);

    showScreen('treinoScreen');
    treinoAtivo = true;
    pausado = false;
    permissoesOk = true;

    solicitarWakeLock();
    iniciarAudioSilencioso();

    const repDisplay = document.getElementById('repeticoesDisplay');
    if (repDisplay) repDisplay.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;

    setTimeout(() => iniciarFaseAtual(), 500);
}

function construirFasesDaRepeticao() {
    const fases = [];

    if (tipoTreino === 'tempo') {
        if (config.tempoCorrida1 > 0) fases.push({ kind: 'corrida1', target: config.tempoCorrida1 });
        if (config.tempoCaminhada > 0) fases.push({ kind: 'caminhada', target: config.tempoCaminhada });
        if (config.tempoCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.tempoCorrida2 });
    } else if (tipoTreino === 'distancia') {
        if (config.distCorrida1 > 0) fases.push({ kind: 'corrida1', target: config.distCorrida1 });
        if (config.distCaminhada > 0) fases.push({ kind: 'caminhada', target: config.distCaminhada });
        if (config.distCorrida2 > 0) fases.push({ kind: 'corrida2', target: config.distCorrida2 });
    }

    return fases;
}

/* =========================
   Iniciar fase atual
   ========================= */
function iniciarFaseAtual() {
    console.log('🔵 iniciarFaseAtual() chamada | Rep:', repeticaoAtual, '| Fase:', indiceFase, '| Total fases:', fasesDaRepeticao.length);
    
    if (!treinoAtivo) treinoAtivo = true;

    if (!fasesDaRepeticao || fasesDaRepeticao.length === 0) {
        console.log('⚠️ Reconstruindo fases (array vazio)');
        fasesDaRepeticao = construirFasesDaRepeticao();
    }

    if (indiceFase >= fasesDaRepeticao.length) {
        console.log('✅ Fim das fases da repetição', repeticaoAtual);
        return;
    }

    const f = fasesDaRepeticao[indiceFase];
    faseDistanciaAcumulada = 0;

    if (!f) {
        console.error('❌ Fase indefinida no indice', indiceFase);
        indiceFase++;
        setTimeout(() => iniciarFaseAtual(), 200);
        return;
    }

    console.log('▶️ Iniciando fase:', f.kind, '| Target:', f.target, '| Tipo:', tipoTreino);

    if (intervaloTreino) { 
        console.log('🛑 Limpando intervalo anterior');
        clearInterval(intervaloTreino); 
        intervaloTreino = null; 
    }

    if (tipoTreino === 'tempo' || tipoTreino === 'fixo') {
        tempoRestante = f.target;
        const infoLabel = document.getElementById('infoLabel');
        const infoValor = document.getElementById('infoValor');
        if (infoLabel) infoLabel.textContent = 'Tempo Restante';
        if (infoValor) infoValor.textContent = formatTempoSegundos(tempoRestante);

        // Anunciar fase com repetição e tipo
        let anuncio = '';
        const tempoVoz = formatTempoParaVoz(f.target);
        
        if (tipoTreino === 'fixo') {
            // Para treinos fixos, anunciar repetição apenas no início do ciclo (Corrida 1)
            if (f.kind === 'corrida1') {
                anuncio = `Repetição ${repeticaoAtual}, Corrida, ${tempoVoz}`;
            } else if (f.kind === 'corrida2') {
                anuncio = `Corrida 2, ${tempoVoz}`;
            } else {
                anuncio = `Caminhada, ${tempoVoz}`;
            }
            
            if (f.zona) {
                const zonaInfo = ZONAS_FC[f.zona];
                if (zonaInfo) anuncio += `, Zona ${f.zona}`;
            }
        } else {
            // Para treinos personalizados
            if (indiceFase === 0) {
                anuncio = `Repetição ${repeticaoAtual}, `;
            }
            
            if (f.kind === 'corrida1') anuncio += `Corrida, ${tempoVoz}`;
            else if (f.kind === 'corrida2') anuncio += `Corrida 2, ${tempoVoz}`;
            else anuncio += `Caminhada, ${tempoVoz}`;
        }
        console.log('🎤 Falando:', anuncio);
        falarTexto(anuncio);

        atualizarBarraProgresso(0, f.target, f.kind);
        intervaloTreino = setInterval(loopTempo, 1000);
        console.log('⏱️ Loop de tempo iniciado');
    } else if (tipoTreino === 'distancia') {
        const infoLabel = document.getElementById('infoLabel');
        const infoValor = document.getElementById('infoValor');
        if (infoLabel) infoLabel.textContent = 'Distância Percorrida';
        faseDistanciaAcumulada = 0;
        if (infoValor) infoValor.textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;

        if (f.kind === 'corrida1' || f.kind === 'corrida2') {
            console.log('🎤 Falando: Corrida!');
            falarTexto('Corrida!');
        } else {
            console.log('🎤 Falando: Caminhada!');
            falarTexto('Caminhada!');
        }

        iniciarGPS();
        atualizarBarraProgresso(0, f.target, f.kind);
        intervaloTreino = setInterval(loopDistancia, 1000);
        console.log('📍 Loop de distância iniciado');
    }

    atualizarDisplay();
}

/* =========================
   Loop tempo
   ========================= */
function loopTempo() {
    if (pausado) return;
    if (!treinoAtivo) return;
    if (!fasesDaRepeticao[indiceFase]) {
        console.log('⚠️ loopTempo: fase indefinida, limpando intervalo');
        if (intervaloTreino) {
            clearInterval(intervaloTreino);
            intervaloTreino = null;
        }
        return;
    }

    tempoRestante = Math.max(0, tempoRestante - 1);
    const infoValor = document.getElementById('infoValor');
    if (infoValor) infoValor.textContent = formatTempoSegundos(tempoRestante);

    const alvo = fasesDaRepeticao[indiceFase].target;
    const decorrido = alvo - tempoRestante;
    const pct = alvo > 0 ? Math.min(100, Math.round((decorrido / alvo) * 100)) : 100;
    atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);

    if (tempoRestante <= 0) {
        console.log('⏱️ Fase concluída:', fasesDaRepeticao[indiceFase].kind);
        
        if (intervaloTreino) {
            clearInterval(intervaloTreino);
            intervaloTreino = null;
        }
        
        tocarTroca(); 
        vibrar(260);
        
        indiceFase++;
        console.log('➡️ Avançando para indiceFase:', indiceFase);
        
        setTimeout(() => {
            if (indiceFase < fasesDaRepeticao.length) {
                iniciarFaseAtual();
            } else {
                if (repeticaoAtual < repeticaoTotal) {
                    repeticaoAtual++;
                    indiceFase = 0;
                    if (tipoTreino !== 'fixo') {
                        fasesDaRepeticao = construirFasesDaRepeticao();
                    }
                    const repDisplay = document.getElementById('repeticoesDisplay');
                    if (repDisplay) repDisplay.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
                    
                    if (tipoTreino !== 'fixo') {
                        const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
                        falarTexto(textoRep, { onEnd: () => {
                            setTimeout(() => iniciarFaseAtual(), 300);
                        }});
                    } else {
                        iniciarFaseAtual();
                    }
                } else {
                    finalizarComSucesso();
                }
            }
        }, 420);
    }
}

/* =========================
   Loop distância
   ========================= */
function loopDistancia() {
    if (pausado) return;
    if (!treinoAtivo) return;
    if (!fasesDaRepeticao[indiceFase]) {
        console.log('⚠️ loopDistancia: fase indefinida, limpando intervalo');
        if (intervaloTreino) {
            clearInterval(intervaloTreino);
            intervaloTreino = null;
        }
        return;
    }

    const alvo = fasesDaRepeticao[indiceFase].target;
    const atual = faseDistanciaAcumulada;
    const pct = alvo > 0 ? Math.min(100, Math.round((atual / alvo) * 100)) : 100;
    atualizarBarraProgresso(pct, alvo, fasesDaRepeticao[indiceFase].kind);

    const infoValor = document.getElementById('infoValor');
    if (infoValor) infoValor.textContent = `${atual.toFixed(2)} km`;

    if (atual >= alvo) {
        console.log('📍 Fase de distância concluída:', fasesDaRepeticao[indiceFase].kind);
        
        if (intervaloTreino) {
            clearInterval(intervaloTreino);
            intervaloTreino = null;
        }
        
        tocarTroca(); 
        vibrar(260);
        
        indiceFase++;
        
        setTimeout(() => {
            if (indiceFase < fasesDaRepeticao.length) {
                iniciarFaseAtual();
            } else {
                if (repeticaoAtual < repeticaoTotal) {
                    repeticaoAtual++;
                    indiceFase = 0;
                    if (tipoTreino !== 'fixo') {
                        fasesDaRepeticao = construirFasesDaRepeticao();
                    }
                    const repDisplay = document.getElementById('repeticoesDisplay');
                    if (repDisplay) repDisplay.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
                    
                    if (tipoTreino !== 'fixo') {
                        const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
                        falarTexto(textoRep, { onEnd: () => {
                            setTimeout(() => iniciarFaseAtual(), 300);
                        }});
                    } else {
                        iniciarFaseAtual();
                    }
                } else {
                    finalizarComSucesso();
                }
            }
        }, 420);
    }
}

/* =========================
   Finalizar com sucesso
   ========================= */
function finalizarComSucesso() {
    limparTreino();
    const faseAt = document.getElementById('faseAtual');
    if (faseAt) faseAt.textContent = 'Parabéns!\nTreino concluído!';
    const infoVal = document.getElementById('infoValor');
    if (infoVal) infoVal.textContent = '🎉';
    setTimeout(() => { tocarFinal(); vibrar(400); }, 0);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 500);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 1000);
    setTimeout(() => { falarTexto('Parabéns! Treino concluído!'); }, 1400);
    enviarNotificacao('🎉 Parabéns!', 'Você concluiu o treino com sucesso!');
    setTimeout(() => showScreen('menuScreen'), 4500);
}

/* =========================
   GPS (distância)
   ========================= */
function iniciarGPS() {
    if (!navigator.geolocation) {
        alert('⚠️ GPS não disponível neste dispositivo');
        return;
    }
    if (watchId) return;
    ultimaLocalizacao = null;
    watchId = navigator.geolocation.watchPosition(atualizarLocalizacao, erroGPS, {
        enableHighAccuracy: true, maximumAge: 0, timeout: 10000
    });
}

function atualizarLocalizacao(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    if (ultimaLocalizacao) {
        const d = calcularDistancia(ultimaLocalizacao.lat, ultimaLocalizacao.lon, lat, lon);
        if (d >= 0 && d < 1) {
            faseDistanciaAcumulada += d;
        }
    }
    ultimaLocalizacao = { lat, lon };

    if (tipoTreino === 'distancia') {
        const infoValor = document.getElementById('infoValor');
        if (infoValor) infoValor.textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;
    }
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371;
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
    const infoExtra = document.getElementById('infoExtra');
    if (infoExtra) infoExtra.textContent = '⚠️ Erro ao acessar GPS';
}

/* =========================
   Barra de progresso
   ========================= */
function atualizarBarraProgresso(pct, alvo, kind) {
    const barra = document.getElementById('barraProgresso');
    const left = document.getElementById('progressoTextoLeft');
    const right = document.getElementById('progressoTextoRight');
    const indicador = document.getElementById('indicadorFase');

    if (barra) barra.style.width = pct + '%';
    if (left) left.textContent = pct + '%';
    if (right) right.textContent = alvo > 0 ? (tipoTreino === 'tempo' || tipoTreino === 'fixo' ? formatTempoSegundos(alvo) : alvo.toFixed(2) + ' km') : 'Meta';

    if (indicador) {
        indicador.classList.remove('caminhada');
        if (kind === 'caminhada') {
            indicador.classList.add('caminhada');
        }
    }
}

/* =========================
   CONTROLES: pausar, finalizar, limpar
   ========================= */
function pausarTreino() {
    pausado = !pausado;
    const btn = document.getElementById('btnPausar');
    if (pausado) {
        if (btn) btn.textContent = 'RETOMAR';
        const faseAt = document.getElementById('faseAtual');
        if (faseAt) faseAt.textContent = 'PAUSADO';
    } else {
        if (btn) btn.textContent = 'PAUSAR';
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

    const repDisp = document.getElementById('repeticoesDisplay');
    if (repDisp) repDisp.textContent = '0 / 0';
    const infoVal = document.getElementById('infoValor');
    if (infoVal) infoVal.textContent = '';
    const infoLbl = document.getElementById('infoLabel');
    if (infoLbl) infoLbl.textContent = '';
    const faseAt = document.getElementById('faseAtual');
    if (faseAt) faseAt.textContent = 'Preparar';
    atualizarBarraProgresso(0, 0, null);
    const infoExtra = document.getElementById('infoExtra');
    if (infoExtra) infoExtra.textContent = '';
}

/* =========================
   UI atualizações
   ========================= */
function atualizarDisplay() {
    const repDisp = document.getElementById('repeticoesDisplay');
    if (repDisp) repDisp.textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
    
    let faseTxt = 'Preparar';
    if (fasesDaRepeticao.length > 0 && fasesDaRepeticao[indiceFase]) {
        const f = fasesDaRepeticao[indiceFase];
        if (f.kind === 'caminhada') faseTxt = 'Caminhada';
        else if (f.kind === 'corrida1') faseTxt = 'Corrida';
        else if (f.kind === 'corrida2') faseTxt = 'Corrida 2';
        else faseTxt = 'Corrida'; // fallback para corrida_zona ou outros
    }
    
    const faseAt = document.getElementById('faseAtual');
    if (faseAt) faseAt.textContent = faseTxt;
}

/* =========================
   HELPERS utilitarios
   ========================= */
function formatTempoSegundos(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatTempoParaVoz(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    let texto = "";
    if (m > 0) texto += `${m} minuto${m > 1 ? 's' : ''}`;
    if (s > 0) texto += `${m > 0 ? ' e ' : ''}${s} segundo${s > 1 ? 's' : ''}`;
    return texto || "0 segundos";
}

function numeroParaOrdinalExtenso(num) {
    const ordinais = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima'];
    return ordinais[num] || num + 'ª';
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

/* =========================
   Notificações
   ========================= */
async function solicitarPermissaoNotificacoes() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'default') {
        const p = await Notification.requestPermission();
        return p === 'granted';
    }
    return Notification.permission === 'granted';
}

function enviarNotificacao(titulo, mensagem) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(titulo, { body: mensagem, icon: 'icon.png', tag: 'running-trainer' });
    }
}

/* =========================
   ANÁLISES - Frequência Cardíaca e Cadência
   ========================= */
function abrirAnaliseFC() {
    const zonas = calcularZonasFC(perfil.idade);
    let html = `<h3>❤️ Frequência Cardíaca - Idade ${perfil.idade}</h3>`;
    html += `<p><strong>FC Máxima Estimada:</strong> ${zonas.Z1.min_bpm + Math.round((zonas.Z5.max_bpm - zonas.Z1.min_bpm) / 4)} bpm</p>`;
    html += `<div style="text-align: left; margin: 15px 0;">`;
    
    Object.keys(zonas).forEach(zona => {
        const info = zonas[zona];
        html += `<div style="background: ${info.cor}20; border-left: 4px solid ${info.cor}; padding: 10px; margin: 8px 0; border-radius: 5px;">`;
        html += `<strong>${zona} - ${info.nome}:</strong> ${info.min_bpm} - ${info.max_bpm} bpm<br>`;
        html += `<small>${info.descricao}</small>`;
        html += `</div>`;
    });
    
    html += `</div>`;
    html += `<p style="font-size: 12px; color: #999;">Fórmula: FC máx = 220 - idade</p>`;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.cssText = 'position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 3000;';
    modal.innerHTML = `<div style="background: #1a1a2e; padding: 20px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; color: #eee;">${html}<button onclick="this.parentElement.parentElement.remove()" style="width: 100%; padding: 10px; margin-top: 15px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Fechar</button></div>`;
    document.body.appendChild(modal);
}

function abrirAnaliseCadencia() {
    const cadencia = obterCadenciaIdeal(perfil.nivel, 'Z2');
    let html = `<h3>🏃 Análise de Cadência</h3>`;
    html += `<p><strong>Nível:</strong> ${perfil.nivel}</p>`;
    html += `<p><strong>Altura:</strong> ${perfil.altura}m</p>`;
    html += `<div style="text-align: left; margin: 15px 0;">`;
    
    const niveis = ['Iniciante', 'Intermediário', 'Avançado'];
    niveis.forEach(nivel => {
        const cad = CADENCIA_IDEAL[nivel];
        html += `<div style="background: rgba(255,255,255,0.05); padding: 10px; margin: 8px 0; border-radius: 5px;">`;
        html += `<strong>${nivel}:</strong><br>`;
        Object.keys(cad).forEach(zona => {
            const info = cad[zona];
            html += `${zona}: ${info.min} - ${info.max} ppm (ideal: ${info.ppm})<br>`;
        });
        html += `</div>`;
    });
    
    html += `</div>`;
    html += `<p style="font-size: 12px; color: #999;">Cadência = passos por minuto. Mantenha um ritmo constante!</p>`;
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.style.cssText = 'position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 3000;';
    modal.innerHTML = `<div style="background: #1a1a2e; padding: 20px; border-radius: 12px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; color: #eee;">${html}<button onclick="this.parentElement.parentElement.remove()" style="width: 100%; padding: 10px; margin-top: 15px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">Fechar</button></div>`;
    document.body.appendChild(modal);
}

/* =========================
   Inicialização da app
   ========================= */
window.addEventListener('load', async () => {
    console.log('Running Trainer iniciado (versão profissional).');

    carregarPerfil();
    carregarPreferenciaVoz();
    garantirAudioContext();

    if (typeof speechSynthesis !== 'undefined') {
        try {
            await inicializarVozesIOS();
        } catch (e) {
            console.warn('inicializarVozesIOS falhou', e);
        }
    }

    setTimeout(carregarVozes, 800);
    garantirAudioContext();

    setTimeout(() => {
        if (!permissoesOk) {
            const modal = document.getElementById('permissionModal');
            if (modal) modal.classList.add('active');
        }
    }, 900);

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('✓ Service Worker registrado'))
            .catch(err => console.log('✗ Erro ao registrar SW:', err));
    }

    document.addEventListener('gesturestart', e => e.preventDefault());
});

/* =========================
   Expor funções globais
   ========================= */
window.showScreen = showScreen;
window.atualizarVoz = atualizarVoz;
window.sincronizarSeletores = sincronizarSeletores;
window.testarVozManual = testarVozManual;
window.testarVozSelecionada = testarVozSelecionada;
window.iniciarTreinoTempo = iniciarTreinoTempo;
window.iniciarTreinoDistancia = iniciarTreinoDistancia;
window.iniciarTreinoFixo = iniciarTreinoFixo;
window.pausarTreino = pausarTreino;
window.finalizarTreino = finalizarTreino;
window.abrirAnaliseFC = abrirAnaliseFC;
window.abrirAnaliseCadencia = abrirAnaliseCadencia;
window.atualizarPerfil = atualizarPerfil;
window.carregarPerfil = carregarPerfil;

window.requestPermissions = () => {
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
};

function ativarVozComInteracao() {
    garantirAudioContext();
    try {
        const u = new SpeechSynthesisUtterance('.');
        u.volume = 0.01; u.rate = 2.0;
        u.onend = () => { setTimeout(() => falarTexto('Running Trainer configurado! Pronto para treinar!'), 300); };
        speechSynthesis.speak(u);
    } catch (e) { console.warn('ativarVozComInteracao falhou', e); }
}