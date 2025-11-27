/************************************************************
 *  SISTEMA COMPLETO DE TREINO - HTML + CSS + JS
 *  COM SUPORTE iOS, GPS, BARRA, VOZ NATURAL, REPETIÇÕES
 ************************************************************/

/* ----------------------------------------------------------
   VARIÁVEIS GLOBAIS
----------------------------------------------------------- */
let voices = [];
let voicesLoaded = false;
let vozSelecionada = null;

let wakeLock = null;
let timerFase = null;

let tipoTreino = "tempo";

let repeticaoAtual = 1;
let totalRepeticoes = 1;

let fasesRepeticao = [];
let faseIndex = 0;

let treinoPausado = false;

/* GPS */
let watchID = null;
let distanciaAcumulada = 0;
let distanciaMeta = 0;
let ultimaPosicao = null;


/* ----------------------------------------------------------
   SUPORTE A VOZES (INCLUINDO iOS)
----------------------------------------------------------- */
function desbloquearVozesIOS() {
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
    popularSelectVoz();
}


/* ----------------------------------------------------------
   SELECT DE VOZ
----------------------------------------------------------- */
async function popularSelectVoz() {
    if (!voicesLoaded) await inicializarVozes();

    const select = document.getElementById("selectVozGlobal");
    if (!select) return;

    select.innerHTML = "";

    voices.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.name;
        opt.textContent = `${v.name} (${v.lang})`;
        select.appendChild(opt);
    });

    vozSelecionada = voices.find(v => v.lang === "pt-BR") || voices[0];
}

function testarVozGlobal() {
    if (!vozSelecionada) return;

    const u = new SpeechSynthesisUtterance("Esta é a voz selecionada para o seu treino.");
    u.voice = vozSelecionada;
    u.rate = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}



/* ----------------------------------------------------------
   FUNÇÃO FALAR
----------------------------------------------------------- */
function falar(texto) {
    if (!vozSelecionada) return;

    const u = new SpeechSynthesisUtterance(texto);
    u.voice = vozSelecionada;
    u.rate = 1;

    speechSynthesis.cancel();
    speechSynthesis.speak(u);
}


/* ----------------------------------------------------------
   ORDINAIS EXTENSOS
----------------------------------------------------------- */
function ordinalExtenso(n) {
    const lista = [
        "primeira", "segunda", "terceira", "quarta", "quinta",
        "sexta", "sétima", "oitava", "nona", "décima",
        "décima primeira", "décima segunda", "décima terceira",
        "décima quarta", "décima quinta", "décima sexta"
    ];
    return lista[n - 1] || `${n}ª`;
}


/* ----------------------------------------------------------
   WAKE LOCK
----------------------------------------------------------- */
async function ativarWakeLock() {
    try {
        wakeLock = await navigator.wakeLock.request("screen");
    } catch (e) {}
}


/* ----------------------------------------------------------
   BARRA DE PROGRESSO
----------------------------------------------------------- */
function atualizarBarra(valor, total, texto = "") {
    const barra = document.getElementById("barraProgresso");
    const left = document.getElementById("progressoTextoLeft");
    const right = document.getElementById("progressoTextoRight");

    const pct = ((total - valor) / total) * 100;

    barra.style.width = pct + "%";
    left.textContent = `${Math.round(pct)}%`;
    right.textContent = texto;
}


/* ----------------------------------------------------------
   MOTOR DO TREINO POR TEMPO
----------------------------------------------------------- */
function iniciarTreinoTempo() {
    tipoTreino = "tempo";

    const corrida1 = Number(document.getElementById("tempoCorrida1").value);
    const caminhada = Number(document.getElementById("tempoCaminhada").value);
    const corrida2 = Number(document.getElementById("tempoCorrida2").value);
    totalRepeticoes = Number(document.getElementById("repeticoes").value);

    fasesRepeticao = [];

    if (corrida1 > 0) fasesRepeticao.push({ tipo: "corrida1", dur: corrida1 * 60 });
    if (caminhada > 0) fasesRepeticao.push({ tipo: "caminhada", dur: caminhada * 60 });
    if (corrida2 > 0) fasesRepeticao.push({ tipo: "corrida2", dur: corrida2 * 60 });

    repeticaoAtual = 1;
    faseIndex = 0;

    falar(`Iniciando ${ordinalExtenso(1)} repetição`);
    setTimeout(iniciarFase, 1500);
}


