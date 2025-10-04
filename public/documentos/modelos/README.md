# Modelos de Documentos

Esta pasta contém os modelos base para geração de documentos.

## 📄 Tipos de documentos:

- documentos de prestação de serviços
- documentos de venda
- documentos de locação
- documentos personalizados

## 🔧 Como usar:

1. Coloque os modelos base aqui
2. Use marcadores específicos no Word para campos dinâmicos
3. Exemplo: `{{NOME_CLIENTE}}`, `{{CPF_CNPJ}}`, `{{DATA_ATUAL}}`

## 📋 Marcadores Disponíveis:

### Informações do Cliente:
- `{{NOME_CLIENTE}}` - Nome completo do cliente
- `{{CPF_CNPJ}}` - CPF ou CNPJ do cliente
- `{{RG}}` - RG do cliente
- `{{NACIONALIDADE}}` - Nacionalidade (padrão: brasileira)
- `{{ESTADO_CIVIL}}` - Estado civil (padrão: solteira)
- `{{PROFISSAO}}` - Profissão (padrão: funcionária pública)

### Endereço:
- `{{ENDERECO}}` - Endereço do cliente
- `{{CIDADE}}` - Cidade do cliente
- `{{UF}}` - Estado do cliente
- `{{ENDERECO_COMPLETO}}` - Endereço completo (endereço, cidade - UF)

### Contato:
- `{{TELEFONE}}` - Telefone do cliente
- `{{EMAIL}}` - E-mail do cliente

### Informações do Documento:
- `{{NUMERO_DOCUMENTO}}` - Número único do documento
- `{{DATA_ATUAL}}` - Data atual formatada (dd/mm/aaaa)

## 📝 Exemplo de Uso no Word:

```
CONTRATANTE: {{NOME_CLIENTE}}, {{NACIONALIDADE}}, {{ESTADO_CIVIL}}, {{PROFISSAO}}, 
portadora do RG: {{RG}}, CPF: {{CPF_CNPJ}}, com endereço eletrônico: {{EMAIL}}, 
residente e domiciliada na {{ENDERECO_COMPLETO}}.

Documento Nº: {{NUMERO_DOCUMENTO}}
Data: {{DATA_ATUAL}}
```

## ⚠️ Importante:

- Os marcadores são substituídos automaticamente pelo sistema
- Se um campo não existir no banco de dados, será substituído por uma string vazia
- Alguns campos têm valores padrão definidos no código
- O sistema preserva a formatação do Word (negrito, itálico, etc.) 