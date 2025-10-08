# Etapa base
FROM node:20-alpine

# Dependências de build que algumas libs nativas podem precisar
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Só os manifests primeiro (cache melhor)
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --omit=dev

# Copia o resto do projeto
COPY . .

# Garante que pastas de escrita existam
RUN mkdir -p public/documentos/gerados public/uploads temp

# Exposição da porta do app
EXPOSE 3000

# Ambiente padrão
ENV NODE_ENV=production

# Sobe o servidor
CMD ["node", "server.js"]
