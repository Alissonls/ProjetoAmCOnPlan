# Guia de Conexão e Melhoria do Fluxo Amazon Connect + AWS Lambda + S3

Este guia detalha o que foi corrigido e o passo a passo para conectar e publicar o fluxo com sucesso na AWS.

---

## 🔍 O que foi identificado e corrigido no seu Fluxo

1. **Falta do ARN da Lambda (Erro Crítico):**
   - No fluxo original, o bloco `Lambda S3 Rede Credenciada` não possuía a propriedade `LambdaFunctionARN`. O Amazon Connect não sabia qual função chamar.
   - **Correção:** Adicionado o ARN `arn:aws:lambda:us-east-1:505599751703:function:AmCOn-ConsultaRedeCredenciada` e configurado o timeout seguro de 8 segundos.

2. **Tratamento de "Médico Não Encontrado" (Novo Bloco de Validação):**
   - Anteriormente, o fluxo ia direto da Lambda para a fala `Informar Medico Credenciado`. Se a Lambda não encontrasse um médico para aquela combinação de região/especialidade, a voz falava dados vazios ou travava.
   - **Correção:** Inserido o bloco **`Verificar Retorno Medico`** (que valida `$.External.Status == "FOUND"`). Se não encontrar, reproduz um áudio amigável (`Aviso Medico Nao Encontrado`) e transfere com contexto para a fila humana.

3. **Tolerância a Falhas na Consulta:**
   - Adicionado o bloco **`Aviso Falha Consulta`** caso ocorra indisponibilidade temporária de rede ou permissão na Lambda, avisando o cliente com elegância antes de transferir.

---

## 🚀 Passo a Passo de Implantação na AWS

### Passo 1: Criar a Função Lambda na AWS
1. Acesse o **AWS Lambda Console** na região `us-east-1` (N. Virginia):
   - Nome da função: `AmCOn-ConsultaRedeCredenciada`
   - Runtime: **Python 3.12**
   - Arquitetura: `x86_64`
2. No editor de código, cole o conteúdo do arquivo [`aws/lambda_function.py`](file:///c:/Users/PoSa/Documents/ProjetoAmCOnPlan/aws/lambda_function.py).
3. Clique em **Deploy**.
4. (Opcional) Na aba **Configuration > Environment variables**, adicione:
   - `S3_BUCKET_NAME`: nome do seu bucket (ex: `amcon-rede-credenciada-505599751703`)
   - `S3_KEY_NAME`: `rede_credenciada.json`

---

### Passo 2: Subir a Base no Amazon S3
1. Crie um bucket no S3 na mesma região (`us-east-1`):
   - Exemplo: `amcon-rede-credenciada-505599751703`
2. Faça o upload do arquivo [`aws/rede_credenciada.json`](file:///c:/Users/PoSa/Documents/ProjetoAmCOnPlan/aws/rede_credenciada.json).
3. Na role de execução da Lambda, certifique-se de que há permissão `s3:GetObject` no bucket (ou anexe a política gerenciada `AmazonS3ReadOnlyAccess`).

> *Nota: O código da Lambda possui base de contingência local embutida. Mesmo se o S3 estiver temporariamente indisponível, a consulta continuará respondendo!*

---

### Passo 3: Associar a Lambda à Instância do Amazon Connect ⚠️ (Passo Obrigatório!)
O Amazon Connect exige autorização prévia para permitir a chamada da Lambda.

**Opção A — Pelo Console AWS:**
1. Abra o console do **Amazon Connect** > clique no alias da sua instância (`986b30c7-64ec-4ea8-a172-b4584705ff8f`).
2. No menu lateral esquerdo, clique em **Flows** (Fluxos).
3. Role até a seção **AWS Lambda**.
4. Selecione a função `AmCOn-ConsultaRedeCredenciada` e clique em **+ Add Lambda Function** (Adicionar função Lambda).

**Opção B — Pelo AWS CLI:**
```bash
aws connect associate-lambda-function \
  --instance-id 986b30c7-64ec-4ea8-a172-b4584705ff8f \
  --function-arn arn:aws:lambda:us-east-1:505599751703:function:AmCOn-ConsultaRedeCredenciada \
  --region us-east-1
```

---

### Passo 4: Importar o Fluxo Aperfeiçoado no Amazon Connect
1. Abra o painel de administração do seu **Amazon Connect** (CCP Admin).
2. Vá em **Routing > Contact Flows** (Roteamento > Fluxos de Contato).
3. Abra o fluxo existente ou crie um novo.
4. No canto superior direito, clique na seta ao lado de "Save" e selecione **Import flow** (Importar fluxo).
5. Selecione o arquivo [`aws/fluxo_amcon_saude_conectado.json`](file:///c:/Users/PoSa/Documents/ProjetoAmCOnPlan/aws/fluxo_amcon_saude_conectado.json).
6. Verifique os blocos na tela gráfica e clique em **Save** e depois em **Publish**.
