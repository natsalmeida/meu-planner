// core/datas.js — gerado a partir do monólito; edite aqui a partir de agora.

/* ---------------- Date helpers ---------------- */
export function localISO(d=new Date()){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}
export const todayISO = ()=> localISO(); // data LOCAL (corrige rollover de fuso à noite em UTC-3)
export function lastDays(n){const out=[];const d=new Date();for(let i=0;i<n;i++){out.push(localISO(d));d.setDate(d.getDate()-1);}return out.reverse();}
export function weekdayLetter(iso){return ['D','S','T','Q','Q','S','S'][new Date(iso+'T12:00').getDay()];}
export function weekKey(iso){const d=new Date(iso+'T00:00');const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
  const t=new Date(d.getFullYear(),0,1);const w=Math.ceil(((d-t)/86400000+1)/7);return d.getFullYear()+'-S'+String(w).padStart(2,'0');}
export function monthKey(iso){return iso.slice(0,7);}
export function fmtBR(iso){if(!iso)return'—';const[y,m,d]=iso.slice(0,10).split('-');return d+'/'+m+'/'+y;}
export function durH(ini,fim){if(!ini||!fim)return 0;const a=ini.split(':').map(Number),b=fim.split(':').map(Number);
  let min=(b[0]*60+b[1])-(a[0]*60+a[1]); if(min<0)min+=1440; return Math.round(min/60*100)/100;}
export function durMin(ini,fim){if(!ini||!fim)return 0;const a=ini.split(':').map(Number),b=fim.split(':').map(Number);
  let min=(b[0]*60+b[1])-(a[0]*60+a[1]); if(min<0)min+=1440; return min;}
// formata horas decimais (ex: 1.5) como "1h 30min"
export function fmtDur(horasDecimais){
  const totalMin=Math.round(horasDecimais*60);
  const hh=Math.floor(totalMin/60), mm=totalMin%60;
  if(hh===0&&mm===0)return '0min';
  if(hh===0)return mm+'min';
  if(mm===0)return hh+'h';
  return hh+'h '+mm+'min';
}