/* ----------------------------------------------------------
   MOTOR DO TREINO POR DISTÂNCIA
----------------------------------------------------------- */
function iniciarTreinoDistancia() {
    tipoTreino = "distancia";

    const dist1 = Number(document.getElementById("distCorrida1").value);
    const distC = Number(document.getElementById("distCaminhada").value);
    const dist2 = Number(document.getElementById("distCorrida2").value);
    totalRepeticoes = Number(document.getElementById("repeticoesDist").value);

    fasesRepeticao = [];

    if (dist1 > 0) fasesRepeticao.push({ tipo: "corrida1", dist: dist1 * 1000 });
    if (distC > 0) fasesRepeticao.push({ tipo: "caminhada", dist: distC * 1000 });
    if (dist2 > 0) fasesRepeticao.push({ tipo: "corrida2", dist: dist2 * 1000 });

    repeticaoAtual = 1;
    faseIndex = 0;

    iniciarGPS();
    falar(`Iniciando ${ordinalExtenso(1)} repetição`);

    setTimeout(iniciarFase, 1500);
}


/* ----------------------------------------------------------
   INICIAR FASE
----------------------------------------------------------- */
function iniciarFase() {
    if (faseIndex >= fasesRepeticao.length) {

        // CORREÇÃO DEFINITIVA DO SEU BUG
        if (timerFase) {
            clearInterval(timerFase);
            timerFase = null;
        }

        if (tipoTreino === "distancia") {
            distanciaAcumulada = 0;
        }

        if (repeticaoAtual < totalRepeticoes) {
            repeticaoAtual++;
            faseIndex = 0;

            falar(`Iniciando ${ordinalExtenso(repeticaoAtual)} repetição`);
            setTimeout(iniciarFase, 1500);
            return;
        }

        finalizarTreino();
        return;
    }

    const fase = fasesRepeticao[faseIndex];

    if (tipoTreino === "tempo") iniciarFaseTempo(fase);
    if (tipoTreino === "distancia") iniciarFaseDistancia(fase);
}


/* ----------------------------------------------------------
   FASE POR TEMPO
----------------------------------------------------------- */
function iniciarFaseTempo(fase) {
    falar(`Iniciando fase de ${fase.tipo.replace("1","").replace("2","")}`);

    let restante = fase.dur;

    atualizarBarra(restante, fase.dur, `${fase.dur}s`);

    timerFase = setInterval(() => {

        if (treinoPausado) return;

        restante--;
        atualizarBarra(restante, fase.dur, `${restante}s`);

        if (restante <= 0) {
            clearInterval(timerFase);
            timerFase = null;
            faseIndex++;
            iniciarFase();
        }

    }, 1000);
}


/* ----------------------------------------------------------
   FASE POR DISTÂNCIA
----------------------------------------------------------- */
function iniciarFaseDistancia(fase) {
    distanciaAcumulada = 0;
    distanciaMeta = fase.dist;

    falar(`Iniciando fase de ${fase.tipo.replace("1","").replace("2","")}`);

    atualizarBarra(distanciaMeta, distanciaMeta, `${distanciaMeta}m`);
}


/* ----------------------------------------------------------
   GPS / DISTÂNCIA
----------------------------------------------------------- */
function iniciarGPS() {
    if (!navigator.geolocation) return;

    ultimaPosicao = null;
    distanciaAcumulada = 0;

    watchID = navigator.geolocation.watchPosition(pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        if (!ultimaPosicao) {
            ultimaPosicao = { lat, lon };
            return;
        }

        const d = calcularDistancia(ultimaPosicao.lat, ultimaPosicao.lon, lat, lon);

        if (!treinoPausado) distanciaAcumulada += d;

        ultimaPosicao = { lat, lon };

        const restante = Math.max(0, distanciaMeta - distanciaAcumulada);
        atualizarBarra(restante, distanciaMeta, `${Math.round(restante)}m`);

        if (restante <= 0) {
            faseIndex++;
            iniciarFase();
        }

    }, () => {}, { enableHighAccuracy: true });
}

function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) *
              Math.cos(lat2*Math.PI/180) *
              Math.sin(dLon/2)**2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}


/* ----------------------------------------------------------
   PAUSAR / FINALIZAR
----------------------------------------------------------- */
function pausarTreino() {
    treinoPausado = !treinoPausado;

    if (treinoPausado) falar("Treino pausado");
    else falar("Treino retomado");
}

function finalizarTreino() {
    falar("Parabéns, você finalizou o treino!");

    clearInterval(timerFase);
    timerFase = null;

    if (watchID) navigator.geolocation.clearWatch(watchID);
}


/* ----------------------------------------------------------
   FUNÇÕES EXPOTAS GLOBALMENTE (onclick)
----------------------------------------------------------- */
window.iniciarTreinoTempo    = iniciarTreinoTempo;
window.iniciarTreinoDistancia = iniciarTreinoDistancia;
window.testarVozGlobal       = testarVozGlobal;
window.pausarTreino          = pausarTreino;
window.finalizarTreino       = finalizarTreino;


/* ----------------------------------------------------------
   INICIALIZAÇÃO
----------------------------------------------------------- */
window.addEventListener("load", async () => {
    await inicializarVozes();
    ativarWakeLock();
});
