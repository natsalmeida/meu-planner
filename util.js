// financas/util.js — gerado a partir do monólito; edite aqui a partir de agora.
import { addDaysISO } from '../views/analytics/graficos.js';
import { fin } from './core.js';

/* ---------------- helpers de data/dinheiro ---------------- */
export const FIN_MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export const FIN_MESES_L=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function r2(v){return Math.round((+v||0)*100)/100;}
export function brl(v){return (+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
export function parseBRL(s){
  s=String(s==null?'':s).replace(/[^\d.,-]/g,'');
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s=s.replace(/\./g,'');       // 1.200,50
  else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s=s.replace(/,/g,'');    // 1,200.50
  s=s.replace(',','.');
  const v=parseFloat(s); return isFinite(v)?r2(v):0;
}
export function ymAdd(ym,n){let[y,m]=ym.split('-').map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;return y+'-'+String(m).padStart(2,'0');}
export function ymDias(ym){const[y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();}
export function ymDia(ym,d){return ym+'-'+String(Math.min(Math.max(1,d),ymDias(ym))).padStart(2,'0');}
export function ymLabel(ym,longo){const[y,m]=ym.split('-');return (longo?FIN_MESES_L:FIN_MESES)[+m-1]+(longo?' de ':'/')+y;}
export function ddmm(iso){return iso?iso.slice(8,10)+'/'+iso.slice(5,7):'—';}
export function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
export function finNorm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
export const finVal=id=>{const e=document.getElementById(id);return e?e.value:'';};

/* Competência = o mês cujo salário paga a conta. Conta que vence até o
   `diaVirada` do mês seguinte ainda pertence ao mês anterior. */
export function finCompDe(iso){const ym=iso.slice(0,7),d=+iso.slice(8,10);return d<=fin.cfg.diaVirada?ymAdd(ym,-1):ym;}

/* ---------------- cartão: parcelas DERIVADAS, nunca armazenadas ----------------
   A compra é 1 registro com `parc`. As parcelas são calculadas na leitura, então
   editar valor/data/cartão da compra corrige todas as faturas de uma vez e não
   existe parcela órfã. Fatura é identificada pelo MÊS DE VENCIMENTO. */
export function finFaturaDaCompra(cartao,dataISO){
  const c=fin.cartoes.find(x=>x.id===cartao); const ym=dataISO.slice(0,7), d=+dataISO.slice(8,10);
  if(!c) return ymAdd(ym,1);
  const fechaYM=d>=c.fecha?ymAdd(ym,1):ym;          // comprou no dia do fechamento → próxima fatura
  return c.vence>c.fecha?fechaYM:ymAdd(fechaYM,1);  // vencimento cai depois do fechamento
}
export function finParcelas(g){
  if(g.meio!=='credito') return [];
  const n=g.parc||1, tot=Math.round(g.valor*100), base=Math.floor(tot/n), resto=tot-base*n;
  const v0=g.fatIni||finFaturaDaCompra(g.cartao,g.data);
  const ini=Math.min(n,Math.max(1,parseInt(g.parcIni)||1));
  return Array.from({length:n},(_,k)=>({g,k:k+1,n,valor:(base+(k===0?resto:0))/100,fat:ymAdd(v0,k),cartao:g.cartao||''})).filter(p=>p.k>=ini);
}
export function finTodasParcelas(){return fin.gastos.flatMap(finParcelas);}
export const finFatKey=(c,ym)=>c+'_'+ym;
export function finFaturasDaComp(M,ps){
  ps=ps||finTodasParcelas(); const out=[];
  fin.cartoes.forEach(c=>{
    [M,ymAdd(M,1)].forEach(ym=>{
      const venc=ymDia(ym,c.vence); if(finCompDe(venc)!==M) return;
      const mine=ps.filter(p=>p.cartao===c.id&&p.fat===ym), k=finFatKey(c.id,ym);
      const pago=!!fin.faturasPagas[k], inf=fin.faturasValor[k];
      if(!mine.length&&!pago&&inf==null) return;
      const calc=r2(mine.reduce((s,p)=>s+p.valor,0));
      out.push({virtual:true,id:k,cartao:c,ym,venc,desc:'Fatura '+c.nome+' · '+ymLabel(ym),
        valor:inf!=null?inf:calc,calc,informado:inf!=null,n:mine.length,ok:pago});
    });
  });
  return out;
}
/* Ciclo de gasto à vista: do dia em que cai a 1ª receita da competência até a véspera
   da 1ª receita da competência seguinte. Ancorado no dinheiro entrando, não no calendário. */
export function finCiclo(M){
  const rec=m=>fin.contas.filter(c=>c.tipo==='receita'&&c.comp===m&&c.venc).map(c=>c.venc).sort()[0];
  const ini=rec(M)||ymDia(M,ymDias(M));
  const prox=rec(ymAdd(M,1));
  let fim=prox?addDaysISO(prox,-1):addDaysISO(ymDia(ymAdd(ini.slice(0,7),1),+ini.slice(8,10)),-1);
  if(fim<ini) fim=ini;
  return {ini,fim};
}
export function finFixosPendentes(M){return fin.modelos.filter(m=>!fin.contas.some(c=>c.modelo===m.id&&c.comp===M));}
