// treinos_fixos.js - Banco de dados com treinos pré-programados
// Padrão: [tempo] corrida + [tempo] caminhada × repetições

const TREINOS_FIXOS = {
  '5k_iniciante': {
    nome: '🏃 5K Iniciante',
    descricao: '8 semanas para correr 5km - 3 treinos por semana',
    duracao: '8 semanas',
    semanas: {
      1: {
        A: { 
          blocos: [
            { tempo: 60, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 10,
          descricao: '1 min corrida + 2 min caminhada × 10'
        },
        B: { 
          blocos: [
            { tempo: 90, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 8,
          descricao: '90s corrida + 2 min caminhada × 8'
        },
        C: { 
          blocos: [
            { tempo: 120, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 7,
          descricao: '2 min corrida + 2 min caminhada × 7'
        }
      },
      2: {
        A: { 
          blocos: [
            { tempo: 120, tipo: 'corrida', repeticao: 1 },
            { tempo: 90, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 8,
          descricao: '2 min corrida + 90s caminhada × 8'
        },
        B: { 
          blocos: [
            { tempo: 180, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 6,
          descricao: '3 min corrida + 2 min caminhada × 6'
        },
        C: { 
          blocos: [
            { tempo: 240, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 5,
          descricao: '4 min corrida + 2 min caminhada × 5'
        }
      },
      3: {
        A: { 
          blocos: [
            { tempo: 300, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 4,
          descricao: '5 min corrida + 2 min caminhada × 4'
        },
        B: { 
          blocos: [
            { tempo: 420, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 3,
          descricao: '7 min corrida + 2 min caminhada × 3'
        },
        C: { 
          blocos: [
            { tempo: 480, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 3,
          descricao: '8 min corrida + 2 min caminhada × 3'
        }
      },
      4: {
        A: { 
          blocos: [
            { tempo: 600, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 3,
          descricao: '10 min corrida + 2 min caminhada × 3'
        },
        B: { 
          blocos: [
            { tempo: 720, tipo: 'corrida', repeticao: 1 },
            { tempo: 180, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 2,
          descricao: '12 min corrida + 3 min caminhada × 2'
        },
        C: { 
          blocos: [
            { tempo: 900, tipo: 'corrida', repeticao: 1 },
            { tempo: 180, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 2,
          descricao: '15 min corrida + 3 min caminhada × 2'
        }
      },
      5: {
        A: { 
          blocos: [
            { tempo: 1200, tipo: 'corrida', repeticao: 1 },
            { tempo: 180, tipo: 'caminhada', repeticao: 1 },
            { tempo: 600, tipo: 'corrida', repeticao: 2 },
          ], 
          repeticoes: 1,
          descricao: '20 min corrida + 3 min caminhada + 10 min corrida'
        },
        B: { 
          blocos: [
            { tempo: 1320, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
            { tempo: 600, tipo: 'corrida', repeticao: 2 },
          ], 
          repeticoes: 1,
          descricao: '22 min corrida + 2 min caminhada + 10 min corrida'
        },
        C: { 
          blocos: [
            { tempo: 1500, tipo: 'corrida', repeticao: 1 },
            { tempo: 120, tipo: 'caminhada', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '25 min corrida + 2 min caminhada'
        }
      },
      6: {
        A: { 
          blocos: [
            { tempo: 1680, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '28 min corrida contínua'
        },
        B: { 
          blocos: [
            { tempo: 1800, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '30 min corrida contínua'
        },
        C: { 
          blocos: [
            { tempo: 1920, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '32 min corrida contínua'
        }
      },
      7: {
        A: { 
          blocos: [
            { tempo: 2040, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '34 min corrida contínua'
        },
        B: { 
          blocos: [
            { tempo: 2160, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '36 min corrida contínua'
        },
        C: { 
          blocos: [
            { tempo: 2280, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '38 min corrida contínua'
        }
      },
      8: {
        A: { 
          blocos: [
            { tempo: 2400, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '40 min corrida contínua'
        },
        B: { 
          blocos: [
            { tempo: 2580, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '43 min corrida contínua'
        },
        C: { 
          blocos: [
            { tempo: 300, tipo: 'corrida', repeticao: 1 },
          ], 
          repeticoes: 1,
          descricao: '5 km corrida contínua (prova final)'
        }
      }
    }
  },

  '5k_sub30': {
    nome: '⚡ 5K Sub 30',
    descricao: '6 semanas para correr 5km em menos de 30 minutos',
    duracao: '6 semanas',
    semanas: {
      1: {
        A: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'caminhada', repeticao: 1 }], repeticoes: 5, descricao: '2 min Z4 + 2 min Z1 × 5' },
        C: { blocos: [{ tempo: 1200, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '20 min corrida Z3' }
      },
      2: {
        A: { blocos: [{ tempo: 2100, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '35 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 90, tipo: 'caminhada', repeticao: 1 }], repeticoes: 6, descricao: '2 min Z4 + 90s Z1 × 6' },
        C: { blocos: [{ tempo: 1320, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '22 min corrida Z3' }
      },
      3: {
        A: { blocos: [{ tempo: 2100, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '35 min corrida Z2' },
        B: { blocos: [{ tempo: 180, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'caminhada', repeticao: 1 }], repeticoes: 4, descricao: '3 min Z4 + 2 min Z1 × 4' },
        C: { blocos: [{ tempo: 1500, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '25 min corrida Z3' }
      },
      4: {
        A: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z2' },
        B: { blocos: [{ tempo: 180, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'caminhada', repeticao: 1 }], repeticoes: 5, descricao: '3 min Z4 + 2 min Z1 × 5' },
        C: { blocos: [{ tempo: 1680, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '28 min corrida Z3' }
      },
      5: {
        A: { blocos: [{ tempo: 2100, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '35 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'corrida', repeticao: 2 }, { tempo: 90, tipo: 'caminhada', repeticao: 1 }], repeticoes: 6, descricao: '2 min Z4/Z5 + 2 min Z1 × 6' },
        C: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z3' }
      },
      6: {
        A: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'caminhada', repeticao: 1 }], repeticoes: 4, descricao: '2 min Z5 + 2 min Z1 × 4' },
        C: { blocos: [{ tempo: 1200, tipo: 'corrida', repeticao: 1 }, { tempo: 1200, tipo: 'corrida', repeticao: 2 }, { tempo: 600, tipo: 'corrida', repeticao: 3 }], repeticoes: 1, descricao: '5km progressivo (2km Z3 + 2km Z4 + 1km Z5)' }
      }
    }
  },

  '10k': {
    nome: '🏆 10K',
    descricao: '8 semanas de preparação para 10km',
    duracao: '8 semanas',
    semanas: {
      1: {
        A: { blocos: [{ tempo: 2100, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '35 min corrida Z2' },
        B: { blocos: [{ tempo: 1500, tipo: 'corrida', repeticao: 1 }, { tempo: 300, tipo: 'corrida', repeticao: 2 }], repeticoes: 1, descricao: '25 min Z2 + 5 min Z3' },
        C: { blocos: [{ tempo: 2700, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '45 min corrida Z2' }
      },
      2: {
        A: { blocos: [{ tempo: 2400, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '40 min corrida Z2' },
        B: { blocos: [{ tempo: 1500, tipo: 'corrida', repeticao: 1 }, { tempo: 600, tipo: 'corrida', repeticao: 2 }], repeticoes: 1, descricao: '25 min Z2 + 10 min Z3' },
        C: { blocos: [{ tempo: 3000, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '50 min corrida Z2' }
      },
      3: {
        A: { blocos: [{ tempo: 2700, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '45 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 60, tipo: 'caminhada', repeticao: 1 }], repeticoes: 4, descricao: '2 min Z4 + 1 min Z1 × 4' },
        C: { blocos: [{ tempo: 3300, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '55 min corrida Z2' }
      },
      4: {
        A: { blocos: [{ tempo: 2400, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '40 min corrida Z2' },
        B: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z3' },
        C: { blocos: [{ tempo: 3600, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '60 min corrida Z2' }
      },
      5: {
        A: { blocos: [{ tempo: 2700, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '45 min corrida Z2' },
        B: { blocos: [{ tempo: 180, tipo: 'corrida', repeticao: 1 }, { tempo: 120, tipo: 'caminhada', repeticao: 1 }], repeticoes: 5, descricao: '3 min Z4 + 2 min Z1 × 5' },
        C: { blocos: [{ tempo: 3900, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '65 min corrida Z2' }
      },
      6: {
        A: { blocos: [{ tempo: 3000, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '50 min corrida Z2' },
        B: { blocos: [{ tempo: 1200, tipo: 'corrida', repeticao: 1 }, { tempo: 600, tipo: 'corrida', repeticao: 2 }], repeticoes: 1, descricao: '20 min Z3 + 10 min Z4' },
        C: { blocos: [{ tempo: 4200, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '70 min corrida Z2' }
      },
      7: {
        A: { blocos: [{ tempo: 2700, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '45 min corrida Z2' },
        B: { blocos: [{ tempo: 120, tipo: 'corrida', repeticao: 1 }, { tempo: 60, tipo: 'caminhada', repeticao: 1 }], repeticoes: 6, descricao: '2 min Z4 + 1 min Z1 × 6' },
        C: { blocos: [{ tempo: 4500, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '75 min corrida Z2' }
      },
      8: {
        A: { blocos: [{ tempo: 2400, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '40 min corrida Z2' },
        B: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }], repeticoes: 1, descricao: '30 min corrida Z2' },
        C: { blocos: [{ tempo: 1800, tipo: 'corrida', repeticao: 1 }, { tempo: 3000, tipo: 'corrida', repeticao: 2 }, { tempo: 1200, tipo: 'corrida', repeticao: 3 }], repeticoes: 1, descricao: '10km (3km Z2 + 5km Z3 + 2km Z4)' }
      }
    }
  }
};

// Zonas de Frequência Cardíaca
const ZONAS_FC = {
  Z1: { min: 0.50, max: 0.60, nome: 'Recuperação', cor: '#00cc66', descricao: 'Muito leve, conversável' },
  Z2: { min: 0.60, max: 0.70, nome: 'Base', cor: '#00aa44', descricao: 'Leve, ritmo confortável' },
  Z3: { min: 0.70, max: 0.80, nome: 'Aeróbica', cor: '#ffaa00', descricao: 'Moderada, respiração acelerada' },
  Z4: { min: 0.80, max: 0.90, nome: 'Limiar', cor: '#ff6600', descricao: 'Intensa, difícil conversar' },
  Z5: { min: 0.90, max: 1.00, nome: 'Máxima', cor: '#ff0000', descricao: 'Muito intensa, esforço máximo' }
};

// Cadência ideal por nível
const CADENCIA_IDEAL = {
  Iniciante: {
    Z2: { min: 160, max: 168, ppm: 164 },
    Z3: { min: 165, max: 172, ppm: 169 },
    Z4: { min: 170, max: 178, ppm: 174 }
  },
  Intermediário: {
    Z2: { min: 165, max: 172, ppm: 169 },
    Z3: { min: 170, max: 176, ppm: 173 },
    Z4: { min: 175, max: 182, ppm: 179 },
    Z5: { min: 180, max: 185, ppm: 182 }
  },
  Avançado: {
    Z2: { min: 170, max: 176, ppm: 173 },
    Z3: { min: 175, max: 180, ppm: 177 },
    Z4: { min: 180, max: 185, ppm: 182 },
    Z5: { min: 185, max: 190, ppm: 187 }
  }
};

// Função para calcular FC máxima
function calcularFCMaxima(idade) {
  return Math.round(220 - idade);
}

// Função para calcular zonas de FC
function calcularZonasFC(idade) {
  const fcMax = calcularFCMaxima(idade);
  const zonas = {};
  
  Object.keys(ZONAS_FC).forEach(zona => {
    const { min, max } = ZONAS_FC[zona];
    zonas[zona] = {
      ...ZONAS_FC[zona],
      min_bpm: Math.round(fcMax * min),
      max_bpm: Math.round(fcMax * max)
    };
  });
  
  return zonas;
}

// Função para obter cadência ideal
function obterCadenciaIdeal(nivel, zona) {
  const cadencia = CADENCIA_IDEAL[nivel] || CADENCIA_IDEAL['Iniciante'];
  return cadencia[zona] || { min: 160, max: 170, ppm: 165 };
}

// Função para converter treino fixo para formato de execução
function converterTreinoFixo(treinoId, semana, dia) {
  const treino = TREINOS_FIXOS[treinoId];
  if (!treino || !treino.semanas[semana] || !treino.semanas[semana][dia]) {
    return null;
  }

  const semanal = treino.semanas[semana][dia];
  const config = {
    tipo: 'fixo',
    nome: `${treino.nome} - Semana ${semana}, Dia ${dia}`,
    blocos: semanal.blocos,
    repeticoes: semanal.repeticoes,
    descricao: semanal.descricao || ''
  };

  return config;
}

// Função para formatar tempo em minutos:segundos
function formatarTempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min}:${seg.toString().padStart(2, '0')}`;
}