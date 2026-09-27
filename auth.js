// core/auth.js — gerado a partir do monólito; edite aqui a partir de agora.
import { db } from './firebase.js';
import { ROOT, __set_authReady, __set_syncAttached } from './store.js';
import { SYNC_INFO, SYNC_ST, setSync } from './sync-status.js';
import { __set_syncPronto, attachSync } from './sync.js';
import { h, toast } from '../ui/base.js';
import { attachFinSync, detachFinSync } from '../financas/core.js';

export let authUser=null;
export let modoLocal=false;          // usuário optou por seguir sem sincronizar

export function initAuth(){
  firebase.auth().onAuthStateChanged(user=>{
    /* Sessão anônima da versão antiga continua salva no navegador e é aceita como login:
       cada aparelho tem um UID diferente e a regra só serve para um deles. Derruba e exige Google. */
    if(user&&user.isAnonymous){
      firebase.auth().signOut();
      toast('Sessão anônima antiga encerrada — entre com o Google');
      return;                                   // signOut dispara este callback de novo com null → abre o portão
    }
    authUser=user||null;
    if(user){
      __set_authReady(true); modoLocal=false;
      fecharPortao();
      renderConta();
      setSync('conectando','');
      attachSync();
      attachFinSync();
    }else{
      __set_authReady(false);
      try{ db.ref(ROOT).off(); }catch(e){}
      __set_syncAttached(false); __set_syncPronto(false);
      detachFinSync();
      renderConta();
      setSync('local','você não está autenticado — nada sobe para a nuvem');
      if(!modoLocal) abrirPortao();
    }
  });
  // conclui o fluxo de redirect (usado quando o popup é bloqueado)
  try{ firebase.auth().getRedirectResult().catch(err=>{ if(err&&err.code)loginErro(err); }); }catch(e){}
}
export function entrarComGoogle(){
  const prov=new firebase.auth.GoogleAuthProvider();
  prov.setCustomParameters({prompt:'select_account'});
  setLoginMsg('Abrindo o Google…','');
  firebase.auth().signInWithPopup(prov).catch(err=>{
    const c=err&&err.code;
    if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request'){ setLoginMsg('',''); return; }
    if(c==='auth/popup-blocked'||c==='auth/operation-not-supported-in-this-environment'){
      setLoginMsg('Popup bloqueado — redirecionando…','');
      firebase.auth().signInWithRedirect(prov).catch(e=>loginErro(e));
      return;
    }
    loginErro(err);
  });
}
export function loginErro(err){
  const c=(err&&err.code)||'', host=(typeof location!=='undefined'?location.hostname:'seu domínio');
  let msg='Falha no login: '+(c||err);
  if(c==='auth/unauthorized-domain')
    msg=`O domínio <b>${h(host)}</b> não está autorizado. Firebase Console → Authentication → Settings → Domínios autorizados → adicione <b>${h(host)}</b>.`;
  else if(c==='auth/operation-not-allowed')
    msg='O provedor Google está desativado. Firebase Console → Authentication → Sign-in method → ative <b>Google</b>.';
  else if(c==='auth/configuration-not-found')
    msg='Authentication não está habilitado neste projeto do Firebase.';
  else if(c==='auth/network-request-failed')
    msg='Sem conexão com o Google. Você pode seguir offline por enquanto.';
  console.error('login:',c,err);
  setLoginMsg(msg,'erro');
}
/* Sair NÃO bastava: o espelho local (estudos + finanças) ficava no navegador e o botão
   "Usar só neste aparelho" do portão abria essa cópia sem login. Em computador que não é
   seu (ex.: TRE), sair tem que limpar o aparelho. Só limpa se a nuvem estiver em dia. */
export function limparAparelho(){
  try{ Object.keys(localStorage).filter(k=>k.startsWith('planner_')).forEach(k=>localStorage.removeItem(k)); }catch(e){}
}
export function sair(){
  if(!confirm('Sair da conta?'))return;
  let limpar=confirm('Apagar também os dados guardados NESTE aparelho?\n\nOK = recomendado em computador que não é só seu (os dados continuam na nuvem).\nCancelar = manter a cópia local.');
  if(limpar&&SYNC_ST.estado!=='ok'){
    limpar=confirm('ATENÇÃO: a sincronização não está confirmada ('+(SYNC_INFO[SYNC_ST.estado]||{}).txt+').\nApagar agora pode perder o que ainda não subiu.\n\nApagar mesmo assim?');
  }
  firebase.auth().signOut().then(()=>{
    if(limpar){ limparAparelho(); location.reload(); }   // reload zera também o que está na memória
    else toast('Sessão encerrada — cópia local mantida');
  });
}
export function usarOffline(){
  modoLocal=true; fecharPortao();
  setSync('local','modo offline escolhido por você — nada sobe para a nuvem');
  toast('Usando só neste aparelho — nada será sincronizado');
}

/* ---- portão de login ---- */
export function abrirPortao(){
  const el=document.getElementById('authGate'); if(!el)return;
  el.innerHTML=`<div class="gate-card">
      <div class="logo" style="margin:0 auto 14px">✷</div>
      <h2>Meu Planner</h2>
      <p>Entre com sua conta Google para sincronizar entre o computador e o celular.
         O login também é o que protege seus dados — sem ele, qualquer pessoa que abrisse o endereço do app teria acesso.</p>
      <button class="btn" style="width:100%;justify-content:center;margin-top:6px" onclick="entrarComGoogle()">Entrar com Google</button>
      <div id="gateMsg" class="gate-msg"></div>
      <button class="gate-link" onclick="usarOffline()">Usar só neste aparelho, sem sincronizar</button>
    </div>`;
  el.style.display='flex';
}
export function fecharPortao(){const el=document.getElementById('authGate'); if(el){el.style.display='none';el.innerHTML='';}}
export function setLoginMsg(msg,tipo){
  const el=document.getElementById('gateMsg'); if(!el)return;
  el.innerHTML=msg||''; el.className='gate-msg'+(tipo==='erro'?' erro':'');
}
export function renderConta(){
  const el=document.getElementById('contaBox'); if(!el)return;
  if(!authUser){
    el.innerHTML=`<button class="nav-item" onclick="abrirPortao()"><span class="ic">→</span> Entrar com Google</button>`;
    return;
  }
  const nome=authUser.displayName||authUser.email||'conta', ini=(nome[0]||'?').toUpperCase();
  el.innerHTML=`<div class="conta-row">
      ${authUser.photoURL?`<img src="${h(authUser.photoURL)}" alt="" referrerpolicy="no-referrer">`:`<i>${h(ini)}</i>`}
      <span title="${h(authUser.email||'')}">${h(nome)}</span>
      <button class="icon-btn" onclick="sair()" title="Sair">⇥</button>
    </div>`;
}
