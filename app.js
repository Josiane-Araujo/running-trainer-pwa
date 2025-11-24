// Estado do Aplicativo
let treinoAtivo = false;
let pausado = false;
let tipoTreino = '';
let tempoRestante = 0;
let repeticaoAtual = 0;
let repeticaoTotal = 0;
let fase = 'corrida';
let intervaloTreino = null;
let watchId = null;

// Configurações do treino
let config = {
    tempoCorrida: 0,
    tempoCaminhada: 0,
    distCorrida: 0,
    distCaminhada: 0,
    repeticoes: 0
};

// GPS
let distanciaPercorrida = 0;
let ultimaLocalizacao = null;

// Audio Context para sons
let audioContext = null;
let permissoesOk = false;

// Wake Lock para manter tela ligada
let wakeLock = null;

// Audio silencioso para manter app ativo em background
let audioSilencioso = null;
let audioSilenciosoSource = null;

// Voz Sintetizada
let vozSelecionada = null;
let vozesDisponiveis = [];

// ========================================
// FUNÇÕES DE NAVEGAÇÃO
// ========================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// Função para testar voz manualmente
function testarVozManual() {
    console.log('🎤 Teste manual de voz iniciado');
    
    // Garantir que vozes estão carregadas
    if (vozesDisponiveis.length === 0) {
        vozesDisponiveis = speechSynthesis.getVoices();
    }
    
    // Vibrar para feedback
    vibrar(200);
    
    // Testar sequência SEM BEEPS (só voz)
    falarTexto('3', { volume: 1.0, rate: 1.0, pitch: 1.0, onEnd: () => {
        setTimeout(() => {
            falarTexto('2', { volume: 1.0, rate: 1.0, pitch: 1.0, onEnd: () => {
                setTimeout(() => {
                    falarTexto('1', { volume: 1.0, rate: 1.0, pitch: 1.0, onEnd: () => {
                        setTimeout(() => {
                            falarTexto('VAI!', { volume: 1.0, rate: 1.0, pitch: 1.2, onEnd: () => {
                                setTimeout(() => {
                                    falarTexto('CORRIDA!', { volume: 1.0, rate: 0.95, pitch: 1.1, onEnd: () => {
                                        setTimeout(() => {
                                            falarTexto('CAMINHADA!', { volume: 1.0, rate: 0.95, pitch: 1.1, onEnd: () => {
                                                setTimeout(() => {
                                                    falarTexto('PARABÉNS! Voz funcionando perfeitamente!', { volume: 1.0, rate: 0.9, pitch: 1.1 });
                                                }, 1500);
                                            }});
                                        }, 1500);
                                    }});
                                }, 800);
                            }});
                        }, 1000);
                    }});
                }, 1000);
            }});
        }, 1000);
    }});
}

// ========================================
// PERMISSÕES
// ========================================

function requestPermissions() {
    // Criar AudioContext para sons
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Carregar vozes para síntese de fala
    carregarVozes();
    
    // IMPORTANTE: Ativar voz com interação do usuário (iOS exige isso)
    ativarVozComInteracao();
    
    // Solicitar permissão para notificações
    solicitarPermissaoNotificacoes();
    
    // Solicitar Wake Lock
    solicitarWakeLock();
    
    // Iniciar áudio silencioso para manter app ativo
    iniciarAudioSilencioso();
    
    permissoesOk = true;
    document.getElementById('permissionModal').classList.remove('active');
    
    // Testar vibração
    if ('vibrate' in navigator) {
        navigator.vibrate(200);
    }
}

// Função para ativar voz com interação do usuário
function ativarVozComInteracao() {
    console.log('🎤 Ativando voz com interação do usuário...');
    
    // Carregar vozes se ainda não carregou
    if (vozesDisponiveis.length === 0) {
        vozesDisponiveis = speechSynthesis.getVoices();
    }
    
    // Tentar falar algo muito curto para "desbloquear" a voz no iOS
    try {
        const utterance = new SpeechSynthesisUtterance('.');
        utterance.volume = 0.01; // Quase mudo
        utterance.rate = 2.0; // Muito rápido
        
        utterance.onend = () => {
            console.log('✓ Voz ativada com sucesso!');
            // Agora falar a mensagem real
            setTimeout(() => {
                falarTexto('Running Trainer configurado! Pronto para treinar!');
            }, 500);
        };
        
        utterance.onerror = (error) => {
            console.error('❌ Erro ao ativar voz:', error);
            // Tentar novamente de forma mais direta
            setTimeout(() => {
                falarTexto('Pronto!');
            }, 1000);
        };
        
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('❌ Exceção ao ativar voz:', error);
    }
}

