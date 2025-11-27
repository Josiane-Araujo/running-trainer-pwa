// ===========================================================
//  SISTEMA DE VOZ – COMPATÍVEL COM iOS
// ===========================================================
let voices = [];
let voicesLoaded = false;
let vozSelecionada = null;

async function desbloquearVozesIOS() {
    return new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        u.onend = () => setTimeout(resolve, 200);
        speechSynthesis.speak(u);
    });
}

function carregarVozesIOS(force = false) {
    return new Promise(resolve => {
        let tentativas = 0;

        function tentar() {
            voices = speechSynthesis.getVoices();
            if (voices.length > 1 || tentativas > 10 || force) {
                voicesLoaded = true;
                resolve(voices);
                return;
            }
            tentativas++;
            setTimeout(tentar, 200);
        }

        tentar();
    });
}

async function inicializarVozes() {
    await desbloquearVozesIOS();
    await carregarVozesIOS(true);
}

async function popularSelectVoz() {
    if (!voicesLoaded) await inicializarVozes();

    const select = document.getElementById("selectVozGlobal");
    if (!select) return;

    select.innerHTML = "";

    voices.forEach(v => {
        let op = document.createElement("option");
        op.value = v.name;
        op.textContent = `${v.name} (${v.lang})`;
        select.appendChild(op);
    });

    // seleciona a primeira voz por padrão
    vozSelecionada = voices.find(v => v.name.includes("Maria")) || voices[0];
}

function testarVozGlobal() {
    const select = document.getElementById("selectVozGlobal");
    if (!select) return;

    const voz = voices.find(v => v.name === select.value);
    if (!voz) return alert("Voz não carregada.");

    vozSelecionada = voz;

    const fala = new SpeechSynthesisUtterance("Esta é a voz selecionada para o seu treino.");
    fala.voice = voz;
    fala.rate = 1.0;
    fala.pitch = 1.0;

    speechSynthesis.cancel();
    speechSynthesis.speak(fala);
}

window.testarVozGlobal = testarVozGlobal;

// ===========================================================
//  FUNÇÃO DE FALAR TEXTO
// ===========================================================
function falar(msg) {
    if (!vozSelecionada) vozSelecionada = voices[0];

    const u = new SpeechSynthesisUtterance(msg);
    u.voice = vozSelecionada;
    u.rate = 1;
    u.pitch = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}

// ===========================================================
//  VARIÁVEIS DE TREINO
// ===========================================================
let fases = [];
let indexFaseAtual = 0;
let repeticaoAtual = 1;
let totalReps = 1;

let timer = null;
let tempoRestante = 0;
let faseDuracao = 0;

let modoTreino = ""; // "tempo" ou "distancia"

let gpsWatchID = null;
let distanciaAtual = 0;
let distanciaMeta = 0;

// ===========================================================
//  BARRA DE PROGRESSO
// ===========================================================
function atualizarBarra() {
    const barra = document.getElementById("barraProgresso");
    const left = document.getElementById("progressoTextoLeft");

    const pct = ((faseDuracao - tempoRestante) / faseDuracao) * 100;
    barra.style.width = pct + "%";
    left.textContent = Math.round(pct) + "%";
}

// ===========================================================
//  EXECUTAR FASE
// ===========================================================
function executarFase() {
    clearInterval(timer);

    let fase = fases[indexFaseAtual];

    if (modoTreino === "tempo") {
        tempoRestante = fase.duracao;
        faseDuracao = fase.duracao;
        falar(fase.fala);

        timer = setInterval(() => {
            tempoRestante--;
            atualizarBarra();

            if (tempoRestante <= 0) {
                clearInterval(timer);
                proximaFase();
            }
        }, 1000);
    }

    if (modoTreino === "distancia") {
        distanciaAtual = 0;
        distanciaMeta = fase.distancia;
        faseDuracao = fase.distancia;
        falar(fase.fala);

        iniciarGPS();
    }
}

// ===========================================================
//  PRÓXIMA FASE
// ===========================================================
function proximaFase() {
    indexFaseAtual++;

    if (indexFaseAtual >= fases.length) {
        repeticaoAtual++;

        if (repeticaoAtual > totalReps) {
            falar("Parabéns! Seu treino foi concluído.");
            finalizarTreino();
            return;
        }

        falar(`Iniciando ${ordinal(repeticaoAtual)} repetição`);
        indexFaseAtual = 0;
    }

    setTimeout(() => executarFase(), 1000);
}

