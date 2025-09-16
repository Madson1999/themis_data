# Themis Data

Sistema de gerenciamento de processos jurídicos desenvolvido com **Node.js**, **Express** e **MySQL**.

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone git@github.com:Madson1999/themis_data.git
cd themis_data
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o ambiente**
   - Copie o arquivo `.env` de exemplo:
     ```bash
     cp env.example .env
     ```
   - Edite suas credenciais no `.env`:
     ```env
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=sua_senha
     DB_NAME=themis_data
     DB_PORT=3306

     PORT=3000
     NODE_ENV=development
     ```

4. **Configure o MySQL**
   ```sql
   CREATE DATABASE themis_data;
   ```

5. **Inicie o servidor**
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

---

## 📊 Funcionalidades

- ✅ Login seguro com bcrypt + cookies de sessão  
- ✅ Painel com estatísticas em tempo real  
- ✅ Logs de acesso automáticos  
- ✅ Gerenciamento de usuários e permissões (admin, advogado, estagiário)  
- ✅ Cadastro e busca de clientes (por nome e/ou CPF/CNPJ)  
- ✅ Criação e gerenciamento de **ações/processos** (Kanban)  
- ✅ Upload/remoção de documentos organizados em pastas  
- ✅ Aprovação, comentários e controle de status das ações  
- ✅ Protocolação e geração de contratos em Word (.docx)  

---

## 📁 Estrutura do Projeto

```
themis_data/
├── src/
│   ├── app.js                  # Configuração principal do Express
│   ├── server.js               # Entry point
│   ├── config/                 # Configurações (DB, contratos)
│   ├── controllers/            # Controladores (lógica HTTP)
│   ├── services/               # Regras de negócio (DB + filesystem)
│   ├── routes/                 # Rotas agrupadas por domínio
│   ├── middlewares/            # Autenticação, validação, erros
│   ├── utils/                  # Utilitários (asyncHandler, uploads, etc.)
│   └── validators/             # Schemas de validação (ex.: Zod)
├── public/                     # Arquivos estáticos (HTML/CSS/JS)
├── env.example                 # Exemplo de variáveis de ambiente
├── package.json
└── README.md
```

---

## 🗄️ Tabelas do Banco

Criadas/geridas automaticamente pelo sistema:

- **usuarios** → dados de login/permissões  
- **logs_acesso** → auditoria (IP, agente, data)  
- **cliente** → dados de clientes  
- **acoes** → processos/ações vinculados a clientes  
- **contratos** → registros de contratos gerados  

---

## 🔐 Credenciais Padrão (exemplo)

- **Email:** `admin@exemplo.com`  
- **Senha:** `123456`  

---

## 🛡️ Segurança

- Senhas com hash via bcrypt  
- Proteção contra SQL Injection (prepared statements)  
- Middleware de validação (Zod/Joi/Yup)  
- Logs de acesso e auditoria  

---

## 📝 Logs

O sistema registra automaticamente:
- Logins e logouts
- IP e navegador do usuário
- Data e hora de cada acesso  