// ========================================
// SONS
// ========================================

function tocarBeep(frequencia = 800, duracao = 0.3) {
    if (!audioContext) return;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequencia;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracao);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duracao);
}

function tocarTroca() {
    if (!audioContext) return;
    tocarBeep(600, 0.2);
    setTimeout(() => tocarBeep(800, 0.3), 200);
}

function tocarFinal() {
    if (!audioContext) return;
    tocarBeep(523, 0.2);
    setTimeout(() => tocarBeep(659, 0.2), 250);
    setTimeout(() => tocarBeep(784, 0.3), 500);
}

function vibrar(duracao = 200) {
    if ('vibrate' in navigator) {
        navigator.vibrate(duracao);
    }
}

// Enviar notificação (faz smartwatch vibrar!)
function enviarNotificacao(titulo, mensagem, icone = '🏃') {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
        new Notification(titulo, {
            body: mensagem,
            icon: 'icon-192.png',
            badge: 'icon-72.png',
            vibrate: [200, 100, 200],
            tag: 'running-trainer',
            requireInteraction: false
        });
    }
}

// Solicitar permissão para notificações
async function solicitarPermissaoNotificacoes() {
    if (!('Notification' in window)) {
        console.log('Notificações não suportadas');
        return false;
    }
    
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return Notification.permission === 'granted';
}

// ========================================
// VOZ SINTETIZADA
// ========================================

function carregarVozes() {
    // Carregar vozes disponíveis
    vozesDisponiveis = speechSynthesis.getVoices();
    
    console.log(`📢 Total de vozes disponíveis: ${vozesDisponiveis.length}`);
    
    if (vozesDisponiveis.length === 0) {
        console.log('⚠️ Nenhuma voz carregada ainda, tentando novamente...');
        return;
    }
    
    // PRIORIDADE MÁXIMA: Google Português do Brasil FEMININA
    vozSelecionada = vozesDisponiveis.find(voice => 
        voice.lang === 'pt-BR' && 
        voice.name.toLowerCase().includes('google') &&
        (voice.name.toLowerCase().includes('female') || 
         voice.name.toLowerCase().includes('luciana') ||
         !voice.name.toLowerCase().includes('male'))
    );
    
    if (vozSelecionada) {
        console.log('✓ Voz Google pt-BR FEMININA selecionada:', vozSelecionada.name);
        return;
    }
    
    // Se não achou, tentar Google pt-BR (qualquer)
    vozSelecionada = vozesDisponiveis.find(voice => 
        voice.lang === 'pt-BR' && voice.name.toLowerCase().includes('google')
    );
    
    if (vozSelecionada) {
        console.log('✓ Voz Google pt-BR selecionada:', vozSelecionada.name);
        return;
    }
    
    // Última opção: primeira voz pt-BR
    vozSelecionada = vozesDisponiveis.find(voice => voice.lang === 'pt-BR');
    
    if (vozSelecionada) {
        console.log('✓ Voz pt-BR selecionada:', vozSelecionada.name);
    } else {
        vozSelecionada = vozesDisponiveis[0];
        console.log('⚠️ Usando voz padrão:', vozSelecionada.name);
    }
}

// Garantir que vozes sejam carregadas
if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.onvoiceschanged = () => {
        console.log('🔄 Evento onvoiceschanged disparado');
        carregarVozes();
    };
    
    // Tentar carregar imediatamente também
    carregarVozes();
}

