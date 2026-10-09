import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoCpf, CampoTelefone } from "@/modules/sorteios/components/publico/CamposPublico";
import { iniciarAcessoFotos, verificarTelefoneFotos } from "@/lib/foto-express-portal.functions";
import { validarCpf } from "@/modules/sorteios/validations/cliente";
import { gravarFluxoFotos, limparFluxoFotos } from "./fluxo";
import { telefoneRaw } from "@/lib/format";

export function FormularioAcessoFotos() {
  const navigate=useNavigate(); const iniciar=useServerFn(iniciarAcessoFotos); const verificar=useServerFn(verificarTelefoneFotos);
  const[cpf,setCpf]=useState(""); const[telefone,setTelefone]=useState(""); const[lembrar,setLembrar]=useState(false); const[passo,setPasso]=useState<1|2>(1); const[erro,setErro]=useState(""); const[carregando,setCarregando]=useState(false); const[dica,setDica]=useState<{nome?:string|null;final?:string|null}>({});
  async function continuar(){setErro("");setCarregando(true);try{if(passo===1){const v=validarCpf(cpf);if(!v.ok){setErro(v.erro??"CPF inválido.");return;}const r=await iniciar({data:{cpf},signal:AbortSignal.timeout(15000)});if(!r.ok){setErro(r.mensagem);return;}setDica({nome:r.dados.nome,final:r.dados.telefoneFinal});gravarFluxoFotos({cpf,encontrado:r.dados.encontrado,nome:r.dados.nome,telefoneFinal:r.dados.telefoneFinal});setPasso(2);return;}if(telefoneRaw(telefone).length<10){setErro("Informe o telefone com DDD.");return;}const r=await verificar({data:{cpf,telefone,lembrar},signal:AbortSignal.timeout(15000)});if(!r.ok){setErro(r.mensagem);return;}if(r.dados.etapa==="cadastro"||r.dados.etapa==="completar"){gravarFluxoFotos({cpf,telefone,lembrar,...("faltantes" in r.dados?{faltantes:r.dados.faltantes}:{})});void navigate({to:"/fotos/cadastro"});}else{limparFluxoFotos();void navigate({to:"/fotos/trabalhos"});}}catch{setErro("Não foi possível conectar ao portal. Tente novamente.");}finally{setCarregando(false);}}
  return <Card className="border-border/70 shadow-card"><CardContent className="space-y-5 p-6">{passo===1?<CampoCpf valor={cpf} aoMudar={setCpf} autoFocus/>:<><div>{dica.nome&&<p className="font-medium">Olá, {dica.nome}!</p>}{dica.final&&<p className="text-sm text-muted-foreground">Confirme o telefone terminado em ****-{dica.final}</p>}</div><CampoTelefone valor={telefone} aoMudar={setTelefone} autoFocus/><label className="flex items-center gap-3 text-sm"><Checkbox checked={lembrar} onCheckedChange={v=>setLembrar(v===true)}/>Lembrar neste dispositivo</label></>}{erro&&<p className="text-sm text-destructive">{erro}</p>}<Button className="h-12 w-full text-base" disabled={carregando} onClick={()=>void continuar()}>{carregando&&<Loader2 className="animate-spin"/>}Continuar</Button>{passo===2&&<Button variant="ghost" className="w-full" onClick={()=>{setPasso(1);setTelefone("")}}>Usar outro CPF</Button>}</CardContent></Card>;
}