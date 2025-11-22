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

// ========================================
// FUNÇÕES DE NAVEGAÇÃO
// ========================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ========================================
// PERMISSÕES
// ========================================

function requestPermissions() {
    // Criar AudioContext para sons
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    permissoesOk = true;
    document.getElementById('permissionModal').classList.remove('active');
    
    // Testar vibração
    if ('vibrate' in navigator) {
        navigator.vibrate(200);
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
    
    tocarBeep();
    vibrar(200);
    
    const intervalo = setInterval(() => {
        contador--;
        
        if (contador > 0) {
            document.getElementById('faseAtual').textContent = contador;
            tocarBeep();
            vibrar(200);
        } else if (contador === 0) {
            document.getElementById('faseAtual').textContent = 'VAI!';
            tocarBeep(1000, 0.5);
            vibrar(500);
        } else {
            clearInterval(intervalo);
            iniciarTreinoReal();
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
    
    atualizarDisplay();
    
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
            tocarTroca();
            vibrar(300);
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
        
        tocarTroca();
        vibrar(300);
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
    
    setTimeout(() => showScreen('menuScreen'), 5000);
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
    
    // Prevenir zoom
    document.addEventListener('gesturestart', e => e.preventDefault());
    
    // Mostrar modal de permissões após 1 segundo
    setTimeout(() => {
        if (!permissoesOk) {
            document.getElementById('permissionModal').classList.add('active');
        }
    }, 1000);
});