function falarTexto(texto, opcoes = {}) {
    console.log('🗣️ Tentando falar:', texto);
    
    if (typeof speechSynthesis === 'undefined') {
        console.error('❌ speechSynthesis não está disponível');
        return;
    }
    
    // CANCELAR IMEDIATAMENTE qualquer fala em andamento
    speechSynthesis.cancel();
    
    // Recarregar vozes se necessário
    if (vozesDisponiveis.length === 0) {
        vozesDisponiveis = speechSynthesis.getVoices();
        carregarVozes();
    }
    
    // Selecionar voz se ainda não selecionou
    if (!vozSelecionada && vozesDisponiveis.length > 0) {
        carregarVozes();
    }
    
    // Pequeno delay para garantir cancelamento
    setTimeout(() => {
        // Criar utterance
        const utterance = new SpeechSynthesisUtterance(texto);
        
        // SEMPRE usar a mesma voz selecionada
        if (vozSelecionada) {
            utterance.voice = vozSelecionada;
        }
        
        utterance.lang = 'pt-BR';
        utterance.volume = opcoes.volume !== undefined ? opcoes.volume : 1.0;
        utterance.rate = opcoes.rate !== undefined ? opcoes.rate : 0.95;
        utterance.pitch = opcoes.pitch !== undefined ? opcoes.pitch : 1.0;
        
        utterance.onstart = () => {
            console.log('✓ Falando:', texto, '| Voz:', vozSelecionada ? vozSelecionada.name : 'padrão');
        };
        
        utterance.onerror = (event) => {
            console.error('❌ Erro ao falar:', event.error);
        };
        
        utterance.onend = () => {
            console.log('✓ Finalizou:', texto);
            if (opcoes.onEnd) {
                opcoes.onEnd();
            }
        };
        
        // Falar APENAS uma vez
        speechSynthesis.speak(utterance);
    }, 200);
}

function falarComBeep(texto, frequenciaBeep = 1000) {
    console.log('🔊 Falar com beep:', texto);
    
    // Tocar beep primeiro
    tocarBeep(frequenciaBeep, 0.3);
    
    // Falar após o beep terminar (não simultâneo)
    setTimeout(() => {
        falarTexto(texto);
    }, 400);
}

async function solicitarWakeLock() {
    if (!('wakeLock' in navigator)) {
        console.log('Wake Lock não suportado');
        return;
    }
    
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('✓ Wake Lock ativado - tela não desligará');
        
        // Reativar se a tela for bloqueada e desbloqueada
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        });
    } catch (err) {
        console.log('Wake Lock não disponível:', err);
    }
}

function liberarWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release().then(() => {
            wakeLock = null;
            console.log('✓ Wake Lock liberado');
        });
    }
}

// ========================================
// ÁUDIO SILENCIOSO - Mantém app ativo em background
// ========================================

function iniciarAudioSilencioso() {
    if (!audioContext) return;
    
    try {
        // Criar oscilador silencioso (volume muito baixo)
        audioSilenciosoSource = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        audioSilenciosoSource.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Volume muito baixo (quase inaudível)
        gainNode.gain.value = 0.001;
        
        // Frequência baixa
        audioSilenciosoSource.frequency.value = 20;
        
        // Iniciar
        audioSilenciosoSource.start();
        
        console.log('✓ Áudio silencioso ativado - app continuará ativo em background');
    } catch (err) {
        console.log('Erro ao iniciar áudio silencioso:', err);
    }
}

function pararAudioSilencioso() {
    if (audioSilenciosoSource) {
        try {
            audioSilenciosoSource.stop();
            audioSilenciosoSource = null;
            console.log('✓ Áudio silencioso parado');
        } catch (err) {
            console.log('Erro ao parar áudio silencioso:', err);
        }
    }
}

// ========================================
// INICIAR TREINO POR TEMPO
// ========================================

function iniciarTreinoTempo() {
    const tempoCorrida = parseInt(document.getElementById('tempoCorrida').value) || 0;
    const tempoCaminhada = parseInt(document.getElementById('tempoCaminhada').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoes').value) || 0;
    
    if (tempoCorrida <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha o tempo de corrida e número de repetições!');
        return;
    }
    
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }
    
    tipoTreino = 'tempo';
    config.tempoCorrida = tempoCorrida * 60;
    config.tempoCaminhada = tempoCaminhada * 60;
    config.repeticoes = repeticoes;
    
    showScreen('treinoScreen');
    iniciarContagemRegressiva();
}

