// core/periodos.js — gerado a partir do monólito; edite aqui a partir de agora.
import { store } from './store.js';
import { fmtBR, todayISO } from './datas.js';

export function periodoById(id){return store.periodos.find(p=>p.id===id)||null;}
export function periodoDe(iso){return store.periodos.find(p=>iso>=p.ini&&iso<=p.fim)||null;}
export function periodoAtivo(){
  return periodoDe(todayISO())
      || [...store.periodos].sort((a,b)=>b.fim.localeCompare(a.fim))[0]
      || null;
}
export function periodoLabel(p){return p?`${p.nome} · ${fmtBR(p.ini).slice(0,5)}–${fmtBR(p.fim).slice(0,5)}`:'—';}
export function periodoEncerrado(p){return !!(p&&p.fim<todayISO());}

/* Próximo período que ainda não começou (o mais cedo). */
export function periodoProximo(){
  const hoje=todayISO();
  return [...store.periodos].filter(p=>p.ini>hoje).sort((a,b)=>a.ini.localeCompare(b.ini))[0]||null;
}
const diasEntre=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
export const PERIODO_AVISO_DIAS=21;

/* Aviso de virada de período. Motivo: depois do fim, periodoAtivo() não fica vazio — cai
   no período mais recente. Sem o próximo cadastrado, matéria e bloco de grade criados no
   semestre novo são carimbados com o período velho (saveMateria/saveBloco e a migração de
   órfãos em normalizeStore) e somem do Hub quando o período certo for criado.
   Com o próximo cadastrado não há risco: na pausa entre semestres, periodoAtivo() devolve
   o futuro (maior `fim`), que é o destino correto. */
export function periodoAviso(){
  if(periodoProximo()) return null;
  const hoje=todayISO(), atual=periodoDe(hoje);
  if(atual){
    const d=diasEntre(hoje,atual.fim);
    return d<=PERIODO_AVISO_DIAS?{tipo:'acabando',p:atual,dias:d}:null;
  }
  const ult=[...store.periodos].sort((a,b)=>b.fim.localeCompare(a.fim))[0];
  return ult?{tipo:'encerrado',p:ult,dias:diasEntre(ult.fim,hoje)}:null;
}
