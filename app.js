// ========================================
// INICIAR TREINO POR TEMPO
// ========================================

function iniciarTreinoTempo() {
    const tempoCorrida1 = parseInt(document.getElementById('tempoCorrida').value) || 0;
    const tempoCaminhada = parseInt(document.getElementById('tempoCaminhada').value) || 0;
    const tempoCorrida2 = parseInt(document.getElementById('tempoCorrida2').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoes').value) || 0;
    
    if (tempoCorrida1 <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha o 1º tempo de corrida e número de repetições!');
        return;
    }
    
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }
    
    tipoTreino = 'tempo';
    config.tempoCorrida1 = tempoCorrida1 * 60;
    config.tempoCaminhada = tempoCaminhada * 60;
    config.tempoCorrida2 = tempoCorrida2 * 60;
    config.repeticoes = repeticoes;
    
    showScreen('treinoScreen');
    iniciarContagemRegressiva();
}

// ========================================
// INICIAR TREINO POR DISTÂNCIA
// ========================================

function iniciarTreinoDistancia() {
    const distCorrida1 = parseFloat(document.getElementById('distCorrida').value) || 0;
    const distCaminhada = parseFloat(document.getElementById('distCaminhada').value) || 0;
    const distCorrida2 = parseFloat(document.getElementById('distCorrida2').value) || 0;
    const repeticoes = parseInt(document.getElementById('repeticoesDist').value) || 0;
    
    if (distCorrida1 <= 0 || repeticoes <= 0) {
        alert('⚠️ Preencha a 1ª distância de corrida e número de repetições!');
        return;
    }
    
    if (!permissoesOk) {
        document.getElementById('permissionModal').classList.add('active');
        return;
    }
    
    tipoTreino = 'distancia';
    config.distCorrida1 = distCorrida1;
    config.distCaminhada = distCaminhada;
    config.distCorrida2 = distCorrida2;
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
    fase = 'corrida1';
    
    // Ativar Wake Lock e áudio para manter ativo
    solicitarWakeLock();
    if (!audioSilenciosoSource) {
        iniciarAudioSilencioso();
    }
    
    atualizarDisplay();
    
    // FALAR APENAS UMA VEZ ao iniciar a corrida
    falarTexto('CORRIDA!');
    
    if (tipoTreino === 'tempo') {
        tempoRestante = config.tempoCorrida1;
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
    // Atualizar texto da fase
    if (fase === 'corrida1' || fase === 'corrida2') {
        document.getElementById('faseAtual').textContent = 'Corrida';
    } else {
        document.getElementById('faseAtual').textContent = 'Caminhada';
    }
    
    document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
    
    const indicador = document.getElementById('indicadorFase');
    if (fase === 'corrida1' || fase === 'corrida2') {
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
    if (fase === 'corrida1') {
        // Acabou 1ª corrida
        if (config.tempoCaminhada > 0 || config.distCaminhada > 0) {
            // Tem caminhada
            fase = 'caminhada';
            
            if (tipoTreino === 'tempo') {
                tempoRestante = config.tempoCaminhada;
            } else {
                distanciaPercorrida = 0;
            }
            
            tocarTroca();
            vibrar(300);
            setTimeout(() => {
                falarTexto('CAMINHADA!');
            }, 400);
            
            atualizarDisplay();
        } else if (config.tempoCorrida2 > 0 || config.distCorrida2 > 0) {
            // Não tem caminhada mas tem 2ª corrida
            fase = 'corrida2';
            
            if (tipoTreino === 'tempo') {
                tempoRestante = config.tempoCorrida2;
            } else {
                distanciaPercorrida = 0;
            }
            
            tocarTroca();
            vibrar(300);
            setTimeout(() => {
                falarTexto('SEGUNDA CORRIDA!');
            }, 400);
            
            atualizarDisplay();
        } else {
            // Não tem caminhada nem 2ª corrida, próxima repetição
            proximaRepeticao();
        }
    } else if (fase === 'caminhada') {
        // Acabou caminhada
        if (config.tempoCorrida2 > 0 || config.distCorrida2 > 0) {
            // Tem 2ª corrida
            fase = 'corrida2';
            
            if (tipoTreino === 'tempo') {
                tempoRestante = config.tempoCorrida2;
            } else {
                distanciaPercorrida = 0;
            }
            
            tocarTroca();
            vibrar(300);
            setTimeout(() => {
                falarTexto('SEGUNDA CORRIDA!');
            }, 400);
            
            atualizarDisplay();
        } else {
            // Não tem 2ª corrida, próxima repetição
            proximaRepeticao();
        }
    } else if (fase === 'corrida2') {
        // Acabou 2ª corrida, próxima repetição
        proximaRepeticao();
    }
}

function proximaRepeticao() {
    if (repeticaoAtual < repeticaoTotal) {
        repeticaoAtual++;
        fase = 'corrida1'; // Volta para 1ª corrida
        
        if (tipoTreino === 'tempo') {
            tempoRestante = config.tempoCorrida1;
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
            volume: 1.5
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
    
    // Carregar preferência de voz salva
    carregarPreferenciaVoz();
    
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


