/* =========================
   Iniciar a fase atual (índice indiceFase)
   ========================= */
function iniciarFaseAtual() {
    console.log('🔵 iniciarFaseAtual() chamada | Rep:', repeticaoAtual, '| Fase:', indiceFase, '| Total fases:', fasesDaRepeticao.length);
    
    if (!treinoAtivo) treinoAtivo = true;

    // Se fasesDaRepeticao estiver vazia (por alguma razão), reconstruir
    if (!fasesDaRepeticao || fasesDaRepeticao.length === 0) {
        console.log('⚠️ Reconstruindo fases (array vazio)');
        fasesDaRepeticao = construirFasesDaRepeticao();
    }

    // Se acabou as fases da repetição atual, ir para próxima repetição (ou finalizar)
    if (indiceFase >= fasesDaRepeticao.length) {
        console.log('✅ Fim das fases da repetição', repeticaoAtual);
        
        // próxima repetição ou finalizar
        if (repeticaoAtual < repeticaoTotal) {
            console.log('➡️ Avançando para repetição', repeticaoAtual + 1);
            repeticaoAtual++;
            indiceFase = 0; // CRÍTICO: resetar ANTES de reconstruir
            // RECONSTRUO as fases para garantir integridade (evita estado sujo)
            fasesDaRepeticao = construirFasesDaRepeticao();
            console.log('🔄 Fases reconstruídas:', fasesDaRepeticao.map(f => f.kind));
            
            document.getElementById('repeticoesDisplay').textContent = `${repeticaoAtual} / ${repeticaoTotal}`;
            // anunciar repetição natural e iniciar fase 0
            const textoRep = `Iniciando ${numeroParaOrdinalExtenso(repeticaoAtual)} repetição`;
            falarTexto(textoRep, { onEnd: () => {
                console.log('🎤 Anúncio da repetição concluído, iniciando fase 0');
                setTimeout(() => iniciarFaseAtual(), 300);
            }});
            return;
        } else {
            console.log('🎉 Todas repetições concluídas!');
            finalizarComSucesso();
            return;
        }
    }

    // Iniciar a fase corrente
    const f = fasesDaRepeticao[indiceFase];
    faseDistanciaAcumulada = 0;

    if (!f) {
        console.error('❌ Fase indefinida no indice', indiceFase, 'fasesDaRepeticao', fasesDaRepeticao);
        // pulo para evitar loop infinito
        indiceFase++;
        setTimeout(() => iniciarFaseAtual(), 200);
        return;
    }

    console.log('▶️ Iniciando fase:', f.kind, '| Target:', f.target, '| Tipo:', tipoTreino);

    // Limpar intervalo anterior se existir (garantir que não há múltiplos loops rodando)
    if (intervaloTreino) { 
        console.log('🛑 Limpando intervalo anterior');
        clearInterval(intervaloTreino); 
        intervaloTreino = null; 
    }

    if (tipoTreino === 'tempo') {
        tempoRestante = f.target;
        document.getElementById('infoLabel').textContent = 'Tempo Restante';
        document.getElementById('infoValor').textContent = formatTempoSegundos(tempoRestante);

        // anunciar fase
        if (f.kind === 'corrida1' || f.kind === 'corrida2') {
            console.log('🎤 Falando: Corrida!');
            falarTexto('Corrida!');
        } else {
            console.log('🎤 Falando: Caminhada!');
            falarTexto('Caminhada!');
        }

        // iniciar loop de tempo
        atualizarBarraProgresso(0, f.target, f.kind);
        intervaloTreino = setInterval(loopTempo, 1000);
        console.log('⏱️ Loop de tempo iniciado');
    } else {
        // distância
        document.getElementById('infoLabel').textContent = 'Distância Percorrida';
        faseDistanciaAcumulada = 0;
        document.getElementById('infoValor').textContent = `${faseDistanciaAcumulada.toFixed(2)} km`;

        if (f.kind === 'corrida1' || f.kind === 'corrida2') {
            console.log('🎤 Falando: Corrida!');
            falarTexto('Corrida!');
        } else {
            console.log('🎤 Falando: Caminhada!');
            falarTexto('Caminhada!');
        }

        // iniciar GPS e loop
        iniciarGPS();
        atualizarBarraProgresso(0, f.target, f.kind);
        intervaloTreino = setInterval(loopDistancia, 1000);
        console.log('📍 Loop de distância iniciado');
    }

    atualizarDisplay();
}
