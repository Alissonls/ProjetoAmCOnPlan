"""
AWS Lambda para Consulta de Rede Credenciada AmCOn Saúde / Saúde Group
Compatível com Amazon Connect Contact Flows.

Recebe os parâmetros do fluxo do Amazon Connect:
- CPF: CPF do cliente coletado via Lex
- Regiao: Região informada pelo cliente (ex: Zona Sul, Centro, etc.)
- Especialidade: Especialidade médica (ex: Cardiologia, Pediatria, etc.)
- Plano: Nome do plano obtido via Customer Profiles (ex: Premium VIP, Básico, etc.)

Consulta o arquivo de médicos no Amazon S3 e retorna um dicionário plano (flat key-value)
para consumo direto no Amazon Connect ($.External.NomeMedico, etc.).
"""

import os
import json
import logging
import unicodedata
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client('s3')

S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'amcon-rede-credenciada-505599751703')
S3_KEY_NAME = os.environ.get('S3_KEY_NAME', 'rede_credenciada.json')

# Base de contingência local para testes caso o S3 ainda não esteja populado
FALLBACK_DATABASE = [
    {
        "nome": "Dra. Mariana Silva Ribeiro",
        "especialidade": "Cardiologia",
        "regiao": "Centro",
        "endereco": "Avenida Paulista, 1200 - Conjunto 42, Bela Vista",
        "telefone": "(11) 3254-8900",
        "planos": ["Todos", "Premium VIP", "Master", "Essencial"]
    },
    {
        "nome": "Dr. Fernando Almeida Costa",
        "especialidade": "Cardiologia",
        "regiao": "Zona Sul",
        "endereco": "Rua Domingos de Morais, 2187 - Vila Mariana",
        "telefone": "(11) 5084-3320",
        "planos": ["Todos", "Premium VIP", "Master"]
    },
    {
        "nome": "Dra. Camila Nogueira Prado",
        "especialidade": "Pediatria",
        "regiao": "Zona Sul",
        "endereco": "Avenida Santo Amaro, 4500 - Brooklin",
        "telefone": "(11) 5543-1288",
        "planos": ["Todos", "Premium VIP", "Master", "Essencial"]
    },
    {
        "nome": "Dr. Lucas Vasconcelos",
        "especialidade": "Ortopedia",
        "regiao": "Zona Leste",
        "endereco": "Rua Tuiuti, 1850 - Tatuapé",
        "telefone": "(11) 2091-6677",
        "planos": ["Todos", "Premium VIP", "Master", "Essencial"]
    },
    {
        "nome": "Dra. Juliana Mendes Rocha",
        "especialidade": "Clínica Geral",
        "regiao": "Zona Oeste",
        "endereco": "Rua Teodoro Sampaio, 1420 - Pinheiros",
        "telefone": "(11) 3085-7140",
        "planos": ["Todos", "Premium VIP", "Master", "Essencial"]
    },
    {
        "nome": "Dr. Ricardo Guimarães Lima",
        "especialidade": "Clínica Geral",
        "regiao": "Zona Norte",
        "endereco": "Avenida Braz Leme, 1600 - Santana",
        "telefone": "(11) 2281-9900",
        "planos": ["Todos", "Premium VIP", "Master", "Essencial"]
    }
]


def normalizar_texto(texto: str) -> str:
    """Remove acentos, pontuação e converte para minúsculas para comparação flexível."""
    if not texto:
        return ""
    texto = str(texto).strip().lower()
    # Remove acentuação
    nfkd = unicodedata.normalize('NFKD', texto)
    sem_acento = "".join([c for c in nfkd if not unicodedata.combining(c)])
    return sem_acento


def buscar_rede_s3():
    """Busca o catálogo de médicos no bucket S3 configurado."""
    try:
        logger.info(f"Tentando ler s3://{S3_BUCKET_NAME}/{S3_KEY_NAME}")
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=S3_KEY_NAME)
        conteudo = response['Body'].read().decode('utf-8')
        dados = json.loads(conteudo)
        logger.info(f"Rede credenciada carregada com sucesso do S3: {len(dados)} registros.")
        return dados
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', '')
        logger.warning(f"Aviso S3 ({error_code}): {e}. Utilizando base de contingência.")
        return FALLBACK_DATABASE
    except Exception as e:
        logger.error(f"Erro inesperado ao consultar S3: {e}. Utilizando contingência.")
        return FALLBACK_DATABASE


def lambda_handler(event, context):
    """Handler principal acionado pelo Amazon Connect."""
    logger.info("Evento recebido do Amazon Connect: " + json.dumps(event, ensure_ascii=False))

    # O Amazon Connect envia os parâmetros em event['Details']['Parameters']
    params = event.get('Details', {}).get('Parameters', {})
    
    cpf_cliente = params.get('CPF', '').strip()
    regiao_solicitada = params.get('Regiao', '').strip()
    especialidade_solicitada = params.get('Especialidade', '').strip()
    plano_cliente = params.get('Plano', 'Padrao').strip()

    logger.info(f"Consulta - CPF: {cpf_cliente} | Regiao: {regiao_solicitada} | Especialidade: {especialidade_solicitada} | Plano: {plano_cliente}")

    regiao_norm = normalizar_texto(regiao_solicitada)
    especialidade_norm = normalizar_texto(especialidade_solicitada)

    medicos = buscar_rede_s3()

    # Busca por correspondência exata ou parcial de Região e Especialidade
    medico_encontrado = None

    for m in medicos:
        m_regiao = normalizar_texto(m.get('regiao', ''))
        m_especialidade = normalizar_texto(m.get('especialidade', ''))
        
        # Confere especialidade (ex: "cardiologia" in "cardiologia clinica")
        match_esp = (especialidade_norm in m_especialidade) or (m_especialidade in especialidade_norm) if especialidade_norm else True
        
        # Confere região (ex: "sul" in "zona sul")
        match_reg = (regiao_norm in m_regiao) or (m_regiao in regiao_norm) if regiao_norm else True

        if match_esp and match_reg:
            medico_encontrado = m
            break

    # Se não encontrou na região específica, busca pela especialidade em qualquer região próxima
    if not medico_encontrado and especialidade_norm:
        for m in medicos:
            m_especialidade = normalizar_texto(m.get('especialidade', ''))
            if (especialidade_norm in m_especialidade) or (m_especialidade in especialidade_norm):
                medico_encontrado = m
                break

    # IMPORTANTE PARA O AMAZON CONNECT:
    # A resposta DEVE ser um dicionário plano (apenas strings ou números)
    # Valores acessados no Contact Flow como $.External.NomeMedico, $.External.Status, etc.
    if medico_encontrado:
        resposta = {
            "Status": "FOUND",
            "NomeMedico": str(medico_encontrado.get('nome', 'Profissional Credenciado')),
            "Endereco": str(medico_encontrado.get('endereco', 'Endereço disponível na central')),
            "Telefone": str(medico_encontrado.get('telefone', '0800 770 2026')),
            "Especialidade": str(medico_encontrado.get('especialidade', especialidade_solicitada)),
            "Regiao": str(medico_encontrado.get('regiao', regiao_solicitada))
        }
    else:
        resposta = {
            "Status": "NOT_FOUND",
            "NomeMedico": "",
            "Endereco": "",
            "Telefone": "",
            "Especialidade": especialidade_solicitada,
            "Regiao": regiao_solicitada
        }

    logger.info("Resposta enviada ao Amazon Connect: " + json.dumps(resposta, ensure_ascii=False))
    return resposta
