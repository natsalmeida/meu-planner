// core/constantes.js — gerado a partir do monólito; edite aqui a partir de agora.

/* ---------------- Data layer ---------------- */
/* tipo:'estudo' → entra nas horas estudadas, metas, hábito automático e Analytics.
   tipo:'trabalho' → contabilizado em bloco próprio (Carga de trabalho), NUNCA somado
   ao estudo. `conta` continua sendo a flag de estudo lida pelo resto do sistema. */
export const AREAS = [
  {id:'unitins', nome:'UNITINS', cor:'#378add', conta:true,  tipo:'estudo'},
  {id:'ingles',  nome:'Inglês',  cor:'#1d9e75', conta:true,  tipo:'estudo', idioma:true},
  {id:'espanhol',nome:'Espanhol',cor:'#ba7517', conta:true,  tipo:'estudo', idioma:true},
  {id:'pibiex',  nome:'PIBIEX',  cor:'#7c3aed', conta:true,  tipo:'estudo'},
  {id:'ia',      nome:'IA',      cor:'#db5c88', conta:true,  tipo:'estudo'},
  {id:'tre',     nome:'TRE (trabalho)', cor:'#6d6879', conta:false, tipo:'trabalho'},
];
export const areaById = id => AREAS.find(a=>a.id===id) || {nome:'—',cor:'#999',conta:true};

/* ---- Períodos letivos: recorte do Hub UNITINS e da Grade (Analytics/Hábitos usam ano civil) ---- */
export const DEFAULT_PERIODOS = [{id:'p_2026_2', nome:'2026.2', ini:'2026-07-11', fim:'2026-12-06'}];

export const DEFAULT_GRADE = [
  ['Segunda','07h-08h','unitins','UNITINS'],['Segunda','08h-08h10','ingles','Inglês Busuu'],
  ['Segunda','08h10-08h20','espanhol','Espanhol Busuu'],['Segunda','08h20-08h25','espanhol','Espanhol Drops'],
  ['Segunda','09h-19h','tre','TRE (trabalho)'],['Segunda','20h-21h','pibiex','PIBIEX'],['Segunda','21h-22h','espanhol','Espanhol Kultivi'],
  ['Terça','07h-08h','unitins','UNITINS'],['Terça','08h-08h10','ingles','Inglês Busuu'],
  ['Terça','08h10-08h20','espanhol','Espanhol Busuu'],['Terça','08h20-08h25','espanhol','Espanhol Drops'],
  ['Terça','09h-19h','tre','TRE (trabalho)'],['Terça','20h-21h','ingles','Inglês BBC'],
  ['Terça','21h-22h','espanhol','Espanhol Kultivi + IA'],['Terça','22h-22h10','espanhol','Espanhol Fala'],
  ['Quarta','07h-08h','unitins','UNITINS'],['Quarta','08h-08h10','ingles','Inglês Busuu'],
  ['Quarta','08h10-08h20','espanhol','Espanhol Busuu'],['Quarta','08h20-08h25','espanhol','Espanhol Drops'],
  ['Quarta','09h-19h','tre','TRE (trabalho)'],['Quarta','20h-21h','pibiex','PIBIEX'],
  ['Quarta','21h-22h','ingles','Inglês BBC + IA'],['Quarta','22h-22h10','ingles','Inglês Fala'],
  ['Quinta','07h-08h','unitins','UNITINS'],['Quinta','08h-08h10','ingles','Inglês Busuu'],
  ['Quinta','08h10-08h20','espanhol','Espanhol Busuu'],['Quinta','08h20-08h25','espanhol','Espanhol Drops'],
  ['Quinta','09h-19h','tre','TRE (trabalho)'],['Quinta','20h-21h','pibiex','PIBIEX'],
  ['Quinta','21h-22h','espanhol','Espanhol Áudios'],['Quinta','22h-22h10','espanhol','Espanhol Fala'],
  ['Sexta','07h-08h','unitins','UNITINS'],['Sexta','08h-08h10','ingles','Inglês Busuu'],
  ['Sexta','08h10-08h20','espanhol','Espanhol Busuu'],['Sexta','08h20-08h25','espanhol','Espanhol Drops'],
  ['Sexta','09h-19h','tre','TRE (trabalho)'],['Sexta','20h-21h','pibiex','PIBIEX'],['Sexta','21h-22h','ingles','Inglês Encontro'],
  ['Sábado','08h-10h','ia','IA'],['Sábado','10h30-12h','ingles','Encontro Poliglota'],
  ['Domingo','10h-12h','ia','IA'],
].map((r,i)=>({id:'g'+i,dia:r[0],horario:r[1],area:r[2],atividade:r[3],periodo:DEFAULT_PERIODOS[0].id}));
export const DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];

export const DEFAULT_HABITOS = [
  {id:'h_aerobico',   nome:'Aeróbico',   cor:'#378add', icon:'🏃', freq:'semanal', alvo:3},
  {id:'h_musculacao', nome:'Musculação', cor:'#db5c88', icon:'🏋️', freq:'semanal', alvo:3},
  {id:'h_leitura',    nome:'Leitura',    cor:'#ba7517', icon:'📖', freq:'diario', livros:true},
  {id:'h_estudo',     nome:'Estudo',     cor:'#7c3aed', icon:'📚', auto:true, freq:'diario', minMin:60,
    excluir:['Inglês Busuu','Espanhol Busuu','Espanhol Drops']}, // microdrills não contam para o limiar
];


// === CONEXÃO FIREBASE ===