// ========================================
// INICIAR TREINO POR DISTÂNCIA
// ========================================

function iniciarTreinoDistancia() {
    const distCorrida = parseFloat(document.getElementById('distCorrida').value) || 0;
    const distCaminhada = parseFloat(document.getElementById('distCaminhada').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoesDist').value) || 0;
    
    if (distCorrida <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha a distância de corrida e número de repetições!');
        return;
    }
    
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }
    
    tipoTreino = 'distancia';
    config.distCorrida = distCorrida;
    config.distCaminhada = distCaminhada;
    config.repeticoes = repeticoes;
    
    showScreen('treinoScreen');
    iniciarContagemRegressiva();
}

// ========================================
// CONTAGEM REGRESSIVA
// ========================================

function iniciarContagemRegressiva() {
    let contador = 3;
    document.getElementById('faseAtual').textContent = contador;
    document.getElementById('infoValor').textContent = '';
    document.getElementById('repeticoesDisplay').textContent = '';
    
    // Beep e voz do 3
    tocarBeep();
    vibrar(200);
    falarTexto('3');
    
    const intervalo = setInterval(() => {
        contador--;
        
        if (contador > 0) {
            // Falar 2 ou 1
            document.getElementById('faseAtual').textContent = contador;
            tocarBeep();
            vibrar(200);
            falarTexto(contador.toString());
        } else if (contador === 0) {
            // Falar VAI
            document.getElementById('faseAtual').textContent = 'VAI!';
            tocarBeep(1000, 0.5);
            vibrar(500);
            falarTexto('VAI!', { pitch: 1.2 });
        } else {
            // Parar contagem e iniciar treino
            clearInterval(intervalo);
            setTimeout(() => {
                iniciarTreinoReal();
            }, 1000); // Aguarda 1 segundo após "VAI!" antes de começar
        }
    }, 1000);
}

// ========================================
// TREINO REAL
// ========================================

function iniciarTreinoReal() {
    treinoAtivo = true;
    repeticaoAtual = 1;
    repeticaoTotal = config.repeticoes;
    fase = 'corrida';
    
    // Ativar Wake Lock e áudio para manter ativo
    solicitarWakeLock();
    if (!audioSilenciosoSource) {
        iniciarAudioSilencioso();
    }
    
    atualizarDisplay();
    
    // FALAR APENAS UMA VEZ ao iniciar a corrida
    falarTexto('CORRIDA!');
    
    if (tipoTreino === 'tempo') {
        tempoRestante = config.tempoCorrida;
        document.getElementById('infoLabel').textContent = 'Tempo Restante';
        intervaloTreino = setInterval(atualizarTreinoTempo, 1000);
    } else {
        distanciaPercorrida = 0;
        document.getElementById('infoLabel').textContent = 'Distância Percorrida';
        iniciarGPS();
        intervaloTreino = setInterval(atualizarTreinoDistancia, 1000);
    }
}

function atualizarDisplay() {
    document.getElementById('faseAtual').textContent = fase === 'corrida' ? 'Corrida' : 'Caminhada';
    document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
    
    const indicador = document.getElementById('indicadorFase');
    if (fase === 'corrida') {
        indicador.classList.remove('caminhada');
    } else {
        indicador.classList.add('caminhada');
    }
}

// ========================================
// TREINO POR TEMPO
// ========================================

