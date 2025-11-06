FROM node:20-alpine
WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

EXPOSE 4002
ENV NEST_PORT=4002

# Start Nest using ts-node ESM loader
CMD ["node", "--loader", "ts-node/esm", "src/main.ts"]