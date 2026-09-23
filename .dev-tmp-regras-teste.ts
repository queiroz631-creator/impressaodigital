import { extrairPorRegras } from "@/lib/curriculo-regras";

const texto = `CURRÍCULO
JOÃO BATISTA DA SILVA
Brasileiro, solteiro, nascido em 12/05/1992
CPF: 529.982.247-25
CELULAR: (43) 99695-8591  |  Telefone: (43) 3323-1234
E-mail: joao.silva@email.com.br
Endereço: Rua das Palmeiras
Número: 145
Bairro: Jardim América
Cidade: Londrina
UF: PR
CEP: 86015-400
Escolaridade: Ensino Médio Completo
CNH categoria B
Objetivo: Atuar na área de logística.

EXPERIÊNCIA PROFISSIONAL
Log Brasil Transportes - Auxiliar de Logística
03/2021 - Atual
Separação e conferência de mercadorias.
Carga e descarga de veículos.

Supermercado Bom Preço - Repositor
02/2018 - 12/2020
Reposição de mercadorias e atendimento ao cliente.

CURSOS
Auxiliar de Logística - Senai - 2020
Informática Básica - Microlins - 2019

HABILIDADES
Organização, trabalho em equipe, pontualidade`;

const r = extrairPorRegras(texto);
console.log(JSON.stringify(r, null, 1));