function atualizarTreinoTempo() {
    if (pausado) return;
    
    tempoRestante--;
    
    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;
    document.getElementById('infoValor').textContent = 
        `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    
    if (tempoRestante <= 0) {
        trocarFase();
    }
}

function trocarFase() {
    if (fase === 'corrida') {
        if (config.tempoCaminhada > 0) {
            fase = 'caminhada';
            tempoRestante = config.tempoCaminhada;
            
            // Beep, vibração e voz APENAS UMA VEZ
            tocarTroca();
            vibrar(300);
            
            // Falar APENAS quando trocar
            setTimeout(() => {
                falarTexto('CAMINHADA!');
            }, 400);
            
            atualizarDisplay();
        } else {
            proximaRepeticao();
        }
    } else {
        proximaRepeticao();
    }
}

function proximaRepeticao() {
    if (repeticaoAtual < repeticaoTotal) {
        repeticaoAtual++;
        fase = 'corrida';
        
        if (tipoTreino === 'tempo') {
            tempoRestante = config.tempoCorrida;
        } else {
            distanciaPercorrida = 0;
        }
        
        // Beep, vibração e voz APENAS UMA VEZ
        tocarTroca();
        vibrar(300);
        
        // Falar APENAS quando trocar para nova repetição
        setTimeout(() => {
            falarTexto('CORRIDA!');
        }, 400);
        
        atualizarDisplay();
    } else {
        finalizarComSucesso();
    }
}

// ========================================
// TREINO POR DISTÂNCIA
// ========================================

function iniciarGPS() {
    if (!navigator.geolocation) {
        alert('⚠️ GPS não disponível neste dispositivo');
        return;
    }
    
    watchId = navigator.geolocation.watchPosition(
        atualizarLocalizacao,
        erroGPS,
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

function atualizarLocalizacao(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    
    if (ultimaLocalizacao) {
        const distancia = calcularDistancia(
            ultimaLocalizacao.lat,
            ultimaLocalizacao.lon,
            lat,
            lon
        );
        distanciaPercorrida += distancia;
    }
    
    ultimaLocalizacao = { lat, lon };
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
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

function atualizarTreinoDistancia() {
    if (pausado) return;
    
    document.getElementById('infoValor').textContent = 
        `${distanciaPercorrida.toFixed(2)} km`;
    
    const distanciaAlvo = fase === 'corrida' ? config.distCorrida : config.distCaminhada;
    
    if (distanciaPercorrida >= distanciaAlvo) {
        trocarFase();
    }
}

// ========================================
// CONTROLES
// ========================================

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

function finalizarComSucesso() {
    limparTreino();
    
    document.getElementById('faseAtual').textContent = 'Parabéns!\nMeta concluída!';
    document.getElementById('infoValor').textContent = '🎉';
    
    // 3 beeps finais
    setTimeout(() => { tocarFinal(); vibrar(400); }, 0);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 500);
    setTimeout(() => { tocarFinal(); vibrar(400); }, 1000);
    
    // Voz de parabéns
    setTimeout(() => {
        falarTexto('PARABÉNS! TREINO CONCLUÍDO!', { 
            pitch: 1.2, 
            rate: 0.9,
            volume: 1.0 
        });
    }, 1500);
    
    // Notificação de conclusão
    enviarNotificacao('🎉 Parabéns!', 'Você concluiu o treino com sucesso!', '🏆');
    
    setTimeout(() => showScreen('menuScreen'), 6000);
}

function limparTreino() {
    treinoAtivo = false;
    pausado = false;
    
    if (intervaloTreino) {
        clearInterval(intervaloTreino);
        intervaloTreino = null;
    }
    
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    // Liberar Wake Lock
    liberarWakeLock();
    
    // Parar áudio silencioso
    pararAudioSilencioso();
    
    ultimaLocalizacao = null;
    distanciaPercorrida = 0;
}

// ========================================
// SERVICE WORKER (PWA)
// ========================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✓ Service Worker registrado'))
            .catch(err => console.log('✗ Erro ao registrar SW:', err));
    });
}

// ========================================
// INICIALIZAÇÃO
// ========================================

window.addEventListener('load', () => {
    console.log('🏃 Running Trainer PWA Iniciado');
    
    // Carregar vozes imediatamente
    carregarVozes();
    
    // Recarregar vozes após 1 segundo (garantia)
    setTimeout(carregarVozes, 1000);
    
    // Prevenir zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    
    // Mostrar modal de permissões após 1 segundo
    setTimeout(() => {
        if (!permissoesOk) {
            document.getElementById('permissionModal').classList.add('active');
        }
    }, 1000);
});