// ORDINAL NATURAL
function ordinal(n) {
    if (n === 1) return "primeira";
    if (n === 2) return "segunda";
    if (n === 3) return "terceira";
    return `${n}ª`;
}

// ===========================================================
//  FINALIZAR TREINO
// ===========================================================
function finalizarTreino() {
    clearInterval(timer);

    if (gpsWatchID) {
        navigator.geolocation.clearWatch(gpsWatchID);
        gpsWatchID = null;
    }

    showScreen("menuScreen");
}

window.finalizarTreino = finalizarTreino;

// ===========================================================
//  GPS – TREINO POR DISTÂNCIA
// ===========================================================
function iniciarGPS() {
    if (!navigator.geolocation) {
        alert("GPS não disponível no seu dispositivo.");
        finalizarTreino();
        return;
    }

    let ultimaPos = null;

    gpsWatchID = navigator.geolocation.watchPosition(
        pos => {
            if (ultimaPos) {
                let dx = distanciaCoords(
                    ultimaPos.latitude,
                    ultimaPos.longitude,
                    pos.coords.latitude,
                    pos.coords.longitude
                );
                distanciaAtual += dx;
            }
            ultimaPos = pos.coords;

            const barra = document.getElementById("barraProgresso");
            const pct = (distanciaAtual / distanciaMeta) * 100;
            barra.style.width = pct + "%";

            if (distanciaAtual >= distanciaMeta) {
                navigator.geolocation.clearWatch(gpsWatchID);
                gpsWatchID = null;
                proximaFase();
            }
        },
        err => console.log("Erro GPS:", err),
        { enableHighAccuracy: true, timeout: 2000, maximumAge: 0 }
    );
}

function distanciaCoords(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 1000;
}

// ===========================================================
//  TREINO POR TEMPO
// ===========================================================
function iniciarTreinoTempo() {
    modoTreino = "tempo";

    const t1 = Number(document.getElementById("tempoCorrida1").value);
    const tCaminhada = Number(document.getElementById("tempoCaminhada").value);
    const t2 = Number(document.getElementById("tempoCorrida2").value);
    totalReps = Number(document.getElementById("repeticoes").value);

    if (!t1 || !totalReps) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    fases = [];

    fases.push({ fala: "Inicie a corrida", duracao: t1 * 60 });

    if (tCaminhada > 0)
        fases.push({ fala: "Inicie a caminhada", duracao: tCaminhada * 60 });

    if (t2 > 0)
        fases.push({ fala: "Inicie a corrida", duracao: t2 * 60 });

    repeticaoAtual = 1;
    indexFaseAtual = 0;

    showScreen("treinoScreen");

    falar(`Iniciando ${ordinal(repeticaoAtual)} repetição`);
    setTimeout(() => executarFase(), 1200);
}

window.iniciarTreinoTempo = iniciarTreinoTempo;

// ===========================================================
//  TREINO POR DISTÂNCIA
// ===========================================================
function iniciarTreinoDistancia() {
    modoTreino = "distancia";

    const d1 = Number(document.getElementById("distCorrida1").value);
    const dCam = Number(document.getElementById("distCaminhada").value);
    const d2 = Number(document.getElementById("distCorrida2").value);
    totalReps = Number(document.getElementById("repeticoesDist").value);

    if (!d1 || !totalReps) {
        alert("Preencha os campos obrigatórios.");
        return;
    }

    fases = [];

    fases.push({ fala: "Inicie a corrida", distancia: d1 * 1000 });

    if (dCam > 0)
        fases.push({ fala: "Inicie a caminhada", distancia: dCam * 1000 });

    if (d2 > 0)
        fases.push({ fala: "Inicie a corrida", distancia: d2 * 1000 });

    repeticaoAtual = 1;
    indexFaseAtual = 0;

    showScreen("treinoScreen");

    falar(`Iniciando ${ordinal(repeticaoAtual)} repetição`);
    setTimeout(() => executarFase(), 1200);
}

window.iniciarTreinoDistancia = iniciarTreinoDistancia;

// ===========================================================
//  TROCA DE TELAS
// ===========================================================
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
    document.getElementById(id).style.display = "block";
}

window.showScreen = showScreen;

// ===========================================================
//  ONLOAD
// ===========================================================
window.onload = async () => {
    await inicializarVozes();
    popularSelectVoz();
};
