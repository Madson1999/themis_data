# Themis Data

Sistema de gerenciamento de dados com Node.js, Express e MySQL.

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone [url-do-repositorio]
cd themis_data
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o banco de dados**

   a. Crie um arquivo `.env` na raiz do projeto:
   ```bash
   cp env.example .env
   ```

   b. Edite o arquivo `.env` com suas configurações:
   ```env
   # Configurações do Banco de Dados
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=sua_senha_aqui
   DB_NAME=themis_data
   DB_PORT=3306

   # Configurações do Servidor
   PORT=3000
   NODE_ENV=development

   # Configurações de Segurança
   JWT_SECRET=sua_chave_secreta_aqui
   SESSION_SECRET=outra_chave_secreta_aqui
   ```

4. **Configure o MySQL**
   - Certifique-se de que o MySQL está instalado e rodando
   - Crie um banco de dados chamado `themis_data`
   ```sql
   CREATE DATABASE themis_data;
   ```

5. **Inicie o servidor**
```bash
npm start
```

## 📊 Funcionalidades

- ✅ Sistema de login seguro com bcrypt
- ✅ menu com estatísticas em tempo real
- ✅ Logs de acesso automáticos
- ✅ Gerenciamento de usuários
- ✅ Interface responsiva e moderna

## 🔐 Credenciais Padrão

- **Email:** `admin@exemplo.com`
- **Senha:** `123456`

## 📁 Estrutura do Projeto

```
themis_data/
├── config/
│   └── database.js          # Configuração do banco de dados
├── public/
│   ├── images/              # Imagens do projeto
│   ├── login.html           # Página de login
│   └── menu.html       # menu principal
├── server.js                # Servidor principal
├── package.json             # Dependências
├── env.example              # Exemplo de variáveis de ambiente
└── README.md               # Este arquivo
```

## 🗄️ Tabelas do Banco de Dados

O sistema cria automaticamente as seguintes tabelas:

- **usuarios**: Armazena informações dos usuários
- **logs_acesso**: Registra todos os acessos ao sistema
- **configuracoes**: Configurações gerais do sistema

## 🔧 Desenvolvimento

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

## 📝 Logs

O sistema registra automaticamente:
- Logins e logouts
- IP do usuário
- User-Agent do navegador
- Data e hora de acesso

## 🛡️ Segurança

- Senhas criptografadas com bcrypt
- Proteção contra SQL injection
- Validação de entrada
- Logs de segurança 